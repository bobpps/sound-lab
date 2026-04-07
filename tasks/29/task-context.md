# Task Context - Issue #29

## Issue
- **Number:** 29
- **Title:** Task 28: Backend - Realtime WebSocket infrastructure + types
- **URL:** https://github.com/bobpps/sound-lab/issues/29
- **State:** OPEN

## Branch & Worktree
- **Branch:** `feat/29-realtime-websocket-infra`
- **Worktree:** `F:\InterviewProj\sources\sound-lab-issue-29`

## Requested Scope

### Files from the issue
- Modify: `backend/package.json`
- Modify: `backend/src/app.ts`
- Create: `backend/src/providers/realtime/types.ts`
- Create: `backend/src/providers/realtime/registry.ts`
- Create: `backend/src/routes/realtime/index.ts`

### Additional files likely needed for a clean implementation
- Create: `backend/src/plugins/realtime.ts`
- Create: `backend/tests/routes/realtime.test.ts`
- Create: `backend/tests/providers/realtime-registry.test.ts`

## Key Findings From the Current Codebase

1. `backend/src/app.ts` already follows a plugin/decorator pattern:
   - `dbPlugin`
   - `ttsPlugin`
   - `llmPlugin`
   - route autoload from `backend/src/routes`

2. Provider factories are exposed through Fastify decorators:
   - `fastify.createTTSProvider(...)`
   - `fastify.createLLMProvider(...)`
   - Realtime should fit the same pattern via `fastify.createRealtimeProvider(...)`.

3. The database layer already supports realtime providers:
   - `ProviderType = 'tts' | 'llm' | 'realtime'`
   - migrations already allow `realtime`
   - bootstrap seeds already include:
     - `openai-realtime`
     - `gemini-realtime`
     - `elevenlabs-realtime`
     - `inworld-realtime`

4. Existing HTTP routes (`tts`, `llm`) share the same resolution pattern:
   - load provider from DB
   - assert provider type
   - load decrypted API key
   - build provider through Fastify decorator
   - return `400` for unsupported providers or missing keys

5. `@fastify/websocket` has two implementation constraints that matter here:
   - the websocket plugin must be registered before route autoload
   - `socket.on('message', ...)` handlers must be attached synchronously, otherwise early messages can be dropped

6. `@fastify/websocket` exposes `injectWS`, which gives us a realistic test path for the session endpoint.

## Dependencies
- **Not blocked by later realtime provider tasks**: this issue only needs the infrastructure, not concrete OpenAI/Gemini/ElevenLabs/Inworld adapters.
- **Follow-up tasks**:
  - #30 / project Task 29 - OpenAI realtime provider
  - #31 / project Task 30 - Gemini realtime provider
  - #32 / project Task 31 - ElevenLabs realtime provider
  - #33 / project Task 32 - Inworld realtime provider

## Important Design Tension To Resolve During Implementation

The full-project plan shows generic provider examples such as `openai` and `gemini`, but the seeded realtime provider IDs in the database are:
- `openai-realtime`
- `gemini-realtime`
- `elevenlabs-realtime`
- `inworld-realtime`

That mismatch should be resolved in the infrastructure task itself. The cleanest default is to use the seeded IDs end-to-end in the registry and routes, instead of introducing an extra ID translation layer.
