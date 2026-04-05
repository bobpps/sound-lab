# Task #4: Providers CRUD Routes -- Analysis

## What the Task Requires

Create REST API routes for provider management at `/providers` prefix, served by Fastify 5 with TypeBox validation.

### Endpoints

| Method | Path | Request | Response | Status |
|--------|------|---------|----------|--------|
| `GET` | `/providers?type=tts` | query: `ProviderTypeQuery` | `Provider[]` | 200 |
| `GET` | `/providers/:id` | params: `StringIdParam` | `Provider` | 200 |
| `POST` | `/providers` | body: `CreateProvider` | `Provider` | 201 |
| `PUT` | `/providers/:id` | params + body: `UpdateProvider` | `Provider` | 200 |
| `DELETE` | `/providers/:id` | params: `StringIdParam` | (empty) | 204 |
| `PUT` | `/providers/:id/key` | params + body: `SetKeyBody` | (empty) | 204 |
| `GET` | `/providers/:id/key` | params: `StringIdParam` | `{ key: string }` | 200 |

### Acceptance Criteria (from issue)

- All endpoints work with proper status codes
- TypeBox validation rejects invalid input with 400
- API key encryption/decryption round-trips correctly
- Not found returns 404 with error message

## Files to Create

1. `backend/src/routes/providers/index.ts` -- route handlers
2. `backend/tests/routes/providers.test.ts` -- integration tests

## Constraints from Project Guidance

### From CLAUDE.md (root + backend)

- **TDD by default** -- write tests first, then implement (Red -> Green -> Refactor)
- **ESM everywhere** -- `.js` extensions in all imports
- **Always define response schemas** -- enables `fast-json-stringify` and prevents data leaks
- **`@fastify/autoload`** -- directory name becomes route prefix (`routes/providers/` -> `/providers`)
- **`@fastify/sensible`** -- use `fastify.httpErrors.notFound()` etc. for error responses
- **`FastifyPluginAsyncTypebox`** -- typed route plugins with TypeBox type provider

### From Backend CLAUDE.md

- Route tests use `app.inject()` (no network), `app.ready()` before and `app.close()` after
- Integration tests use in-memory SQLite (real SQL)
- "Not found" from DB returns `null`; route handlers must translate to 404
- Provider IDs are natural string keys (not auto-increment)

## Key Patterns from Existing Code

### Route Pattern (`routes/health/index.ts`)

```typescript
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const routes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', { schema: { response: { 200: SomeSchema } } }, async () => {
    return { /* ... */ };
  });
};

export default routes;
```

Key observations:
- Default export of `FastifyPluginAsyncTypebox`
- Schema object passed in route options with `response`, `body`, `params`, `querystring` keys
- Handler is an async function; return value is the response (no `reply.send()` needed)

### Route Test Pattern (`tests/routes/health.test.ts`)

```typescript
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('...', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildTestApp(); });
  afterEach(async () => { await app.close(); });

  it('...', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
```

Key observations:
- Fresh app per test (in-memory SQLite, migrations auto-run)
- `app.inject()` for HTTP simulation
- Assert on `statusCode` and `res.json()`
- Vitest with globals: `describe`, `it`, `expect` -- but existing DB tests explicitly import from vitest

### DB Repository Pattern (`IProviderRepository`)

```typescript
list(type?: ProviderType): Promise<Provider[]>;
getById(id: string): Promise<Provider | null>;
create(data: CreateProvider): Promise<Provider>;
update(id: string, data: UpdateProvider): Promise<Provider>;
delete(id: string): Promise<void>;
getDecryptedKey(id: string): Promise<string | null>;
setKey(id: string, key: string): Promise<void>;
```

## How DB Repository Maps to Route Handlers

| Endpoint | Repository Method | Error Handling |
|----------|------------------|----------------|
| `GET /providers` | `fastify.db.providers.list(query.type)` | None needed (returns `[]`) |
| `GET /providers/:id` | `fastify.db.providers.getById(params.id)` | `null` -> 404 |
| `POST /providers` | `fastify.db.providers.create(body)` | Duplicate ID -> handle constraint error |
| `PUT /providers/:id` | `fastify.db.providers.update(params.id, body)` | Throws `Error` if not found -> 404 |
| `DELETE /providers/:id` | `fastify.db.providers.delete(params.id)` | Silent success even if not found (SQLite DELETE is idempotent) |
| `PUT /providers/:id/key` | `fastify.db.providers.setKey(params.id, body.key)` | Should verify provider exists first -> 404 |
| `GET /providers/:id/key` | `fastify.db.providers.getDecryptedKey(params.id)` | `null` -> 404 (no key set) vs provider not found |

## Risks and Edge Cases

### 1. `enabled` Field: SQLite Integer vs Boolean

**Critical.** SQLite stores `enabled` as `INTEGER` (0/1). `better-sqlite3` returns raw integers, not JS booleans. The `Provider` TypeBox schema uses `Type.Boolean()`. When `fast-json-stringify` serializes using the response schema, it may coerce `0`/`1` to `false`/`true` -- but this needs verification. If it doesn't auto-coerce, response serialization could fail or return `0` instead of `false`.

