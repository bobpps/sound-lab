# Analysis: Issue #12 -- TTS API Routes (voices + synthesize)

## What the Task Requires

Create two HTTP endpoints that allow the frontend to interact with TTS providers:

1. **`GET /tts/:providerId/voices`** -- Returns `IVoice[]` (JSON array of available voices for a given TTS provider)
2. **`POST /tts/:providerId/synthesize`** -- Returns audio binary with `Content-Type: audio/mpeg`

### Deliverables

| File | Action |
|------|--------|
| `backend/src/routes/tts/index.ts` | Create -- route handler plugin |
| `backend/src/schemas/tts.ts` | Create -- TypeBox schemas for request/response validation |
| `backend/tests/routes/tts.test.ts` | Create -- route-level tests |

### Route Handler Flow (both endpoints)

1. Look up provider in DB via `fastify.db.providers.getById(providerId)` -- 404 if not found
2. Verify `provider.type === 'tts'` -- 404 if not a TTS provider
3. Get decrypted API key via `fastify.db.providers.getDecryptedKey(providerId)` -- 400 if no key set
4. Create provider instance via `createTTSProvider(providerId, apiKey)`
5. Call the appropriate provider method (`getVoices()` or `synthesize(opts)`)
6. For voices: return JSON array directly
7. For synthesize: return `Buffer` with `Content-Type: audio/mpeg` and appropriate headers

---

## Constraints from Project Guidance

From `CLAUDE.md` (root):
- **TDD by default** -- write tests first, then implement
- **ESM everywhere** -- `.js` extensions in all imports

From `backend/CLAUDE.md`:
- **TypeBox as single source of truth** -- define request/response schemas with `@sinclair/typebox`
- **`additionalProperties: false`** on all body schemas (the synthesize POST body must include this)
- **Always define response schemas** -- enables `fast-json-stringify` and prevents data leaks
- **`@fastify/autoload`** for routes -- directory name `tts/` becomes the `/tts` prefix automatically
- **App factory pattern** -- `buildApp()` returns configured Fastify instance; tests use `app.inject()`
- **Errors via `@fastify/sensible`** -- use `reply.notFound()`, `reply.badRequest()`, or `fastify.httpErrors.*`
- **Provider IDs are natural string keys** (e.g., `"elevenlabs"`, `"google"`)

---

## Key Files and Systems Involved

### TTS Provider Infrastructure

| File | Key Exports | Role |
|------|-------------|------|
| `backend/src/providers/tts/types.ts` | `IVoice`, `ISynthesizeOptions`, `ITTSProvider` | Core interfaces |
| `backend/src/providers/tts/registry.ts` | `createTTSProvider(providerId, apiKey): ITTSProvider`, `getSupportedTTSProviders(): string[]` | Factory function |
| `backend/src/providers/tts/elevenlabs.ts` | `ElevenLabsTTSProvider` | Reference implementation |
| `backend/src/providers/tts/google.ts` | `GoogleTTSProvider` | Provider (JSON credentials) |
| `backend/src/providers/tts/inworld.ts` | `InworldTTSProvider` | Provider |

### Database Layer

| File | Key Exports | Relevant Methods |
|------|-------------|------------------|
| `backend/src/db/interfaces.ts` | `IProviderRepository`, `IDatabase` | `providers.getById(id: string): Promise<Provider \| null>`, `providers.getDecryptedKey(id: string): Promise<string \| null>` |
| `backend/src/db/types.ts` | `Provider`, `ProviderType` | `Provider.type: 'tts' \| 'llm' \| 'realtime'` |

### App & Routing Infrastructure

| File | Key Exports | Role |
|------|-------------|------|
| `backend/src/app.ts` | `buildApp(opts?)` | App factory; uses `@fastify/autoload` with `dirNameRoutePrefix: true` |
| `backend/src/plugins/db.ts` | `dbPlugin` | Decorates `fastify.db: IDatabase`; test mode uses in-memory SQLite |
| `backend/src/schemas/common.ts` | `StringIdParam`, `ErrorResponse` | Reusable param/error schemas |
| `backend/src/schemas/provider.ts` | `Provider`, `ProviderType`, etc. | Existing provider schemas |

### Test Infrastructure

