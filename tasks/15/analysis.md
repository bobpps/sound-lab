# Analysis: Issue #15 -- LLM API Routes (models + complete)

## What the Task Requires

Two HTTP endpoints that expose the LLM provider adapters over HTTP:

### `GET /llm/:providerId/models`

- **Response:** `200` with `string[]` (array of model ID strings)
- **Errors:** `404` if provider not found or not type `llm`, `400` if no API key configured or provider unsupported by registry

### `POST /llm/:providerId/complete`

- **Request body:**
  ```json
  {
    "messages": [{ "role": "system"|"user"|"assistant", "content": "string" }],
    "model": "gpt-4o"
  }
  ```
- **Response:** `200` with `{ text: string }`
- **Errors:** same as above, plus `400` for invalid body

The pattern must mirror the TTS routes exactly: look up provider in DB, verify type, decrypt API key, instantiate adapter via registry factory, call method.

---

## Constraints from Project Guidance

Source: `CLAUDE.md` (root), `backend/CLAUDE.md`

| Constraint | Detail |
|---|---|
| **TypeBox schemas** | All request/response types via `@sinclair/typebox`. `Type.Object()` for bodies must use `{ additionalProperties: false }`. |
| **Response schemas required** | Every endpoint must define response schemas for `fast-json-stringify` and data-leak prevention. |
| **ESM `.js` extensions** | All imports must use `.js` extensions (ESM everywhere). |
| **App factory pattern** | `buildApp()` in `app.ts` returns configured Fastify instance; tests use `app.inject()`. |
| **`@fastify/autoload`** | Route files in `backend/src/routes/<dir>/index.ts` auto-register with directory name as prefix. So `routes/llm/index.ts` becomes `/llm/*`. |
| **`FastifyPluginAsyncTypebox`** | Route plugin type for automatic TypeBox type inference. |
| **Provider as fp plugin** | Provider factory is registered as a Fastify decorator via `fastify-plugin` (global scope). See `plugins/tts.ts`. |
| **`@fastify/sensible` errors** | Use `reply.notFound()`, `reply.badRequest()` for error responses. |
| **TDD** | Write tests first (RED), then implement (GREEN), then refactor. |
| **`vi.restoreAllMocks()`** | In `afterEach` for every test file. |

---

## Key Files and Systems

### Files Read During Analysis

| File | Purpose |
|---|---|
| `backend/src/routes/tts/index.ts` | **Primary pattern to replicate.** TTS route plugin with `resolveTTSProvider()` helper + 2 endpoints. |
| `backend/tests/routes/tts.test.ts` | **Test pattern to replicate.** Uses `buildTestApp()`, overrides decorator, seeds DB provider + key. |
| `backend/src/providers/llm/types.ts` | `ILLMProvider` interface: `getModels(): Promise<string[]>`, `complete(messages, model): Promise<string>`, `validateCredentials()`. |
| `backend/src/providers/llm/registry.ts` | `createLLMProvider(providerId, apiKey): ILLMProvider` factory. Supports `openai` and `anthropic`. |
| `backend/src/providers/llm/openai.ts` | OpenAI adapter implementing `ILLMProvider`. |
| `backend/src/providers/llm/anthropic.ts` | Anthropic adapter implementing `ILLMProvider`. |
| `backend/src/app.ts` | `buildApp()` registers plugins: `dbPlugin`, `ttsPlugin`, then autoloads routes. Must add `llmPlugin` here. |
| `backend/src/plugins/tts.ts` | TTS plugin pattern: `fp()` wrapper, `declare module 'fastify'` for decorator type, exports factory type. |
| `backend/src/plugins/db.ts` | DB plugin pattern: decorator + onClose hook. |
| `backend/src/schemas/tts.ts` | TTS schema pattern: `ProviderIdParam`, body schemas with `additionalProperties: false`, response type schemas. |
| `backend/src/schemas/common.ts` | `ErrorResponse` schema reused in all route response definitions. |
| `backend/src/db/interfaces.ts` | `IProviderRepository`: `getById(id)`, `getDecryptedKey(id)`, `setKey(id, key)`. |
| `backend/src/db/types.ts` | `Provider` type: `{ id, name, type: 'tts'|'llm'|'realtime', enabled, created_at }`. |
| `backend/src/db/local/crypto.ts` | AES-256-GCM encryption/decryption for API keys. Used transparently by the repository. |
| `backend/tests/helpers.ts` | `buildTestApp()` -- calls `buildApp({ testing: true })` + `app.ready()`. |
| `backend/src/schemas/provider.ts` | Reference for TypeBox schema patterns with `additionalProperties: false`. |

### Files to Create

| File | Purpose |
|---|---|
| `backend/src/plugins/llm.ts` | LLM provider factory decorator plugin (mirrors `plugins/tts.ts`). |
| `backend/src/schemas/llm.ts` | TypeBox schemas for LLM route params, bodies, and responses. |
| `backend/src/routes/llm/index.ts` | Route plugin with `resolveLLMProvider()` + 2 endpoints. |
| `backend/tests/routes/llm.test.ts` | Route tests (mirrors `tests/routes/tts.test.ts`). |

### Files to Modify

| File | Change |
|---|---|
| `backend/src/app.ts` | Import and register `llmPlugin` (alongside `ttsPlugin`). |

---

## The TTS Route Pattern (to replicate for LLM)

The TTS routes (`backend/src/routes/tts/index.ts`) follow this exact pattern:

### 1. Plugin structure

```typescript
const ttsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // helper + routes inside
};
export default ttsRoutes;
```

### 2. Provider resolution helper

