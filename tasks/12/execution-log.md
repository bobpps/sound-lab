# Execution Log: Issue #12 -- TTS API Routes (voices + synthesize)

## Research Phase

**Status:** COMPLETE

### Files Examined

1. **`CLAUDE.md` (root)** -- TDD by default, ESM everywhere, `.js` extensions in imports.

2. **`backend/CLAUDE.md`** -- TypeBox schemas as single source of truth, `additionalProperties: false` on body schemas, always define response schemas, autoload for routes (directory name = prefix), `@fastify/sensible` for HTTP errors, app factory pattern for testing.

3. **`backend/src/app.ts`** -- Uses `@fastify/autoload` with `dirNameRoutePrefix: true` and `dir: join(__dirname, 'routes')`. Registers `cors`, `sensible`, `dbPlugin`. Exports `buildApp(opts?)`. Creating `routes/tts/index.ts` will auto-register at `/tts`.

4. **`backend/src/routes/providers/index.ts`** -- Reference route file. Pattern: `FastifyPluginAsyncTypebox` async function, imports TypeBox schemas, defines route handlers with `schema: { params, body, response }` objects. Uses `reply.notFound()`, `reply.conflict()`, `reply.status(204).send(null)` from sensible.

5. **`backend/src/routes/annotations/index.ts`** -- Shows alternative error pattern: `throw fastify.httpErrors.notFound('...')` vs `reply.notFound('...')`. Both work; the providers route uses `reply.*` style. Will follow the providers pattern for consistency.

6. **`backend/src/routes/health/index.ts`** -- Minimal route example. Shows `FastifyPluginAsyncTypebox` and inline response schema.

7. **`backend/src/providers/tts/types.ts`** -- Core interfaces:
   - `IVoice { id, name, language, gender?, description?, previewUrl?, providerMeta? }`
   - `ISynthesizeOptions { voiceId, text, speed?, temperature?, format?, sampleRate? }`
   - `ITTSProvider { id, name, getVoices(), synthesize(opts), validateCredentials() }`

8. **`backend/src/providers/tts/registry.ts`** -- `createTTSProvider(providerId: string, apiKey: string): ITTSProvider` factory. Throws `Error('Unsupported TTS provider: ...')` for unknown IDs. `getSupportedTTSProviders(): string[]` returns keys. Three providers registered: `elevenlabs`, `google`, `inworld`.

9. **`backend/src/providers/tts/elevenlabs.ts`** -- Reference implementation. Constructor takes `apiKey: string`. `getVoices()` returns `IVoice[]`. `synthesize(opts)` returns `Buffer` (from `response.arrayBuffer()`). Key detail: synthesize returns raw bytes, the route must set Content-Type.

10. **`backend/src/db/interfaces.ts`** -- `IProviderRepository` interface:
    - `getById(id: string): Promise<Provider | null>` -- returns null if not found
    - `getDecryptedKey(id: string): Promise<string | null>` -- returns null if no key set
    - Accessed via `fastify.db.providers`

11. **`backend/src/db/types.ts`** -- `Provider { id, name, type: ProviderType, enabled, created_at }` where `ProviderType = 'tts' | 'llm' | 'realtime'`.

12. **`backend/src/schemas/common.ts`** -- `StringIdParam { id: Type.String() }`, `ErrorResponse { statusCode, error, message }`. The TTS route needs a custom `ProviderIdParam` since the param is named `providerId`, not `id`.

13. **`backend/src/schemas/provider.ts`** -- Shows `additionalProperties: false` on Create/Update/SetKey bodies. Response schemas do NOT have `additionalProperties: false`.

14. **`backend/src/plugins/db.ts`** -- Decorates `fastify.db: IDatabase`. Test mode uses `{ provider: 'local', local: { path: ':memory:' }, encryptionKey: 'test-encryption-key' }`.

15. **`backend/src/db/local/crypto.ts`** -- AES-256-GCM encryption with scrypt. Used internally by the DB layer; routes never call this directly. Routes call `providers.getDecryptedKey()`.

16. **`backend/tests/helpers.ts`** -- `buildTestApp()` creates app with `{ testing: true }`, calls `app.ready()`, returns configured Fastify instance.

17. **`backend/tests/routes/providers.test.ts`** -- Reference test file. Pattern:
    - `buildTestApp()` in `beforeEach`, `app.close()` in `afterEach`
    - Seeds data via `app.db.providers.create()` and `app.db.providers.setKey()`
    - Tests via `app.inject({ method, url, payload })`
    - Checks `res.statusCode` and `res.json()`

18. **`backend/tests/routes/health.test.ts`** -- Minimal test pattern. Same `beforeEach`/`afterEach` structure.

