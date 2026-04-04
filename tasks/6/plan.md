# Annotation Prompts CRUD Routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing `IAnnotationPromptRepository` through five REST endpoints on `/annotation-prompts` (list, get, create, update, delete).

**Architecture:** Standard Fastify route plugin using `FastifyPluginAsyncTypebox` for type-safe handlers. The plugin exports a default async function that registers five routes. Each handler delegates to `fastify.db.annotationPrompts` (already decorated by the DB plugin). `@fastify/autoload` auto-maps the directory name `annotation-prompts` to the `/annotation-prompts` prefix. Tests use `buildTestApp()` which spins up an in-memory SQLite instance per test.

**Tech Stack:** Fastify 5, TypeBox (schemas), Vitest (tests), `app.inject()` (HTTP simulation), ESM (`.js` extensions)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/tests/routes/annotation-prompts.test.ts` | **Create** | Route-level integration tests — all five endpoints, happy paths and error paths |
| `backend/src/routes/annotation-prompts/index.ts` | **Create** | Route plugin — five handlers delegating to `fastify.db.annotationPrompts` |

No existing files are modified. All schemas, DB interfaces, and test helpers already exist.

---

## Task 1: Scaffold test file with GET list tests

**Files:**
- Create: `backend/tests/routes/annotation-prompts.test.ts`

- [ ] **Step 1: Write the failing tests for GET /annotation-prompts**

Create `backend/tests/routes/annotation-prompts.test.ts`:

```typescript
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('GET /annotation-prompts', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns empty array when no prompts exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/annotation-prompts',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns all prompts', async () => {
    await app.db.annotationPrompts.create({
      title: 'Prompt A',
      provider_id: 'openai',
      language: 'en',
      prompt: 'Rate this.',
    });
    await app.db.annotationPrompts.create({
      title: 'Prompt B',
      provider_id: 'google',
      language: 'ru',
      prompt: 'Evaluate this.',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/annotation-prompts',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ title: 'Prompt B' }); // DESC order — newest first
    expect(body[1]).toMatchObject({ title: 'Prompt A' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: FAIL — 404 status (no route registered yet), tests will get 404 instead of 200.

---

## Task 2: Implement GET list route (make Task 1 pass)

**Files:**
- Create: `backend/src/routes/annotation-prompts/index.ts`

- [ ] **Step 1: Create route plugin with GET list handler**

Create `backend/src/routes/annotation-prompts/index.ts`:

```typescript
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AnnotationPrompt } from '../../schemas/prompt.js';

const annotationPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(AnnotationPrompt) },
    },
  }, async () => {
    return fastify.db.annotationPrompts.list();
  });
};

export default annotationPromptRoutes;
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/annotation-prompts.test.ts backend/src/routes/annotation-prompts/index.ts
git commit -m "feat(api): add GET /annotation-prompts list route with tests"
```

---

## Task 3: GET by ID — tests then implementation

**Files:**
- Modify: `backend/tests/routes/annotation-prompts.test.ts`
- Modify: `backend/src/routes/annotation-prompts/index.ts`

- [ ] **Step 1: Add failing tests for GET /annotation-prompts/:id**

Append to `backend/tests/routes/annotation-prompts.test.ts` (inside the file, as a new `describe` block after the existing one):

```typescript
describe('GET /annotation-prompts/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns a single prompt by id', async () => {
    const created = await app.db.annotationPrompts.create({
      title: 'My Prompt',
      provider_id: 'openai',
      language: 'en',
      prompt: 'Rate the naturalness.',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/annotation-prompts/${created.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: created.id,
      title: 'My Prompt',
      provider_id: 'openai',
      language: 'en',
      prompt: 'Rate the naturalness.',
    });
  });

  it('returns 404 for non-existent id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/annotation-prompts/9999',
    });

    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: The 2 new tests FAIL (404 for the found case since route doesn't exist; the not-found test may accidentally pass — verify both).

- [ ] **Step 3: Add GET /:id handler to the route plugin**

Add to `backend/src/routes/annotation-prompts/index.ts`, inside the `annotationPromptRoutes` function, after the existing `fastify.get('/')`:

```typescript
import { IdParam, ErrorResponse } from '../../schemas/common.js';
```

(Add this import at the top, alongside the existing imports.)

Then add the route handler inside the plugin function:

```typescript
  fastify.get('/:id', {
    schema: {
      params: IdParam,
      response: {
        200: AnnotationPrompt,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const prompt = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!prompt) {
      return reply.notFound('Annotation prompt not found');
    }
    return prompt;
  });
```

The full file should now look like:

```typescript
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AnnotationPrompt } from '../../schemas/prompt.js';
import { IdParam, ErrorResponse } from '../../schemas/common.js';

const annotationPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(AnnotationPrompt) },
    },
  }, async () => {
    return fastify.db.annotationPrompts.list();
  });

  fastify.get('/:id', {
    schema: {
      params: IdParam,
      response: {
        200: AnnotationPrompt,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const prompt = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!prompt) {
      return reply.notFound('Annotation prompt not found');
    }
    return prompt;
  });
};

export default annotationPromptRoutes;
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/routes/annotation-prompts.test.ts backend/src/routes/annotation-prompts/index.ts
git commit -m "feat(api): add GET /annotation-prompts/:id route with 404 handling"
```

---

## Task 4: POST create — tests then implementation

**Files:**
- Modify: `backend/tests/routes/annotation-prompts.test.ts`
- Modify: `backend/src/routes/annotation-prompts/index.ts`

- [ ] **Step 1: Add failing tests for POST /annotation-prompts**

Append to `backend/tests/routes/annotation-prompts.test.ts`:

```typescript
describe('POST /annotation-prompts', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a new prompt and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/annotation-prompts',
      payload: {
        title: 'New Prompt',
        provider_id: 'openai',
        language: 'en',
        prompt: 'Please rate the quality.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      title: 'New Prompt',
      provider_id: 'openai',
      language: 'en',
      prompt: 'Please rate the quality.',
    });
    expect(body.id).toBeDefined();
    expect(body.created_at).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/annotation-prompts',
      payload: {
        title: 'Incomplete Prompt',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: The 2 new tests FAIL (404 — no POST route registered).

- [ ] **Step 3: Add POST handler to the route plugin**

Add to `backend/src/routes/annotation-prompts/index.ts`, inside the plugin function, after the GET /:id handler:

```typescript
import { CreateAnnotationPrompt } from '../../schemas/prompt.js';
```

(Update the existing import from `../../schemas/prompt.js` to also import `CreateAnnotationPrompt`.)

Then add the route handler:

```typescript
  fastify.post('/', {
    schema: {
      body: CreateAnnotationPrompt,
      response: {
        201: AnnotationPrompt,
      },
    },
  }, async (request, reply) => {
    const prompt = await fastify.db.annotationPrompts.create(request.body);
    return reply.status(201).send(prompt);
  });
```

The import line should now be:

```typescript
import { AnnotationPrompt, CreateAnnotationPrompt } from '../../schemas/prompt.js';
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/routes/annotation-prompts.test.ts backend/src/routes/annotation-prompts/index.ts
git commit -m "feat(api): add POST /annotation-prompts route with validation"
```

---

## Task 5: PUT update — tests then implementation

**Files:**
- Modify: `backend/tests/routes/annotation-prompts.test.ts`
- Modify: `backend/src/routes/annotation-prompts/index.ts`

- [ ] **Step 1: Add failing tests for PUT /annotation-prompts/:id**

Append to `backend/tests/routes/annotation-prompts.test.ts`:

```typescript
describe('PUT /annotation-prompts/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('updates an existing prompt with partial data', async () => {
    const created = await app.db.annotationPrompts.create({
      title: 'Original',
      provider_id: 'openai',
      language: 'en',
      prompt: 'Old prompt text.',
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/annotation-prompts/${created.id}`,
      payload: {
        title: 'Updated Title',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe('Updated Title');
    expect(body.prompt).toBe('Old prompt text.'); // unchanged field preserved
    expect(body.id).toBe(created.id);
  });

  it('returns 404 when updating non-existent prompt', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/annotation-prompts/9999',
      payload: {
        title: 'Does not matter',
      },
    });

    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: The 2 new tests FAIL (404 — no PUT route registered).

- [ ] **Step 3: Add PUT handler to the route plugin**

Update the import from `../../schemas/prompt.js` to also import `UpdateAnnotationPrompt`:

```typescript
import { AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt } from '../../schemas/prompt.js';
```

Then add the route handler inside the plugin function, after the POST handler:

```typescript
  fastify.put('/:id', {
    schema: {
      params: IdParam,
      body: UpdateAnnotationPrompt,
      response: {
        200: AnnotationPrompt,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!existing) {
      return reply.notFound('Annotation prompt not found');
    }
    const updated = await fastify.db.annotationPrompts.update(request.params.id, request.body);
    return updated;
  });
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/routes/annotation-prompts.test.ts backend/src/routes/annotation-prompts/index.ts
git commit -m "feat(api): add PUT /annotation-prompts/:id route with 404 handling"
```

---

## Task 6: DELETE — tests then implementation

**Files:**
- Modify: `backend/tests/routes/annotation-prompts.test.ts`
- Modify: `backend/src/routes/annotation-prompts/index.ts`

- [ ] **Step 1: Add failing tests for DELETE /annotation-prompts/:id**

Append to `backend/tests/routes/annotation-prompts.test.ts`:

```typescript
describe('DELETE /annotation-prompts/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('deletes an existing prompt and returns 204', async () => {
    const created = await app.db.annotationPrompts.create({
      title: 'To Delete',
      provider_id: 'openai',
      language: 'en',
      prompt: 'Temporary.',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/annotation-prompts/${created.id}`,
    });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    // Verify it's actually gone
    const check = await app.db.annotationPrompts.getById(created.id);
    expect(check).toBeNull();
  });

  it('returns 404 when deleting non-existent prompt', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/annotation-prompts/9999',
    });

    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: The 2 new tests FAIL (404 for the happy path; the not-found test may accidentally pass).

