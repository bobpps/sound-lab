# Issue #17 — Dialog Editing Service: Alignment Check

## Original Analysis Summary

The analysis specified building a dialog editing service exposed at `POST /services/edit-dialog` that:

1. **Service function** `editDialog(params: EditDialogParams)` as a pure function with injected `IDatabase`, `ILLMProvider`, `instructions`, `model`, and `dialogId`.
2. **Data flow:** Fetch dialog via `getWithMessages()` -> build system+user prompt -> call `llmProvider.complete()` -> parse JSON response -> validate (count, characters) -> update changed messages via `updateMessage()` -> re-fetch and return.
3. **LLM prompt structure:** System message instructing JSON array output of `{character, text}` objects. User message with current dialog JSON + instructions.
4. **Edge cases:** Not found (throw), wrong message count (throw), character mismatch (throw), invalid JSON (throw), no-op/unchanged messages (skip update), markdown code fence stripping.
5. **Route:** Uses `resolveLLMProvider` pattern (check provider exists + type is 'llm', get decrypted key, create provider instance). Errors: 404 for not found, 400 for no key/unsupported, 502 for LLM parse failures.
6. **Schemas:** TypeBox with `additionalProperties: false` on body. Response schema using `DialogWithMessages`.
7. **Files:** Service, service tests, route, route tests, and a schemas file.

## What Was Implemented

### Files Created (5 total)
1. `backend/src/services/dialog-editing.ts` — `editDialog()` pure function
2. `backend/src/schemas/service.ts` — `EditDialogBody` TypeBox schema
3. `backend/src/routes/services/index.ts` — `POST /edit-dialog` route
4. `backend/tests/services/dialog-editing.test.ts` — 7 unit tests
5. `backend/tests/routes/services.test.ts` — 8 integration tests

### Service (`dialog-editing.ts`)
- Pure function `editDialog(params: EditDialogParams)` with signature matching analysis: `{ dialogId, llmProvider, instructions, model, db }`.
- Fetches dialog, builds system+user prompt, calls LLM, parses JSON, validates count and characters, updates changed messages only, re-fetches and returns.
- `stripCodeFences()` handles markdown-wrapped responses.
- `parseLLMResponse()` validates JSON structure including individual message shape (order, character, text types).
- Shape validation added during implementation (not in original analysis) to prevent undefined values reaching DB.

### Schema (`service.ts`)
- `EditDialogBody` with `Type.Integer()` for dialogId, `Type.String()` for providerId/model, `Type.String({ minLength: 1 })` for instructions. `additionalProperties: false` applied.

### Route (`routes/services/index.ts`)
- `resolveLLMProvider()` helper follows the described pattern: check provider exists + type='llm', get decrypted key, create provider via decorator.
- Error mapping: 'not found' -> 404, parse/json/count/character/shape -> 502, else rethrow.
- Response schema includes 200 (DialogWithMessages), 400, 404, 502 (ErrorResponse).

### Tests
- Service tests cover: happy path, not found, wrong count, character mismatch, invalid JSON, no-op, code fences.
- Route tests cover: happy path 200, dialog not found 404, provider not found 404, no API key 400, non-LLM provider 404, missing fields 400, empty instructions 400, LLM parse error 502.

## Mismatches

### 1. LLM Response Format: `{ messages: [...] }` wrapper vs flat array — **Minor**

**Analysis said:** LLM returns a flat JSON array of `{ character, text }` objects. System prompt says "Return your response as a JSON array of objects."

**Implementation does:** LLM returns `{ "messages": [{ "order", "character", "text" }] }` wrapper object. System prompt says `Return the edited dialog in the same JSON format: { "messages": [...] }`.

**Impact:** The wrapped format is arguably better because it is more explicit and less ambiguous for LLMs. The `order` field is also included in the response messages (not in the analysis), which adds extra validation potential. This is a design improvement, not a regression.

### 2. Message fields include `order` — **Minor**

**Analysis said:** LLM response messages have `{ character, text }`.

**Implementation does:** LLM response messages have `{ order, character, text }`.

**Impact:** Including `order` provides a more robust contract and makes the prompt's round-trip more symmetrical (the user message sends `{ order, character, text }`, the response returns the same shape). Positive deviation.

### 3. System prompt wording differs from analysis template — **Minor**

**Analysis said:** Detailed multi-paragraph system prompt with specific rules like "Return ONLY the JSON array, no additional text or markdown formatting."

**Implementation does:** More concise system prompt using array-joined lines. Still conveys the same constraints (same count, same characters, only modify text, return JSON).

**Impact:** The intent and constraints are equivalent. The concise version is slightly less explicit about "no markdown" but the code defensively handles code fences regardless. No functional difference.

### 4. Dialog `language` included in user prompt — **Minor**

**Analysis said:** User message contains `Current dialog:` followed by the JSON array.

**Implementation does:** User message contains `Dialog (en-US):` with the language code in parentheses.

**Impact:** Positive deviation. Including the language helps the LLM maintain linguistic consistency when editing.

### 5. Error classification uses broad string matching — **Minor**

**Analysis said:** "not found" -> 404, LLM issues -> 502.

**Implementation does:** String matching on lowercased error message: `not found` -> 404; `parse`, `json`, `message count`, `character`, `shape` -> 502; otherwise rethrow.

**Impact:** This works correctly for all current error paths. The string-matching approach is somewhat fragile if error messages change, but it is the same pattern used in the plan and is acceptable for an internal tool. The implementation covers more keywords than strictly necessary, which is defensive.

### 6. Task 1 (LLM Plugin) was skipped — **Minor**

**Plan said:** Create `backend/src/plugins/llm.ts` and modify `backend/src/app.ts`.

**Implementation did:** Skipped, because the plugin already existed from the feat/16 merge.

**Impact:** Correct decision. The execution log documents this. No code was missing.

## Corrections Made

These corrections were made during implementation (documented in execution log):

1. **Shape validation added to `parseLLMResponse()`** — Validates that each message in the LLM response has the correct types for `order` (number), `character` (number), and `text` (string). Prevents `undefined` values from reaching the database. This was not in the original analysis or plan but is a defensive improvement.

2. **`LLMResponseMessage.character` type tightened** — Changed from generic `number` to `1 | 2` in the type definition for stronger type safety.

3. **Mock extraction pattern improved** — Tests extract `complete` handle from `createMocks()` instead of casting `llmProvider.complete` each time. Cleaner test code.

4. **Specific regex matchers in tests** — Used `/not found/i`, `/message count/i`, `/character/i`, `/parse|json/i` instead of bare `.rejects.toThrow()` for more precise error assertions.

## Final Alignment Verdict

**ALIGNED** — The implementation faithfully follows the analysis and plan with only minor deviations, all of which are improvements:

- The core architecture matches exactly: pure service function with dependency injection, `resolveLLMProvider` pattern in the route, TypeBox schemas with `additionalProperties: false`, and proper error code mapping (404/400/502).
- All 6 edge cases from the analysis are covered: not found, wrong count, character mismatch, invalid JSON, no-op, code fences.
- The function signature matches the spec: `EditDialogParams { dialogId, llmProvider, instructions, model, db }`.
- ESM `.js` extensions used throughout all imports.
- No dual-DB contract violations — service uses `IDatabase` interface, never direct DB access.
- Response schemas defined for `fast-json-stringify`.
- All 15 tests pass (7 service + 8 route), full suite 280/280.

The deviations (wrapped response format, `order` field, concise prompt, language in user message, shape validation) are all defensible engineering decisions that improve robustness without changing the architecture.
