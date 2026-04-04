# Agent Prompts CRUD Routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement five REST endpoints (list, get, create, update, delete) for the AgentPrompt entity, with full integration tests.

**Architecture:** A single Fastify route plugin at `backend/src/routes/agent-prompts/index.ts` auto-registered by `@fastify/autoload`. Routes delegate to `fastify.db.agentPrompts` repository methods. All request/response validation via TypeBox schemas already defined in `backend/src/schemas/prompt.ts`. TDD: tests written first against the real in-memory SQLite DB via `buildTestApp()`.

**Tech Stack:** Fastify 5, TypeBox, Vitest, `@fastify/sensible` (httpErrors), `@fastify/autoload`, ESM with `.js` import extensions.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/routes/agent-prompts/index.ts` | Create | Route plugin — 5 CRUD endpoints |
| `backend/tests/routes/agent-prompts.test.ts` | Create | Integration tests — `app.inject()` against in-memory SQLite |

No existing files are modified.

### Key Reference Files (read-only)

| File | What to look at |
|------|-----------------|
| `backend/src/schemas/prompt.ts` (lines 30-55) | `AgentPrompt`, `CreateAgentPrompt`, `UpdateAgentPrompt` TypeBox schemas |
| `backend/src/schemas/common.ts` | `IdParam` (integer), `ErrorResponse` |
| `backend/src/db/interfaces.ts` (lines 41-47) | `IAgentPromptRepository` — the 5 methods routes call |
| `backend/src/routes/health/index.ts` | Reference for plugin export pattern |
| `backend/tests/routes/health.test.ts` | Reference for `buildTestApp()` + `app.inject()` pattern |
| `backend/tests/helpers.ts` | `buildTestApp()` — creates app with in-memory SQLite |
| `backend/src/app.ts` | Autoload config confirming `dirNameRoutePrefix: true` |

### Behavior Contract

- `getById(id)` returns `null` when not found
- `update(id, data)` throws `Error` when ID not found
- `delete(id)` is **silent** when ID not found (no error)
- Routes must check existence via `getById` before `update` and `delete` to return consistent 404s

---

## Task 1: Write test file scaffold and GET /agent-prompts tests

**Files:**
- Create: `backend/tests/routes/agent-prompts.test.ts`

- [ ] **Step 1: Create the test file with scaffold and GET list tests**

```typescript
// backend/tests/routes/agent-prompts.test.ts
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

const SEED_PROMPT = {
  title: 'Support Agent',
  provider_id: 'openai',
  language: 'en-US',
  prompt: 'You are a helpful support agent...',
};

