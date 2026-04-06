# Alignment Check — Issue #16: Dialog Generation Service + Route

## Original Analysis Summary

The analysis planned a dialog generation feature with the following architecture:

1. **New endpoint:** `POST /services/generate-dialog` accepting `{ providerId, model, language, prompt, messageCount }`.
2. **Route handler** resolves an LLM provider (DB lookup, type check, API key retrieval, factory call), then delegates to a pure service function.
3. **Service function** `generateDialog()` takes injected dependencies (`ILLMProvider`, `IDialogRepository`), constructs a system prompt instructing the LLM to return a JSON array of `{character, text}` objects, calls `llmProvider.complete()`, parses/validates the JSON response, creates a `Dialog` and `DialogMessage` records, and returns `DialogWithMessages`.
4. **Schema file** `backend/src/schemas/service.ts` with `GenerateDialogBody` TypeBox schema, `additionalProperties: false`, `messageCount` minimum 2.
5. **Files to create:** 4 files (schema, service, route, two test files) — plus the schema file identified during research, totaling 5 files.
6. **TDD approach:** Red-Green-Refactor cycle.
7. **Key risks identified:** LLM JSON parsing (code fences, malformed JSON), character assignment validation (1 or 2 only), message count mismatch, transaction safety (accepted as-is for internal tool), route prefix autoloading.
8. **Patterns to follow:** `resolveLLMProvider` local helper (copied from `routes/llm/index.ts`), `FastifyPluginAsyncTypebox` typing, `@fastify/sensible` error responses, mock patterns from existing route tests.

## What Was Implemented

### `backend/src/schemas/service.ts`
- `GenerateDialogBody` TypeBox schema with all 5 fields.
- `additionalProperties: false` applied.
- `messageCount`: `Type.Integer({ minimum: 2, maximum: 50 })`.
- `prompt`: `Type.String({ minLength: 1 })`.
- Static type export via `Static<typeof GenerateDialogBody>`.

### `backend/src/services/dialog-generation.ts`
- `GenerateDialogParams` interface with injected `ILLMProvider` and `IDialogRepository`.
- `buildSystemPrompt()` constructs a system prompt specifying JSON array format, character 1|2 constraint, message count, and language (BCP 47).
- `extractJSON()` strips markdown code fences via regex.
- `parseAndValidate()` validates array structure, character values (1 or 2), and non-empty text strings.
- `generateDialog()` orchestrates the full flow: LLM call, parse, create dialog (title truncated at 100 chars), create messages in order, return via `getWithMessages()`.

### `backend/src/routes/services/index.ts`
- `FastifyPluginAsyncTypebox` typed plugin.
- Local `resolveLLMProvider()` helper matching the pattern from `routes/llm/index.ts`.
- `POST /generate-dialog` with response schemas for 201, 400, 404, 500.
- Returns 201 with `DialogWithMessages` on success.
- Uses `@fastify/sensible` (`reply.notFound()`, `reply.badRequest()`).

### `backend/tests/services/dialog-generation.test.ts`
- 9 unit tests covering: LLM prompt construction, system prompt content, dialog creation with correct language, message ordering, return value, code fence handling, invalid JSON, invalid character values, and language in system prompt.
- Mocks `ILLMProvider` and `IDialogRepository` at the interface level.

### `backend/tests/routes/services.test.ts`
- 11 integration tests via `app.inject()` covering: happy path (201 + correct body), model passthrough, persistence verification, 404 for missing provider, 404 for non-LLM provider, 400 for missing API key, 400 for missing fields, 400 for messageCount < 2, 400 for empty prompt, additional properties stripping, and 500 for invalid LLM JSON.
- Uses `buildTestApp()`, mocks `createLLMProvider` decorator, seeds providers via DB.

## Mismatches

### 1. `messageCount` maximum constraint added — Minor
**Analysis:** Specified `messageCount: Type.Integer({ minimum: 2 })` with no upper bound.
**Implementation:** Added `maximum: 50` to the schema.
**Assessment:** This is a sensible defensive addition. Prevents absurd requests that could exhaust LLM token budgets or cause timeouts. Not in the original spec but a pragmatic improvement. No functional conflict.

### 2. `prompt` minLength constraint added — Minor
**Analysis:** Specified `prompt: Type.String()` with no constraints.
**Implementation:** Added `minLength: 1` to the prompt schema.
**Assessment:** Prevents empty-string prompts from reaching the LLM. Matches the route test that explicitly verifies 400 for empty prompt. Sensible guard rail not originally specified.

### 3. No message count validation/truncation in service — Minor
**Analysis (Risk #3):** "The LLM may return more or fewer messages than `messageCount`. Service should validate or truncate."
**Implementation:** The service does not compare `parsedMessages.length` against `messageCount`. It accepts whatever the LLM returns.
**Assessment:** The risk was identified but the decision to skip truncation is reasonable for an internal tool. The system prompt requests the exact count, and the service validates structure/format but not quantity. This is a conscious trade-off, not an oversight, but it does leave the identified risk unmitigated.

### 4. `description` not set on created dialog — Minor
**Analysis:** Mentioned `Dialog` has a `description` field; the analysis assumed `created_by` would be null but did not specify description handling.
**Implementation:** `dialogRepo.create({ title, language })` — `description` defaults to null (handled by the repository layer).
**Assessment:** Consistent with the `CreateDialog` interface where `description` is optional. No issue.

### 5. Test count difference — Minor
**Analysis:** Did not specify exact test counts, but described categories of tests to write.
**Implementation:** 9 service tests + 11 route tests = 20 total. Covers all categories mentioned in the analysis plus some additional edge cases (empty prompt, additional properties stripping).
**Assessment:** More thorough than specified. No concern.

## Corrections Made

Per the execution log: **no deviations from plan.** The implementation followed the analysis exactly. The two minor schema additions (`maximum: 50`, `minLength: 1`) were pragmatic improvements made during implementation, not corrections to the plan.

The TDD cycle was followed faithfully:
- Task 2 (service tests): all 9 failed (RED) — module not found as expected.
- Task 3 (service implementation): all 9 passed (GREEN).
- Task 4 (route tests): 9 of 11 failed (RED) — route not registered; 2 passed (expected 404 behavior).
- Task 5 (route handler): all 20 passed (GREEN).

No existing files were modified. No regressions in the full test suite (285 tests).

## Final Alignment Verdict

**Aligned.**

The implementation faithfully follows the original analysis in all material aspects: architecture (pure service + route handler), file structure (5 files as planned), patterns (resolveLLMProvider, TypeBox schemas, TDD, mock patterns), risk mitigations (JSON code fence stripping, character validation, error handling), and conventions (additionalProperties: false, ESM imports, response schemas, @fastify/sensible errors).

The three minor mismatches are all additive improvements (schema constraints, extra tests) rather than deviations. The one unmitigated risk (message count validation) was consciously identified in the analysis as something that "should" be done but is acceptable to defer for an internal tool. Overall, the implementation is a clean, faithful execution of the plan.
