# Code Review: Issue #15 -- LLM API Routes

**Reviewer:** Claude Opus 4.6 (code-reviewer)
**Date:** 2026-04-06
**Branch:** feat/15-llm-api-routes
**Base:** deb4c9a (main)
**Head:** 38cf5bf

---

## Diff Summary

6 files changed, +443 lines, 0 deletions.

| File | Change | Lines |
|------|--------|-------|
| `backend/src/app.ts` | Modified | +2 (import + register llmPlugin) |
| `backend/src/plugins/llm.ts` | New | 18 (Fastify plugin decorator) |
| `backend/src/routes/llm/index.ts` | New | 75 (route plugin: resolveLLMProvider + 2 endpoints) |
| `backend/src/schemas/llm.ts` | New | 30 (TypeBox schemas) |
| `backend/tests/routes/llm.test.ts` | New | 243 (14 test cases) |
| `tasks/15/execution-log.md` | New | 75 (task artifact) |

---

## Verification Outcomes

| Check | Result |
|-------|--------|
| TypeScript build | Pass |
| Tests | 263/263 pass (14 new LLM route tests) |
| Lint | Clean |
| Regression | None |

---

## Strengths

1. **Exact pattern mirror of TTS routes.** The plugin, routes, schemas, and tests follow the established TTS pattern line-for-line. This makes the codebase predictable and maintainable. New developers who understand one provider route understand them all.

2. **Thorough test coverage.** 14 test cases cover: happy path for both endpoints, argument forwarding, 404 (missing provider), 404 (wrong type), 400 (no API key), 400 (unsupported registry), 400 (empty messages), 400 (missing required fields), 400 (invalid role), and additional-properties stripping. Both GET and POST endpoints have symmetric error coverage.

3. **Clean schema design.** `LLMMessage` uses `Type.Union` of `Type.Literal` values to match the `ILLMMessage` interface exactly. `CompleteBody` has `additionalProperties: false` and `minItems: 1` as required by backend conventions. Response schemas are present for `fast-json-stringify` optimization.

4. **TDD discipline.** Commit history shows RED (56341c3) then GREEN (a8ffac5) -- tests written first, implementation second.

5. **Good error messages.** `resolveLLMProvider()` returns differentiated error messages for each failure mode: provider not found, no API key, unsupported provider.

---

## Issues

### Minor

1. **Duplicated `ProviderIdParam` schema**
   - File: `backend/src/schemas/llm.ts:3-5`
   - `LLMProviderIdParam` is identical to `ProviderIdParam` in `backend/src/schemas/tts.ts:3-5`. Both are `Type.Object({ providerId: Type.String() })`.
   - Impact: Low. This is a minor DRY concern. The TTS routes also define their own copy, so this is consistent with the existing pattern.
   - Fix (optional): Extract a shared `ProviderIdParam` into `schemas/common.ts` and import from both. However, since this would also require changing TTS routes, it is out of scope for this PR.

2. **No error handling for `llm.complete()` / `llm.getModels()` runtime exceptions**
   - File: `backend/src/routes/llm/index.ts:51-52, 70-71`
   - If the underlying provider throws (e.g., network error, API rate limit, invalid model), the error will propagate as a 500 with Fastify's default error handler. This is consistent with the TTS routes, which also do not catch provider method errors.
   - Impact: Low. Fastify's default error handler will log the error and return a generic 500. For an internal tool, this is acceptable.
   - Fix (optional, future): Add a try/catch around provider method calls to return structured error responses (e.g., 502 for upstream failures). This should be done across both TTS and LLM routes together in a separate PR if desired.

3. **No test for provider method exceptions**
   - File: `backend/tests/routes/llm.test.ts`
   - There are no tests for what happens when `llm.complete()` or `llm.getModels()` throws (e.g., `mockComplete.mockRejectedValueOnce(new Error('API rate limited'))`). Again, TTS tests also lack this coverage.
   - Impact: Low. The behavior (500 response) is correct by default. A test would serve as documentation.

---

## Known Limitations

1. **No streaming support.** `POST /complete` returns the full response as a single JSON object. Streaming (SSE/WebSocket) is not in scope for this issue.
2. **Provider instantiated per-request.** `resolveLLMProvider()` creates a new provider instance for each request (DB lookup + decrypt + factory). This matches TTS behavior. Caching could be added later if performance becomes a concern.
3. **No request timeout.** Long-running LLM completions have no explicit timeout beyond Fastify's server-level defaults.

---

## Assessment

**Ready to merge: Yes**

**Reasoning:** The implementation is clean, follows the established TTS route pattern exactly, has comprehensive test coverage (14 tests), and all verification checks pass. The three minor issues identified are consistent with existing patterns in the codebase (TTS routes have the same characteristics) and do not warrant blocking the PR. No critical or important issues found.
