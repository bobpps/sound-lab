# Execution Log: Task #4 -- Providers CRUD Routes

## Research Phase

### Files Read

| File | Purpose | Key Findings |
|------|---------|--------------|
| `backend/src/routes/health/index.ts` | Route pattern | Default export of `FastifyPluginAsyncTypebox`, inline schema object, async handlers with return values |
| `backend/src/schemas/provider.ts` | TypeBox schemas | `Provider`, `CreateProvider`, `UpdateProvider`, `SetKeyBody`, `ProviderTypeQuery` defined. **Missing:** `GetKeyResponse` for `GET /:id/key` |
| `backend/src/schemas/common.ts` | Shared schemas | `StringIdParam` (for string `:id` params), `ErrorResponse` (Fastify default error shape) |
| `backend/src/db/interfaces.ts` | Repository contract | `IProviderRepository` with 7 methods: `list`, `getById`, `create`, `update`, `delete`, `getDecryptedKey`, `setKey` |
| `backend/src/db/types.ts` | Domain types | Provider has string `id` (natural key), `enabled: boolean` |
| `backend/src/db/local/providers.ts` | SQLite implementation | `update()` throws on not-found; `delete()` is silent; `enabled` stored as INTEGER 0/1; encryption via `crypto.ts` |
| `backend/src/db/supabase/providers.ts` | Supabase implementation | `update()` calls `.single()` (throws on not-found via Supabase error); `delete()` is silent |
| `backend/src/db/local/migrations/001_initial.sql` | DB schema | `enabled INTEGER NOT NULL DEFAULT 1`, `encrypted_key TEXT` nullable |
| `backend/src/app.ts` | App factory | Autoload from `routes/`, `@fastify/sensible` registered, TypeBox type provider |
| `backend/src/plugins/db.ts` | DB decorator | `fastify.db` decorated globally, in-memory SQLite for `testing: true` |
| `backend/tests/helpers.ts` | Test app builder | `buildTestApp()` -> `buildApp({ testing: true })` then `app.ready()` |
| `backend/tests/routes/health.test.ts` | Route test example | `app.inject()` pattern, `beforeEach`/`afterEach` lifecycle |
| `backend/tests/db/providers.test.ts` | DB test example | Tests CRUD + key encryption, does NOT test `enabled` field value type |
| `backend/src/db/local/client.ts` | DB client | `createMemoryDb()` runs migrations automatically |
| `backend/src/db/local/crypto.ts` | Encryption | AES-256-GCM with scrypt, salt+iv+tag+ciphertext packed in base64 |
| `backend/CLAUDE.md` | Backend conventions | Patterns for errors, testing, plugins, response schemas |

### Decisions Made

1. **`GetKeyResponse` schema needed.** The provider schemas define `SetKeyBody` but no response type for key retrieval. Will add `GetKeyResponse = Type.Object({ key: Type.String() })` to `provider.ts`. Could reuse `SetKeyBody` but creating a separate schema is semantically cleaner.

2. **Error handling strategy:**
   - `GET /:id` -- check for `null`, return 404 via `fastify.httpErrors.notFound()`
   - `POST /` -- try/catch for constraint violations, return 409
   - `PUT /:id` -- try/catch for the `Error('Provider ... not found')` thrown by local repo, return 404
   - `DELETE /:id` -- return 204 always (idempotent DELETE, consistent with both DB backends)
   - `PUT /:id/key` -- verify provider exists first (`getById`), then `setKey`, return 204
   - `GET /:id/key` -- verify provider exists (`getById` -> 404), then check key (`null` -> 404 with "no key" message)

3. **`enabled` INTEGER/boolean concern.** SQLite returns `0`/`1` as integers. `fast-json-stringify` with `Type.Boolean()` schema should coerce these during serialization (it outputs `true`/`false` for truthy/falsy values). Will verify in integration tests. If it fails, a fix in the local repository (explicit boolean cast) would be the proper solution.

4. **Test style.** Route tests will follow the `health.test.ts` pattern (globals-style `describe`/`it`/`expect` without explicit vitest imports). DB tests import from vitest explicitly -- this inconsistency exists in the codebase already; follow the convention for each test type.

5. **No nested route directories.** All provider routes (including `/providers/:id/key`) go in a single `routes/providers/index.ts` file. Autoload gives the `/providers` prefix; individual routes define their own sub-paths (`:id`, `:id/key`).

6. **Response schema for error codes.** Include `404: ErrorResponse` and `400: ErrorResponse` in route schema definitions where applicable, to document possible error responses.

### Open Questions (to resolve during implementation)

- Should `DELETE /providers/:id` return 404 when provider doesn't exist, or always 204? **Leaning toward:** always 204 for idempotency, but will follow whatever the acceptance criteria implies. The issue just says "DELETE -> 204" without 404 qualification.
- How exactly does `fast-json-stringify` handle SQLite's integer `enabled` field? Will test empirically.

---

## Implementation Phase

### Execution Summary

All 10 tasks from the plan were implemented in strict TDD order (Red -> Green -> Refactor).

### Commits (9 total)

| SHA | Message |
|-----|---------|
| `5184118` | feat(schemas): add GetKeyResponse schema for provider key endpoint |
| `d267cb5` | test: add failing tests for GET /providers and GET /providers/:id |
| `c13711b` | feat: implement GET /providers and GET /providers/:id routes |
| `f1da62a` | test: add failing tests for POST /providers |
| `ae3b265` | feat: implement POST /providers route with duplicate detection |
| `5ad423d` | test: add failing tests for PUT /providers/:id and DELETE /providers/:id |
| `f539a96` | feat: implement PUT /providers/:id and DELETE /providers/:id routes |
| `cc2eb28` | test: add failing tests for PUT/GET /providers/:id/key |
| `96aa1c4` | feat: implement PUT/GET /providers/:id/key routes for API key management |
| `743e2cc` | fix: pass null to reply.send() for 204 responses to satisfy TypeBox types |

### Deviations from Plan

1. **TypeScript `send()` argument:** `reply.status(204).send()` fails TypeScript check because `Type.Null()` response schema makes the TypeBox type provider expect `send(null)` not `send()`. Fixed with `send(null)`. This was not anticipated in the plan.

### Findings

1. **SQLite `enabled` coercion works.** `fast-json-stringify` with `Type.Boolean()` correctly coerces SQLite's integer `1`/`0` to `true`/`false` in JSON responses. Confirmed by the test `returns providers with enabled as boolean` which asserts `expect(body[0].enabled).toBe(true)`.

2. **Route order matters.** `/:id/key` routes registered before `/:id` routes to avoid Fastify's radix-tree router treating `key` as a parameter value.

3. **DELETE is idempotent.** Returns 204 for both existing and non-existing providers, matching the DB layer's behavior.

### Verification Results

- **Full test suite:** 64/64 tests pass (7 test files)
- **Provider route tests:** 21/21 pass
- **TypeScript:** Compiles cleanly with `--noEmit`
- **Existing tests unaffected:** All health, DB, crypto tests continue to pass
