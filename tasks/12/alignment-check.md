# Alignment Check: Issue #12 -- TTS API Routes

## Original Analysis Summary

The analysis specified two HTTP endpoints:

1. **`GET /tts/:providerId/voices`** -- returns `IVoice[]` JSON array
2. **`POST /tts/:providerId/synthesize`** -- returns binary audio with `Content-Type: audio/mpeg`

Key requirements:

- **Route handler flow:** DB lookup -> type check (`provider.type === 'tts'`) -> key decrypt -> provider factory -> call method
- **Error codes:** 404 for provider not found OR wrong type; 400 for missing API key
- **Binary response:** `reply.type('audio/mpeg').send(buffer)`, no 200 response schema for synthesize
- **Schemas:** TypeBox schemas matching `IVoice` and `ISynthesizeOptions` exactly, with `additionalProperties: false` on `SynthesizeBody`
- **Tests:** Mock `createTTSProvider` at registry level; cover happy paths + all error scenarios
- **Files:** `backend/src/schemas/tts.ts`, `backend/src/routes/tts/index.ts`, `backend/tests/routes/tts.test.ts`
- **Error style:** `reply.notFound()` / `reply.badRequest()` from `@fastify/sensible`

---

## What Was Implemented

### `backend/src/schemas/tts.ts`
- `ProviderIdParam` with `providerId: Type.String()` -- matches spec
- `Voice` schema with all 7 fields matching `IVoice` interface exactly (id, name, language, gender?, description?, previewUrl?, providerMeta?)
- `SynthesizeBody` with all 6 fields matching `ISynthesizeOptions` exactly, `additionalProperties: false` present, `text` has `minLength: 1` validation

### `backend/src/plugins/tts.ts` (NOT in original plan)
- Fastify plugin wrapping `createTTSProvider` as a decorator on `fastify.createTTSProvider`
- Proper declaration merging via `declare module 'fastify'`
- Uses `fastify-plugin` (fp) for global scope

### `backend/src/routes/tts/index.ts`
- Both endpoints implemented with correct paths
- Handler flow: DB lookup -> type check -> key decrypt -> `fastify.createTTSProvider()` -> method call
- GET voices: returns JSON with `Type.Array(Voice)` response schema for 200
- POST synthesize: returns binary via `void reply.type('audio/mpeg'); return reply.send(audio as never);`
- No 200 response schema on synthesize (correct for binary)
- Error/400/404 response schemas defined on both endpoints
- Uses `reply.notFound()` and `reply.badRequest()` from sensible

### `backend/src/app.ts`
- TTS plugin registered after DB plugin, before autoload -- correct order

### `backend/tests/routes/tts.test.ts`
- 11 test cases across both endpoints
- Mocks `createTTSProvider` by overriding the decorator on the app instance (not `vi.mock`)
- Covers: happy path voices, happy path synthesize, options passthrough, 404 not found, 404 wrong type, 400 no key, 400 missing body fields, 400 empty text

---

## Mismatches

### 1. TTS plugin not in plan -- Severity: **Minor (Positive Deviation)**

The plan called for a direct import of `createTTSProvider` in the route file. Instead, a `backend/src/plugins/tts.ts` was created to decorate `fastify.createTTSProvider`. The route file calls `fastify.createTTSProvider()` instead of importing from the registry directly.

**Impact:** This is architecturally sound. It follows the existing codebase pattern (cf. `dbPlugin` decorating `fastify.db`). It provides clean declaration merging and avoids fragile `vi.mock()` path resolution in tests. No negative consequence.

### 2. Test mocking approach changed -- Severity: **Minor (Positive Deviation)**

The plan specified `vi.mock('../../src/providers/tts/registry.js')` at module level. The implementation overrides the decorator directly: `(app as Record<string, unknown>).createTTSProvider = vi.fn(...)` after `buildTestApp()`.

**Impact:** More robust. Avoids Vitest module mock path resolution issues that are a known pain point in ESM codebases. The tests exercise the actual plugin registration (the decorator exists before override), then swap the implementation. Functionally equivalent and less brittle.

### 3. Binary send uses `as never` cast -- Severity: **Minor**

The route uses `return reply.send(audio as never)` with `void reply.type('audio/mpeg')` on a separate statement. The plan specified `return reply.type('audio/mpeg').send(audio)` as a single chained call.

**Impact:** This is a TypeScript-level workaround for the type provider inferring send parameter types from response schemas. Since no 200 schema is defined, TypeBox infers `never` as the valid send type. The cast is safe because Fastify handles Buffer payloads correctly at runtime. The `void` prefix on `reply.type()` is slightly unusual but harmless -- it discards the return value. Functionally identical behavior.

### 4. `text` field has `minLength: 1` -- Severity: **Minor (Enhancement)**

The analysis schema for `SynthesizeBody` showed `text: Type.String()` without constraints. The implementation adds `{ minLength: 1 }`, and the tests include a case verifying empty text returns 400.

**Impact:** Strictly an improvement. Prevents synthesize calls with empty text that would waste API credits. The additional test case validates this.

---

## Corrections Made

All deviations were improvements over the original plan:

| Deviation | Rationale | Assessment |
|-----------|-----------|------------|
| TTS plugin decorator pattern | Follows codebase conventions; cleaner DI | Correct |
| Decorator override mocking | Avoids fragile `vi.mock` ESM path resolution | Correct |
| `as never` cast on binary send | Required by TypeBox type inference; safe at runtime | Acceptable |
| `minLength: 1` on text | Prevents empty-text API calls; tested | Correct |

---

## Final Alignment Verdict

**PASS**

All requirements from the analysis and issue spec are satisfied:

1. Both endpoints match the issue spec (`GET /tts/:providerId/voices`, `POST /tts/:providerId/synthesize`)
2. Route handler flow matches: DB lookup -> type check -> key decrypt -> provider factory -> call
3. Error codes are correct: 404 for not found / wrong type, 400 for no key / invalid body
4. Binary response handled correctly with `Content-Type: audio/mpeg` and no 200 JSON schema
5. `Voice` schema matches `IVoice` field-for-field; `SynthesizeBody` matches `ISynthesizeOptions` field-for-field
6. Tests cover all 8 specified scenarios (11 test cases total)
7. `additionalProperties: false` is present on `SynthesizeBody`

The four deviations from the plan are all minor and either neutral or positive. The TTS plugin pattern is arguably the most significant deviation, but it aligns with established codebase conventions (`dbPlugin` pattern) and improves testability. No requirements were missed, no behavior was misimplemented.

All 215 tests pass. TypeScript compiles clean. Build succeeds.
