# Execution Log: Issue #7 — Agent Prompts CRUD Routes

## Research Phase

### Files Read

| File | Location | Key Finding |
|------|----------|-------------|
| `backend/CLAUDE.md` | worktree | Repository pattern, app factory, TypeBox as source of truth, autoload for routes, testing with `app.inject()` |
| `frontend/CLAUDE.md` | worktree | Not relevant to this backend task (read for completeness) |
| `backend/src/db/interfaces.ts` | worktree | `IAgentPromptRepository` has 5 methods: `list`, `getById`, `create`, `update`, `delete`. Accessed via `IDatabase.agentPrompts`. |
| `backend/src/db/types.ts` | worktree | `AgentPrompt` (7 fields), `CreateAgentPrompt` (4 required + 1 optional), `UpdateAgentPrompt` (4 optional). Structurally identical to `AnnotationPrompt`. |
| `backend/src/app.ts` | worktree | Uses `@fastify/autoload` with `dirNameRoutePrefix: true` scanning `src/routes/`. Registers cors, sensible, db plugin, then routes. |
| `backend/src/plugins/db.ts` | worktree | Fastify-plugin wrapping `createDatabase()`. In-memory SQLite for testing (`path: ':memory:'`). Decorates `fastify.db`. |
| `backend/src/routes/health/index.ts` | worktree | Reference for plugin export pattern: `const routes: FastifyPluginAsyncTypebox = async (fastify) => { ... }; export default routes;` |
| `backend/src/schemas/prompt.ts` | worktree | Contains all 6 prompt schemas: `AgentPrompt`, `CreateAgentPrompt`, `UpdateAgentPrompt` + annotation equivalents. Uses `Type.Integer()` for IDs, `Type.Optional()` for update fields, `Type.Union([Type.String(), Type.Null()])` for nullable `created_by`. |
| `backend/src/schemas/common.ts` | worktree | `IdParam` (integer), `StringIdParam` (string), `ErrorResponse`. IdParam is what agent-prompts routes need. |
| `backend/src/db/local/prompts.ts` | main repo | `LocalAgentPromptRepository` implementation. `update` throws on not-found, `delete` is silent on not-found. |
| `backend/src/db/factory.ts` | worktree | Both SQLite and Supabase paths wire `agentPrompts` repo. |
| `backend/tests/helpers.ts` | worktree (via main) | `buildTestApp()` calls `buildApp({ testing: true })` + `app.ready()`. |
| `backend/tests/routes/health.test.ts` | main repo | Reference test pattern: `beforeEach` builds app, `afterEach` closes, `app.inject()` for requests. |
| `backend/tests/db/prompts.test.ts` | main repo | Shows test data patterns for agent prompts: `{ title: 'Support Agent', provider_id: 'openai', language: 'en-US', prompt: 'You are a helpful support agent...' }` |
| `backend/vitest.config.ts` | worktree | `globals: true`, `pool: 'forks'`, uses tsx for ESM TS execution. |
| `backend/package.json` | worktree | ESM (`"type": "module"`), deps include `@fastify/type-provider-typebox`, `@sinclair/typebox`, `@fastify/sensible`, `@fastify/autoload` |
| `backend/tsconfig.json` | worktree | `strict: true`, `module: ESNext`, `moduleResolution: bundler` |
| `backend/eslint.config.js` | worktree | `no-console: warn` rule |
| `docs/plans/2026-04-04-full-project-plan.md` | main repo | Task 6 section (lines 987-1013): confirms endpoints, TDD steps, commit message. Task 3 (providers) has full route code example. Task 5 (annotation prompts) has no implementation code. |
| GitHub issue #7 | remote | Confirms scope, endpoints, dependency on #3 (merged). |
| `tasks/3/plan.md` | worktree | Shows how the schema task was structured and executed — useful as style reference. |

### Research Decisions

1. **Searched for annotation-prompts route first** — Found it does NOT exist. Task 5 from the plan has not been implemented. This means agent-prompts will be the first prompt CRUD route in the codebase.

2. **Used providers route from the plan as primary reference** — Since no annotation-prompts route exists, the providers route code in the project plan (Task 3, lines 789-887) is the closest implemented CRUD pattern. Adapted for numeric IDs and simpler structure (no query filter, no key management).

