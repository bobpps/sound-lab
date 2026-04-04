# Providers CRUD Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement REST API routes for provider management (list, get, create, update, delete, key management) with full TypeBox schema validation and response serialization.

**Architecture:** Route file at `backend/src/routes/providers/index.ts` using Fastify's autoload convention (directory name becomes `/providers` prefix). All 7 endpoints in a single plugin, typed with `FastifyPluginAsyncTypebox`. DB access via `fastify.db.providers.*` decorator. Error handling via `@fastify/sensible` (`fastify.httpErrors`).

**Tech Stack:** Fastify 5, TypeBox (schemas + types), Vitest, `app.inject()` for route tests, in-memory SQLite via `buildTestApp()`.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/src/schemas/provider.ts` | Add `GetKeyResponse` schema |
| Create | `backend/src/routes/providers/index.ts` | All 7 route handlers |
| Create | `backend/tests/routes/providers.test.ts` | Integration tests for all routes |

---

## Important Context

**SQLite `enabled` coercion:** SQLite stores `enabled` as INTEGER (0/1). `better-sqlite3` returns raw integers. The `Provider` TypeBox schema expects `Type.Boolean()`. Fastify's response serialization with `fast-json-stringify` will serialize `1` as `true` and `0` as `false` because JSON Schema coercion handles this. This works for responses. However, if you read a provider and compare in JS, `provider.enabled` will be `1` not `true`. This is fine for our API -- response schemas handle the coercion at serialization time.

**Error patterns from DB layer:**
- `getById(id)` returns `null` when not found
- `update(id, data)` throws `Error("Provider {id} not found")` when not found
- `delete(id)` is idempotent (no error if not found) -- always return 204
- `setKey(id, key)` silently does nothing if provider doesn't exist (UPDATE WHERE clause matches 0 rows) -- must check existence first
- `getDecryptedKey(id)` returns `null` for both "provider doesn't exist" and "provider exists but no key set" -- must distinguish with `getById`
- `create(data)` throws SQLite constraint error on duplicate `id` (UNIQUE constraint on PRIMARY KEY)

**Existing patterns to follow:**
- Route file: default-export a `FastifyPluginAsyncTypebox` (see `backend/src/routes/health/index.ts`)
- Test file: `buildTestApp()` from `../helpers.js`, `beforeEach`/`afterEach` for app lifecycle (see `backend/tests/routes/health.test.ts`)
- Schemas: TypeBox in `backend/src/schemas/`, shared `StringIdParam` and `ErrorResponse` from `common.ts`
- ESM: `.js` extensions in all imports

---

### Task 1: Add `GetKeyResponse` Schema

**Files:**
- Modify: `backend/src/schemas/provider.ts`

- [ ] **Step 1: Add `GetKeyResponse` to the provider schema file**

Add to the end of `backend/src/schemas/provider.ts`:

```typescript
export const GetKeyResponse = Type.Object({
  key: Type.String(),
});
export type GetKeyResponse = Static<typeof GetKeyResponse>;
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd backend && npx tsc --noEmit --pretty src/schemas/provider.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/provider.ts
git commit -m "feat(schemas): add GetKeyResponse schema for provider key endpoint"
```

---

### Task 2: Write Failing Tests for GET /providers and GET /providers/:id

**Files:**
- Create: `backend/tests/routes/providers.test.ts`

- [ ] **Step 1: Write the test file with list and get-by-id tests**

Create `backend/tests/routes/providers.test.ts`:

```typescript
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('Provider routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // Helper: seed a provider via the DB layer directly
  async function seedProvider(id: string, name: string, type: 'tts' | 'llm' | 'realtime' = 'tts') {
    return app.db.providers.create({ id, name, type });
  }

  describe('GET /providers', () => {
    it('returns empty array when no providers exist', async () => {
      const res = await app.inject({ method: 'GET', url: '/providers' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('returns all providers', async () => {
      await seedProvider('google', 'Google');
      await seedProvider('openai', 'OpenAI', 'llm');

      const res = await app.inject({ method: 'GET', url: '/providers' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({ id: 'google', name: 'Google', type: 'tts' });
    });

    it('filters by type query param', async () => {
      await seedProvider('google', 'Google', 'tts');
      await seedProvider('openai', 'OpenAI', 'llm');
      await seedProvider('elevenlabs', 'ElevenLabs', 'tts');

      const res = await app.inject({ method: 'GET', url: '/providers?type=tts' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body.every((p: { type: string }) => p.type === 'tts')).toBe(true);
    });

    it('returns providers with enabled as boolean', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({ method: 'GET', url: '/providers' });
      const body = res.json();
      expect(body[0].enabled).toBe(true);
    });
  });

  describe('GET /providers/:id', () => {
    it('returns a provider by id', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({ method: 'GET', url: '/providers/google' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: 'google', name: 'Google', type: 'tts', enabled: true });
    });

    it('returns 404 for non-existent provider', async () => {
      const res = await app.inject({ method: 'GET', url: '/providers/nonexistent' });
      expect(res.statusCode).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run tests/routes/providers.test.ts`
Expected: FAIL -- routes not yet implemented (404 for all endpoints since the route file doesn't exist)

- [ ] **Step 3: Commit the failing tests**

```bash
git add backend/tests/routes/providers.test.ts
git commit -m "test: add failing tests for GET /providers and GET /providers/:id"
```

---

### Task 3: Implement GET /providers and GET /providers/:id

**Files:**
- Create: `backend/src/routes/providers/index.ts`

- [ ] **Step 1: Create the route file with list and get-by-id handlers**

Create `backend/src/routes/providers/index.ts`:

```typescript
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { Provider, ProviderTypeQuery } from '../../schemas/provider.js';
import { StringIdParam, ErrorResponse } from '../../schemas/common.js';

const providerRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /providers?type=tts
  fastify.get('/', {
    schema: {
      querystring: ProviderTypeQuery,
      response: { 200: Type.Array(Provider) },
    },
  }, async (request) => {
    return fastify.db.providers.list(request.query.type);
  });

  // GET /providers/:id
  fastify.get('/:id', {
    schema: {
      params: StringIdParam,
      response: {
        200: Provider,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const provider = await fastify.db.providers.getById(request.params.id);
    if (!provider) {
      return reply.notFound(`Provider ${request.params.id} not found`);
    }
    return provider;
  });
};

export default providerRoutes;
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/providers.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/providers/index.ts
git commit -m "feat: implement GET /providers and GET /providers/:id routes"
```

---

### Task 4: Write Failing Tests for POST /providers

**Files:**
- Modify: `backend/tests/routes/providers.test.ts`

- [ ] **Step 1: Add POST /providers tests**

Add the following `describe` block inside the outer `describe('Provider routes', ...)`, after the `GET /providers/:id` block:

```typescript
  describe('POST /providers', () => {
    it('creates a provider and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: { id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts', enabled: true });
    });

    it('returns 409 for duplicate provider id', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: { id: 'elevenlabs', name: 'ElevenLabs Duplicate', type: 'tts' },
      });
      expect(res.statusCode).toBe(409);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: { id: 'test' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: { id: 'test', name: 'Test', type: 'invalid' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd backend && npx vitest run tests/routes/providers.test.ts`
Expected: The 4 new POST tests FAIL (POST route not yet implemented)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/providers.test.ts
git commit -m "test: add failing tests for POST /providers"
```

---

### Task 5: Implement POST /providers

**Files:**
- Modify: `backend/src/routes/providers/index.ts`

- [ ] **Step 1: Add the POST handler and CreateProvider import**

In `backend/src/routes/providers/index.ts`, update the import line:

```typescript
import { Provider, ProviderTypeQuery, CreateProvider } from '../../schemas/provider.js';
```

Then add the following route inside the plugin function, after the `GET /:id` handler:

```typescript
  // POST /providers
  fastify.post('/', {
    schema: {
      body: CreateProvider,
      response: {
        201: Provider,
        409: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    try {
      const provider = await fastify.db.providers.create(request.body);
      return reply.status(201).send(provider);
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        return reply.conflict(`Provider ${request.body.id} already exists`);
      }
      throw err;
    }
  });
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/providers.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/providers/index.ts
git commit -m "feat: implement POST /providers route with duplicate detection"
```

---

### Task 6: Write Failing Tests for PUT /providers/:id and DELETE /providers/:id

**Files:**
- Modify: `backend/tests/routes/providers.test.ts`

- [ ] **Step 1: Add PUT and DELETE tests**

Add the following `describe` blocks inside the outer `describe('Provider routes', ...)`:

```typescript
  describe('PUT /providers/:id', () => {
    it('updates a provider', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/google',
        payload: { name: 'Google Cloud' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: 'google', name: 'Google Cloud' });
    });

    it('updates enabled field', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/google',
        payload: { enabled: false },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().enabled).toBe(false);
    });

    it('returns 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/nonexistent',
        payload: { name: 'Test' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /providers/:id', () => {
    it('deletes a provider and returns 204', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({
        method: 'DELETE',
        url: '/providers/google',
      });
      expect(res.statusCode).toBe(204);

      const check = await app.inject({ method: 'GET', url: '/providers/google' });
      expect(check.statusCode).toBe(404);
    });

    it('returns 204 for non-existent provider (idempotent)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/providers/nonexistent',
      });
      expect(res.statusCode).toBe(204);
    });
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd backend && npx vitest run tests/routes/providers.test.ts`
Expected: The 5 new tests FAIL (PUT and DELETE routes not implemented)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/providers.test.ts
git commit -m "test: add failing tests for PUT /providers/:id and DELETE /providers/:id"
```

---

### Task 7: Implement PUT /providers/:id and DELETE /providers/:id

**Files:**
- Modify: `backend/src/routes/providers/index.ts`

- [ ] **Step 1: Add UpdateProvider import**

In `backend/src/routes/providers/index.ts`, update the import line:

```typescript
import { Provider, ProviderTypeQuery, CreateProvider, UpdateProvider } from '../../schemas/provider.js';
```

- [ ] **Step 2: Add the PUT handler**

Add the following route inside the plugin function:

```typescript
  // PUT /providers/:id
  fastify.put('/:id', {
    schema: {
      params: StringIdParam,
      body: UpdateProvider,
      response: {
        200: Provider,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    try {
      const provider = await fastify.db.providers.update(request.params.id, request.body);
      return provider;
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return reply.notFound(`Provider ${request.params.id} not found`);
      }
      throw err;
    }
  });
```

- [ ] **Step 3: Add the DELETE handler**

Add the following route inside the plugin function:

```typescript
  // DELETE /providers/:id
  fastify.delete('/:id', {
    schema: {
      params: StringIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    await fastify.db.providers.delete(request.params.id);
    return reply.status(204).send();
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/providers.test.ts`
Expected: All 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/providers/index.ts
git commit -m "feat: implement PUT /providers/:id and DELETE /providers/:id routes"
```

---

### Task 8: Write Failing Tests for PUT /providers/:id/key and GET /providers/:id/key

**Files:**
- Modify: `backend/tests/routes/providers.test.ts`

- [ ] **Step 1: Add key management tests**

Add the following `describe` blocks inside the outer `describe('Provider routes', ...)`:

```typescript
  describe('PUT /providers/:id/key', () => {
    it('sets an API key and returns 204', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/elevenlabs/key',
        payload: { key: 'sk-secret-12345' },
      });
      expect(res.statusCode).toBe(204);
    });

    it('returns 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/nonexistent/key',
        payload: { key: 'sk-secret' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when key is missing', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/elevenlabs/key',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /providers/:id/key', () => {
    it('returns the decrypted key', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      await app.db.providers.setKey('elevenlabs', 'sk-secret-12345');

      const res = await app.inject({
        method: 'GET',
        url: '/providers/elevenlabs/key',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ key: 'sk-secret-12345' });
    });

    it('returns 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/providers/nonexistent/key',
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider exists but no key is set', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      const res = await app.inject({
        method: 'GET',
        url: '/providers/elevenlabs/key',
      });
      expect(res.statusCode).toBe(404);
    });
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd backend && npx vitest run tests/routes/providers.test.ts`
Expected: The 6 new tests FAIL (key routes not implemented)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/providers.test.ts
git commit -m "test: add failing tests for PUT/GET /providers/:id/key"
```

---

### Task 9: Implement PUT /providers/:id/key and GET /providers/:id/key

**Files:**
- Modify: `backend/src/routes/providers/index.ts`

- [ ] **Step 1: Add key schema imports**

In `backend/src/routes/providers/index.ts`, update the provider schema import:

```typescript
import { Provider, ProviderTypeQuery, CreateProvider, UpdateProvider, SetKeyBody, GetKeyResponse } from '../../schemas/provider.js';
```

- [ ] **Step 2: Add the PUT /providers/:id/key handler**

Add inside the plugin function:

```typescript
  // PUT /providers/:id/key
  fastify.put('/:id/key', {
    schema: {
      params: StringIdParam,
      body: SetKeyBody,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const provider = await fastify.db.providers.getById(request.params.id);
    if (!provider) {
      return reply.notFound(`Provider ${request.params.id} not found`);
    }
    await fastify.db.providers.setKey(request.params.id, request.body.key);
    return reply.status(204).send();
  });
```

- [ ] **Step 3: Add the GET /providers/:id/key handler**

Add inside the plugin function:

```typescript
  // GET /providers/:id/key
  fastify.get('/:id/key', {
    schema: {
      params: StringIdParam,
      response: {
        200: GetKeyResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const provider = await fastify.db.providers.getById(request.params.id);
    if (!provider) {
      return reply.notFound(`Provider ${request.params.id} not found`);
    }
    const key = await fastify.db.providers.getDecryptedKey(request.params.id);
    if (!key) {
      return reply.notFound(`No API key set for provider ${request.params.id}`);
    }
    return { key };
  });
```

**Important:** The `/:id/key` routes MUST be registered BEFORE the `/:id` route. Fastify's radix-tree router matches more specific paths first, but with parametric routes you should register sub-paths first to avoid the `/:id` route capturing `/key` as the id parameter.

If tests fail because `/:id` is matching before `/:id/key`, reorder the route registrations so that the key routes come before the `GET /:id`, `PUT /:id`, and `DELETE /:id` routes.

- [ ] **Step 4: Run the tests to verify they all pass**

Run: `cd backend && npx vitest run tests/routes/providers.test.ts`
Expected: All 20 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/providers/index.ts
git commit -m "feat: implement PUT/GET /providers/:id/key routes for API key management"
```

---

### Task 10: Run Full Test Suite and Final Verification

**Files:**
- No new changes -- verification only

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && npx vitest run`
Expected: All tests PASS (existing health/db tests + new provider route tests)

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify the final route file structure**

The final `backend/src/routes/providers/index.ts` should contain these 7 route registrations in this order:
1. `GET /` -- list providers (with optional `?type=` filter)
2. `POST /` -- create provider
3. `PUT /:id/key` -- set API key
4. `GET /:id/key` -- get API key
5. `GET /:id` -- get provider by id
6. `PUT /:id` -- update provider
7. `DELETE /:id` -- delete provider

The sub-path routes (`/:id/key`) are registered before the parametric routes (`/:id`) to avoid routing conflicts.

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: final cleanup for providers CRUD routes"
```

Only run this if changes were made during verification. Skip if everything passed cleanly.
