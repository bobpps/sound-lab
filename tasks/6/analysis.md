# Analysis: Annotation Prompts CRUD Routes (Issue #6)

## What the Task Requires

Create REST CRUD routes for annotation prompts, exposing the existing `IAnnotationPromptRepository` through HTTP endpoints.

### Endpoints

| Method | Path | Response | Status |
|--------|------|----------|--------|
| GET | `/annotation-prompts` | `AnnotationPrompt[]` | 200 |
| GET | `/annotation-prompts/:id` | `AnnotationPrompt` | 200 / 404 |
| POST | `/annotation-prompts` | `AnnotationPrompt` | 201 |
| PUT | `/annotation-prompts/:id` | `AnnotationPrompt` | 200 / 404 |
| DELETE | `/annotation-prompts/:id` | (empty) | 204 / 404 |

### Behavior Details

- **GET list**: Returns all annotation prompts ordered by `created_at DESC` (ordering comes from the repo layer).
- **GET by ID**: Returns single prompt or 404 via `fastify.httpErrors.notFound()` if `repo.getById()` returns `null`.
- **POST create**: Validates body against `CreateAnnotationPrompt` schema (title, provider_id, language, prompt -- all required strings). Returns 201.
- **PUT update**: Validates body against `UpdateAnnotationPrompt` schema (all fields optional). Checks existence first; 404 if not found. Returns updated prompt.
- **DELETE**: Checks existence first; 404 if not found. Returns 204 with empty body.

### Error Handling

- **404**: Use `reply.notFound()` from `@fastify/sensible` (already registered in `app.ts`).
- **400**: Automatic from Fastify schema validation when body/params fail TypeBox validation.
- Response schema for error cases uses `ErrorResponse` from `schemas/common.ts`.

## Constraints from Project Guidance

### From CLAUDE.md (root)
- ESM everywhere: `.js` extensions in imports
- TDD by default: write tests first, then implement

### From backend/CLAUDE.md
- **TypeBox as single source of truth** -- schemas already exist in `backend/src/schemas/prompt.ts`
- **Always define response schemas** -- enables `fast-json-stringify` and prevents data leaks
- **`@fastify/autoload` for routes** -- directory name becomes route prefix. So `routes/annotation-prompts/index.ts` auto-maps to `/annotation-prompts`.
- **DB as decorator** -- access via `fastify.db.annotationPrompts.list()` etc.
- **Errors** -- `@fastify/sensible` (`reply.notFound()`)
- **Route tests** -- `app.inject()` simulates HTTP without network. `app.ready()` before, `app.close()` after. Use `buildTestApp()` from `tests/helpers.ts`.
- **Vitest** -- `globals: true`, `pool: 'forks'` with tsx loader.

