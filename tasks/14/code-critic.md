# Code Review: feat/14-anthropic-llm

## Architectural violations

### [ARCH-1] Missing Fastify plugin for LLM providers (Major)
**File:** `backend/src/app.ts` (absent registration), `backend/src/plugins/` (no `llm.ts`)
**What's wrong:** TTS providers are properly integrated into Fastify via `backend/src/plugins/tts.ts` — a `fastify-plugin` that decorates the instance with `createTTSProvider` and includes declaration merging for `FastifyInstance`. The LLM registry has no corresponding plugin. The code exists in isolation: it's a library that nothing in the Fastify app can reach.
**Why it's bad:** Without a plugin, routes cannot access the LLM provider factory through `fastify.createLLMProvider(...)`. The entire adapter is dead code from the application's perspective. Either this is unfinished work shipped as "done," or the next developer has to figure out the integration pattern themselves, which the TTS plugin already established as a convention.

### [ARCH-2] No `validateCredentials` method on `ILLMProvider` (Major)
**File:** `backend/src/providers/llm/types.ts:6-11`
**What's wrong:** Every TTS provider (`ITTSProvider`) exposes `validateCredentials(): Promise<boolean>`. The LLM interface omits it entirely. The existing provider CRUD routes (`/providers/:id/key`) rely on credential validation as part of the key management flow — this is visible in how TTS providers are used.
**Why it's bad:** Breaks the consistent provider contract. When LLM routes are added, either the interface will need a breaking change, or the credential validation path will be missing for LLM providers. The TTS adapter set the pattern; the LLM adapter ignores it.

## Abstraction problems

### [ABS-1] Hardcoded `max_tokens: 4096` with no override mechanism (Major)
**File:** `backend/src/providers/llm/anthropic.ts:31`
**What's wrong:** `max_tokens` is baked into the `complete()` method. The `ILLMProvider.complete()` signature accepts only `messages` and `model` — there is no way for callers to control output length, temperature, top_p, or any other generation parameter.
**Why it's bad:** This is a tool for *testing* LLM providers. The whole point is to experiment with different configurations. Hardcoding `max_tokens` and providing zero knobs means the first real use case will force a signature change to `complete()`, which will break all existing implementations and tests. The interface was designed too narrowly for its stated purpose.

### [ABS-2] `complete()` returns `string` — discards all response metadata (Minor)
**File:** `backend/src/providers/llm/types.ts:10`
**What's wrong:** The return type is `Promise<string>`. Token usage (`input_tokens`, `output_tokens`), stop reason, model version — all discarded. The Anthropic SDK response contains `usage`, `stop_reason`, `model` — none of it is surfaced.
**Why it's bad:** For a testing/evaluation tool, token usage and stop reason are essential metrics. Returning bare text means a second API call or interface change will be needed when anyone wants to understand *why* a response was truncated or how much it cost.

### [ABS-3] Static model list will silently go stale (Minor)
**File:** `backend/src/providers/llm/anthropic.ts:9-15`
**What's wrong:** `MODELS` is a hardcoded static array. The Anthropic API has a `/v1/models` endpoint that returns the actual available models. `getModels()` ignores it entirely and returns the frozen list.
**Why it's bad:** When Anthropic deprecates a model or adds new ones, this list becomes inaccurate. Users testing against a "supported" model that no longer exists will get cryptic API errors. The TTS providers at least call the real API in their equivalent methods (`getVoices()`).

## Project patterns

### [PAT-1] `ILLMMessage` duplicates a concept that should come from the domain layer (Minor)
**File:** `backend/src/providers/llm/types.ts:1-4`
**What's wrong:** The project already has `DialogMessage` with `character: 1 | 2` and `text` in `db/types.ts`. `ILLMMessage` introduces a parallel `role` + `content` type with no mapping or relationship to the existing domain model. There's no adapter or conversion function between the two.
**Why it's bad:** When the annotation workflow needs to send dialog messages to an LLM (the core use case of this project), someone will have to write the `DialogMessage -> ILLMMessage` conversion. The gap between domain types and provider types is undocumented and unaddressed.

## Code quality

### [QUAL-1] Redundant type guard in `textBlock` extraction (Minor)
**File:** `backend/src/providers/llm/anthropic.ts:44-45`
```typescript
const textBlock = response.content.find((block) => block.type === 'text');
return textBlock && 'text' in textBlock ? textBlock.text : '';
```
**What's wrong:** The `.find((block) => block.type === 'text')` already narrows to `TextBlock`, which by Anthropic SDK types guarantees the `text` property. The additional `'text' in textBlock` check is redundant — it's guarding against something the type system already prevents.
**Why it's bad:** Minor noise. Makes a reader wonder whether there's a runtime edge case that justified this double-check. There isn't.

### [QUAL-2] Model list contains a stale/non-existent model ID (Minor)
**File:** `backend/src/providers/llm/anthropic.ts:10`
**What's wrong:** `claude-sonnet-4-5-20250929` — this model ID format does not follow Anthropic's established naming convention (`claude-{version}-{variant}-{date}`). Published model IDs are `claude-sonnet-4-5-20250514`, not `20250929`. This looks like a fabricated or future-dated model ID.
**Why it's bad:** If any code path validates model IDs against this list before calling the API, it will pass validation but fail at Anthropic's endpoint. Users will see a confusing "model not found" error from the API after the application said the model was valid.

## Potential bugs

### [BUG-1] `complete()` has no error handling (Major)
**File:** `backend/src/providers/llm/anthropic.ts:42`
**What's wrong:** `await this.client.messages.create(params)` is completely unwrapped — no `try/catch`, no error translation. The Anthropic SDK throws `APIError` subclasses (`AuthenticationError`, `RateLimitError`, `BadRequestError`) with SDK-specific properties. These will propagate raw to the caller.
**Why it's bad:** Compare with TTS providers: `GoogleTTSProvider.synthesize()` wraps errors into `new Error('Google TTS API error: ...')`. `ElevenLabsTTSProvider` checks `response.ok` and throws a formatted error. The LLM adapter lets raw SDK exceptions escape, leaking SDK internals to consumers. When this hits a Fastify route handler, the error message will include SDK stack traces and internal details in the HTTP response.

### [BUG-2] No test for API error propagation (Minor)
**File:** `backend/tests/providers/anthropic-llm.test.ts`
**What's wrong:** Tests cover the happy path (successful completion, system message extraction, empty response). There is no test for what happens when `messages.create` throws — authentication failure, rate limiting, invalid model, network error. None of these scenarios are tested.
**Why it's bad:** Combined with BUG-1, this means the error behavior is both undefined and unverified. The test suite gives false confidence that the adapter works correctly.

## Testing violations

### [TEST-1] Mocking pattern is appropriate for this case (no issue)
The tests mock the Anthropic SDK, which is correct for a provider adapter — these are unit tests for the adapter logic, not integration tests. The TTS provider tests follow the same pattern. No issue here.

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| **Fundamental** | 0 | — |
| **Major** | 4 | ARCH-1, ARCH-2, ABS-1, BUG-1 |
| **Minor** | 5 | ABS-2, ABS-3, PAT-1, QUAL-1, QUAL-2, BUG-2 |

**Overall assessment:** The adapter correctly implements the Anthropic Messages API mechanics (system message extraction, text block parsing), but it's an incomplete integration: no Fastify plugin, no credential validation, no error handling, no generation parameters. It follows the TTS registry structure but omits half the patterns that make the TTS providers production-usable. The code works in isolation; it doesn't work as part of Sound Lab.
