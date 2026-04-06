# Code Review: feat/15-llm-api-routes

## Potential Bugs

### [BUG-1] Unhandled errors from `llm.getModels()` and `llm.complete()` — Major
**File:** `backend/src/routes/llm/index.ts:50-51, 70`
**What's wrong:** Both `llm.getModels()` and `llm.complete()` call external APIs (OpenAI, Anthropic). These calls can throw on network errors, authentication failures, rate limits, invalid model IDs, etc. Neither call is wrapped in `try/catch`. Fastify's default error handler will catch these and return a generic 500 with the raw error message.
**Why it's bad:** Raw provider SDK error messages (including potential internal details, stack traces, or API key fragments in some edge cases) will be sent directly to the client in the 500 response body. The route has no 500 response schema defined, so `fast-json-stringify` won't sanitize the output. This is both a data leak risk and a poor user experience — the client gets an opaque internal error instead of a meaningful "LLM provider returned an error" message.

### [BUG-2] `resolveLLMProvider` sets reply status but handler returns `undefined` — Minor
**File:** `backend/src/routes/llm/index.ts:47-49, 66-68`
**What's wrong:** When `resolveLLMProvider` returns `null`, the handler does `if (!llm) return;` — returning `undefined` from an `async` handler. Fastify handles this correctly because `reply.notFound()` / `reply.badRequest()` already sends the response. However, the explicit `return;` after the reply has been sent is relying on Fastify's internal behavior of ignoring the handler return value when the reply is already sent. This is the same pattern used in the TTS routes, so it's consistent — but it's still fragile. If Fastify ever warns on double-send or changes semantics, every route using this pattern breaks simultaneously.
**Why it's bad:** Fragile coupling to Fastify internal behavior. Not a bug today, but a latent one.

## Code Quality

### [QUAL-1] `LLMProviderIdParam` duplicates `ProviderIdParam` from TTS schemas — Minor
**File:** `backend/src/schemas/llm.ts:3-6` vs `backend/src/schemas/tts.ts:3-6`
**What's wrong:** `LLMProviderIdParam` is `Type.Object({ providerId: Type.String() })`. `ProviderIdParam` in `schemas/tts.ts` is identical: `Type.Object({ providerId: Type.String() })`. Two separate schemas with the same structure and the same semantic purpose — identifying a provider by its string ID from the URL.
**Why it's bad:** Copy-paste. When someone adds validation to the `providerId` field (e.g., `minLength`, `pattern` for allowed characters), they'll update one and miss the other. This should live in `schemas/common.ts` next to `StringIdParam`, which already exists for the same conceptual purpose (just with `id` instead of `providerId`).

### [QUAL-2] `resolveLLMProvider` is a copy-paste of `resolveTTSProvider` — Minor
**File:** `backend/src/routes/llm/index.ts:13-35` vs `backend/src/routes/tts/index.ts:24-47`
**What's wrong:** The two functions are structurally identical:
1. Look up provider by ID from DB
2. Check type matches (`'llm'` vs `'tts'`)
3. Get decrypted key
4. Call factory function via Fastify decorator

The only differences are the string `'llm'`/`'tts'`, the decorator name, and the return type. This is the textbook "same algorithm, different data" duplication.
**Why it's bad:** Two places to maintain the same provider-resolution logic. When a third provider type arrives (e.g., STT/speech-to-text), this will be copied a third time. Not critical at two copies, but the trend is clear.

## Testing Violations

### [TEST-1] No test for provider SDK errors propagating as 500 — Major
**File:** `backend/tests/routes/llm.test.ts`
**What's wrong:** There is no test where `mockGetModels` or `mockComplete` rejects with an error (e.g., `.mockRejectedValueOnce(new Error('Rate limit exceeded'))`). The happy path and input validation paths are well-covered, but the "provider call succeeds at resolution but fails at execution" path is completely untested.
**Why it's bad:** This is directly related to BUG-1 above. Without a test, there's no specification for what should happen when the external API fails. If someone later adds error handling, they'll have no test to validate it against.

## Summary
- Critical issues: 0
- Major: 2 (BUG-1, TEST-1 — both related to unhandled provider errors)
- Minor: 3 (BUG-2, QUAL-1, QUAL-2)
- Overall assessment: Clean mechanical port of the TTS pattern. The architecture is sound and the implementation follows established conventions faithfully. The one real gap is error handling for external API calls — the route assumes the provider never throws after successful resolution, which is false for any real HTTP call to OpenAI/Anthropic.
