# Code Review: feat/17-dialog-editing-service

## Architectural violations

### [ARCH-1] Duplicated `resolveLLMProvider` — Major
**File:** `backend/src/routes/services/index.ts:10-32`
**What's wrong:** The `resolveLLMProvider` function is a near-exact copy of the one in `backend/src/routes/llm/index.ts:13-35`. Same signature, same logic (fetch provider, check type, decrypt key, create instance), different error message strings.
**Why it's bad:** Two copies of the same provider-resolution logic. When the contract changes (e.g. a new check is added, or error handling is revised), one copy will be updated and the other forgotten. This is textbook copy-paste debt. The function should be extracted to a shared utility or a Fastify decorator.

### [ARCH-2] Error classification via string matching on error messages — Major
**File:** `backend/src/routes/services/index.ts:55-66`
**What's wrong:** The route handler classifies errors into HTTP status codes by scanning the error message string for substrings like `"not found"`, `"parse"`, `"json"`, `"message count"`, `"character"`, `"shape"`. This is the route layer doing error classification that belongs in the service layer — or at least in a typed error hierarchy.
**Why it's bad:** This is extremely fragile. If anyone changes an error message wording in `dialog-editing.ts` (e.g. from "not found" to "does not exist"), the route silently falls through to a 500 instead of returning 404. The coupling is invisible — no compiler or test will catch it unless you have explicit tests for every error message variant. The word "character" is especially dangerous: any unrelated error containing "character" (e.g. "invalid character in input") would be incorrectly classified as 502.

## Abstraction problems

### [ABS-1] `order` field accepted but never validated — Major
**File:** `backend/src/services/dialog-editing.ts:83-95`
**What's wrong:** The service validates that message count matches and that `character` values match by index position. It does NOT validate that the `order` field of the LLM response matches the original. The `order` field is included in the prompt and parsed from the response, but is completely ignored during validation. The matching is purely positional (array index `i`).
**Why it's bad:** If the LLM returns messages in a different order (e.g. swaps order 1 and 2), the positional matching will apply the wrong text to the wrong message. The `order` field creates a false sense of correctness — it's included in the schema but never used for alignment or validation. Either sort by `order` before matching, validate `order` matches, or stop including it entirely.

### [ABS-2] `LLMResponseMessage.character` type `1 | 2` not enforced at runtime — Minor
**File:** `backend/src/services/dialog-editing.ts:13-16, 40`
**What's wrong:** The TypeScript type declares `character: 1 | 2`, but the runtime validation at line 40 only checks `typeof msg.character !== 'number'`. A value like `character: 3` or `character: 0` passes validation and gets compared against the original. It won't cause a data corruption (the character mismatch check on line 90 will catch it), but the type annotation is misleading — it promises a constraint that the code doesn't enforce.
**Why it's bad:** The `as LLMResponseMessage[]` cast on line 45 trusts the runtime check, but the runtime check is weaker than the type claims. This is a type assertion abuse — the `as` cast is not backed by equivalent runtime validation.

## Potential bugs

### [BUG-1] Non-atomic multi-message update — Major
**File:** `backend/src/services/dialog-editing.ts:97-103`
**What's wrong:** Messages are updated one by one in a sequential loop with individual `await db.dialogs.updateMessage()` calls. If the third update fails (DB error, constraint violation), the first two updates are already committed. There is no transaction wrapping the batch.
**Why it's bad:** A partial update leaves the dialog in an inconsistent state — some messages edited, others not. The function then re-fetches the dialog and returns it as if everything succeeded (or throws, but the damage is done). For SQLite this could be wrapped in a transaction; for Supabase it's harder but the problem should at least be acknowledged. In practice, `updateMessage` is unlikely to fail for a simple text update, but the code has no protection against it.

