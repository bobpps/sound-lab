# Alignment Check: Issue #4 -- Providers CRUD Routes

## Original Analysis Summary

The analysis identified 7 REST endpoints for provider management under the `/providers` prefix, served by Fastify 5 with TypeBox validation:

| Method | Path | Status |
|--------|------|--------|
| `GET` | `/providers?type=tts` | 200 |
| `GET` | `/providers/:id` | 200 / 404 |
| `POST` | `/providers` | 201 / 409 / 400 |
| `PUT` | `/providers/:id` | 200 / 404 |
| `DELETE` | `/providers/:id` | 204 |
| `PUT` | `/providers/:id/key` | 204 / 404 |
| `GET` | `/providers/:id/key` | 200 / 404 |

Key risks identified:
1. SQLite `enabled` INTEGER vs TypeBox `Type.Boolean()` coercion
2. Missing `GetKeyResponse` schema
3. Duplicate ID handling (409 Conflict)
4. `update()` throws on not-found (must catch and return 404)
5. `delete()` is idempotent (analysis noted two options: always 204 vs check-and-404)
6. `setKey()` silently does nothing for non-existent providers (must verify existence first)
7. `getDecryptedKey()` returns `null` ambiguously (provider missing vs no key set)
8. Error response schemas should use `ErrorResponse` from `common.ts`
9. Route registration order: `/:id/key` before `/:id` to avoid routing conflicts

The plan called for strict TDD (Red -> Green -> Refactor) across 10 tasks, incremental commits, and a `GetKeyResponse` schema addition.

## What Was Implemented

### Schema Changes (`backend/src/schemas/provider.ts`)
- Added `GetKeyResponse = Type.Object({ key: Type.String() })` with corresponding `Static` type export.

### Route Handlers (`backend/src/routes/providers/index.ts`)
- All 7 endpoints implemented in a single `FastifyPluginAsyncTypebox` plugin.
- Route registration order: `GET /`, `POST /`, `PUT /:id/key`, `GET /:id/key`, `GET /:id`, `PUT /:id`, `DELETE /:id` -- sub-path routes registered before parametric routes.
- Error handling:
  - `GET /:id` -- `null` check -> `reply.notFound()`
  - `POST /` -- try/catch for `UNIQUE constraint failed` -> `reply.conflict()`
  - `PUT /:id` -- try/catch for error containing `not found` -> `reply.notFound()`
  - `DELETE /:id` -- always returns 204 (idempotent)
  - `PUT /:id/key` -- `getById()` existence check first -> 404 if missing, then `setKey()`
  - `GET /:id/key` -- `getById()` existence check first -> 404, then `getDecryptedKey()` null check -> 404 with distinct message
- All response schemas defined including `404: ErrorResponse` for error-capable routes.
- 204 responses use `reply.status(204).send(null)` (not `send()`) to satisfy TypeBox type provider.

### Tests (`backend/tests/routes/providers.test.ts`)
- 21 integration tests across 7 `describe` blocks.
- Uses `buildTestApp()` + `app.inject()` pattern, fresh app per test.
- Helper `seedProvider()` uses `app.db.providers.create()` directly.
- Tests cover: happy paths, 404s, 400 validation, 409 duplicate, key round-trip, missing key 404, idempotent DELETE.

### Commits
- 12 commits total (10 implementation + 1 fix + 1 docs), strict TDD order maintained.

## Mismatches

### 1. DELETE /providers/:id -- Idempotent 204 vs Issue's 404 Specification
**Severity: Minor**

The GitHub issue explicitly lists under test steps: `Delete (found -> 204, not found -> 404)`. The implementation returns 204 regardless of whether the provider exists (idempotent DELETE). The test explicitly asserts `it('returns 204 for non-existent provider (idempotent)')`.

The analysis acknowledged both options (section 5: "Standard REST practice: 204 regardless vs strict REST says 404") and left it as a decision point. The execution log does not record an explicit decision rationale -- it just states "DELETE is idempotent." The plan (Task 6/7) also specified 204 for non-existent, diverging from the issue.

**Impact:** The behavior is defensible (idempotent DELETE is common practice and arguably better API design), but it contradicts the issue's acceptance test description. A conscious deviation that should have been documented as a decision in the execution log.

### 2. No Explicit Test for `DELETE /providers/:id` Returning 404
**Severity: Minor**

Related to mismatch #1. The issue's test steps say `not found -> 404`. Instead the test asserts `204` for non-existent. No test exists for the issue-specified 404 behavior because the implementation chose 204.

### 3. Execution Log Missing Deviation Documentation for DELETE Behavior
**Severity: Minor**

The execution log's "Deviations from Plan" section only lists the `send(null)` TypeScript fix. The DELETE idempotency decision (diverging from the issue spec) is not listed as a deviation -- it is only mentioned under "Findings" as a fact. A plan deviation that contradicts the issue spec should be more prominently documented.

## Corrections Made

1. **`reply.status(204).send(null)` instead of `send()`**: TypeBox's `Type.Null()` response schema makes the type provider expect `send(null)`, not `send()`. Fixed in a dedicated commit (`743e2cc`). This was an unanticipated TypeScript strictness issue, not a logic bug.

## Final Alignment Verdict

**Overall: Well Aligned -- with one documented exception.**

Answering the key questions:

1. **Are all 7 endpoints from the issue implemented?** Yes. All 7 endpoints are present with correct HTTP methods and paths.

2. **Do the status codes match the issue specification?** Mostly. 6 of 7 endpoints match exactly. `DELETE /providers/:id` returns 204 always instead of the issue-specified 204/404 split. This is a reasonable design choice but technically diverges from the spec.

3. **Does TypeBox validation work as specified?** Yes. `CreateProvider`, `UpdateProvider`, `SetKeyBody`, and `ProviderTypeQuery` schemas enforce validation. Tests confirm 400 for missing fields and invalid `type` values.

4. **Is the API key encryption/decryption round-trip tested?** Yes. The test seeds a provider, sets a key via `app.db.providers.setKey()`, then retrieves it via `GET /providers/:id/key` and asserts the decrypted value matches the original (`sk-secret-12345`).

5. **Are all acceptance criteria met?**
   - "All endpoints work with proper status codes" -- Yes (with the DELETE caveat).
   - "TypeBox validation rejects invalid input with 400" -- Yes, tested.
   - "API key encryption/decryption round-trips correctly" -- Yes, tested.
   - "Not found returns 404 with error message" -- Yes for all endpoints except DELETE (which returns 204).

6. **Were there any unplanned deviations?**
   - The `send(null)` fix was unplanned but trivial.
   - The DELETE idempotency behavior was a conscious design decision that should have been more explicitly documented as a deviation from the issue spec.

**Bottom line:** The implementation is solid, follows the plan faithfully, uses correct patterns, and passes all 21 tests plus the full backend suite (64 tests). The only substantive gap is the DELETE behavior diverging from the issue's test step description -- a minor issue that should be raised with the project owner for confirmation before merging.
