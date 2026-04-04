# Task Context: Issue #4

- **Issue:** #4 — Task 3: Providers CRUD routes
- **URL:** https://github.com/bobpps/sound-lab/issues/4
- **Branch:** `feat/4-providers-crud`
- **Worktree:** `.claude/worktrees/feat/4-providers-crud`
- **Labels:** backend
- **Depends on:** #3 (TypeBox schemas) — MERGED

## Description

REST API for provider management: list (with type filter), get, create, update, delete, set/get API key.

### Endpoints

- `GET /providers?type=tts` → Provider[]
- `GET /providers/:id` → Provider
- `POST /providers` → Provider (201)
- `PUT /providers/:id` → Provider
- `DELETE /providers/:id` → 204
- `PUT /providers/:id/key` → 204
- `GET /providers/:id/key` → `{ key: string }`

### Acceptance Criteria

- All endpoints work with proper status codes
- TypeBox validation rejects invalid input with 400
- API key encryption/decryption round-trips correctly
- Not found returns 404 with error message

## Key Files

- `backend/src/schemas/provider.ts` — TypeBox schemas (Provider, CreateProvider, UpdateProvider, SetKeyBody, ProviderTypeQuery)
- `backend/src/schemas/common.ts` — StringIdParam, ErrorResponse
- `backend/src/db/interfaces.ts` — IProviderRepository interface
- `backend/src/db/types.ts` — Provider domain types
- `backend/src/db/local/crypto.ts` — AES-256-GCM encryption
- `backend/src/routes/health/index.ts` — existing route pattern (autoload, FastifyPluginAsyncTypebox)
- `backend/src/app.ts` — buildApp() with autoload from routes/
- `backend/src/plugins/db.ts` — DB decorator (fastify.db)
- `backend/tests/helpers.ts` — buildTestApp() helper
- `backend/tests/routes/health.test.ts` — existing route test pattern

## Files to Create

- `backend/src/routes/providers/index.ts` — route handlers
- `backend/tests/routes/providers.test.ts` — integration tests

## Architecture Notes

- Routes are autoloaded from `src/routes/` — directory name becomes prefix (`/providers`)
- DB access via `fastify.db.providers.*` decorator
- Use `@fastify/sensible` for error helpers (`fastify.httpErrors.notFound()`)
- TypeBox schemas provide both JSON Schema validation and TypeScript types
- `FastifyPluginAsyncTypebox` for typed route plugins
- Provider IDs are string keys (not auto-increment)
- In-memory SQLite for tests via `buildTestApp()`