| File | Key Exports | Role |
|------|-------------|------|
| `backend/tests/helpers.ts` | `buildTestApp()` | Creates test app with `{ testing: true }`, calls `app.ready()` |
| `backend/tests/routes/providers.test.ts` | -- | Reference for route test patterns |

---

## Exact Patterns to Follow

### Route File Structure (`backend/src/routes/tts/index.ts`)

```typescript
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
// schema imports from ../../schemas/tts.js
// common schema imports from ../../schemas/common.js
import { createTTSProvider } from '../../providers/tts/registry.js';

const ttsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /:providerId/voices
  fastify.get('/:providerId/voices', {
    schema: {
      params: ProviderIdParam,
      response: {
        200: Type.Array(Voice),
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    // 1. lookup provider
    // 2. check type === 'tts'
    // 3. get decrypted key
    // 4. create provider instance
    // 5. call getVoices()
  });

  // POST /:providerId/synthesize
  fastify.post('/:providerId/synthesize', {
    schema: {
      params: ProviderIdParam,
      body: SynthesizeBody,
      // NO response schema for binary -- Fastify raw replies don't use fast-json-stringify
    },
  }, async (request, reply) => {
    // 1-4 same as above
    // 5. call synthesize(opts)
    // 6. reply.type('audio/mpeg').send(buffer)
  });
};

export default ttsRoutes;
```

**Key pattern notes:**
- The directory `tts/` auto-maps to `/tts` prefix via autoload
- Param is `:providerId` (not `:id`) because the prefix path is `/tts`, not `/providers`
- Error handling uses `reply.notFound(msg)` and `reply.badRequest(msg)` from `@fastify/sensible`

### Schema File (`backend/src/schemas/tts.ts`)

Follow the pattern from `schemas/provider.ts` and `schemas/dialog.ts`:

```typescript
import { Type, type Static } from '@sinclair/typebox';

export const ProviderIdParam = Type.Object({
  providerId: Type.String(),
});
export type ProviderIdParam = Static<typeof ProviderIdParam>;

export const Voice = Type.Object({
  id: Type.String(),
  name: Type.String(),
  language: Type.String(),
  gender: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  previewUrl: Type.Optional(Type.String()),
  providerMeta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type Voice = Static<typeof Voice>;

export const SynthesizeBody = Type.Object({
  voiceId: Type.String(),
  text: Type.String(),
  speed: Type.Optional(Type.Number()),
  temperature: Type.Optional(Type.Number()),
  format: Type.Optional(Type.String()),
  sampleRate: Type.Optional(Type.Number()),
}, { additionalProperties: false });
export type SynthesizeBody = Static<typeof SynthesizeBody>;
```

### Test File Pattern (`backend/tests/routes/tts.test.ts`)

Follow the pattern from `tests/routes/providers.test.ts`:

```typescript
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

// Mock the TTS registry to avoid real API calls
vi.mock('../../src/providers/tts/registry.js', () => ({
  createTTSProvider: vi.fn(),
}));

describe('TTS routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  // Helper: seed a TTS provider with an API key
  async function seedTTSProvider(id: string, name: string) {
    await app.db.providers.create({ id, name, type: 'tts' });
    await app.db.providers.setKey(id, 'test-api-key');
  }

  describe('GET /tts/:providerId/voices', () => {
    // tests here
  });

  describe('POST /tts/:providerId/synthesize', () => {
    // tests here
  });
});
```

### Binary Response Pattern

For returning audio buffers, the handler must:

```typescript
const buffer = await provider.synthesize(opts);
return reply.type('audio/mpeg').send(buffer);
```

**Important:** When returning binary data via `reply.send(buffer)`, Fastify does NOT apply JSON serialization. A response schema for binary is NOT needed (and would break things). The route schema should either omit the `200` response or use a minimal schema.

### Error Handling Pattern (from providers route)

```typescript
// 404 if provider not found
const provider = await fastify.db.providers.getById(request.params.providerId);
if (!provider) {
  return reply.notFound(`Provider ${request.params.providerId} not found`);
}

// 404 if not a TTS provider
if (provider.type !== 'tts') {
  return reply.notFound(`Provider ${request.params.providerId} is not a TTS provider`);
}

// 400 if no API key set
const apiKey = await fastify.db.providers.getDecryptedKey(request.params.providerId);
if (apiKey === null) {
  return reply.badRequest(`No API key set for provider ${request.params.providerId}`);
}
```