3. **Verified worktree has all needed files** — The worktree branch is at the same commit as main. All schema files, DB implementations, and infrastructure files are present. The Glob tool initially returned empty results due to path resolution, but `find` confirmed all files exist.

4. **Checked DB behavior for edge cases** — Confirmed that `update` throws on missing ID while `delete` is silent. Routes must check existence before both operations to consistently return 404.

5. **Verified schema field types match** — `prompt.ts` uses `Type.Integer()` for IDs and `Type.Optional()` for update fields. `common.ts` `IdParam` also uses `Type.Integer()`. These match.

6. **Confirmed `created_by` handling** — Not in Create/Update schemas. DB layer accepts optional `created_by` in create, defaults to null. No auth context exists yet.

### Ambiguities Encountered

1. **Plan says "PATCH" in schema comments but "PUT" in endpoints** — Resolved: The issue and the plan's endpoint listing both say PUT. The "PATCH" in schema comments was informal. Using PUT.

2. **Plan's `Type.Number()` vs actual `Type.Integer()`** — The plan drafts used `Type.Number()` but the actually-implemented schemas in `prompt.ts` use `Type.Integer()`. The implemented code is authoritative.

3. **Whether to use `FastifyPluginAsync` or `FastifyPluginAsyncTypebox`** — The plan's providers route uses `FastifyPluginAsync`, but the health route uses `FastifyPluginAsyncTypebox`. The TypeBox variant provides better type inference with schema definitions. Going with `FastifyPluginAsyncTypebox` to match the existing codebase (health route) and get automatic type safety.

4. **Whether `as any` casts are needed** — The plan's provider route uses `req.body as any`. With `FastifyPluginAsyncTypebox` and schema definitions, TypeBox should infer types. However, there may be compatibility nuances between TypeBox schema types and DB types. Will follow the plan's approach and use casts if needed for type compatibility.

### Summary

The task is well-defined and low-risk. It's a mechanical CRUD route that mirrors established patterns. The main nuance is that annotation-prompts (the stated "reference pattern") doesn't exist yet, so we derive from the providers route + conventions. All infrastructure (schemas, DB layer, test helpers, autoload) is in place.

## Execution Phase

### TDD Cycle Log

| Task | RED (fails) | GREEN (passes) | Notes |
|------|-------------|----------------|-------|
| T1+T2: GET /agent-prompts | 2 tests fail (404) | 2 tests pass | Route autoloaded via directory name |
| T3: GET /agent-prompts/:id | 1 test fails (404), 1 passes (404=404) | 4 tests pass | IdParam + notFound pattern |
| T4: POST /agent-prompts | 2 tests fail (404) | 6 tests pass | TypeBox body validation gives 400 for free |
| T5: PUT /agent-prompts/:id | 1 test fails (404), 1 passes | 8 tests pass | Existence check before update |
| T6: DELETE /agent-prompts/:id | 1 test fails (404), 1 passes | 10 tests pass | Existence check before delete |
| T7: Full verification | N/A | 53 tests pass, build + lint clean | TS fix needed for send(null) |

### Deviations from Plan

1. **`reply.status(204).send()` → `reply.status(204).send(null)`** — The plan had `send()` with no argument, but TypeScript strict mode with TypeBox type provider requires an argument matching `Type.Null()`. Fixed by passing `null`. This is the only deviation.

2. **No `as any` casts needed** — The plan anticipated possible type cast needs, but `FastifyPluginAsyncTypebox` with proper schema definitions provided full type inference without casts.

### Commits

| Hash | Message |
|------|---------|
| c5f4889 | feat(api): add GET /agent-prompts route with tests |
| b8710c4 | feat(api): add GET /agent-prompts/:id route with tests |
| a5a28fc | feat(api): add POST /agent-prompts route with tests |
| 1d5f1d0 | feat(api): add PUT /agent-prompts/:id route with tests |
| fa5a1f3 | feat(api): add DELETE /agent-prompts/:id route with tests |
| d7b83a9 | fix(api): pass null to reply.send() for 204 response |

### Final Verification

- **Agent-prompts tests:** 10/10 pass
- **Full backend suite:** 53/53 pass (7 test files)
- **Build (tsc + vite):** Clean
- **Lint:** Clean
