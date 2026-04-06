# Alignment Check: Issue #14 -- Anthropic Claude LLM Adapter

## Original Analysis Summary

The analysis (`tasks/14/analysis.md`) specified:

**Key requirements:**
1. Create `ILLMMessage` and `ILLMProvider` type interfaces in `backend/src/providers/llm/types.ts`
2. Create `AnthropicLLMProvider` adapter class in `backend/src/providers/llm/anthropic.ts`
3. Create LLM provider registry (`createLLMProvider`, `getSupportedLLMProviders`) in `backend/src/providers/llm/registry.ts`
4. Full test coverage for adapter and registry in separate test files
5. Add `@anthropic-ai/sdk` dependency to `backend/package.json`

**Design decisions:**
- `ILLMMessage.role` includes `'system'` in the universal interface; each adapter translates to its provider's format
- `complete()` returns `Promise<string>` (text only, matching TTS simplicity)
- `getModels()` returns a curated/hardcoded list (no API call)
- `complete()` extracts system messages from the array and passes them via the Anthropic API's dedicated `system` parameter
- Multiple system messages concatenated with `\n\n`
- `max_tokens: 4096` hardcoded default
- Response extraction: find first `type === 'text'` block, return empty string if none
- Registry mirrors `providers/tts/registry.ts` pattern exactly
- Mock the SDK constructor in tests, not `fetch`

**Assumptions:**
- OpenAI adapter is out of scope
- No `validateCredentials()` method needed
- Only `anthropic` registered in the registry
- SDK default export is the `Anthropic` constructor accepting `{ apiKey: string }`

## What Was Implemented

### `backend/src/providers/llm/types.ts`
- `ILLMMessage` with `role: 'system' | 'user' | 'assistant'` and `content: string` -- matches analysis exactly
- `ILLMProvider` with `readonly id`, `readonly name`, `getModels(): Promise<string[]>`, `complete(messages, model): Promise<string>` -- matches analysis exactly

### `backend/src/providers/llm/anthropic.ts`
- Class `AnthropicLLMProvider implements ILLMProvider`
- `id = 'anthropic'`, `name = 'Anthropic'`
- Static readonly `MODELS` array: `claude-sonnet-4-5-20250929`, `claude-haiku-3-5-20241022`, `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229` -- matches analysis
- Constructor takes `apiKey`, creates `new Anthropic({ apiKey })` -- matches analysis
- `getModels()` returns the static list with no API call -- matches analysis
- `complete()` separates system vs. non-system messages, builds `MessageCreateParams` with `max_tokens: 4096`, conditionally sets `system` param, extracts text block from response -- matches analysis
- Text extraction uses `textBlock && 'text' in textBlock ? textBlock.text : ''` -- slightly more defensive than analysis's `textBlock?.text ?? ''`, functionally equivalent

### `backend/src/providers/llm/registry.ts`
- `PROVIDERS` record mapping `'anthropic'` to `AnthropicLLMProvider` -- matches analysis
- `createLLMProvider(providerId, apiKey)` factory with error on unknown ID -- matches analysis
- `getSupportedLLMProviders()` returns `Object.keys(PROVIDERS)` -- matches analysis

### `backend/tests/providers/anthropic-llm.test.ts`
- 11 test cases covering: identity (2), getModels (3), complete (6)
- All test cases from the analysis are present
- SDK mock pattern differs from the plan (see Corrections Made below)

### `backend/tests/providers/llm-registry.test.ts`
- 3 test cases: creates Anthropic provider, throws on unknown, lists supported providers
- Matches analysis/plan exactly

### Dependency
- `@anthropic-ai/sdk@^0.82.0` added to backend

## Mismatches

### 1. Test count discrepancy in plan summary text (Severity: Minor)
The plan's prose states "12 new tests total: 9 adapter + 3 registry" but the plan's own test code actually contains 11 `it()` blocks for the adapter (2 identity + 3 getModels + 6 complete). The implementation has 11 adapter tests, which matches the plan's code but not its summary. The execution log correctly reports 11 + 3 = 14 total. This is a documentation typo in the plan, not an implementation issue.

### 2. Text block extraction: slightly more defensive guard (Severity: Minor)
- **Analysis:** `textBlock?.text ?? ''`
- **Implementation:** `textBlock && 'text' in textBlock ? textBlock.text : ''`

The implementation adds a `'text' in textBlock` type guard, which is marginally more type-safe when dealing with the Anthropic SDK's union types (content blocks can be `TextBlock` or `ToolUseBlock`). Functionally identical behavior. This is actually an improvement over the analysis.

### 3. No mismatches found in interfaces, registry, or overall architecture (N/A)
All five files to create were created. The file to modify (`backend/package.json`) was modified. The directory structure, naming conventions, ESM imports with `.js` extensions, and overall architectural pattern all match the analysis precisely.

## Corrections Made

### Mock pattern fix (documented in execution-log.md)
The plan's mock approach (`const mockCreate = vi.fn()` declared outside with `vi.mock` factory using `mockImplementation`) broke when combined with `vi.restoreAllMocks()` in `afterEach`. After `restoreAllMocks`, the constructor mock lost its implementation, causing `client.messages` to be `undefined` in subsequent tests.

**Fix applied:** Import the mocked `Anthropic` directly, use `vi.mocked(Anthropic).mockImplementation(...)` in `beforeEach` to re-apply the mock before each test, and add `mockCreate.mockReset()` in `beforeEach`. This is documented as a more robust pattern that correctly interacts with `vi.restoreAllMocks()`.

This deviation is well-justified: it fixes a real bug in the plan's test code while preserving the same test coverage and assertions. The mock still targets the SDK constructor (not fetch), as specified in the analysis.

## Final Alignment Verdict

**Aligned.** The implementation matches the original analysis in all material aspects: interfaces, adapter logic, registry structure, test coverage, and architectural patterns. The only deviations are:

1. A justified fix to the test mock pattern that was necessary to make `vi.restoreAllMocks()` work correctly (documented in execution log)
2. A trivially more defensive type guard in text block extraction (improvement, not regression)
3. A count typo in the plan's summary text (9 vs. 11 adapter tests) that does not affect the implementation

No requirements were dropped. No scope was added. No architectural decisions were changed. The implementation is a faithful execution of the analysis.
