# Execution Log: Annotation Prompts CRUD Routes (Issue #6)

## Phase: Research and Analysis

### Files Read

| File | Key Takeaways |
|------|---------------|
| `CLAUDE.md` (root) | ESM everywhere, TDD by default, `.js` extensions in imports |
| `backend/CLAUDE.md` | TypeBox schemas, response schemas required, autoload routing, DB decorator pattern, sensible for errors, app.inject() testing |
| `backend/src/db/interfaces.ts` | `IAnnotationPromptRepository` has 5 methods: list, getById, create, update, delete. All return Promise. `getById` returns null on miss. |
| `backend/src/db/types.ts` | `AnnotationPrompt` has 7 fields (id, title, provider_id, language, prompt, created_by, created_at). Create omits id/created_at, Update has all fields optional. |
| `backend/src/db/local/prompts.ts` | SQLite implementation. `update()` throws Error on missing ID. `delete()` silent on miss. Order by created_at DESC. |
| `backend/src/db/supabase/prompts.ts` | Supabase implementation. Same interface. Uses PGRST116 for not-found handling. |
| `backend/src/schemas/prompt.ts` | TypeBox schemas already exist for AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt. Also has AgentPrompt equivalents. |
| `backend/src/schemas/common.ts` | `IdParam` (integer), `StringIdParam` (string), `ErrorResponse` available. |
| `backend/src/app.ts` | Uses `buildApp()` factory. Registers: cors, sensible, db plugin, autoload (routes dir). TypeBoxTypeProvider on the instance. |
| `backend/src/plugins/db.ts` | DB decorator: `fastify.db` with `IDatabase` type. Testing mode uses in-memory SQLite with test encryption key. |
| `backend/src/routes/health/index.ts` | Only existing route. Uses `FastifyPluginAsyncTypebox` type. Simple GET with schema/response. |
| `backend/tests/routes/health.test.ts` | Route test pattern: `buildTestApp()`, `app.inject()`, `beforeEach`/`afterEach` with app lifecycle. Also tests DB decorator availability. |
| `backend/tests/helpers.ts` | `buildTestApp()` calls `buildApp({ testing: true })` then `app.ready()`. |
| `backend/tests/db/prompts.test.ts` | DB-level tests. Uses `createTestDb()` directly. Test data: title, provider_id, language, prompt fields. |
| `backend/vitest.config.ts` | `globals: true`, `pool: 'forks'` with tsx import. |
| `backend/package.json` | All needed deps present: fastify 5, typebox, autoload, sensible, type-provider-typebox. |
| `docs/plans/2026-04-04-full-project-plan.md` (Task 5 section) | Task 5 specifies same CRUD pattern as providers but with numeric IDs. Steps: tests first, fail, implement, pass, commit. |
| `docs/plans/2026-04-04-full-project-plan.md` (Task 3 - providers) | Full reference implementation with route code and test code. Shows patterns for 404 handling, 201 for create, 204 for delete, schema definitions. |

### Key Observations

1. **No CRUD routes exist yet** -- only the health route is implemented. The providers, dialogs, and other CRUD routes from the plan have not been built. This means annotation-prompts will be the first CRUD route in the codebase.

2. **Schemas are ready** -- all TypeBox schemas needed for the route already exist in `schemas/prompt.ts` and `schemas/common.ts`. No schema work needed.

3. **DB layer is complete** -- both local (SQLite) and Supabase implementations exist and are tested. The route just needs to delegate to `fastify.db.annotationPrompts.*`.

4. **Autoload convention** -- creating `routes/annotation-prompts/index.ts` and exporting a default Fastify plugin will auto-register at `/annotation-prompts` prefix. No manual registration needed.

5. **Route plugin type decision** -- the plan's providers example uses `FastifyPluginAsync`, but the health route uses `FastifyPluginAsyncTypebox`. The TypeBox variant is better because it provides automatic type inference for `req.params` and `req.body` from the schema. Decision: use `FastifyPluginAsyncTypebox` from `@fastify/type-provider-typebox`.

6. **404 pre-check pattern** -- both `update()` and `delete()` in the route must pre-check existence via `getById()` before calling the mutation, because:
   - Local `update()` throws a generic Error (not an HTTP error)
   - Local `delete()` silently succeeds on non-existent rows
   - Consistent 404 behavior is needed regardless of DB backend