```typescript
async function resolveTTSProvider(providerId, reply): Promise<ITTSProvider | null> {
  // Step 1: Look up provider in DB
  const provider = await fastify.db.providers.getById(providerId);
  if (!provider || provider.type !== 'tts') {
    reply.notFound(`TTS provider ${providerId} not found`);
    return null;
  }
  // Step 2: Get decrypted API key
  const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
  if (!apiKey) {
    reply.badRequest(`No API key configured for provider ${providerId}`);
    return null;
  }
  // Step 3: Create provider instance via decorator factory
  try {
    return fastify.createTTSProvider(providerId, apiKey);
  } catch {
    reply.badRequest(`Provider ${providerId} is not supported`);
    return null;
  }
}
```

### 3. Endpoint definitions

Each endpoint specifies:
- `schema.params` -- `ProviderIdParam` (reusable)
- `schema.body` -- request body with `additionalProperties: false` (POST only)
- `schema.response` -- `200` with success type, `400`/`404` with `ErrorResponse`
- Handler calls `resolveTTSProvider()`, returns early if `null`, then calls adapter method

### 4. Test pattern

- `buildTestApp()` to get a fresh app with in-memory DB
- Override the decorator: `(app as Record<string, unknown>).createTTSProvider = vi.fn(...)`
- `seedTTSProvider()` helper creates DB provider + sets API key
- Tests cover: happy path, 404 (not found), 404 (wrong type), 400 (no key), 400 (unsupported), 400 (invalid body)
- `afterEach`: `vi.restoreAllMocks()` + `app.close()`

### 5. Plugin registration chain

`plugins/tts.ts` uses `fastify-plugin` to expose a `createTTSProvider` decorator globally. Registered in `app.ts` with `await app.register(ttsPlugin)`. The route then accesses it via `fastify.createTTSProvider(id, key)`.

---

## LLM Interface Methods Available

From `backend/src/providers/llm/types.ts`:

```typescript
interface ILLMProvider {
  readonly id: string;
  readonly name: string;
  getModels(): Promise<string[]>;
  complete(messages: ILLMMessage[], model: string): Promise<string>;
  validateCredentials(): Promise<boolean>;
}

interface ILLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

- `getModels()` returns `string[]` -- maps directly to `GET /llm/:providerId/models` response.
- `complete(messages, model)` returns `string` -- needs wrapping in `{ text: string }` for the response.
- `validateCredentials()` is not used by the routes (used elsewhere for credential checks).

From `backend/src/providers/llm/registry.ts`:

```typescript
function createLLMProvider(providerId: string, apiKey: string): ILLMProvider
function getSupportedLLMProviders(): string[]
```

---

## How API Key Decryption Works

API keys are stored encrypted in the database. The `IProviderRepository.getDecryptedKey(id)` method handles decryption transparently:
- Returns `string | null` -- `null` if no key is set
- Encryption uses AES-256-GCM with scrypt key derivation (`backend/src/db/local/crypto.ts`)
- The route code does NOT call crypto directly -- it uses the repository method

In tests, `app.db.providers.setKey(id, 'test-api-key')` stores an encrypted key (in-memory SQLite), and `getDecryptedKey()` returns it. The test helper `buildTestApp()` uses a fixed `encryptionKey: 'test-encryption-key'` for deterministic behavior.

---

## Risks and Assumptions

### Risks

1. **Error propagation from LLM adapters.** If `complete()` or `getModels()` throws (e.g., invalid API key, rate limit, network error), the route must handle it gracefully. The TTS routes do NOT have explicit try/catch around adapter calls (they let Fastify's error handler deal with it). Decision: match TTS pattern initially. We could add a try/catch with a `500` or `502` response for adapter errors, but that is out of scope unless specified.

2. **Large message arrays.** No size limit on `messages` array in the request body. This is acceptable for an internal tool but should be noted.

3. **No model validation.** The route does not check whether the requested `model` is in the provider's `getModels()` list before calling `complete()`. This matches the TTS pattern (which does not validate voice IDs before synthesis). The adapter will throw if the model is invalid.

### Assumptions

1. **ProviderIdParam reuse.** The `ProviderIdParam` from `schemas/tts.ts` can be duplicated into `schemas/llm.ts` or extracted to `schemas/common.ts`. Since TTS already defines its own, LLM should define its own copy in `schemas/llm.ts` for encapsulation (same pattern).

2. **`messages` must have `minItems: 1`.** At least one message is needed for a completion. The issue does not explicitly state this but it is logically required.

3. **`model` is required in POST body.** Confirmed by the issue's request body example.

4. **Response for complete is `{ text: string }`.** Wraps the raw string from `ILLMProvider.complete()`.

5. **No streaming.** Issue does not mention SSE/streaming. Simple JSON request/response.

---

## Unknowns Resolved

| Unknown | Resolution |
|---|---|
| Where do LLM provider files live? | `backend/src/providers/llm/` (NOT `backend/src/llm/` -- the task-context.md had a stale reference). |
| Is there already an LLM plugin? | No. `backend/src/plugins/llm.ts` does not exist. Must be created following the `tts.ts` pattern. |
| Is there already an LLM schema file? | No. `backend/src/schemas/llm.ts` does not exist. Must be created. |
| Is `createLLMProvider` already a decorator? | No. Only `createTTSProvider` is decorated. Must add `createLLMProvider` as a decorator. |
| Does `app.ts` need modification? | Yes. Must import and register the new `llmPlugin`. |
| Does `ProviderIdParam` exist in common schemas? | No, it is defined locally in `schemas/tts.ts`. LLM should define its own in `schemas/llm.ts`. |
| What happens when adapter methods throw? | Fastify's default error handler returns a `500`. The TTS routes do not add extra try/catch around adapter calls, so we match that pattern. |
| Does `complete()` need wrapping? | Yes. `ILLMProvider.complete()` returns `string`, but the endpoint must return `{ text: string }`. |