19. **`backend/tests/providers/registry.test.ts`** -- Shows how `vi.mock('@google-cloud/text-to-speech')` is used to prevent constructor failures in tests. Important: TTS route tests must also mock this if the registry is not itself mocked.

20. **`backend/tests/providers/elevenlabs.test.ts`** -- Unit tests mock `fetch` via `vi.stubGlobal('fetch', mockFetch)`. Route tests should NOT do this; they should mock `createTTSProvider` from the registry.

21. **`backend/vitest.config.ts`** -- `globals: true` (no need to import `describe`, `it`, `expect`, `vi`), `pool: 'forks'` with tsx import.

22. **GitHub Issue #12** (fetched via `gh issue view 12`):
    - Title: "Task 11: TTS API routes (voices + synthesize)" (numbered as Task 11 in the plan, GitHub issue #12)
    - Files to create: `backend/src/routes/tts/index.ts`, `backend/tests/routes/tts.test.ts`
    - Depends on: #4 (providers CRUD), #9 (ElevenLabs TTS provider)
    - Specifies mock strategy: "mock TTS registry, seed provider with key"

### Key Decisions Recorded

1. **Schema file needed**: The issue only lists 2 files, but a `backend/src/schemas/tts.ts` schema file should be created to follow the codebase pattern (schemas are separate from routes).

2. **Mock `createTTSProvider` at the registry level**: This is explicitly called out in the issue and is the correct approach. Route tests should not mock individual provider HTTP calls.

3. **Binary response handling**: Use `reply.type('audio/mpeg').send(buffer)`. Do NOT define a JSON response schema for the 200 status of synthesize endpoint. Error responses (400, 404) should have `ErrorResponse` schemas.

4. **Param naming**: Use `providerId` (not `id`) since the route is at `/tts/:providerId/voices` -- this avoids confusion with the `StringIdParam` used in `/providers/:id`.

5. **Type checking on provider**: Route must check `provider.type === 'tts'` after fetching from DB. A provider of type `llm` should return 404 even though it exists in the DB.

---

## Planning Phase

**Status:** COMPLETE (see `tasks/12/plan.md`)

---

## Implementation Phase

**Status:** COMPLETE

### Steps (TDD order)

- [x] Step 1: Create `backend/src/schemas/tts.ts` with TypeBox schemas (`ProviderIdParam`, `Voice`, `SynthesizeBody`)
  - Committed: `837bbe6 feat(tts): add TypeBox schemas for TTS routes (#12)`
- [x] Step 2: Write `backend/tests/routes/tts.test.ts` (RED phase) -- mock registry, test all cases
  - Committed: `12a49e0 test(tts): add failing tests for TTS API routes (#12)`
  - 11 test cases covering happy paths + 404/400 error scenarios
- [x] Step 3: Run tests -- confirmed all fail (routes not registered yet)
- [x] Step 4: Create `backend/src/routes/tts/index.ts` -- implement route handlers
- [x] Step 5: Run tests -- confirmed all 11 pass (GREEN phase)
- [x] Step 6: Run full test suite -- 215 tests across 16 files, 0 failures
- [x] Step 7: Commit `375b49b feat(tts): implement TTS route handlers and provider plugin (#12)`

### Deviations from Plan

1. **TTS plugin added (`backend/src/plugins/tts.ts`)**: The plan called for importing `createTTSProvider` directly in the route file. Instead, a Fastify plugin was created to decorate `fastify.createTTSProvider`. This is architecturally better because:
   - It follows the codebase pattern of decorating infrastructure on the Fastify instance
   - It enables clean mocking in tests by overriding the decorator instead of using `vi.mock()` with fragile path resolution
   - It provides proper TypeScript declaration merging for the decorator type

2. **Test mocking strategy changed**: Instead of using `vi.mock('../../src/providers/tts/registry.js')` at the module level, tests override the `createTTSProvider` decorator directly on the app instance. This avoids `vi.mock` path resolution issues and is more maintainable.

3. **Type fix for binary response**: TypeBox type provider infers `send()` parameter type from response schemas. Since the synthesize endpoint only defines error schemas (400/404), sending a Buffer caused TS2345. Fixed with `reply.send(audio as never)` -- the `as never` cast is safe because Fastify correctly handles Buffer payloads at runtime, and no 200 schema means no serialization interference.

### Verification Results

- **TypeScript**: `npx tsc --noEmit` -- clean, no errors
- **TTS tests**: 11/11 pass
- **Full suite**: 215/215 pass, 0 failures
- **Build**: `npm run build` -- backend + frontend both succeed