- [ ] **Step 3: Add DELETE handler to the route plugin**

Add the route handler inside the plugin function, after the PUT handler:

```typescript
  fastify.delete('/:id', {
    schema: {
      params: IdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!existing) {
      return reply.notFound('Annotation prompt not found');
    }
    await fastify.db.annotationPrompts.delete(request.params.id);
    return reply.status(204).send();
  });
```

The complete final `backend/src/routes/annotation-prompts/index.ts` should now be:

```typescript
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt } from '../../schemas/prompt.js';
import { IdParam, ErrorResponse } from '../../schemas/common.js';

const annotationPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(AnnotationPrompt) },
    },
  }, async () => {
    return fastify.db.annotationPrompts.list();
  });

  fastify.get('/:id', {
    schema: {
      params: IdParam,
      response: {
        200: AnnotationPrompt,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const prompt = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!prompt) {
      return reply.notFound('Annotation prompt not found');
    }
    return prompt;
  });

  fastify.post('/', {
    schema: {
      body: CreateAnnotationPrompt,
      response: {
        201: AnnotationPrompt,
      },
    },
  }, async (request, reply) => {
    const prompt = await fastify.db.annotationPrompts.create(request.body);
    return reply.status(201).send(prompt);
  });

  fastify.put('/:id', {
    schema: {
      params: IdParam,
      body: UpdateAnnotationPrompt,
      response: {
        200: AnnotationPrompt,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!existing) {
      return reply.notFound('Annotation prompt not found');
    }
    const updated = await fastify.db.annotationPrompts.update(request.params.id, request.body);
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
  }, async (request, reply) => {
    const existing = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!existing) {
      return reply.notFound('Annotation prompt not found');
    }
    await fastify.db.annotationPrompts.delete(request.params.id);
    return reply.status(204).send();
  });
};

export default annotationPromptRoutes;
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd backend && npx vitest run tests/routes/annotation-prompts.test.ts`
Expected: 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/routes/annotation-prompts.test.ts backend/src/routes/annotation-prompts/index.ts
git commit -m "feat(api): add DELETE /annotation-prompts/:id route with 404 handling"
```

---

## Task 7: Full verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && npx vitest run`
Expected: All tests pass (annotation-prompts tests + existing health tests + DB tests).

- [ ] **Step 2: Run the build**

Run: `cd backend && npm run build`
Expected: TypeScript compiles with no errors.

- [ ] **Step 3: Final commit (if any adjustments were needed)**

If any fixes were required during verification, commit them:

```bash
git add -A
git commit -m "fix: address issues from full verification"
```

If no fixes were needed, skip this step.