The Supabase backend returns proper booleans (PostgreSQL `BOOLEAN` -> JS `boolean`), so this is a local-only concern.

**Resolution needed:** Test this in integration tests. If needed, add a mapping layer in the local repo or in the route handler.

### 2. Missing `GetKeyResponse` Schema

The `provider.ts` schemas define `SetKeyBody` (`{ key: string }`) but no response schema for `GET /providers/:id/key`. Need to define one:

```typescript
export const GetKeyResponse = Type.Object({
  key: Type.String(),
});
```

Or reuse `SetKeyBody` since the shape is identical. Using `SetKeyBody` for a response is semantically wrong -- better to create a dedicated schema.

### 3. `POST /providers` -- Duplicate ID

`CreateProvider` includes `id` (natural string key). If a duplicate ID is inserted:
- SQLite: throws `SQLITE_CONSTRAINT` error
- Supabase: returns a PostgreSQL unique violation error

Route handler should catch this and return 409 Conflict (or let Fastify's default error handling return 500). Ideally: try/catch with a 409 response.

### 4. `PUT /providers/:id` -- Not Found

`LocalProviderRepository.update()` throws `Error('Provider ${id} not found')` if the provider doesn't exist. `SupabaseProviderRepository.update()` calls `.single()` which throws a Supabase error. Route handler must catch this and return 404.

### 5. `DELETE /providers/:id` -- Idempotent

`LocalProviderRepository.delete()` runs `DELETE FROM providers WHERE id = ?` which succeeds silently even if no row matches. The issue says "DELETE /providers/:id -> 204" but doesn't specify behavior for non-existent IDs. Two options:
- Always return 204 (idempotent, simpler)
- Check existence first and return 404

Standard REST practice: 204 regardless (idempotent DELETE). But strict REST says 404 if resource doesn't exist. Need to decide.

### 6. `PUT /providers/:id/key` -- Provider Must Exist

`setKey()` runs an UPDATE statement. If the provider doesn't exist:
- SQLite: `UPDATE ... WHERE id = ?` silently affects 0 rows (no error)
- Supabase: same behavior

Route handler should verify the provider exists first (call `getById`), then `setKey`. Otherwise, keys could be "set" on non-existent providers without error.

### 7. `GET /providers/:id/key` -- Ambiguous Null

`getDecryptedKey()` returns `null` in two cases:
- Provider exists but has no key set
- Provider doesn't exist (SQLite: `row` is `undefined`, `!row?.encrypted_key` -> `null`)

Route handler should distinguish these: call `getById()` first to confirm provider exists (404 if not), then check key (404 with "no API key configured" message, or return `null`/empty). The issue says the response is `{ key: string }` which implies a key must exist.

### 8. Error Response Schema

`ErrorResponse` from `common.ts` matches Fastify's default error format (`statusCode`, `error`, `message`). It should be used in response schemas for 404 responses so they're documented/typed.

### 9. `@fastify/autoload` Nested Routes

The key routes (`/providers/:id/key`) are nested under `/providers/:id`. With autoload, `routes/providers/index.ts` handles the `/providers` prefix. The `:id/key` paths are just additional routes registered within the same plugin -- no subdirectory needed.

## Resolved Assumptions

1. **Router file location:** `backend/src/routes/providers/index.ts` -- autoload picks up the directory, prefix becomes `/providers`
2. **DB access:** `fastify.db.providers` -- the `db` decorator is global (registered with `fastify-plugin`)
3. **Test helper:** `buildTestApp()` from `tests/helpers.ts` -- creates app with in-memory SQLite, runs migrations
4. **Vitest globals:** The health test uses bare `describe/it/expect` (globals mode), but DB tests explicitly import from vitest. Route tests should follow the health test pattern (globals).
5. **No middleware/auth:** No authentication required (no `@fastify/jwt` registered yet)
6. **TypeBox provider:** Already configured in `buildApp()` via `.withTypeProvider<TypeBoxTypeProvider>()`
7. **`@fastify/sensible`** is registered -- provides `fastify.httpErrors.notFound()`, `.badRequest()`, `.conflict()`, etc.
8. **Response schemas for error codes:** Should include `404: ErrorResponse` in schema definitions for routes that can 404
9. **No `GetKeyResponse` schema exists** -- must be added to `backend/src/schemas/provider.ts`

## Implementation Plan (High-Level)

### Step 1: Add Missing Schema

Add `GetKeyResponse` to `backend/src/schemas/provider.ts`:
```typescript
export const GetKeyResponse = Type.Object({ key: Type.String() });
```

### Step 2: Write Route Tests (TDD -- Red)

Create `backend/tests/routes/providers.test.ts` with tests for all 7 endpoints, including:
- Happy paths
- 404 for non-existent providers
- 400 for invalid input (TypeBox validation)
- 409 for duplicate creation
- Key operations on providers with/without keys

### Step 3: Implement Route Handlers (TDD -- Green)

Create `backend/src/routes/providers/index.ts` with all handlers, using:
- `fastify.db.providers.*` for data access
- `fastify.httpErrors.*` for error responses
- TypeBox schemas for validation and serialization

### Step 4: Refactor

Clean up, ensure consistent error messages, verify all tests pass.