### [BUG-2] `updated!` non-null assertion after re-fetch — Minor
**File:** `backend/src/services/dialog-editing.ts:106`
**What's wrong:** `const updated = await db.dialogs.getWithMessages(dialogId); return updated!;` — The non-null assertion assumes the dialog still exists after the update loop. If another process deletes the dialog between the update and the re-fetch, this returns `null` disguised as a non-null type.
**Why it's bad:** In practice unlikely for a single-user tool, but the `!` assertion is a code smell. It silences the type system where a proper guard or error throw would be more honest.

## Code quality

### [QUAL-1] `resolveLLMProvider` return-null pattern forces awkward control flow — Minor
**File:** `backend/src/routes/services/index.ts:42-43`
**What's wrong:** The pattern `const llm = await resolveLLMProvider(providerId, reply); if (!llm) return;` relies on `resolveLLMProvider` having already sent the error response via `reply.notFound()` / `reply.badRequest()` as a side effect, then returning `null`. The handler must remember to check and bail. This is the same pattern used in `llm/index.ts` and `tts/index.ts`, so it's a codebase convention — but it's still a side-effect-driven control flow that separates the decision (which error) from the place that acts on it (return).
**Why it's bad:** If someone forgets the `if (!llm) return;` check, the handler continues with a null provider and crashes. The pattern works but is inherently fragile. Not specific to this PR — it's a pre-existing pattern — but worth noting since this PR adds another copy.

### [QUAL-2] Service unit tests use mocks instead of integration DB — Minor
**File:** `backend/tests/services/dialog-editing.test.ts:23-38`
**What's wrong:** The `createMocks()` function constructs a fake `IDatabase` with `as unknown as IDatabase`. Only `dialogs.getWithMessages` and `dialogs.updateMessage` are mocked — the rest of `IDatabase` is missing. The backend CLAUDE.md says: "Integration tests: in-memory SQLite (real SQL). Unit tests: mocked repos (isolates handler logic)."
**Why it's bad:** This is a service, not a handler. The convention allows mocked repos for handler/route tests (which `services.test.ts` does correctly via `buildTestApp()`), but for services the question is whether the service should be tested with real DB calls. The mock approach works here since the service is a pure function with injected deps, and testing it with mocks is legitimate for isolating the LLM interaction. However, there's no integration test that exercises `editDialog` against a real in-memory SQLite, which means the actual `updateMessage` SQL path combined with `getWithMessages` re-fetch is never tested end-to-end. The route test partially covers this, but it mocks `createLLMProvider`, so the DB path is real while the LLM is fake — which is actually a reasonable integration test. This one is borderline.

## Testing violations

### [TEST-1] No test for LLM provider `complete()` throwing — Minor
**File:** `backend/tests/routes/services.test.ts`
**What's wrong:** There is no route test for the case where `llmProvider.complete()` itself throws (e.g., network error, API rate limit, 500 from the upstream LLM). The route handler has a catch block, but the `throw error` fallback on line 68 is never exercised by any test.
**Why it's bad:** If `complete()` throws an error whose message doesn't match any of the string patterns (lines 56-65), the code re-throws it, which Fastify catches and returns as 500. This path is untested. Given the fragility of the string-matching error classification (ARCH-2), this is a real gap.

### [TEST-2] No test for `createLLMProvider` factory failure — Minor
**File:** `backend/tests/routes/services.test.ts`
**What's wrong:** The route test mocks `createLLMProvider` to always succeed. There is no test for the `catch` block in `resolveLLMProvider` (line 28-31) where the factory throws. The code returns `reply.badRequest(...)` in that case, but no test verifies it.
**Why it's bad:** Dead code from a testing perspective. If the catch block has a bug, it won't be caught.

## Summary
- Fundamental issues: 0
- Major issues: 3 (ARCH-1, ARCH-2, ABS-1)
- Minor issues: 5 (ABS-2, BUG-2, QUAL-1, QUAL-2, TEST-1, TEST-2)
- Also major but more of a design concern: BUG-1 (non-atomic updates)

Overall assessment: Structurally sound service with clean separation of concerns and good test coverage for the happy path, but the error-classification-by-string-matching in the route is a ticking time bomb, the `resolveLLMProvider` duplication is sloppy, and the `order` field is a phantom validation that creates false confidence.
