# Code Review: TTS API Routes (#12)

**Reviewer:** Claude Opus 4.6 (1M context)
**Branch:** feat/11-inworld-tts (commits 837bbe6..375b49b)
**Date:** 2026-04-06

## Diff Summary

3 commits, 5 files changed, +299 lines:

| Commit | Description |
|--------|-------------|
| `837bbe6` | TypeBox schemas for TTS routes |
| `12a49e0` | Failing tests (TDD RED phase) |
| `375b49b` | Route handlers, TTS plugin, app registration |

## Files Changed

| File | Lines | Purpose |
|------|-------|---------|
| `backend/src/schemas/tts.ts` | +27 | `ProviderIdParam`, `Voice`, `SynthesizeBody` TypeBox schemas |
| `backend/src/plugins/tts.ts` | +18 | Fastify plugin decorating `createTTSProvider` factory |
| `backend/src/routes/tts/index.ts` | +66 | `GET /:providerId/voices`, `POST /:providerId/synthesize` |
| `backend/src/app.ts` | +2 | Register TTS plugin before autoload |
| `backend/tests/routes/tts.test.ts` | +186 | 11 test cases covering happy + error paths |

## Verification Outcomes

| Check | Result |
|-------|--------|
| Build (`npm run build`) | PASS -- zero errors, both backend and frontend compile clean |
| Tests (`npm test`) | PASS -- 215/215 (16 test files), including all 11 new TTS route tests |
| Lint (`npm run lint --workspace=frontend`) | CLEAN -- no warnings or errors |
| ESM imports (`.js` extensions) | All present and correct |

## Architecture Compliance

**Conventions followed correctly:**
- App factory pattern (`buildApp()` + `app.inject()` in tests) -- check
- TypeBox as single source of truth with `FastifyPluginAsyncTypebox` -- check
- `additionalProperties: false` on `SynthesizeBody` (the only body schema) -- check
- Response schemas defined for all error codes (400, 404) -- check
- `fastify-plugin` (fp) wrapping for the global TTS decorator -- check
- Declaration merging for `FastifyInstance` -- check
- Plugin registration order: db -> tts -> autoload (routes) -- check
- `@fastify/sensible` error helpers (`reply.notFound`, `reply.badRequest`) -- check
- Provider IDs as natural string keys -- check
- `afterEach` calls `vi.restoreAllMocks()` -- check

## Detailed Analysis

### Schemas (`backend/src/schemas/tts.ts`)

The `Voice` schema is a 1:1 match with `IVoice` from `providers/tts/types.ts`:
- `id`, `name`, `language` -- required strings: match
- `gender`, `description`, `previewUrl` -- optional strings: match
- `providerMeta` -- `Type.Optional(Type.Record(Type.String(), Type.Unknown()))` matches `Record<string, unknown>`: match

The `SynthesizeBody` schema is a 1:1 match with `ISynthesizeOptions`:
- `voiceId`, `text` -- required strings: match
- `speed`, `temperature` -- optional numbers: match
- `format` -- optional string: match
- `sampleRate` -- optional number: match
- `text` has `minLength: 1` -- sensible validation, tested in test case

`ProviderIdParam` uses `Type.String()` for the param, consistent with provider routes using `StringIdParam`.

### Plugin (`backend/src/plugins/tts.ts`)

Clean plugin design. Wraps `createTTSProvider` from the registry as a Fastify decorator. The `TTSProviderFactory` type export is useful for typing. Using `fp` is correct since this is global infrastructure.

### Routes (`backend/src/routes/tts/index.ts`)

Both routes follow the same guard pattern:
1. Look up provider in DB, verify `type === 'tts'`
2. Fetch decrypted API key, verify non-null
3. Create TTS provider instance via decorator
4. Delegate to provider method

This is consistent with existing route patterns (e.g., `providers/index.ts`).

### Tests (`backend/tests/routes/tts.test.ts`)

11 tests covering:
- **GET /tts/:providerId/voices** (4 tests): happy path, provider not found, wrong type, no API key
- **POST /tts/:providerId/synthesize** (7 tests): happy path + content-type, all options passthrough, provider not found, wrong type, no API key, missing required fields, empty text validation

The mock override pattern `(app as Record<string, unknown>).createTTSProvider = vi.fn(...)` is pragmatic for overriding a decorator.

## Issues

### Minor: No 200 response schema for `POST /synthesize` (Severity: Minor)

The synthesize endpoint omits the 200 schema (`response: { 400: ..., 404: ... }`) because TypeBox cannot express a binary Buffer response. The code comment explains the rationale and the `as never` cast is the correct workaround.

**Impact:** Loses the `fast-json-stringify` optimization for this route. Acceptable because the response is binary audio data, not JSON, so `fast-json-stringify` would not apply anyway.

**Verdict:** Acknowledged limitation, documented in code. No action needed.

### Minor: Hardcoded `audio/mpeg` content-type (Severity: Minor)

The synthesize endpoint always returns `audio/mpeg` regardless of the `format` field in the request body. If a client requests `format: 'wav'`, the response will still claim `audio/mpeg`.

**Impact:** Low for current usage. The TTS provider implementations likely return mp3 by default. However, when `format` is actually honored by providers, this will send incorrect `Content-Type` headers.

**Recommendation:** Consider deriving the content-type from the format field in a follow-up, e.g.:
```ts
const mimeTypes: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };
void reply.type(mimeTypes[request.body.format ?? 'mp3'] ?? 'application/octet-stream');
```

### Minor: Unhandled `createTTSProvider` throw (Severity: Minor)

If the provider exists in the DB but is not in the `PROVIDERS` registry map (e.g., someone registers a provider with `id: 'azure'` in the DB but there's no `AzureTTSProvider` class), `createTTSProvider` throws `Error('Unsupported TTS provider: azure')`. This will surface as a generic 500.

**Impact:** Low. In practice, providers are seeded with known IDs. The existing provider check (`provider.type !== 'tts'`) catches type mismatches but not registry mismatches.

**Recommendation:** Could wrap in try/catch and return 400/422, or validate against `getSupportedTTSProviders()` before calling. Low priority -- acceptable for an internal tool.

### Minor: `ProviderIdParam` duplicates `StringIdParam` (Severity: Minor)

`ProviderIdParam` is `Type.Object({ providerId: Type.String() })` while `StringIdParam` is `Type.Object({ id: Type.String() })`. The only difference is the field name (`providerId` vs `id`).

**Impact:** None functionally. The distinct name `providerId` improves readability in TTS routes since the URL is `/tts/:providerId/...`, making it self-documenting. This is a reasonable choice.

**Verdict:** Acceptable. Not a duplication concern.

## Known Limitations

1. **Binary response has no 200 schema** -- inherent TypeBox limitation for non-JSON responses. Correctly handled with comment + `as never` cast.
2. **Content-type is static** -- always `audio/mpeg` regardless of requested format. Acceptable for MVP.
3. **No error wrapping for unsupported registry providers** -- throws generic 500. Acceptable for internal tool.

## Test Coverage Assessment

Coverage is thorough for the two endpoints:
- All error branches tested (404 not found, 404 wrong type, 400 no key, 400 validation)
- Happy paths tested with data verification
- Binary response handling verified (content-type header + raw payload comparison)
- Schema validation tested (missing field, empty text)
- Options passthrough verified

No significant gaps identified.

## PR Readiness

**Status: READY TO MERGE**

The implementation is clean, well-structured, and follows all established codebase conventions. All 215 tests pass, build compiles cleanly, and lint is clean. The three minor issues noted are acknowledged limitations appropriate for an internal tool at this stage. No blocking issues found.
