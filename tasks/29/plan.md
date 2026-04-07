# Realtime WebSocket Infrastructure - Implementation Plan

**Goal:** add the backend infrastructure for realtime voice sessions in Fastify: websocket support, realtime provider contracts, provider factory wiring, and a route scaffold that later provider adapters can plug into.

**Architecture direction:** follow the existing backend pattern:
- Fastify plugin decorates the app with a provider factory
- route resolves provider metadata from the DB
- provider registry owns adapter construction
- route tests mock the factory instead of reaching real external services

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `backend/package.json` | add websocket dependency |
| Modify | `backend/src/app.ts` | register websocket + realtime plugin before autoload |
| Create | `backend/src/plugins/realtime.ts` | Fastify decorator for `createRealtimeProvider` |
| Create | `backend/src/providers/realtime/types.ts` | session config, events, session contract, provider interface |
| Create | `backend/src/providers/realtime/registry.ts` | empty registry + registration API |
| Create | `backend/src/routes/realtime/index.ts` | models REST endpoint + websocket session endpoint |
| Create | `backend/tests/providers/realtime-registry.test.ts` | registry behavior tests |
| Create | `backend/tests/routes/realtime.test.ts` | HTTP + websocket route tests |

## Step 1: Add Realtime Plugin Wiring

- [ ] Install `@fastify/websocket` in `backend`
- [ ] Add `backend/src/plugins/realtime.ts`
- [ ] Expose `fastify.createRealtimeProvider(providerId, apiKey)` through a Fastify decorator
- [ ] Register the websocket plugin in `backend/src/app.ts`
- [ ] Register the realtime factory plugin in `backend/src/app.ts`

Implementation note:
- Register `@fastify/websocket` before route autoload so websocket routes are intercepted correctly.
- If TypeScript requires it, add `@types/ws` to `backend` devDependencies. The official `@fastify/websocket` README recommends that for TS projects.

## Step 2: Define Realtime Contracts

- [ ] Create `backend/src/providers/realtime/types.ts`
- [ ] Keep the issue-specified contract, but split the session return type into a named interface for clarity

Recommended shape:

```ts
export interface RealtimeSessionConfig {
  model: string;
  systemPrompt: string;
  voice?: string;
}

export interface RealtimeEvent {
  type: 'transcript' | 'audio' | 'error' | 'session_start' | 'session_end';
  data: unknown;
}

export interface IRealtimeSession {
  sendAudio(chunk: Buffer): void | Promise<void>;
  close(): Promise<void>;
}

export interface IRealtimeProvider {
  readonly id: string;
  readonly name: string;
  getModels(): Promise<string[]>;
  createSession(
    config: RealtimeSessionConfig,
    onEvent: (event: RealtimeEvent) => void,
  ): Promise<IRealtimeSession>;
}
```

Why this matters:
- later provider adapters will share one stable contract
- the route can manage session lifecycle without caring about adapter internals

## Step 3: Build the Registry

- [ ] Create `backend/src/providers/realtime/registry.ts`
- [ ] Store provider constructors in a mutable record
- [ ] Export:
  - `createRealtimeProvider(providerId, apiKey)`
  - `registerRealtimeProvider(providerId, ctor)`
  - `getSupportedRealtimeProviders()`

Design choice:
- Use the seeded realtime provider IDs directly in the registry:
  - `openai-realtime`
  - `gemini-realtime`
  - `elevenlabs-realtime`
  - `inworld-realtime`
- Do not introduce aliasing at this stage unless a concrete provider task forces it.

## Step 4: Implement the Route Scaffold

- [ ] Create `backend/src/routes/realtime/index.ts`
- [ ] Reuse the same provider resolution pattern as `tts` and `llm`
- [ ] Add `GET /realtime/:providerId/models`
- [ ] Add websocket `GET /realtime/:providerId/session`

### Route behavior for `GET /realtime/:providerId/models`

- validate that the DB provider exists
- validate `provider.type === 'realtime'`
- validate that an API key exists
- construct the provider through `fastify.createRealtimeProvider(...)`
- return `provider.getModels()`
- return:
  - `404` for missing or wrong-type providers
  - `400` for missing API keys or unsupported provider IDs

### Route behavior for websocket `GET /realtime/:providerId/session`

- attach the message listener synchronously as soon as the handler starts
- maintain route-local state:
  - `sessionPromise` or `session`
  - `sessionStarted`
  - `sessionClosed`
- expect the first meaningful message to be `session_start`
- on `session_start`:
  - parse config
  - create provider session
  - forward provider events back to the client via `socket.send(JSON.stringify(event))`
- on `audio`:
  - reject if the session has not started yet
  - decode base64 to `Buffer`
  - pass audio to `session.sendAudio(...)`
- on `session_end`:
  - close the provider session
  - optionally close the socket cleanly after provider teardown
- on socket close/error:
  - close the provider session exactly once

### Guardrails to include

- malformed JSON should not crash the process
- duplicate `session_start` should be ignored or turned into an error event
- `audio` before `session_start` should return an error event instead of silently failing
- provider callback should check that the socket is still open before sending
- session cleanup should be idempotent

## Step 5: Test the Infrastructure Properly

- [ ] Create `backend/tests/providers/realtime-registry.test.ts`
- [ ] Create `backend/tests/routes/realtime.test.ts`

### Registry tests

- `createRealtimeProvider()` returns a registered stub provider
- unsupported provider ID throws
- `getSupportedRealtimeProviders()` reflects registered IDs

### HTTP route tests

- `GET /realtime/:providerId/models` returns model list
- returns `404` when provider is missing
- returns `404` when provider exists but is not `realtime`
- returns `400` when API key is missing
- returns `400` when registry does not support the provider

### WebSocket route tests using `injectWS`

- `session_start` creates a provider session
- `audio` forwards decoded bytes to `sendAudio`
- `session_end` closes the provider session
- socket close closes the provider session
- invalid JSON does not crash the handler

Test strategy:
- mock `app.createRealtimeProvider`
- use a stub session object with spies for `sendAudio` and `close`
- seed providers in the test DB with `type: 'realtime'`

## Recommended Execution Order

1. Add dependency and plugin wiring
2. Add contracts and registry
3. Write registry tests
4. Write route tests, including websocket tests
5. Implement route scaffold until tests pass
6. Run full backend test suite

## Verification

- `npm run test --workspace=backend`
- targeted pass for `backend/tests/routes/realtime.test.ts`
- targeted pass for `backend/tests/providers/realtime-registry.test.ts`

## Expected Outcome

After this task lands:
- the backend can accept websocket realtime sessions
- later provider tasks only need to implement adapters and register them
- the frontend can already rely on stable endpoints:
  - `GET /realtime/:providerId/models`
  - `WS /realtime/:providerId/session`