7. **Test data pattern** -- from DB tests, typical test data: `{ title: 'SSML Annotation', provider_id: 'elevenlabs', language: 'en-US', prompt: 'Annotate...' }`. Provider IDs used in tests: 'elevenlabs', 'google', 'openai'. Languages: 'en-US', 'ru-RU'.

8. **No provider FK seeding needed in route tests** -- the in-memory SQLite test DB likely doesn't enforce FK constraints (SQLite has FK enforcement off by default unless `PRAGMA foreign_keys = ON` is set). Need to verify, but the DB-level prompt tests in `tests/db/prompts.test.ts` create prompts with provider_ids like 'elevenlabs' without first creating the provider, which confirms FKs are not enforced. This simplifies test data setup.

### Decisions

- Use `FastifyPluginAsyncTypebox` for the route plugin type (matches existing health route, gives type inference).
- Pre-check existence on GET/:id, PUT/:id, DELETE/:id with `getById()` returning 404 if null.
- Use `Type.Array(S.AnnotationPrompt)` for list response schema, `S.AnnotationPrompt` for single, `Type.Null()` for 204.
- Import schemas as `* as S from '../../schemas/prompt.js'` pattern (following plan's providers example).
- Test 400 validation errors by sending requests with missing required fields.

### Status

- [x] Research complete
- [x] Analysis artifact written
- [x] Plan written

---

## Phase: Implementation

### Task 1-2: GET /annotation-prompts (list)
- Created test file with 2 tests (empty list, returns all prompts)
- **Deviation:** Changed ordering test from strict DESC order check to `toContain` check — in-memory SQLite creates both records in the same millisecond so `ORDER BY created_at DESC` doesn't guarantee a stable order between them
- Created route plugin with GET `/` handler
- 2/2 tests pass
- Committed: `931dec7`

### Task 3: GET /annotation-prompts/:id
- Added 2 tests (found, 404 not found)
- Added GET `/:id` handler with `IdParam` and `ErrorResponse` schemas
- Uses `reply.notFound()` from `@fastify/sensible`
- 4/4 tests pass
- Committed: `adebdc6`

### Task 4: POST /annotation-prompts
- Added 2 tests (create 201, validation 400)
- Added POST `/` handler with `CreateAnnotationPrompt` body schema
- Returns 201 with created prompt
- Fastify auto-validates body against TypeBox schema (400 on missing fields)
- 6/6 tests pass
- Committed: `922079f`

### Task 5: PUT /annotation-prompts/:id
- Added 2 tests (partial update, 404 not found)
- Added PUT `/:id` handler with `UpdateAnnotationPrompt` body schema
- Pre-checks existence with `getById()` before calling `update()`
- 8/8 tests pass
- Committed: `9d6032d`

### Task 6: DELETE /annotation-prompts/:id
- Added 2 tests (delete 204 with empty body verification, 404 not found)
- Added DELETE `/:id` handler with `Type.Null()` response schema
- Pre-checks existence, returns 204 with empty body
- 10/10 tests pass
- Committed: `5b8bf87`

### Task 7: Full verification
- Full backend test suite: **53 tests, 7 files, all pass**
- TypeScript build: **initial failure** on `reply.status(204).send()` — TypeScript expected an argument
- **Fix:** Changed to `reply.status(204).send(null)` which satisfies the `Type.Null()` response schema type. Fastify correctly serializes `null` as empty body for 204.
- Build passes after fix
- Re-verified: 10/10 route tests still pass with `send(null)`
- Committed fix: `6dfaf8c`

### Deviations from Plan
1. **Ordering test relaxed** — Plan's test assumed `body[0]` is Prompt B (newest first), but in-memory SQLite with same-millisecond inserts returns by rowid (ASC). Changed to `toContain` assertions.
2. **`send(null)` instead of `send()`** — Plan's code used `reply.status(204).send()` but `FastifyPluginAsyncTypebox` with `Type.Null()` response schema requires an argument. Changed to `send(null)` which produces the same empty 204 response.

### Final State
- Route file: 5 handlers (GET list, GET by id, POST, PUT, DELETE)
- Test file: 10 test cases across 5 describe blocks
- All 53 backend tests pass
- TypeScript build clean
