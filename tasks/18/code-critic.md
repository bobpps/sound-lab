# Code Review: feat/18-auto-annotation

## Potential bugs

### [BUG-1] Error dispatching in route handler relies on fragile string matching
- **Severity: Major**

**File:** `backend/src/routes/services/index.ts:42-48`
**What's wrong:** The route catches errors from `autoAnnotate()` and routes them to 404 or 400 by checking `message.includes('not found')` and `message.includes('no messages')`. This is fragile substring matching. If anyone changes the wording in the service (e.g., "Dialog 1 was not found" to "Dialog 1 does not exist"), the route silently reclassifies it — the error falls through to `throw err`, which becomes a 500. There is no compiler or test that would catch such a drift. This is a brittle contract between layers based on untyped string content instead of structured error types or codes.
**Why it's bad:** Silent regression path. A trivial copy edit in the service layer changes the HTTP status code in production. The coupling is invisible — nothing in the type system or import graph reveals it.

### [BUG-2] `params.providerId` is accepted by the service but never used
- **Severity: Minor**

**File:** `backend/src/services/auto-annotation.ts:6` (interface), `backend/src/routes/services/index.ts:40`
**What's wrong:** `AutoAnnotateParams` includes `providerId: string`, and the route passes it in via `{ providerId, ...rest }` -> `{ providerId, ...rest }`. But the service function never reads `params.providerId`. The route destructures it to resolve the LLM provider, then reconstructs it back into the params object for no reason. The service receives it and ignores it — it gets `llmProvider` from `deps`, which is already resolved. This is dead data flowing through the system.
**Why it's bad:** Misleading. A reader assumes `providerId` matters inside the service. If someone later accesses `params.providerId` thinking it's meaningful, they get the LLM provider ID rather than, say, the TTS provider — a subtle confusion since the annotated dialog's `provider_id` field is actually `ttsProviderId`.

## Architectural violations

### [ARCH-1] LLM provider resolution logic is duplicated across routes
- **Severity: Major**

**File:** `backend/src/routes/services/index.ts:20-36`
**What's wrong:** The provider resolution sequence — `getById` -> check type -> `getDecryptedKey` -> `createLLMProvider` with try/catch — is a near-exact copy of `backend/src/routes/llm/index.ts:13-35` (`resolveLLMProvider` helper). The LLM routes already extracted this into a reusable function, but the services route rewrote it inline instead of sharing it.
**Why it's bad:** Two places to update when provider resolution logic changes (e.g., adding rate-limit checks, logging, new provider types). The LLM routes version returns `null` on failure (and sets reply), while the services version uses `return reply.xxx()` — same logic, different shape, guaranteeing they will diverge over time.

### [ARCH-2] Mixed error handling paradigms: `reply.notFound()` vs `throw fastify.httpErrors.notFound()`
- **Severity: Minor**

**File:** `backend/src/routes/services/index.ts:23,28,35,44,47`
**What's wrong:** The codebase has two error handling styles. CRUD routes (`dialogs`, `annotations`, `annotation-prompts`) use `throw fastify.httpErrors.notFound()`. Provider-adjacent routes (`providers`, `tts`, `llm`, and now `services`) use `return reply.notFound()`. The new services route follows the `reply.xxx()` pattern, which is consistent with `llm/` and `tts/` but inconsistent with the CRUD majority. Neither pattern is wrong, but having both in one codebase means every new contributor has to guess which to use.
**Why it's bad:** Inconsistency breeds inconsistency. The two patterns also have different semantics: `throw` aborts execution immediately, `return reply.xxx()` requires the developer to remember to `return` — forgetting it means execution continues past the error. The services route correctly returns, but this is a footgun.

## Code quality

### [QUAL-1] Duplicated mock setup boilerplate in unit tests
- **Severity: Minor**

**File:** `backend/tests/services/auto-annotation.test.ts:117-131, 152-166, 177-194, 210-231`
**What's wrong:** Every test in the happy-path group manually sets up the same 6 mock return values (`getWithMessages`, `getById`, `complete`, `create`, `createMessage`, `getWithMessages` again). The setup blocks are 12-15 lines of identical mock wiring repeated 4 times. Only the assertions differ.
**Why it's bad:** When a new repository method is added to `IDatabase` or the service call sequence changes, all 4 tests need identical edits. This is copy-paste masquerading as test isolation.

### [QUAL-2] Integration tests mock `createLLMProvider` via unsafe cast
- **Severity: Minor**

**File:** `backend/tests/routes/services.test.ts:13-19`
**What's wrong:** `(app as Record<string, unknown>).createLLMProvider = vi.fn(...)` — this bypasses TypeScript's type system to replace a decorated property. If `createLLMProvider`'s signature changes (e.g., adding an `options` parameter), this mock won't fail at compile time. The test silently uses the old shape.
**Why it's bad:** The `as Record<string, unknown>` cast is a type escape hatch. The mock won't track signature changes in `LLMProviderFactory`, so tests can pass while production breaks.

### [QUAL-3] No atomicity for DB writes — partial annotation left on LLM failure
- **Severity: Major**

**File:** `backend/src/services/auto-annotation.ts:49-63`
**What's wrong:** The service uses a "collect-then-write" pattern: all LLM calls run first, then DB writes happen. This is good. But the DB writes themselves are not atomic — `annotations.create()` runs first, then `annotations.createMessage()` in a loop. If the second or third `createMessage` call fails (DB constraint, connection drop), the system has an orphaned `AnnotatedDialog` with partial messages. There is no transaction wrapper, no cleanup, no rollback.
**Why it's bad:** Data integrity issue. A partial annotation in the database is worse than no annotation — downstream consumers (UI, export) assume annotations are complete. The issue is latent: it never triggers in tests because mocks don't fail mid-sequence, and SQLite in-memory rarely errors. It will surface under real conditions with network-accessible Supabase.

## Testing violations

### [TEST-1] Unit tests use mocked DB, not in-memory SQLite
- **Severity: Minor**

**File:** `backend/tests/services/auto-annotation.test.ts` (entire file)
**What's wrong:** The unit tests create a fully mocked `IDatabase` with `vi.fn()` for every method. Per `backend/CLAUDE.md`: "Integration tests: in-memory SQLite (real SQL). Unit tests: mocked repos (isolates handler logic)." — so mocked repos for unit tests is technically allowed. But this is a service function, not a handler. The service interacts with multiple repository methods in sequence (`getWithMessages`, `getById`, `create`, `createMessage`, `getWithMessages` again). Mocking all of these means the test verifies the mock wiring, not the actual interaction. If `annotations.create()` returns an object whose `id` field name changes to `annotationId`, the mocks happily return whatever you told them and the test passes.
**Why it's bad:** The mocks replicate the implementation's assumptions rather than testing against them. The test proves the code calls things in a certain order — it doesn't prove the results are correct. The integration tests partially compensate, but they mock `createLLMProvider`, so there's a gap where neither test level verifies the full service-to-DB path without mocks.

## Summary

| Severity | Count |
|---|---|
| **Fundamental** | 0 |
| **Major** | 3 |
| **Minor** | 5 |

**Overall assessment:** Solid implementation of a well-scoped feature, but the error dispatching via string matching (BUG-1), duplicated provider resolution (ARCH-1), and lack of DB write atomicity (QUAL-3) are real issues that will cause pain as the codebase grows. The code is clean and well-structured — the problems are in the seams between layers, not in the layers themselves.