---

## Risks and Edge Cases

### 1. Binary Response Schema

Fastify's `fast-json-stringify` will mangle binary data if a JSON response schema is defined for status 200 on the synthesize endpoint. The response schema for 200 must be **omitted** or set to something that bypasses serialization. Only error responses (400, 404, 500) should have schemas.

### 2. Provider Errors Bubbling as 500

If `createTTSProvider` throws (unsupported provider), or `getVoices()`/`synthesize()` throws (API error), these will bubble as unhandled 500s. The route should either:
- Let them propagate (Fastify returns 500 with the error message in dev, sanitized in production)
- Catch and convert to appropriate HTTP status (e.g., 502 Bad Gateway for upstream API failures)

**Recommendation:** Let provider errors propagate as 500 for now. The `createTTSProvider` error should not occur in practice because we already validated the provider exists in DB and is type `tts`. If the provider ID isn't in the registry, that's a configuration error (provider exists in DB but has no adapter implementation), which is correctly a 500.

### 3. Large Audio Responses

`synthesize()` returns a full `Buffer` in memory. For very long texts, this could be large. No streaming is implemented in the current provider interface. This is acceptable for the internal tool use case.

### 4. Content-Type Assumptions

The issue says `Content-Type: audio/mpeg`. But providers may return formats other than MP3 depending on `format`/`sampleRate` options. Two approaches:
- Always return `audio/mpeg` (simple, matches spec)
- Derive content type from the requested format

**Recommendation:** Return `audio/mpeg` as the default content type per the issue spec. If a `format` field implies a different content type, it could be added later.

### 5. Mock Strategy for Route Tests

Route tests should mock `createTTSProvider` from the registry, NOT the individual provider HTTP calls. This isolates the route logic from provider implementation details. The mock returns a fake `ITTSProvider` with `getVoices()` and `synthesize()` controlled by the test.

### 6. vi.mock Path Resolution

`vi.mock()` in Vitest uses the **path relative to the test file**. For a test at `backend/tests/routes/tts.test.ts` mocking `backend/src/providers/tts/registry.ts`, the mock path should be `'../../src/providers/tts/registry.js'`.

---

## Assumptions

1. The TTS routes directory (`backend/src/routes/tts/`) does not exist yet and will be created.
2. Autoload will automatically pick up `routes/tts/index.ts` and mount it at `/tts`.
3. The synthesize endpoint returns `Content-Type: audio/mpeg` regardless of the actual format requested.
4. Route tests mock `createTTSProvider` rather than stubbing `fetch` or real provider calls.
5. No authentication/authorization middleware is needed for these endpoints (consistent with all other routes).
6. The `SynthesizeBody` schema mirrors `ISynthesizeOptions` exactly.
7. Provider errors from `getVoices()`/`synthesize()` propagate as 500 Internal Server Error.

---

## Unknowns Resolved

| Question | Resolution |
|----------|------------|
| Does `backend/src/routes/tts/` exist? | No -- must be created |
| Does `backend/src/providers/tts/` exist? | Yes -- fully implemented with 3 providers (elevenlabs, google, inworld) |
| What is the `createTTSProvider` signature? | `(providerId: string, apiKey: string) => ITTSProvider` in `registry.ts` |
| What does `IVoice` look like? | `{ id, name, language, gender?, description?, previewUrl?, providerMeta? }` in `types.ts` |
| What does `ISynthesizeOptions` look like? | `{ voiceId, text, speed?, temperature?, format?, sampleRate? }` in `types.ts` |
| How does the test infrastructure work? | `buildTestApp()` in `tests/helpers.ts` creates in-memory SQLite app; use `app.inject()` |
| How are providers seeded in tests? | `app.db.providers.create({ id, name, type })` then `app.db.providers.setKey(id, key)` |
| Is `@fastify/sensible` available? | Yes -- registered in `app.ts`; provides `reply.notFound()`, `reply.badRequest()` |
| How to handle binary responses? | `reply.type('audio/mpeg').send(buffer)` -- no JSON response schema for 200 |
| What param name for provider ID? | `providerId` (since the route is `/tts/:providerId/...`, not under `/providers`) |