describe('Agent prompt routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /agent-prompts', () => {
    it('returns empty array when no prompts exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent-prompts',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('returns all prompts', async () => {
      await app.db.agentPrompts.create(SEED_PROMPT);
      await app.db.agentPrompts.create({
        title: 'Sales Agent',
        provider_id: 'gemini',
        language: 'ru-RU',
        prompt: 'You are a sales assistant...',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/agent-prompts',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body[0]).toHaveProperty('id');
      expect(body[0]).toHaveProperty('title');
      expect(body[0]).toHaveProperty('created_at');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: FAIL — the route `/agent-prompts` returns 404 because the route file does not exist yet.

---

## Task 2: Create route plugin with GET /agent-prompts endpoint

**Files:**
- Create: `backend/src/routes/agent-prompts/index.ts`

- [ ] **Step 1: Create the route file with the GET list endpoint**

```typescript
// backend/src/routes/agent-prompts/index.ts
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import * as S from '../../schemas/prompt.js';

const agentPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(S.AgentPrompt) },
    },
  }, async () => {
    return fastify.db.agentPrompts.list();
  });
};

export default agentPromptRoutes;
```

- [ ] **Step 2: Run the GET list tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/agent-prompts/index.ts backend/tests/routes/agent-prompts.test.ts
git commit -m "feat(api): add GET /agent-prompts list endpoint with tests"
```

---

## Task 3: Add GET /agent-prompts/:id tests and implementation

**Files:**
- Modify: `backend/tests/routes/agent-prompts.test.ts`
- Modify: `backend/src/routes/agent-prompts/index.ts`

- [ ] **Step 1: Add GET /:id tests to the test file**

Append inside the `describe('Agent prompt routes', ...)` block, after the `GET /agent-prompts` describe:

```typescript
  describe('GET /agent-prompts/:id', () => {
    it('returns a prompt by id', async () => {
      const created = await app.db.agentPrompts.create(SEED_PROMPT);

      const res = await app.inject({
        method: 'GET',
        url: `/agent-prompts/${created.id}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(created.id);
      expect(body.title).toBe('Support Agent');
      expect(body.provider_id).toBe('openai');
      expect(body.language).toBe('en-US');
      expect(body.prompt).toBe('You are a helpful support agent...');
      expect(body.created_by).toBeNull();
      expect(body.created_at).toBeDefined();
    });

    it('returns 404 for non-existent id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent-prompts/999',
      });

      expect(res.statusCode).toBe(404);
    });
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: The 2 new GET /:id tests FAIL (404 for the found case, or wrong response).

- [ ] **Step 3: Add GET /:id route to the plugin**

Add this route inside `agentPromptRoutes`, after the GET `/` route. Also add the import for `IdParam` and `ErrorResponse`:

Update the imports at the top of `backend/src/routes/agent-prompts/index.ts`:

```typescript
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import * as S from '../../schemas/prompt.js';
import { IdParam, ErrorResponse } from '../../schemas/common.js';
```

Add this route after the existing GET `/` route:

```typescript
  fastify.get('/:id', {
    schema: {
      params: IdParam,
      response: {
        200: S.AgentPrompt,
        404: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const prompt = await fastify.db.agentPrompts.getById(req.params.id);
    if (!prompt) return reply.notFound();
    return prompt;
  });
```

- [ ] **Step 4: Run all tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/agent-prompts/index.ts backend/tests/routes/agent-prompts.test.ts
git commit -m "feat(api): add GET /agent-prompts/:id endpoint with tests"
```

---

## Task 4: Add POST /agent-prompts tests and implementation

**Files:**
- Modify: `backend/tests/routes/agent-prompts.test.ts`
- Modify: `backend/src/routes/agent-prompts/index.ts`

- [ ] **Step 1: Add POST tests to the test file**

Append inside the `describe('Agent prompt routes', ...)` block:

```typescript
  describe('POST /agent-prompts', () => {
    it('creates a prompt and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent-prompts',
        payload: SEED_PROMPT,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBe(1);
      expect(body.title).toBe('Support Agent');
      expect(body.provider_id).toBe('openai');
      expect(body.language).toBe('en-US');
      expect(body.prompt).toBe('You are a helpful support agent...');
      expect(body.created_by).toBeNull();
      expect(body.created_at).toBeDefined();
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent-prompts',
        payload: { title: 'Incomplete' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: The POST tests FAIL (404 — no POST route registered yet).

- [ ] **Step 3: Add POST route to the plugin**

Add this route inside `agentPromptRoutes`, after the GET `/:id` route:

```typescript
  fastify.post('/', {
    schema: {
      body: S.CreateAgentPrompt,
      response: {
        201: S.AgentPrompt,
      },
    },
  }, async (req, reply) => {
    const prompt = await fastify.db.agentPrompts.create(req.body);
    return reply.status(201).send(prompt);
  });
```

- [ ] **Step 4: Run all tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/agent-prompts/index.ts backend/tests/routes/agent-prompts.test.ts
git commit -m "feat(api): add POST /agent-prompts endpoint with tests"
```

---

## Task 5: Add PUT /agent-prompts/:id tests and implementation

**Files:**
- Modify: `backend/tests/routes/agent-prompts.test.ts`
- Modify: `backend/src/routes/agent-prompts/index.ts`

- [ ] **Step 1: Add PUT tests to the test file**

Append inside the `describe('Agent prompt routes', ...)` block:

```typescript
  describe('PUT /agent-prompts/:id', () => {
    it('updates a prompt with partial fields', async () => {
      const created = await app.db.agentPrompts.create(SEED_PROMPT);

      const res = await app.inject({
        method: 'PUT',
        url: `/agent-prompts/${created.id}`,
        payload: { title: 'Updated Agent', prompt: 'New prompt text' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(created.id);
      expect(body.title).toBe('Updated Agent');
      expect(body.prompt).toBe('New prompt text');
      expect(body.provider_id).toBe('openai');
      expect(body.language).toBe('en-US');
    });

    it('returns 404 for non-existent id', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/agent-prompts/999',
        payload: { title: 'Ghost' },
      });

      expect(res.statusCode).toBe(404);
    });
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: The PUT tests FAIL (404 — no PUT route registered yet).

- [ ] **Step 3: Add PUT route to the plugin**

Add this route inside `agentPromptRoutes`, after the POST `/` route:

```typescript
  fastify.put('/:id', {
    schema: {
      params: IdParam,
      body: S.UpdateAgentPrompt,
      response: {
        200: S.AgentPrompt,
        404: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const existing = await fastify.db.agentPrompts.getById(req.params.id);
    if (!existing) return reply.notFound();
    const updated = await fastify.db.agentPrompts.update(req.params.id, req.body);
    return updated;
  });
```

- [ ] **Step 4: Run all tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/agent-prompts/index.ts backend/tests/routes/agent-prompts.test.ts
git commit -m "feat(api): add PUT /agent-prompts/:id endpoint with tests"
```

---

## Task 6: Add DELETE /agent-prompts/:id tests and implementation

**Files:**
- Modify: `backend/tests/routes/agent-prompts.test.ts`
- Modify: `backend/src/routes/agent-prompts/index.ts`

- [ ] **Step 1: Add DELETE tests to the test file**

Append inside the `describe('Agent prompt routes', ...)` block:

```typescript
  describe('DELETE /agent-prompts/:id', () => {
    it('deletes a prompt and returns 204', async () => {
      const created = await app.db.agentPrompts.create(SEED_PROMPT);

      const res = await app.inject({
        method: 'DELETE',
        url: `/agent-prompts/${created.id}`,
      });

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');

      const check = await app.inject({
        method: 'GET',
        url: `/agent-prompts/${created.id}`,
      });
      expect(check.statusCode).toBe(404);
    });

    it('returns 404 for non-existent id', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/agent-prompts/999',
      });

      expect(res.statusCode).toBe(404);
    });
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: The DELETE tests FAIL (404 — no DELETE route registered yet).

- [ ] **Step 3: Add DELETE route to the plugin**

Add this route inside `agentPromptRoutes`, after the PUT `/:id` route:

```typescript
  fastify.delete('/:id', {
    schema: {
      params: IdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const existing = await fastify.db.agentPrompts.getById(req.params.id);
    if (!existing) return reply.notFound();
    await fastify.db.agentPrompts.delete(req.params.id);
    return reply.status(204).send();
  });
```

- [ ] **Step 4: Run all tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/agent-prompts/index.ts backend/tests/routes/agent-prompts.test.ts
git commit -m "feat(api): add DELETE /agent-prompts/:id endpoint with tests"
```

---

## Task 7: Full verification — all tests, build, lint

**Files:** None (verification only)

- [ ] **Step 1: Run the full agent-prompts test suite**

Run from `backend/`:
```bash
npx vitest run tests/routes/agent-prompts.test.ts
```

Expected: All 10 tests PASS.

- [ ] **Step 2: Run the entire backend test suite**

Run from `backend/`:
```bash
npx vitest run
```

Expected: All tests PASS (no regressions in existing tests).

- [ ] **Step 3: Run the build**

Run from project root:
```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Run lint (if configured for backend)**

Run from project root:
```bash
npm run lint --workspace=backend 2>/dev/null || echo "No backend lint script"
```

Expected: Either passes or no lint script configured for backend.

---

## Final File Contents Reference

### `backend/src/routes/agent-prompts/index.ts` (complete)

```typescript
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import * as S from '../../schemas/prompt.js';
import { IdParam, ErrorResponse } from '../../schemas/common.js';

const agentPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(S.AgentPrompt) },
    },
  }, async () => {
    return fastify.db.agentPrompts.list();
  });

  fastify.get('/:id', {
    schema: {
      params: IdParam,
      response: {
        200: S.AgentPrompt,
        404: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const prompt = await fastify.db.agentPrompts.getById(req.params.id);
    if (!prompt) return reply.notFound();
    return prompt;
  });

  fastify.post('/', {
    schema: {
      body: S.CreateAgentPrompt,
      response: {
        201: S.AgentPrompt,
      },
    },
  }, async (req, reply) => {
    const prompt = await fastify.db.agentPrompts.create(req.body);
    return reply.status(201).send(prompt);
  });

  fastify.put('/:id', {
    schema: {
      params: IdParam,
      body: S.UpdateAgentPrompt,
      response: {
        200: S.AgentPrompt,
        404: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const existing = await fastify.db.agentPrompts.getById(req.params.id);
    if (!existing) return reply.notFound();
    const updated = await fastify.db.agentPrompts.update(req.params.id, req.body);
    return updated;
  });

  fastify.delete('/:id', {
    schema: {
      params: IdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const existing = await fastify.db.agentPrompts.getById(req.params.id);
    if (!existing) return reply.notFound();
    await fastify.db.agentPrompts.delete(req.params.id);
    return reply.status(204).send();
  });
};

export default agentPromptRoutes;
```

### `backend/tests/routes/agent-prompts.test.ts` (complete)

```typescript
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

const SEED_PROMPT = {
  title: 'Support Agent',
  provider_id: 'openai',
  language: 'en-US',
  prompt: 'You are a helpful support agent...',
};

describe('Agent prompt routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /agent-prompts', () => {
    it('returns empty array when no prompts exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent-prompts',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('returns all prompts', async () => {
      await app.db.agentPrompts.create(SEED_PROMPT);
      await app.db.agentPrompts.create({
        title: 'Sales Agent',
        provider_id: 'gemini',
        language: 'ru-RU',
        prompt: 'You are a sales assistant...',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/agent-prompts',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body[0]).toHaveProperty('id');
      expect(body[0]).toHaveProperty('title');
      expect(body[0]).toHaveProperty('created_at');
    });
  });

  describe('GET /agent-prompts/:id', () => {
    it('returns a prompt by id', async () => {
      const created = await app.db.agentPrompts.create(SEED_PROMPT);

      const res = await app.inject({
        method: 'GET',
        url: `/agent-prompts/${created.id}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(created.id);
      expect(body.title).toBe('Support Agent');
      expect(body.provider_id).toBe('openai');
      expect(body.language).toBe('en-US');
      expect(body.prompt).toBe('You are a helpful support agent...');
      expect(body.created_by).toBeNull();
      expect(body.created_at).toBeDefined();
    });

    it('returns 404 for non-existent id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent-prompts/999',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /agent-prompts', () => {
    it('creates a prompt and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent-prompts',
        payload: SEED_PROMPT,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBe(1);
      expect(body.title).toBe('Support Agent');
      expect(body.provider_id).toBe('openai');
      expect(body.language).toBe('en-US');
      expect(body.prompt).toBe('You are a helpful support agent...');
      expect(body.created_by).toBeNull();
      expect(body.created_at).toBeDefined();
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent-prompts',
        payload: { title: 'Incomplete' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /agent-prompts/:id', () => {
    it('updates a prompt with partial fields', async () => {
      const created = await app.db.agentPrompts.create(SEED_PROMPT);

      const res = await app.inject({
        method: 'PUT',
        url: `/agent-prompts/${created.id}`,
        payload: { title: 'Updated Agent', prompt: 'New prompt text' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(created.id);
      expect(body.title).toBe('Updated Agent');
      expect(body.prompt).toBe('New prompt text');
      expect(body.provider_id).toBe('openai');
      expect(body.language).toBe('en-US');
    });

    it('returns 404 for non-existent id', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/agent-prompts/999',
        payload: { title: 'Ghost' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /agent-prompts/:id', () => {
    it('deletes a prompt and returns 204', async () => {
      const created = await app.db.agentPrompts.create(SEED_PROMPT);

      const res = await app.inject({
        method: 'DELETE',
        url: `/agent-prompts/${created.id}`,
      });

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');

      const check = await app.inject({
        method: 'GET',
        url: `/agent-prompts/${created.id}`,
      });
      expect(check.statusCode).toBe(404);
    });

    it('returns 404 for non-existent id', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/agent-prompts/999',
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
```
