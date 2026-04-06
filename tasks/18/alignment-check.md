# Alignment Check -- Issue #18: Auto-annotation service + route

## Original Analysis Summary

The analysis specified creating a `POST /services/annotate` endpoint that:

1. Receives `dialogId`, `providerId` (LLM), `model`, `annotationPromptId`, `ttsProviderId`, and `title`
2. Resolves the LLM provider in the route handler (check provider exists + is type `llm`, get API key, create instance)
3. Delegates to a pure service function `autoAnnotate(params, deps)` with dependency injection
4. Service fetches the dialog with messages and the annotation prompt from DB
5. For each message, builds a growing conversation history: system prompt + prior user/assistant pairs + current user message
6. Calls `llm.complete(messages, model)` per message
7. Uses collect-then-write pattern: gather all LLM responses first, then write to DB
8. Stores `ttsProviderId` as `AnnotatedDialog.provider_id` (the TTS provider the annotation is *for*, not the LLM that did the annotating)
9. Returns `AnnotatedDialogWithMessages` by calling `db.annotations.getWithMessages()` after writing

Five files were specified:
- `backend/src/schemas/service.ts` -- TypeBox schema
- `backend/src/services/auto-annotation.ts` -- pure service function
- `backend/tests/services/auto-annotation.test.ts` -- 7 unit tests
- `backend/src/routes/services/index.ts` -- Fastify route handler
- `backend/tests/routes/services.test.ts` -- 9 integration tests

Error cases specified: dialog not found (404), annotation prompt not found (404), dialog has no messages (400), LLM provider not found (404), LLM provider wrong type (404), no API key (400), missing body fields (400).

## What Was Implemented

All 5 planned files were created:

| File | Status | Tests |
|------|--------|-------|
| `backend/src/schemas/service.ts` | Created | N/A |
| `backend/src/services/auto-annotation.ts` | Created | 7 unit tests |
| `backend/tests/services/auto-annotation.test.ts` | Created | 7 tests passing |
| `backend/src/routes/services/index.ts` | Created | 9 integration tests |
| `backend/tests/routes/services.test.ts` | Created | 9 tests passing |

Full test suite: 281/281 tests pass. TypeScript compiles cleanly.

**Service function** (`autoAnnotate`):
- Pure function with `AutoAnnotateParams` + `AutoAnnotateDeps` (db + llmProvider)
- Fetches dialog and annotation prompt, validates both exist and dialog has messages
- Builds growing conversation history exactly as specified in analysis section 12
- Uses collect-then-write: all LLM calls complete before any DB writes
- Stores `params.ttsProviderId` as `AnnotatedDialog.provider_id`
- Returns result of `db.annotations.getWithMessages()`

**Route handler** (`POST /services/annotate`):
- Resolves LLM provider: checks provider exists + type is `llm`, gets API key, creates instance
- Wraps `createLLMProvider` in try/catch for unsupported provider
- Maps service errors to HTTP codes via message string matching ("not found" -> 404, "no messages" -> 400)
- Uses `reply.notFound()` / `reply.badRequest()` pattern (consistent with existing `routes/llm/index.ts`)

**Schema**:
- TypeBox `AutoAnnotateBody` with all 6 fields, `additionalProperties: false`

## Mismatches

### 1. Route error handling style: `reply.notFound()` vs `throw fastify.httpErrors.notFound()` -- **Minor**

The plan specified `throw fastify.httpErrors.notFound()` but the implementation uses `return reply.notFound()`. Both are valid Fastify patterns provided by `@fastify/sensible`. The execution log documents this as a deliberate choice to match `routes/llm/index.ts` codebase conventions. Functionally identical.

### 2. Unit test mock style: type casts vs `vi.mocked()` -- **Minor**

The plan used `vi.mocked(db.dialogs.getWithMessages).mockResolvedValue(...)` but the implementation uses `(db.dialogs.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue(...)`. Both work; the plan's `vi.mocked()` approach is slightly cleaner, but the implementation's approach avoids potential issues with Vitest's type inference. No functional difference.

### 3. Unit test fixture values differ from plan -- **Minor**

Some fixture values differ (e.g., language `'en'` vs `'en-US'`, prompt text, mock LLM provider id `'test-llm'` vs `'openai'`). These are cosmetic differences in test data that do not affect test correctness or coverage. All the same scenarios and assertions are covered.

### 4. Integration test uses `makePayload()` helper not in plan -- **Minor**

The tests introduce a `makePayload()` helper function for building request payloads. This is an improvement over the plan's approach of repeating full payloads in every test. Does not change test behavior.

### 5. No `AnnotatedMessage` type import used in unit tests (unused import in plan) -- **Minor**

The plan imported `AnnotatedMessage` as a type in unit tests. The implementation also imports it and uses `satisfies AnnotatedMessage` for type checking mock return values, which is actually more rigorous than the plan.

## Corrections Made

1. **`provider_id` bug caught and fixed** -- The subagent initially used `params.providerId` (LLM provider) instead of `params.ttsProviderId` for `AnnotatedDialog.provider_id`. This was caught during review and corrected (commit `33f27fb`). This is exactly the mistake the analysis warned about in its "Key insight" note.

2. **Error messages with entity IDs** -- The subagent initially used generic messages like `"Dialog not found"` instead of `"Dialog 1 not found"`. Corrected to include entity IDs as specified in the plan.

3. **Collect-then-write enforcement** -- The subagent initially wrote to DB inside the LLM loop. This was corrected to the collect-then-write pattern specified in the analysis (section 10, assumption 6).

4. **`reply.notFound()`/`reply.badRequest()` over `throw`** -- Deliberate improvement to match existing codebase conventions in `routes/llm/index.ts`.

5. **`createLLMProvider` try/catch** -- Added error handling around provider instantiation that was in the plan but initially missed by the subagent. Ensures unsupported providers return 400 instead of crashing.

## Final Alignment Verdict

**PASS**

The implementation is faithful to the original analysis and plan. All 5 specified files were created. The core architecture decisions are correctly implemented:

- **Growing conversation history** (analysis section 12): Verified. The service builds `[system, ...history, user]` per message, pushing user+assistant pairs to history after each call. Unit test explicitly verifies message array lengths of 2, 4, and 6 for a 3-message dialog.
- **`ttsProviderId` stored as `AnnotatedDialog.provider_id`**: Verified. Line 52 of the service: `provider_id: params.ttsProviderId`. Unit test asserts `provider_id: 'elevenlabs'` in the `create` call. Integration test asserts `body.provider_id === 'elevenlabs'`.
- **Collect-then-write pattern**: Verified. Lines 37-47 collect all LLM responses into `llmResponses[]`, then lines 50-63 write to DB.
- **LLM resolution pattern**: Verified. Route checks provider exists + type is `llm`, gets API key, creates instance via factory. Integration tests cover missing provider (404), wrong type (404), and missing key (400).
- **All error cases covered**: Dialog not found (404), annotation prompt not found (404), dialog has no messages (400), LLM provider not found (404), LLM provider wrong type (404), no API key (400), missing body fields (400), unsupported provider (400). That is 8 error cases across 7 unit tests + 9 integration tests (some overlap, some additive).
- **All 5 planned files created**: Confirmed.

All mismatches are Minor (cosmetic or stylistic). No Major or Fundamental mismatches. The three bugs introduced by the subagent were all caught and fixed before finalization. The final code matches the analysis specification.
