# Code Review: Issue #7 — Agent Prompts CRUD Routes

**Reviewer:** Claude Opus 4.6 (code-reviewer)
**Date:** 2026-04-05
**Git range:** `7133b63..09c13c7` (6 commits on branch)

---

## Diff Summary

| File | Lines | Action |
|------|-------|--------|
| `backend/src/routes/agent-prompts/index.ts` | 72 | Created |
| `backend/tests/routes/agent-prompts.test.ts` | 174 | Created |
| `tasks/7/execution-log.md` | 94 | Created (non-code) |
| **Total** | **340** | |

**5 REST endpoints implemented:**
- `GET /agent-prompts` — list all
- `GET /agent-prompts/:id` — get by ID
- `POST /agent-prompts` — create
- `PUT /agent-prompts/:id` — partial update
- `DELETE /agent-prompts/:id` — delete

**10 integration tests:** 2 per endpoint (happy path + error case).

---

## Verification Outcomes

| Check | Result |
|-------|--------|
| Agent-prompts tests | 10/10 pass |
| Full backend suite | 53/53 pass (7 files) |
| TypeScript build (tsc) | Clean |
| Vite build | Clean |
| ESLint | Clean |

---

## Strengths

1. **Faithful to plan and codebase conventions.** The implementation matches the plan exactly, uses `FastifyPluginAsyncTypebox` (matching the health route pattern), and reuses existing TypeBox schemas from `prompt.ts` and `common.ts`. No unnecessary deviations.

2. **Correct existence-check pattern.** Both PUT and DELETE perform a `getById` check before mutating, which is required because the DB layer's `delete()` is silent on missing IDs and `update()` throws an unstructured error. This ensures consistent 404 responses.

3. **Response schemas on all endpoints.** Enables `fast-json-stringify` for serialization performance and prevents accidental data leaks — both called out as requirements in `backend/CLAUDE.md`.

4. **Clean test isolation.** Each test gets a fresh app with in-memory SQLite via `beforeEach`/`afterEach`. The DELETE happy-path test verifies the side effect with a follow-up GET, which is the strongest assertion pattern for deletion.

5. **Proper TDD execution.** The execution log shows red-green discipline: tests written first, confirmed failing, then implementation added. 6 incremental commits with clear messages.

---

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

None.

### Minor (Nice to Have)

1. **Missing blank line before `fastify.put(...)` registration**
   - File: `backend/src/routes/agent-prompts/index.ts:39-40`
   - Issue: There is no blank line between the closing of `fastify.get('/:id', ...)` at line 39 and the opening of `fastify.put('/:id', ...)` at line 40. All other route registrations are separated by blank lines.
   - Impact: Cosmetic inconsistency only.
   - Fix: Add a blank line between lines 39 and 40.

2. **PUT with empty body is accepted (all fields optional)**
   - File: `backend/src/routes/agent-prompts/index.ts:41` (schema: `S.UpdateAgentPrompt`)
   - Issue: `UpdateAgentPrompt` has all fields as `Type.Optional(...)`, so `PUT /agent-prompts/:id` with `{}` is valid and results in a no-op update (re-saves current values). Semantically, a PUT with no changes is unusual.
   - Impact: Not a bug — the DB layer handles it gracefully by falling back to existing values. This is a design-level consideration, not an implementation error. If partial updates are the intent, PATCH would be more RESTful, but the plan explicitly specified PUT.
   - Recommendation: Document this behavior or consider adding `Type.MinProperties(1)` to `UpdateAgentPrompt` schema if no-op updates should be rejected. Not blocking for this PR.

3. **POST test asserts `body.id` is `1` (auto-increment assumption)**
   - File: `backend/tests/routes/agent-prompts.test.ts:96`
   - Issue: `expect(body.id).toBe(1)` assumes the first inserted row always gets ID 1. This is true for fresh in-memory SQLite, but is fragile if test infrastructure ever changes (e.g., shared DB, seeded data).
   - Impact: Low — the `beforeEach` creates a fresh DB per test, so this is safe for now. But it is a latent fragility.
   - Recommendation: Could use `expect(body.id).toBeGreaterThan(0)` or `expect(typeof body.id).toBe('number')` instead. Not blocking.

4. **TOCTOU gap between existence check and mutation (PUT/DELETE)**
   - File: `backend/src/routes/agent-prompts/index.ts:50-53` and `65-68`
   - Issue: The `getById` + `update`/`delete` pattern has a theoretical time-of-check-to-time-of-use gap — another request could delete the record between the check and the mutation.
   - Impact: Negligible. This is a single-user internal tool backed by SQLite (which serializes writes). The DB `update()` would throw on missing row, and `delete()` would silently no-op. Neither causes data corruption.
   - Recommendation: Acceptable for this project context. No action needed.

---

## Requirements Compliance

| Plan Requirement | Status | Notes |
|-----------------|--------|-------|
| 5 REST endpoints | Met | GET list, GET by ID, POST, PUT, DELETE |
| TypeBox schemas from `prompt.ts` | Met | Uses `S.AgentPrompt`, `S.CreateAgentPrompt`, `S.UpdateAgentPrompt` |
| `fastify.db.agentPrompts.*` calls | Met | All 5 repo methods used correctly |
| `@fastify/sensible` for 404s | Met | `reply.notFound()` pattern |
| Existence check before PUT/DELETE | Met | `getById` guard in both handlers |
| 10 tests (2 per endpoint) | Met | Exact count and coverage |
| TDD workflow | Met | Red-green-refactor confirmed in execution log |
| No modifications to existing files | Met | Only 2 new files in backend |

---

## Known Limitations

1. **No pagination on GET list.** The list endpoint returns all rows. Acceptable for an internal tool with low data volume, but will need pagination if the dataset grows.

2. **No input length validation.** Fields like `title` and `prompt` accept arbitrary-length strings. The DB layer does not enforce limits. Future consideration.

3. **No authentication/authorization.** `created_by` is always null. The plan acknowledges this — auth is a separate concern to be added later.

4. **PUT semantics vs PATCH.** Using PUT for partial updates is unconventional but explicitly specified in the plan and GitHub issue.

---

## Assessment

**Ready to merge: Yes**

**Reasoning:** The implementation is clean, minimal, and precisely matches the plan. All 5 endpoints follow established codebase patterns. The 10 integration tests cover happy and error paths against real SQLite. Build, lint, and full test suite are green. The 4 minor issues noted are all cosmetic or theoretical and do not affect correctness or production readiness. No code changes are required before merge.
