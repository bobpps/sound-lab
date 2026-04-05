# Code Review -- Issue #20: Frontend API Client + Shared Types

**Reviewer:** Claude (holistic final review)
**Date:** 2026-04-06
**Branch:** feat/20-frontend-api-client
**Base:** `3724362` (main)
**Head:** `45db18b`

---

## Diff Summary

Two new files, 193 lines total. No existing files modified (Vite proxy was already handled by #19).

## Files Changed

| File | Lines | Action | Purpose |
|---|---|---|---|
| `frontend/src/types/api.ts` | 103 | Created | 12 read-model types mirroring backend entities |
| `frontend/src/lib/api-client.ts` | 90 | Created | `ApiError` class + typed fetch wrapper (`api.get`, `post`, `put`, `delete`, `fetchRaw`) |

## Verification Outcomes

| Check | Result |
|---|---|
| `npm run build` | Pass -- frontend built in 129ms, no errors |
| `npm test` | Pass -- 204 tests, 15 test files, all green |
| `npm run lint --workspace=frontend` | Pass -- ESLint clean, zero warnings |
| TypeScript type-check | Pass -- implicit via build success |

## Strengths

1. **Exact type parity with backend.** Every field in `frontend/src/types/api.ts` matches the corresponding backend type in `backend/src/db/types.ts` and `backend/src/providers/tts/types.ts`. Verified field-by-field: `Provider`, `Dialog`, `DialogMessage`, `DialogWithMessages`, `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`, `AnnotationPrompt`, `AgentPrompt`, `Voice`, `ApiErrorResponse` -- all correct.

2. **Correct `erasableSyntaxOnly` compliance.** `ApiError` avoids parameter properties; `status` is declared as a class field and assigned in the constructor body. `ProviderType` uses a string union, not an enum. No namespaces.

3. **Correct `verbatimModuleSyntax` compliance.** The sole import is `import type { ApiErrorResponse }` -- properly marked as type-only.

4. **Import extension convention followed.** Uses `.ts` extension (`'../types/api.ts'`) matching existing codebase pattern (`import App from './App.tsx'` in `main.tsx`) and `allowImportingTsExtensions: true`.

5. **YAGNI discipline.** Only read-model types included. Create/Update types deferred to feature directories per plan.

6. **`ApiErrorResponse` matches backend schema exactly.** `{ statusCode: number; error: string; message: string }` mirrors `backend/src/schemas/common.ts` `ErrorResponse` (Fastify/sensible shape).

7. **Clean separation of concerns.** `handleResponse<T>()` centralizes JSON parsing, 204 handling, and error extraction. `buildUrl()` isolates URL construction. `fetchRaw` provides an escape hatch for binary data.

8. **`override readonly name = 'ApiError'`** -- correctly uses `override` keyword for the `Error.name` property, which is good practice for custom error classes.

## Issues

### Minor (Nice to Have)

1. **Duplicated error-handling logic in `delete` method.**
   - File: `frontend/src/lib/api-client.ts:71-85`
   - Issue: The `delete` method duplicates the error-parsing logic from `handleResponse<T>()` (lines 20-28 vs lines 76-83). The only behavioral difference is that `delete` treats 204 as success (which `handleResponse` also does, returning `undefined as T`).
   - Impact: If the error response format changes, two places need updating. Low risk given the format is stable (Fastify standard), but violates DRY.
   - Fix: `delete` could call `handleResponse<void>(response)` instead of inlining the logic. The `undefined as T` return from 204 handling is harmless for `void`. Alternatively, keep as-is since the duplication is small and the intent is explicit.
   - Severity: **Minor** -- the duplication is 8 lines and unlikely to diverge.

2. **`delete` condition `!response.ok && response.status !== 204` is redundant.**
   - File: `frontend/src/lib/api-client.ts:75`
   - Issue: HTTP 204 is a success status, so `response.ok` is `true` for 204. The `&& response.status !== 204` guard is technically unnecessary -- when `!response.ok` is true, the status is already outside 200-299, and 204 is within that range.
   - Impact: No behavioral bug. The code works correctly. It's just a redundant condition that could confuse future readers into thinking 204 might not be `ok`.
   - Fix: Could simplify to `if (!response.ok) { ... }` or use `handleResponse<void>`. Not urgent.
   - Severity: **Minor** -- correct behavior, slightly misleading code.

3. **No PATCH method.**
   - File: `frontend/src/lib/api-client.ts`
   - Issue: The API client provides `get`, `post`, `put`, `delete`, `fetchRaw` but no `patch`. The backend currently uses PUT for updates, so this isn't needed now.
   - Impact: None currently. If PATCH endpoints are added later, callers can use `fetchRaw` or `patch` can be added then.
   - Severity: **Minor** -- YAGNI applies; add when needed.

4. **`post` and `put` set `Content-Type: application/json` even when body is `undefined`.**
   - File: `frontend/src/lib/api-client.ts:49-53`, `62-66`
   - Issue: When `body` is `undefined`, `JSON.stringify` is skipped (correctly), but the `Content-Type: application/json` header is still sent. Sending a content-type header with no body is technically incorrect per HTTP semantics, though in practice servers ignore it.
   - Impact: No practical impact. Fastify and browsers handle this fine.
   - Severity: **Minor** -- pedantic HTTP correctness.

### No Critical or Important Issues Found

The implementation is clean, minimal, and correctly aligned with the plan and project constraints.

## Known Limitations

1. **Types may drift from backend.** Frontend types are manually mirrored, not generated from a shared schema. This is an accepted trade-off documented in the analysis. Future mitigation: codegen from TypeBox schemas or a shared types package.

2. **No runtime validation.** The `handleResponse<T>()` casts `response.json()` as `Promise<T>` without validating the shape at runtime. If the backend returns unexpected data, TypeScript won't catch it. This is standard for typed fetch wrappers; Zod or TypeBox runtime validation could be added per-endpoint if needed.

3. **No request/response interceptors.** No mechanism for auth headers, request logging, retry logic, or token refresh. These would be added when auth is implemented (future issue).

4. **No abort/cancellation support.** The `get`, `post`, `put` methods don't accept `AbortSignal`. Callers needing cancellation must use `fetchRaw`. TanStack Query handles this at the hook level, so this is acceptable.

5. **`BASE_URL` is hardcoded.** `/api` is not configurable via environment variable. This is fine since the Vite proxy is the only consumer path, but noted for completeness.

## PR Readiness

**Ready to merge: Yes**

**Reasoning:** The implementation is minimal, correct, and fully aligned with the plan. All 12 entity types exactly mirror backend definitions. The API client follows project conventions (`erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` import extensions). Build, tests (204/204), and lint all pass. The minor issues identified are cosmetic/pedantic and do not affect correctness or maintainability. No existing files were modified, so there is zero regression risk.
