# Dialogs + Messages CRUD Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 8 REST endpoints for dialog and message CRUD as a Fastify route plugin, with full test coverage.

**Architecture:** Single route plugin at `routes/dialogs/index.ts` auto-loaded by `@fastify/autoload` under prefix `/dialogs`. Uses `FastifyPluginAsyncTypebox` for automatic type inference. All schemas from `schemas/dialog.ts`. DB via `fastify.db.dialogs` decorator. Error handling via `@fastify/sensible` httpErrors. Pre-check existence before mutating operations (update/delete return 404 for non-existent).

**Tech Stack:** Fastify 5, TypeBox, Vitest, in-memory SQLite (tests), ESM with `.js` extensions.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `backend/tests/routes/dialogs.test.ts` (create) | Integration tests for all 8 endpoints — happy paths, 404s, validation |
| `backend/src/routes/dialogs/index.ts` (create) | Route plugin — all 8 CRUD endpoints with schemas and error handling |

No other files need creation or modification. Autoload discovers `routes/dialogs/index.ts` automatically.

---

### Task 1: Write route tests for dialog CRUD (5 endpoints)

**Files:**
- Create: `backend/tests/routes/dialogs.test.ts`

- [ ] **Step 1: Create the test file with dialog CRUD tests**

Write all dialog-level tests: list, get by id, create, update, delete — including 404 cases.