### From project plan (Task 5)
- Same CRUD pattern as providers, but with numeric IDs (`IdParam` from `schemas/common.ts` instead of `StringIdParam`).
- Route plugin type: `FastifyPluginAsync` (not `FastifyPluginAsyncTypebox` -- the plan's providers example uses plain `FastifyPluginAsync`).

## Key Files and Systems

### Files to CREATE
- `backend/src/routes/annotation-prompts/index.ts` -- route plugin
- `backend/tests/routes/annotation-prompts.test.ts` -- route tests

### Files to READ/IMPORT FROM
| File | Purpose |
|------|---------|
| `backend/src/schemas/prompt.ts` | TypeBox schemas: `AnnotationPrompt`, `CreateAnnotationPrompt`, `UpdateAnnotationPrompt` |
| `backend/src/schemas/common.ts` | `IdParam` (numeric), `ErrorResponse` |
| `backend/src/db/interfaces.ts` | `IAnnotationPromptRepository` interface (list, getById, create, update, delete) |
| `backend/src/app.ts` | `buildApp()` -- registers sensible, db plugin, autoload for routes |
| `backend/src/plugins/db.ts` | DB decorator registration, `fastify.db` available on instance |
| `backend/tests/helpers.ts` | `buildTestApp()` -- builds app with `{ testing: true }`, calls `app.ready()` |

### Reference Implementations
| File | Purpose |
|------|---------|
| `backend/src/routes/health/index.ts` | Only existing route -- shows `FastifyPluginAsyncTypebox` pattern with schema |
| `backend/tests/routes/health.test.ts` | Only existing route test -- shows `buildTestApp()`, `app.inject()`, `beforeEach`/`afterEach` pattern |
| `docs/plans/2026-04-04-full-project-plan.md` lines 786-887 | Providers route reference implementation (most complete CRUD example) |

## Repository Method Signatures

From `IAnnotationPromptRepository` in `backend/src/db/interfaces.ts`:

```typescript
interface IAnnotationPromptRepository {
  list(): Promise<AnnotationPrompt[]>;
  getById(id: number): Promise<AnnotationPrompt | null>;
  create(data: CreateAnnotationPrompt): Promise<AnnotationPrompt>;
  update(id: number, data: UpdateAnnotationPrompt): Promise<AnnotationPrompt>;
  delete(id: number): Promise<void>;
}
```

Key behaviors from the local implementation (`db/local/prompts.ts`):
- `list()` returns all rows ordered by `created_at DESC`
- `getById()` returns `null` if not found
- `create()` accepts `{ title, provider_id, language, prompt, created_by? }` -- `created_by` defaults to `null`
- `update()` throws `Error` if prompt not found (but route should pre-check with 404)
- `delete()` silently succeeds even if row doesn't exist (route should pre-check with 404)

## DB Types

From `backend/src/db/types.ts`:

```typescript
interface AnnotationPrompt {
  id: number;          // auto-increment
  title: string;
  provider_id: string;
  language: string;    // BCP 47
  prompt: string;
  created_by: string | null;
  created_at: string;
}

interface CreateAnnotationPrompt {
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by?: string;
}

interface UpdateAnnotationPrompt {
  title?: string;
  provider_id?: string;
  language?: string;
  prompt?: string;
}
```

## TypeBox Schemas Available

From `backend/src/schemas/prompt.ts`:

- `AnnotationPrompt` -- full response schema (id, title, provider_id, language, prompt, created_by, created_at)
- `CreateAnnotationPrompt` -- body schema for POST (title, provider_id, language, prompt -- all required)
- `UpdateAnnotationPrompt` -- body schema for PUT (all fields Optional)

From `backend/src/schemas/common.ts`:

- `IdParam` -- `{ id: Type.Integer() }` -- for `:id` params
- `ErrorResponse` -- `{ statusCode, error, message }` -- for 404/400 responses

## Test Patterns

Based on `health.test.ts` and the plan's providers test example:

```typescript
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('Annotation Prompt routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // Tests use app.inject({ method, url, payload })
  // Seed data via app.db.annotationPrompts.create(...)
});
```

Test cases to cover:
1. **GET /annotation-prompts** -- empty list, then with data
2. **GET /annotation-prompts/:id** -- found, not found (404)
3. **POST /annotation-prompts** -- valid create (201), missing required fields (400)
4. **PUT /annotation-prompts/:id** -- partial update, not found (404)
5. **DELETE /annotation-prompts/:id** -- found (204), not found (404)

## Risks and Assumptions

### Assumptions
1. **No auth required yet** -- no auth middleware exists in the codebase. Routes will be public for now.
2. **`created_by` not exposed in POST body** -- the TypeBox `CreateAnnotationPrompt` schema does not include `created_by`. This matches the DB `CreateAnnotationPrompt` type where it's optional. The route will not accept `created_by` from clients (it stays `null` until auth is added).
3. **Autoload naming** -- the directory `annotation-prompts` will produce the route prefix `/annotation-prompts` automatically via `@fastify/autoload` with `dirNameRoutePrefix: true`.
4. **`@sinclair/typebox` is installed** -- confirmed in `package.json` dependencies.

### Risks
1. **`update()` throws on missing ID** -- the local repo throws `Error` if the prompt isn't found. The route must pre-check with `getById()` and return 404 before calling `update()`, to ensure consistent error handling across both DB backends.
2. **`delete()` is silent on missing ID** -- the local repo doesn't throw on deleting a non-existent row. The route must pre-check with `getById()` and return 404.
3. **No foreign key validation for `provider_id`** -- the DB schema may have a FK constraint on `provider_id` referencing `providers.id`. If so, creating a prompt with a non-existent provider_id will throw at the DB level. The route should let this bubble up as a 500 or handle it gracefully. For this first implementation, we rely on DB constraints and Fastify's default error handling.

### Unknowns Resolved
- **Route plugin type**: The plan uses `FastifyPluginAsync` (plain, not TypeBox variant). However, the existing health route uses `FastifyPluginAsyncTypebox`. Either works. The TypeBox variant provides better type inference in handlers. Decision: use `FastifyPluginAsyncTypebox` to match the existing health route and get type-safe `req.params`, `req.body`.
- **Test helper**: `buildTestApp()` in `tests/helpers.ts` returns a fully ready app with in-memory SQLite. Fresh DB per test (each `beforeEach` creates a new app).
- **Response schema for 204**: Use `Type.Null()` as seen in the plan's providers DELETE example.
- **Param parsing**: `IdParam` uses `Type.Integer()`, so Fastify will coerce the string `:id` param to a number automatically via TypeBox validation.
