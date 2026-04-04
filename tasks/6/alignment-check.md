# Alignment Check: Annotation Prompts CRUD Routes (Issue #6)

## Original Analysis Summary

The analysis expected five REST endpoints on `/annotation-prompts`:

| Method | Path | Response | Status |
|--------|------|----------|--------|
| GET | `/annotation-prompts` | `AnnotationPrompt[]` | 200 |
| GET | `/annotation-prompts/:id` | `AnnotationPrompt` | 200 / 404 |
| POST | `/annotation-prompts` | `AnnotationPrompt` | 201 |
| PUT | `/annotation-prompts/:id` | `AnnotationPrompt` | 200 / 404 |
| DELETE | `/annotation-prompts/:id` | (empty) | 204 / 404 |

Key architectural requirements from the analysis:

1. **Route plugin type**: `FastifyPluginAsyncTypebox` (decided during analysis, matching the existing health route)
2. **Response schemas defined for every endpoint** including error schemas (`ErrorResponse` for 404 cases, `Type.Null()` for 204)
3. **404 pre-check pattern**: GET/:id, PUT/:id, DELETE/:id must call `getById()` first and return 404 if null, because the local `update()` throws a generic Error on miss and `delete()` silently succeeds
4. **TypeBox schemas**: Import `AnnotationPrompt`, `CreateAnnotationPrompt`, `UpdateAnnotationPrompt` from `schemas/prompt.ts`; `IdParam`, `ErrorResponse` from `schemas/common.ts`
5. **ESM imports**: All imports use `.js` extensions
6. **Error handling**: `reply.notFound()` from `@fastify/sensible`; 400 automatic from Fastify schema validation
7. **Testing**: 10 tests across 5 describe blocks covering happy paths and error paths, using `buildTestApp()` + `app.inject()` pattern
8. **TDD**: Tests written before implementation, red-green cycle per endpoint

## What Was Implemented

### Route file: `backend/src/routes/annotation-prompts/index.ts`

- 5 handlers registered: GET `/`, GET `/:id`, POST `/`, PUT `/:id`, DELETE `/:id`
- Plugin typed as `FastifyPluginAsyncTypebox`
- All imports use `.js` extensions (`../../schemas/prompt.js`, `../../schemas/common.js`)
- Imports: `Type` from `@sinclair/typebox`; `AnnotationPrompt`, `CreateAnnotationPrompt`, `UpdateAnnotationPrompt` from prompt schema; `IdParam`, `ErrorResponse` from common schema
- Response schemas defined on all five endpoints:
  - GET list: `200: Type.Array(AnnotationPrompt)`
  - GET by id: `200: AnnotationPrompt`, `404: ErrorResponse`
  - POST: `201: AnnotationPrompt`
  - PUT: `200: AnnotationPrompt`, `404: ErrorResponse`
  - DELETE: `204: Type.Null()`, `404: ErrorResponse`
- 404 pre-check pattern used on GET/:id, PUT/:id, DELETE/:id via `getById()` + `reply.notFound('Annotation prompt not found')`
- POST returns `reply.status(201).send(prompt)`
- DELETE returns `reply.status(204).send(null)`

### Test file: `backend/tests/routes/annotation-prompts.test.ts`

- 10 tests across 5 describe blocks
- Covers: empty list, list with data, get by id (found), get by id (404), create (201), create missing fields (400), partial update, update 404, delete (204 + verification), delete 404
- Uses `buildTestApp()` / `app.close()` lifecycle pattern
- All imports use `.js` extensions

### Verification results (from execution log)

- All 53 backend tests pass (10 route tests + existing suite)
- TypeScript build clean (after `send(null)` fix)

## Mismatches

### 1. GET list ordering test relaxed -- **Minor**

**Analysis expected**: Test asserts `body[0]` is newest prompt (DESC order), `body[1]` is oldest.

**Actual**: Test uses `toContain` on a mapped titles array instead of positional assertions, because in-memory SQLite creates both records in the same millisecond, making `ORDER BY created_at DESC` non-deterministic for same-timestamp rows.

**Impact**: The route still delegates to `list()` which orders by `created_at DESC`. The test just doesn't verify ordering. This is a pragmatic trade-off -- the ordering behavior is already tested at the DB layer (`tests/db/prompts.test.ts`). No functional gap.

### 2. `send(null)` instead of `send()` for DELETE 204 -- **Minor**

**Analysis/plan expected**: `reply.status(204).send()` (no argument).

**Actual**: `reply.status(204).send(null)` because `FastifyPluginAsyncTypebox` with `Type.Null()` response schema requires an argument to satisfy the type constraint.

**Impact**: None. The HTTP response is still a proper 204 with empty body. The test verifies `res.body` is `''`. This is a TypeScript type system requirement, not a behavioral change.

### 3. POST create lacks `ErrorResponse` in 400 response schema -- **Minor**

**Analysis expected**: Error handling for 400 is "automatic from Fastify schema validation" and `ErrorResponse` from `schemas/common.ts` should be used for error cases.

**Actual**: The POST route schema only defines `201: AnnotationPrompt` in its response schema. There is no `400: ErrorResponse` declared.

**Impact**: Low. Fastify still returns proper 400 JSON responses on validation failure -- this is handled by `@fastify/sensible` and Fastify's built-in validation. The missing response schema means the 400 response won't go through `fast-json-stringify` for that status code, but since Fastify generates these automatically, it's not a data leak risk. The test still passes and validates 400 behavior. However, this is inconsistent with the 404 patterns on other routes where `ErrorResponse` is explicitly declared.

### 4. Import style differs from analysis decision -- **Minor**

**Analysis decided**: `import * as S from '../../schemas/prompt.js'` namespace import pattern (following plan's providers example).

**Actual**: Named imports `import { AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt } from '../../schemas/prompt.js'`.

**Impact**: Zero functional impact. Named imports are arguably more explicit and tree-shaking friendly. This is purely a style preference.

## Corrections Made

1. **Ordering test adjusted correctly** -- The plan's test assumed deterministic ordering for same-millisecond inserts. The implementation correctly identified this as unreliable in in-memory SQLite and switched to presence-based assertions while keeping the test meaningful (verifies count + both records present). Good engineering judgment.

2. **`send(null)` TypeScript fix** -- The plan's code didn't account for `FastifyPluginAsyncTypebox` enforcing that `Type.Null()` response schema requires a matching argument. The fix was discovered during the build step (Task 7) and resolved correctly. This shows the TDD + build verification workflow working as intended.

3. **TDD cycle followed** -- Each endpoint went through red (failing test) -> green (implement) -> commit, matching the analysis requirement. Six commits total (one per endpoint pair + one build fix).

## Final Alignment Verdict

**PASS**

The implementation faithfully matches the analysis and plan across all critical dimensions:

- All 5 endpoints implemented with correct HTTP methods, paths, and status codes
- `FastifyPluginAsyncTypebox` used as decided
- Response schemas defined on all endpoints (including error schemas for 404 and `Type.Null()` for 204)
- 404 pre-check pattern applied on all three `/:id` mutation/read routes
- All TypeBox schemas from `schemas/prompt.ts` and `schemas/common.ts` used correctly
- ESM `.js` extensions on all imports
- Tests cover all 10 cases (2 per endpoint: happy path + error path)
- `buildTestApp()` + `app.inject()` testing pattern followed

The three minor mismatches are all either pragmatic fixes for real issues discovered during implementation (ordering test, `send(null)`) or inconsequential style differences (import style, missing 400 schema). None affect correctness, security, or maintainability. The deviations were properly documented in the execution log.