```typescript
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe('GET /dialogs', () => {
  it('returns empty array when no dialogs exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/dialogs' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns all dialogs', async () => {
    await app.db.dialogs.create({ title: 'First', language: 'en-US' });
    await app.db.dialogs.create({ title: 'Second', language: 'ru-RU' });

    const res = await app.inject({ method: 'GET', url: '/dialogs' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('title');
    expect(body[0]).toHaveProperty('language');
  });
});

describe('GET /dialogs/:dialogId', () => {
  it('returns dialog with messages', async () => {
    const dialog = await app.db.dialogs.create({ title: 'Test', language: 'en-US' });
    await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Hello' });
    await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 2, character: 2, text: 'Hi' });

    const res = await app.inject({ method: 'GET', url: `/dialogs/${dialog.id}` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.id).toBe(dialog.id);
    expect(body.title).toBe('Test');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].text).toBe('Hello');
    expect(body.messages[1].text).toBe('Hi');
  });

  it('returns 404 for non-existent dialog', async () => {
    const res = await app.inject({ method: 'GET', url: '/dialogs/999' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /dialogs', () => {
  it('creates a dialog and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/dialogs',
      payload: { title: 'New Dialog', language: 'en-US' },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.title).toBe('New Dialog');
    expect(body.language).toBe('en-US');
    expect(body.description).toBeNull();
    expect(body.created_at).toBeDefined();
  });

  it('creates a dialog with optional description', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/dialogs',
      payload: { title: 'With Desc', description: 'A description', language: 'ru-RU' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().description).toBe('A description');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/dialogs',
      payload: { title: 'No Language' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /dialogs/:dialogId', () => {
  it('updates dialog fields', async () => {
    const dialog = await app.db.dialogs.create({ title: 'Old', description: 'Old desc', language: 'en-US' });

    const res = await app.inject({
      method: 'PUT',
      url: `/dialogs/${dialog.id}`,
      payload: { title: 'New Title' },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.title).toBe('New Title');
    expect(body.description).toBe('Old desc');
    expect(body.language).toBe('en-US');
  });

  it('returns 404 for non-existent dialog', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/dialogs/999',
      payload: { title: 'Ghost' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /dialogs/:dialogId', () => {
  it('deletes a dialog and returns 204', async () => {
    const dialog = await app.db.dialogs.create({ title: 'Doomed', language: 'en-US' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/dialogs/${dialog.id}`,
    });
    expect(res.statusCode).toBe(204);

    const check = await app.inject({ method: 'GET', url: `/dialogs/${dialog.id}` });
    expect(check.statusCode).toBe(404);
  });

  it('returns 404 for non-existent dialog', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/dialogs/999',
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/5-dialogs-crud/backend && npx vitest run tests/routes/dialogs.test.ts`

Expected: FAIL — routes not implemented yet. Endpoints return 404 (autoload finds no plugin) or connection errors.

---

### Task 2: Add message CRUD tests to the test file

**Files:**
- Modify: `backend/tests/routes/dialogs.test.ts` (append after dialog tests)

- [ ] **Step 3: Add message CRUD test cases**

Append these test blocks to the same file, after the dialog `DELETE` describe block:

```typescript
describe('POST /dialogs/:dialogId/messages', () => {
  it('creates a message and returns 201', async () => {
    const dialog = await app.db.dialogs.create({ title: 'Test', language: 'en-US' });

    const res = await app.inject({
      method: 'POST',
      url: `/dialogs/${dialog.id}/messages`,
      payload: { order: 1, character: 1, text: 'Hello world' },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.dialog_id).toBe(dialog.id);
    expect(body.order).toBe(1);
    expect(body.character).toBe(1);
    expect(body.text).toBe('Hello world');
  });

  it('returns 404 when dialog does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/dialogs/999/messages',
      payload: { order: 1, character: 1, text: 'Orphan' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for invalid character value', async () => {
    const dialog = await app.db.dialogs.create({ title: 'Test', language: 'en-US' });

    const res = await app.inject({
      method: 'POST',
      url: `/dialogs/${dialog.id}/messages`,
      payload: { order: 1, character: 3, text: 'Bad character' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /dialogs/:dialogId/messages/:messageId', () => {
  it('updates a message', async () => {
    const dialog = await app.db.dialogs.create({ title: 'Test', language: 'en-US' });
    const msg = await app.db.dialogs.createMessage({
      dialog_id: dialog.id, order: 1, character: 1, text: 'Original',
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/dialogs/${dialog.id}/messages/${msg.id}`,
      payload: { text: 'Updated' },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.text).toBe('Updated');
    expect(body.character).toBe(1);
  });

  it('returns 404 when dialog does not exist', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/dialogs/999/messages/1',
      payload: { text: 'Ghost' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message does not exist', async () => {
    const dialog = await app.db.dialogs.create({ title: 'Test', language: 'en-US' });

    const res = await app.inject({
      method: 'PUT',
      url: `/dialogs/${dialog.id}/messages/999`,
      payload: { text: 'Ghost' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /dialogs/:dialogId/messages/:messageId', () => {
  it('deletes a message and returns 204', async () => {
    const dialog = await app.db.dialogs.create({ title: 'Test', language: 'en-US' });
    const msg = await app.db.dialogs.createMessage({
      dialog_id: dialog.id, order: 1, character: 1, text: 'Bye',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/dialogs/${dialog.id}/messages/${msg.id}`,
    });
    expect(res.statusCode).toBe(204);

    const check = await app.inject({ method: 'GET', url: `/dialogs/${dialog.id}` });
    expect(check.json().messages).toHaveLength(0);
  });

  it('returns 404 when dialog does not exist', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/dialogs/999/messages/1',
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message does not exist', async () => {
    const dialog = await app.db.dialogs.create({ title: 'Test', language: 'en-US' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/dialogs/${dialog.id}/messages/999`,
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 4: Run tests to verify they all fail**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/5-dialogs-crud/backend && npx vitest run tests/routes/dialogs.test.ts`

Expected: All tests FAIL — route plugin does not exist yet.

- [ ] **Step 5: Commit test file**

```bash
cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/5-dialogs-crud
git add backend/tests/routes/dialogs.test.ts
git commit -m "test: add route tests for dialogs + messages CRUD (red phase)"
```

---

### Task 3: Implement route plugin — dialog endpoints

**Files:**
- Create: `backend/src/routes/dialogs/index.ts`

- [ ] **Step 6: Create the route plugin with all 5 dialog endpoints**

Create `backend/src/routes/dialogs/index.ts`:

```typescript
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  Dialog,
  DialogWithMessages,
  DialogMessage,
  CreateDialog,
  UpdateDialog,
  CreateDialogMessage,
  UpdateDialogMessage,
  DialogIdParam,
  MessageIdParam,
} from '../../schemas/dialog.js';
import { ErrorResponse } from '../../schemas/common.js';

const dialogRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /dialogs
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(Dialog) },
    },
  }, async () => {
    return fastify.db.dialogs.list();
  });

  // GET /dialogs/:dialogId
  fastify.get('/:dialogId', {
    schema: {
      params: DialogIdParam,
      response: {
        200: DialogWithMessages,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const dialog = await fastify.db.dialogs.getWithMessages(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');
    return dialog;
  });

  // POST /dialogs
  fastify.post('/', {
    schema: {
      body: CreateDialog,
      response: {
        201: Dialog,
      },
    },
  }, async (request, reply) => {
    const dialog = await fastify.db.dialogs.create(request.body);
    reply.status(201);
    return dialog;
  });

  // PUT /dialogs/:dialogId
  fastify.put('/:dialogId', {
    schema: {
      params: DialogIdParam,
      body: UpdateDialog,
      response: {
        200: Dialog,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!existing) throw fastify.httpErrors.notFound('Dialog not found');
    return fastify.db.dialogs.update(request.params.dialogId, request.body);
  });

  // DELETE /dialogs/:dialogId
  fastify.delete('/:dialogId', {
    schema: {
      params: DialogIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!existing) throw fastify.httpErrors.notFound('Dialog not found');
    await fastify.db.dialogs.delete(request.params.dialogId);
    reply.status(204);
  });

  // POST /dialogs/:dialogId/messages
  fastify.post('/:dialogId/messages', {
    schema: {
      params: DialogIdParam,
      body: CreateDialogMessage,
      response: {
        201: DialogMessage,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const dialog = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');
    const msg = await fastify.db.dialogs.createMessage({
      dialog_id: request.params.dialogId,
      ...request.body,
    });
    reply.status(201);
    return msg;
  });

  // PUT /dialogs/:dialogId/messages/:messageId
  fastify.put('/:dialogId/messages/:messageId', {
    schema: {
      params: MessageIdParam,
      body: UpdateDialogMessage,
      response: {
        200: DialogMessage,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const dialog = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');
    try {
      return await fastify.db.dialogs.updateMessage(request.params.messageId, request.body);
    } catch {
      throw fastify.httpErrors.notFound('Message not found');
    }
  });

  // DELETE /dialogs/:dialogId/messages/:messageId
  fastify.delete('/:dialogId/messages/:messageId', {
    schema: {
      params: MessageIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const dialog = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');

    // Check message exists via getWithMessages (no getMessageById in repo)
    const dialogWithMsgs = await fastify.db.dialogs.getWithMessages(request.params.dialogId);
    const messageExists = dialogWithMsgs?.messages.some(m => m.id === request.params.messageId);
    if (!messageExists) throw fastify.httpErrors.notFound('Message not found');

    await fastify.db.dialogs.deleteMessage(request.params.messageId);
    reply.status(204);
  });
};

export default dialogRoutes;
```

- [ ] **Step 7: Run the dialog + message tests**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/5-dialogs-crud/backend && npx vitest run tests/routes/dialogs.test.ts`

Expected: All tests PASS (green).

If any test fails, debug and fix. Common issues:
- 204 response: Fastify may return empty string instead of null. Check `reply.status(204).send()` vs `reply.status(204)`.
- TypeBox integer coercion: URL params like `:dialogId` arrive as strings. TypeBox + Fastify should coerce them to integers, but if not, check `ajv` coercion settings.
- Import extensions: ensure all imports use `.js` extension.

- [ ] **Step 8: Commit the route plugin**

```bash
cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/5-dialogs-crud
git add backend/src/routes/dialogs/index.ts
git commit -m "feat: implement dialogs + messages CRUD route plugin (green phase)"
```

---

### Task 4: Verify — full test suite and lint

**Files:** None (verification only)

- [ ] **Step 9: Run the full backend test suite**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/5-dialogs-crud/backend && npx vitest run`

Expected: ALL tests pass — both existing tests (health, DB) and new dialog route tests.

If any existing test breaks, it means the new route plugin has a side effect (unlikely with autoload encapsulation, but check).

- [ ] **Step 10: Run lint (if ESLint is configured)**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/5-dialogs-crud/backend && npx eslint src/routes/dialogs/index.ts 2>/dev/null || echo "ESLint not configured for backend — skip"`

Expected: Clean or not configured. Fix any lint errors if found.

- [ ] **Step 11: Run TypeScript type check**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/5-dialogs-crud/backend && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 12: Final commit (if any fixes were needed)**

Only if steps 9-11 required changes:

```bash
cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/5-dialogs-crud
git add -A
git commit -m "fix: address lint/type issues in dialogs CRUD routes"
```

---

## Key Design Decisions

1. **Pre-check existence before update/delete**: Rather than catching repo exceptions, we call `getById()` first and return 404 via `httpErrors.notFound()`. Cleaner error messages, no reliance on repo error format.

2. **CreateDialogMessage type merge**: Schema `CreateDialogMessage` omits `dialog_id` (comes from URL param). Route handler merges: `{ dialog_id: request.params.dialogId, ...request.body }`.

3. **Message delete checks existence**: Since `deleteMessage()` is silent, we use `getWithMessages()` to verify the message exists before deleting. Returns 404 if message not found.

4. **Message update uses try/catch**: Since `updateMessage()` throws on non-existent message, we catch the error and convert to 404. We also pre-check dialog existence separately.

5. **No ownership validation**: Message endpoints check that the dialog exists, but don't verify the message belongs to that specific dialog. This is an internal tool — the simpler approach is acceptable.

6. **204 response schema**: Uses `Type.Null()` for the 204 response schema entry. Fastify sends empty body with `reply.status(204)`.

## Traceability: Spec to Tasks

| Spec Requirement | Task | Steps |
|-----------------|------|-------|
| GET /dialogs | Task 1 (test), Task 3 (impl) | Steps 1, 6 |
| GET /dialogs/:dialogId | Task 1 (test), Task 3 (impl) | Steps 1, 6 |
| POST /dialogs | Task 1 (test), Task 3 (impl) | Steps 1, 6 |
| PUT /dialogs/:dialogId | Task 1 (test), Task 3 (impl) | Steps 1, 6 |
| DELETE /dialogs/:dialogId | Task 1 (test), Task 3 (impl) | Steps 1, 6 |
| POST /dialogs/:dialogId/messages | Task 2 (test), Task 3 (impl) | Steps 3, 6 |
| PUT /dialogs/:dialogId/messages/:messageId | Task 2 (test), Task 3 (impl) | Steps 3, 6 |
| DELETE /dialogs/:dialogId/messages/:messageId | Task 2 (test), Task 3 (impl) | Steps 3, 6 |
| 404 for non-existent resources | Tasks 1-2 (tests), Task 3 (impl) | Steps 1, 3, 6 |
| 400 for validation errors | Task 2 (test) | Step 3 |
| Character 1\|2 validation | Task 2 (test) — TypeBox handles | Step 3 |
| TDD: tests first | Tasks 1-2 run before Task 3 | Steps 1-5 before 6 |
