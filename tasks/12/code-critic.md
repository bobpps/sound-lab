# Code Review: feat/12-tts-routes

## Architectural violations

### [ARCH-1] Missing response schema for 200 on POST /synthesize (Major)
**File:** `backend/src/routes/tts/index.ts:40-43`
**What's wrong:** The synthesize endpoint defines response schemas for 400 and 404 but deliberately omits a 200 schema. The comment on line 60 says "no 200 schema defined, so we bypass TypeBox's strict send() typing" and uses `as never` cast.
**Why it's bad:** The backend CLAUDE.md is unambiguous: "Always define response schemas -- enables `fast-json-stringify` (~20-30% throughput boost) and prevents accidental data leaks." This is a binary endpoint, which is a legitimate edge case, but the absence of any 200 response schema still violates the documented rule. The `as never` cast is a type system escape hatch that hides the contract from consumers. At minimum, this should be documented as an intentional exception with a rationale beyond "it's hard."

### [ARCH-2] Business logic in route handlers (Major)
**File:** `backend/src/routes/tts/index.ts:20-31` and `backend/src/routes/tts/index.ts:48-59`
**What's wrong:** Both handlers perform a multi-step orchestration: fetch provider from DB, validate type, decrypt key, instantiate TTS provider, call provider method. This is business logic (provider resolution + validation + key management + TTS invocation) living directly in route handlers.
**Why it's bad:** This isn't a simple CRUD passthrough -- it's an orchestration workflow that combines DB lookups, authorization checks, and external provider calls. The existing CRUD routes (providers, dialogs) are thin DB wrappers, which is fine. But the TTS routes coordinate across two subsystems (DB + TTS providers). As soon as a second consumer needs this logic (e.g., a batch synthesis endpoint, a WebSocket stream), it gets duplicated. A service layer or at minimum a shared helper is warranted.

### [ARCH-3] Duplicated provider-validation logic across two handlers (Major)
**File:** `backend/src/routes/tts/index.ts:18-29` and `backend/src/routes/tts/index.ts:46-57`
**What's wrong:** Lines 18-29 and 46-57 are functionally identical: fetch provider, check type, get decrypted key, check null. Copy-pasted verbatim.
**Why it's bad:** The code-critic skill explicitly calls out copy-paste: "duplicated logic that could be eliminated." If the validation logic changes (e.g., adding a check for provider-enabled status), both handlers must be updated in lockstep. This is a textbook DRY violation.

## Project patterns

### [PAT-1] Hardcoded `audio/mpeg` content type (Minor)
**File:** `backend/src/routes/tts/index.ts:61`
**What's wrong:** `reply.type('audio/mpeg')` is hardcoded, but `SynthesizeBody` accepts a `format` field (line 24 of schemas/tts.ts) which could be `'wav'`, `'ogg'`, `'flac'`, etc.
**Why it's bad:** If a client sends `{ format: 'wav' }`, the response header still says `audio/mpeg`. The content-type lies. This isn't hypothetical -- the schema explicitly exposes `format` as a user-controllable option.

### [PAT-2] Unhandled error from `createTTSProvider` (Major)
**File:** `backend/src/routes/tts/index.ts:30` and `backend/src/routes/tts/index.ts:58`
**What's wrong:** `registry.ts:15` throws `Error('Unsupported TTS provider: ...')` when the providerId is not in the PROVIDERS map. But the route handler has no try/catch around `fastify.createTTSProvider(providerId, apiKey)`.
**Why it's bad:** A provider can exist in the DB (type 'tts') but not be implemented in the registry. For example, someone inserts a provider record with id `"azure"` via the providers CRUD API, then hits `/tts/azure/voices`. The DB lookup passes, the type check passes, the key check passes, and then `createTTSProvider` throws an unhandled Error that surfaces as a 500 with a stack trace. The route should catch this and return a proper 4xx.

### [PAT-3] No unhandled error from TTS provider calls (Minor)
**File:** `backend/src/routes/tts/index.ts:31` and `backend/src/routes/tts/index.ts:59`
**What's wrong:** `tts.getVoices()` and `tts.synthesize()` call external APIs. No try/catch, no error mapping.
**Why it's bad:** External API failures (network errors, auth failures, rate limits) will surface as raw 500s with provider-specific error messages potentially leaking to the client. The code-critic checklist calls out "Unhandled errors -- `await` without `try/catch` where failure is realistic." External API calls are the definition of "failure is realistic."

## Abstraction problems

### [ABS-1] Schema type `Voice` duplicates `IVoice` interface (Minor)
**File:** `backend/src/schemas/tts.ts:8-16` vs `backend/src/providers/tts/types.ts:1-9`
**What's wrong:** The TypeBox `Voice` schema in `schemas/tts.ts` has exactly the same fields as `IVoice` in `providers/tts/types.ts`. Two sources of truth for the same shape.
**Why it's bad:** If someone adds a field to `IVoice` (say, `accent`), the API response won't include it because the `Voice` TypeBox schema doesn't know about it. Conversely, if someone adds a field to the TypeBox schema, `IVoice` won't have it. Schema drift between the TypeBox response schema and the provider interface is a silent bug waiting to happen. The backend CLAUDE.md says "TypeBox as single source of truth" -- but here there are two sources.

### [ABS-2] Schema type `SynthesizeBody` duplicates `ISynthesizeOptions` interface (Minor)
**File:** `backend/src/schemas/tts.ts:19-27` vs `backend/src/providers/tts/types.ts:11-18`
**What's wrong:** Same problem as ABS-1. The TypeBox `SynthesizeBody` and the `ISynthesizeOptions` interface describe the same shape independently.
**Why it's bad:** Same consequences as ABS-1 -- two sources of truth for the same data shape, prone to drift.

## Testing violations

### [TEST-1] Type-unsafe mock injection via `as Record<string, unknown>` (Minor)
**File:** `backend/tests/routes/tts.test.ts:17`
**What's wrong:** `(app as Record<string, unknown>).createTTSProvider = vi.fn(...)` bypasses TypeScript's type system entirely to monkey-patch a decorator onto an already-initialized Fastify instance.
**Why it's bad:** If the `ITTSProvider` interface changes (e.g., `synthesize` returns `Uint8Array` instead of `Buffer`), the mock won't fail at compile time. The test also overrides the decorator _after_ `app.ready()` has been called, which means Fastify's plugin system has already sealed the instance -- this works by accident because JavaScript objects are mutable, but it violates Fastify's plugin encapsulation model.

### [TEST-2] No test for unsupported provider scenario (Minor)
**File:** `backend/tests/routes/tts.test.ts`
**What's wrong:** There is no test for the case where a provider exists in the DB with type 'tts' but is not supported by the TTS registry (e.g., `createTTSProvider` throws). This is exactly the bug described in PAT-2.
**Why it's bad:** The happy path and the standard error paths are covered, but the registry-throws path is not. This is a real bug in the route logic that the test suite doesn't catch.

### [TEST-3] No test for external provider failure (Minor)
**File:** `backend/tests/routes/tts.test.ts`
**What's wrong:** No test where `mockGetVoices` or `mockSynthesize` rejects. All tests either mock a successful response or never reach the provider call.
**Why it's bad:** This directly maps to PAT-3 -- the route has no error handling for provider failures, and the tests don't expose this gap. If someone adds a try/catch later, there won't be a regression test to protect it.

## Summary
- Fundamental issues: 0
- Major issues: 4 (ARCH-1, ARCH-2, ARCH-3, PAT-2)
- Minor issues: 6 (PAT-1, PAT-3, ABS-1, ABS-2, TEST-1, TEST-2, TEST-3)
- Overall assessment: Structurally competent routes with correct schemas and decent test coverage, but the provider-resolution logic is duplicated, error handling for external calls is absent, and the response content-type is hardcoded despite accepting a format parameter -- all of which will bite as soon as the feature gets real usage.
