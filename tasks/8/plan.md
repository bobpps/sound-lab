# Annotations + Annotated Messages Routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement seven REST endpoints for annotation management (annotated dialogs + annotated messages), with full integration tests, following the existing dialog CRUD pattern.

**Architecture:** Two-file route registration. Dialog-scoped routes (list/create annotations) go in `dialogs/index.ts` under the existing `/dialogs` autoload prefix. Annotation-specific routes (get/delete + message CRUD) go in a new `annotations/index.ts` autoloaded at `/annotations`. A new body-only TypeBox schema `CreateAnnotatedDialogBody` excludes `dialog_id` (taken from URL param), mirroring how `CreateDialogMessage` excludes `dialog_id`. All routes delegate to `fastify.db.annotations.*` repository methods. Message ownership is verified via `getWithMessages(annotationId)` + `messages.some()`.

**Tech Stack:** Fastify 5, TypeBox, Vitest, `@fastify/sensible` (httpErrors), `@fastify/autoload`, ESM with `.js` import extensions.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/schemas/annotation.ts` | Modify | Add `CreateAnnotatedDialogBody` (body-only schema without `dialog_id`) |
| `backend/src/routes/dialogs/index.ts` | Modify | Add 2 dialog-scoped annotation routes: `GET /:dialogId/annotations`, `POST /:dialogId/annotations` |
| `backend/src/routes/annotations/index.ts` | Create | Route plugin — 5 annotation-specific endpoints (`GET /:id`, `DELETE /:id`, message CRUD) |
| `backend/tests/routes/annotations.test.ts` | Create | Integration tests — all 7 endpoints via `app.inject()` against in-memory SQLite |

### Key Reference Files (read-only)

| File | What to look at |
|------|-----------------|
| `backend/src/schemas/annotation.ts` | Existing TypeBox schemas: `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`, `CreateAnnotatedDialog`, `CreateAnnotatedMessage`, `UpdateAnnotatedMessage`, `AnnotationIdParam`, `AnnotationMessageIdParam`, `DialogAnnotationsParam` |
| `backend/src/schemas/common.ts` | `ErrorResponse` |
| `backend/src/db/interfaces.ts` (lines 23-31) | `IAnnotationRepository` — the 7 methods routes call |
| `backend/src/db/types.ts` (lines 95-110) | DB-layer types: `CreateAnnotatedDialog` (includes `dialog_id`), `CreateAnnotatedMessage` (includes `annotated_dialog_id`) |
| `backend/src/routes/dialogs/index.ts` | Existing CRUD + nested message routes — the pattern to follow |
| `backend/tests/routes/dialogs.test.ts` | Test patterns: seed via `app.db`, assert status + body |
| `backend/tests/helpers.ts` | `buildTestApp()` — creates app with in-memory SQLite |
| `backend/src/app.ts` | Autoload config: `dirNameRoutePrefix: true` |

### Behavior Contract

- `listByDialog(dialogId)` returns `[]` when no annotations exist (no error)
- `getWithMessages(id)` returns `null` when annotation not found
- `create(data)` returns the created `AnnotatedDialog`
- `delete(id)` is **silent** when ID not found (no error)
- `createMessage(data)` returns the created `AnnotatedMessage`
- `updateMessage(id, data)` throws `Error` when ID not found
- `deleteMessage(id)` is **silent** when ID not found (no error)
- Routes must check existence before `delete` and `deleteMessage` to return consistent 404s

### Endpoint Summary

| Method | URL | Handler Location | Response | Status |
|--------|-----|-----------------|----------|--------|
| GET | `/dialogs/:dialogId/annotations` | `dialogs/index.ts` | `AnnotatedDialog[]` | 200 / 404 |
| POST | `/dialogs/:dialogId/annotations` | `dialogs/index.ts` | `AnnotatedDialog` | 201 / 404 |
| GET | `/annotations/:id` | `annotations/index.ts` | `AnnotatedDialogWithMessages` | 200 / 404 |
| DELETE | `/annotations/:id` | `annotations/index.ts` | (empty) | 204 / 404 |
| POST | `/annotations/:id/messages` | `annotations/index.ts` | `AnnotatedMessage` | 201 / 404 |
| PUT | `/annotations/:id/messages/:messageId` | `annotations/index.ts` | `AnnotatedMessage` | 200 / 404 |
| DELETE | `/annotations/:id/messages/:messageId` | `annotations/index.ts` | (empty) | 204 / 404 |

---

## Task 1: Add body-only schema for annotation creation

**Files:**
- Modify: `backend/src/schemas/annotation.ts`

- [ ] **Step 1: Add `CreateAnnotatedDialogBody` schema**

In `backend/src/schemas/annotation.ts`, add this after the existing `CreateAnnotatedDialog` schema and its type export (after line 34):

```typescript
export const CreateAnnotatedDialogBody = Type.Object({
  provider_id: Type.String(),
  title: Type.String(),
});
export type CreateAnnotatedDialogBody = Static<typeof CreateAnnotatedDialogBody>;
```

This mirrors how `CreateDialogMessage` in `schemas/dialog.ts` excludes `dialog_id` from the body — the route handler merges the ID from the URL param.

- [ ] **Step 2: Verify the backend still compiles**

Run from `backend/`:
```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/annotation.ts
git commit -m "feat(schema): add CreateAnnotatedDialogBody for route-level validation"
```

---

## Task 2: Write test scaffold and dialog-scoped annotation tests (GET + POST)

**Files:**
- Create: `backend/tests/routes/annotations.test.ts`

- [ ] **Step 1: Create test file with scaffold, seed helpers, and dialog-scoped tests**

```typescript
// backend/tests/routes/annotations.test.ts
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

// Helper: create a dialog and return its id
async function seedDialog() {
  return app.db.dialogs.create({ title: 'Test Dialog', language: 'en-US' });
}

// Helper: create a dialog with messages and return { dialog, messages }
async function seedDialogWithMessages() {
  const dialog = await app.db.dialogs.create({ title: 'Test Dialog', language: 'en-US' });
  const msg1 = await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Hello' });
  const msg2 = await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 2, character: 2, text: 'Hi there' });
  return { dialog, messages: [msg1, msg2] };
}

// Helper: create a dialog + annotation and return both
async function seedAnnotation() {
  const dialog = await seedDialog();
  const annotation = await app.db.annotations.create({
    dialog_id: dialog.id,
    provider_id: 'elevenlabs',
    title: 'ElevenLabs v1',
  });
  return { dialog, annotation };
}

// --- Dialog-scoped annotation routes ---

describe('GET /dialogs/:dialogId/annotations', () => {
  it('returns empty array when no annotations exist for dialog', async () => {
    const dialog = await seedDialog();

    const res = await app.inject({ method: 'GET', url: `/dialogs/${dialog.id}/annotations` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns all annotations for a dialog', async () => {
    const dialog = await seedDialog();
    await app.db.annotations.create({ dialog_id: dialog.id, provider_id: 'elevenlabs', title: 'ElevenLabs v1' });
    await app.db.annotations.create({ dialog_id: dialog.id, provider_id: 'google', title: 'Google v1' });

    const res = await app.inject({ method: 'GET', url: `/dialogs/${dialog.id}/annotations` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('dialog_id');
    expect(body[0]).toHaveProperty('provider_id');
    expect(body[0]).toHaveProperty('title');
    expect(body[0]).toHaveProperty('created_at');
  });

  it('does not return annotations from other dialogs', async () => {
    const dialog1 = await app.db.dialogs.create({ title: 'Dialog 1', language: 'en-US' });
    const dialog2 = await app.db.dialogs.create({ title: 'Dialog 2', language: 'en-US' });
    await app.db.annotations.create({ dialog_id: dialog1.id, provider_id: 'elevenlabs', title: 'D1 annotation' });
    await app.db.annotations.create({ dialog_id: dialog2.id, provider_id: 'google', title: 'D2 annotation' });

    const res = await app.inject({ method: 'GET', url: `/dialogs/${dialog1.id}/annotations` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe('D1 annotation');
  });

  it('returns 404 when dialog does not exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/dialogs/999/annotations' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /dialogs/:dialogId/annotations', () => {
  it('creates an annotation and returns 201', async () => {
    const dialog = await seedDialog();

    const res = await app.inject({
      method: 'POST',
      url: `/dialogs/${dialog.id}/annotations`,
      payload: { provider_id: 'elevenlabs', title: 'ElevenLabs v1' },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.dialog_id).toBe(dialog.id);
    expect(body.provider_id).toBe('elevenlabs');
    expect(body.title).toBe('ElevenLabs v1');
    expect(body.created_by).toBeNull();
    expect(body.created_at).toBeDefined();
  });

  it('returns 404 when dialog does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/dialogs/999/annotations',
      payload: { provider_id: 'elevenlabs', title: 'Ghost' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when required fields are missing', async () => {
    const dialog = await seedDialog();

    const res = await app.inject({
      method: 'POST',
      url: `/dialogs/${dialog.id}/annotations`,
      payload: { title: 'Missing provider_id' },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/routes/annotations.test.ts
```

Expected: FAIL — the routes `/dialogs/:dialogId/annotations` return 404 because they are not registered yet.

---

## Task 3: Implement dialog-scoped annotation routes (GET + POST)

**Files:**
- Modify: `backend/src/routes/dialogs/index.ts`

- [ ] **Step 1: Add imports for annotation schemas**

In `backend/src/routes/dialogs/index.ts`, update the imports. Add the annotation schema imports after the existing dialog imports:

```typescript
import {
  AnnotatedDialog,
  CreateAnnotatedDialogBody,
  DialogAnnotationsParam,
} from '../../schemas/annotation.js';
```

The existing imports remain unchanged:

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
```

- [ ] **Step 2: Add GET /:dialogId/annotations route**

Add this route at the end of the `dialogRoutes` plugin function, after the `DELETE /:dialogId/messages/:messageId` route (before the closing `};`):

```typescript
  // GET /dialogs/:dialogId/annotations
  fastify.get('/:dialogId/annotations', {
    schema: {
      params: DialogAnnotationsParam,
      response: {
        200: Type.Array(AnnotatedDialog),
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const dialog = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');
    return fastify.db.annotations.listByDialog(request.params.dialogId);
  });
```

- [ ] **Step 3: Add POST /:dialogId/annotations route**

Add this route immediately after the GET annotations route:

```typescript
  // POST /dialogs/:dialogId/annotations
  fastify.post('/:dialogId/annotations', {
    schema: {
      params: DialogAnnotationsParam,
      body: CreateAnnotatedDialogBody,
      response: {
        201: AnnotatedDialog,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const dialog = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');
    const annotation = await fastify.db.annotations.create({
      dialog_id: request.params.dialogId,
      ...request.body,
    });
    reply.status(201);
    return annotation;
  });
```

- [ ] **Step 4: Run the dialog-scoped annotation tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/routes/annotations.test.ts
```

Expected: All 7 tests PASS (the 4 GET tests + 3 POST tests from Task 2).

- [ ] **Step 5: Run the full dialog test suite to verify no regressions**

Run from `backend/`:
```bash
npx vitest run tests/routes/dialogs.test.ts
```

Expected: All existing dialog tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/schemas/annotation.ts backend/src/routes/dialogs/index.ts backend/tests/routes/annotations.test.ts
git commit -m "feat(api): add GET/POST /dialogs/:dialogId/annotations with tests"
```

---

## Task 4: Write tests for annotation-specific routes (GET + DELETE)

**Files:**
- Modify: `backend/tests/routes/annotations.test.ts`

- [ ] **Step 1: Add GET /annotations/:id and DELETE /annotations/:id tests**

Append these test blocks at the bottom of the test file, after the `POST /dialogs/:dialogId/annotations` describe block:

```typescript
// --- Annotation-specific routes ---

describe('GET /annotations/:id', () => {
  it('returns annotation with messages', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'ElevenLabs v1',
    });
    await app.db.annotations.createMessage({
      annotated_dialog_id: annotation.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Hello</speak>',
    });
    await app.db.annotations.createMessage({
      annotated_dialog_id: annotation.id,
      dialog_message_id: messages[1].id,
      text: '<speak>Hi there</speak>',
    });

    const res = await app.inject({ method: 'GET', url: `/annotations/${annotation.id}` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.id).toBe(annotation.id);
    expect(body.dialog_id).toBe(dialog.id);
    expect(body.provider_id).toBe('elevenlabs');
    expect(body.title).toBe('ElevenLabs v1');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].text).toBe('<speak>Hello</speak>');
    expect(body.messages[1].text).toBe('<speak>Hi there</speak>');
  });

  it('returns annotation with empty messages array', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({ method: 'GET', url: `/annotations/${annotation.id}` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.id).toBe(annotation.id);
    expect(body.messages).toEqual([]);
  });

  it('returns 404 for non-existent annotation', async () => {
    const res = await app.inject({ method: 'GET', url: '/annotations/999' });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /annotations/:id', () => {
  it('deletes an annotation and returns 204', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({ method: 'DELETE', url: `/annotations/${annotation.id}` });
    expect(res.statusCode).toBe(204);

    const check = await app.inject({ method: 'GET', url: `/annotations/${annotation.id}` });
    expect(check.statusCode).toBe(404);
  });

  it('returns 404 for non-existent annotation', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/annotations/999' });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/routes/annotations.test.ts
```

Expected: The 5 new tests FAIL (404 — no `/annotations` routes registered yet). The 7 existing dialog-scoped tests still PASS.

---

## Task 5: Implement annotation-specific routes (GET + DELETE)

**Files:**
- Create: `backend/src/routes/annotations/index.ts`

- [ ] **Step 1: Create the route plugin with GET /:id and DELETE /:id**

```typescript
// backend/src/routes/annotations/index.ts
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  AnnotatedDialogWithMessages,
  AnnotatedMessage,
  AnnotationIdParam,
  AnnotationMessageIdParam,
  CreateAnnotatedMessage,
  UpdateAnnotatedMessage,
} from '../../schemas/annotation.js';
import { ErrorResponse } from '../../schemas/common.js';

const annotationRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /annotations/:id
  fastify.get('/:id', {
    schema: {
      params: AnnotationIdParam,
      response: {
        200: AnnotatedDialogWithMessages,
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    return annotation;
  });

  // DELETE /annotations/:id
  fastify.delete('/:id', {
    schema: {
      params: AnnotationIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!existing) throw fastify.httpErrors.notFound('Annotation not found');
    await fastify.db.annotations.delete(request.params.id);
    reply.status(204);
  });
};

export default annotationRoutes;
```

- [ ] **Step 2: Run the annotation tests to verify GET and DELETE pass**

Run from `backend/`:
```bash
npx vitest run tests/routes/annotations.test.ts
```

Expected: All 12 tests PASS (7 dialog-scoped + 5 annotation-specific).

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/annotations/index.ts backend/tests/routes/annotations.test.ts
git commit -m "feat(api): add GET/DELETE /annotations/:id with tests"
```

---

## Task 6: Write tests for annotated message routes (POST, PUT, DELETE)

**Files:**
- Modify: `backend/tests/routes/annotations.test.ts`

- [ ] **Step 1: Add POST /annotations/:id/messages tests**

Append this test block at the bottom of the test file:

```typescript
// --- Annotated message routes ---

describe('POST /annotations/:id/messages', () => {
  it('creates an annotated message and returns 201', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'ElevenLabs v1',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/annotations/${annotation.id}/messages`,
      payload: { dialog_message_id: messages[0].id, text: '<speak>Hello</speak>' },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.annotated_dialog_id).toBe(annotation.id);
    expect(body.dialog_message_id).toBe(messages[0].id);
    expect(body.text).toBe('<speak>Hello</speak>');
  });

  it('returns 404 when annotation does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/annotations/999/messages',
      payload: { dialog_message_id: 1, text: '<speak>Orphan</speak>' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when required fields are missing', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({
      method: 'POST',
      url: `/annotations/${annotation.id}/messages`,
      payload: { text: 'Missing dialog_message_id' },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Add PUT /annotations/:id/messages/:messageId tests**

Append this test block:

```typescript
describe('PUT /annotations/:id/messages/:messageId', () => {
  it('updates an annotated message', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'ElevenLabs v1',
    });
    const annotMsg = await app.db.annotations.createMessage({
      annotated_dialog_id: annotation.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Original</speak>',
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/annotations/${annotation.id}/messages/${annotMsg.id}`,
      payload: { text: '<speak>Updated</speak>' },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.id).toBe(annotMsg.id);
    expect(body.text).toBe('<speak>Updated</speak>');
    expect(body.annotated_dialog_id).toBe(annotation.id);
    expect(body.dialog_message_id).toBe(messages[0].id);
  });

  it('returns 404 when annotation does not exist', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/annotations/999/messages/1',
      payload: { text: '<speak>Ghost</speak>' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message does not exist', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({
      method: 'PUT',
      url: `/annotations/${annotation.id}/messages/999`,
      payload: { text: '<speak>Ghost</speak>' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message belongs to a different annotation', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation1 = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'Annotation 1',
    });
    const annotation2 = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'google',
      title: 'Annotation 2',
    });
    const annotMsg = await app.db.annotations.createMessage({
      annotated_dialog_id: annotation1.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Belongs to A1</speak>',
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/annotations/${annotation2.id}/messages/${annotMsg.id}`,
      payload: { text: '<speak>Wrong parent</speak>' },
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 3: Add DELETE /annotations/:id/messages/:messageId tests**

Append this test block:

```typescript
describe('DELETE /annotations/:id/messages/:messageId', () => {
  it('deletes an annotated message and returns 204', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'ElevenLabs v1',
    });
    const annotMsg = await app.db.annotations.createMessage({
      annotated_dialog_id: annotation.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Bye</speak>',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/annotations/${annotation.id}/messages/${annotMsg.id}`,
    });
    expect(res.statusCode).toBe(204);

    const check = await app.inject({ method: 'GET', url: `/annotations/${annotation.id}` });
    expect(check.json().messages).toHaveLength(0);
  });

  it('returns 404 when annotation does not exist', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/annotations/999/messages/1',
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message does not exist', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({
      method: 'DELETE',
      url: `/annotations/${annotation.id}/messages/999`,
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message belongs to a different annotation', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation1 = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'Annotation 1',
    });
    const annotation2 = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'google',
      title: 'Annotation 2',
    });
    const annotMsg = await app.db.annotations.createMessage({
      annotated_dialog_id: annotation1.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Belongs to A1</speak>',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/annotations/${annotation2.id}/messages/${annotMsg.id}`,
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 4: Run the new tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/routes/annotations.test.ts
```

Expected: The 10 new message tests FAIL (404 — message routes not registered yet). The 12 existing tests still PASS.

---

## Task 7: Implement annotated message routes (POST, PUT, DELETE)

**Files:**
- Modify: `backend/src/routes/annotations/index.ts`

- [ ] **Step 1: Add POST /:id/messages route**

Add this route inside the `annotationRoutes` plugin function, after the `DELETE /:id` route:

```typescript
  // POST /annotations/:id/messages
  fastify.post('/:id/messages', {
    schema: {
      params: AnnotationIdParam,
      body: CreateAnnotatedMessage,
      response: {
        201: AnnotatedMessage,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    const msg = await fastify.db.annotations.createMessage({
      annotated_dialog_id: request.params.id,
      ...request.body,
    });
    reply.status(201);
    return msg;
  });
```

- [ ] **Step 2: Add PUT /:id/messages/:messageId route**

Add this route after the POST messages route:

```typescript
  // PUT /annotations/:id/messages/:messageId
  fastify.put('/:id/messages/:messageId', {
    schema: {
      params: AnnotationMessageIdParam,
      body: UpdateAnnotatedMessage,
      response: {
        200: AnnotatedMessage,
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    const messageExists = annotation.messages.some(m => m.id === request.params.messageId);
    if (!messageExists) throw fastify.httpErrors.notFound('Message not found');
    return fastify.db.annotations.updateMessage(request.params.messageId, request.body);
  });
```

- [ ] **Step 3: Add DELETE /:id/messages/:messageId route**

Add this route after the PUT messages route:

```typescript
  // DELETE /annotations/:id/messages/:messageId
  fastify.delete('/:id/messages/:messageId', {
    schema: {
      params: AnnotationMessageIdParam,
      body: undefined,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    const messageExists = annotation.messages.some(m => m.id === request.params.messageId);
    if (!messageExists) throw fastify.httpErrors.notFound('Message not found');
    await fastify.db.annotations.deleteMessage(request.params.messageId);
    reply.status(204);
  });
```

- [ ] **Step 4: Run all annotation tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/routes/annotations.test.ts
```

Expected: All 22 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/annotations/index.ts backend/tests/routes/annotations.test.ts
git commit -m "feat(api): add annotation message routes (POST/PUT/DELETE) with tests"
```

---

## Task 8: Full verification — all tests, build

**Files:** None (verification only)

- [ ] **Step 1: Run the full annotation test suite**

Run from `backend/`:
```bash
npx vitest run tests/routes/annotations.test.ts
```

Expected: All 22 tests PASS.

- [ ] **Step 2: Run the full dialog test suite to check for regressions**

Run from `backend/`:
```bash
npx vitest run tests/routes/dialogs.test.ts
```

Expected: All existing dialog tests PASS.

- [ ] **Step 3: Run the entire backend test suite**

Run from `backend/`:
```bash
npx vitest run
```

Expected: All tests PASS (no regressions).

- [ ] **Step 4: Run the build**

Run from project root:
```bash
npm run build
```

Expected: Build succeeds with no errors.

---

## Final File Contents Reference

### `backend/src/schemas/annotation.ts` (additions only)

Add after line 34 (after the existing `CreateAnnotatedDialog` type export):

```typescript
export const CreateAnnotatedDialogBody = Type.Object({
  provider_id: Type.String(),
  title: Type.String(),
});
export type CreateAnnotatedDialogBody = Static<typeof CreateAnnotatedDialogBody>;
```

### `backend/src/routes/dialogs/index.ts` (additions only)

New imports at the top:

```typescript
import {
  AnnotatedDialog,
  CreateAnnotatedDialogBody,
  DialogAnnotationsParam,
} from '../../schemas/annotation.js';
```

Two new routes appended at the end of the plugin function (before closing `};`):

```typescript
  // GET /dialogs/:dialogId/annotations
  fastify.get('/:dialogId/annotations', {
    schema: {
      params: DialogAnnotationsParam,
      response: {
        200: Type.Array(AnnotatedDialog),
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const dialog = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');
    return fastify.db.annotations.listByDialog(request.params.dialogId);
  });

  // POST /dialogs/:dialogId/annotations
  fastify.post('/:dialogId/annotations', {
    schema: {
      params: DialogAnnotationsParam,
      body: CreateAnnotatedDialogBody,
      response: {
        201: AnnotatedDialog,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const dialog = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');
    const annotation = await fastify.db.annotations.create({
      dialog_id: request.params.dialogId,
      ...request.body,
    });
    reply.status(201);
    return annotation;
  });
```

### `backend/src/routes/annotations/index.ts` (complete)

```typescript
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  AnnotatedDialogWithMessages,
  AnnotatedMessage,
  AnnotationIdParam,
  AnnotationMessageIdParam,
  CreateAnnotatedMessage,
  UpdateAnnotatedMessage,
} from '../../schemas/annotation.js';
import { ErrorResponse } from '../../schemas/common.js';

const annotationRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /annotations/:id
  fastify.get('/:id', {
    schema: {
      params: AnnotationIdParam,
      response: {
        200: AnnotatedDialogWithMessages,
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    return annotation;
  });

  // DELETE /annotations/:id
  fastify.delete('/:id', {
    schema: {
      params: AnnotationIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!existing) throw fastify.httpErrors.notFound('Annotation not found');
    await fastify.db.annotations.delete(request.params.id);
    reply.status(204);
  });

  // POST /annotations/:id/messages
  fastify.post('/:id/messages', {
    schema: {
      params: AnnotationIdParam,
      body: CreateAnnotatedMessage,
      response: {
        201: AnnotatedMessage,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    const msg = await fastify.db.annotations.createMessage({
      annotated_dialog_id: request.params.id,
      ...request.body,
    });
    reply.status(201);
    return msg;
  });

  // PUT /annotations/:id/messages/:messageId
  fastify.put('/:id/messages/:messageId', {
    schema: {
      params: AnnotationMessageIdParam,
      body: UpdateAnnotatedMessage,
      response: {
        200: AnnotatedMessage,
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    const messageExists = annotation.messages.some(m => m.id === request.params.messageId);
    if (!messageExists) throw fastify.httpErrors.notFound('Message not found');
    return fastify.db.annotations.updateMessage(request.params.messageId, request.body);
  });

  // DELETE /annotations/:id/messages/:messageId
  fastify.delete('/:id/messages/:messageId', {
    schema: {
      params: AnnotationMessageIdParam,
      body: undefined,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    const messageExists = annotation.messages.some(m => m.id === request.params.messageId);
    if (!messageExists) throw fastify.httpErrors.notFound('Message not found');
    await fastify.db.annotations.deleteMessage(request.params.messageId);
    reply.status(204);
  });
};

export default annotationRoutes;
```

### `backend/tests/routes/annotations.test.ts` (complete)

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

// Helper: create a dialog and return its id
async function seedDialog() {
  return app.db.dialogs.create({ title: 'Test Dialog', language: 'en-US' });
}

// Helper: create a dialog with messages and return { dialog, messages }
async function seedDialogWithMessages() {
  const dialog = await app.db.dialogs.create({ title: 'Test Dialog', language: 'en-US' });
  const msg1 = await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Hello' });
  const msg2 = await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 2, character: 2, text: 'Hi there' });
  return { dialog, messages: [msg1, msg2] };
}

// Helper: create a dialog + annotation and return both
async function seedAnnotation() {
  const dialog = await seedDialog();
  const annotation = await app.db.annotations.create({
    dialog_id: dialog.id,
    provider_id: 'elevenlabs',
    title: 'ElevenLabs v1',
  });
  return { dialog, annotation };
}

// --- Dialog-scoped annotation routes ---

describe('GET /dialogs/:dialogId/annotations', () => {
  it('returns empty array when no annotations exist for dialog', async () => {
    const dialog = await seedDialog();

    const res = await app.inject({ method: 'GET', url: `/dialogs/${dialog.id}/annotations` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns all annotations for a dialog', async () => {
    const dialog = await seedDialog();
    await app.db.annotations.create({ dialog_id: dialog.id, provider_id: 'elevenlabs', title: 'ElevenLabs v1' });
    await app.db.annotations.create({ dialog_id: dialog.id, provider_id: 'google', title: 'Google v1' });

    const res = await app.inject({ method: 'GET', url: `/dialogs/${dialog.id}/annotations` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('dialog_id');
    expect(body[0]).toHaveProperty('provider_id');
    expect(body[0]).toHaveProperty('title');
    expect(body[0]).toHaveProperty('created_at');
  });

  it('does not return annotations from other dialogs', async () => {
    const dialog1 = await app.db.dialogs.create({ title: 'Dialog 1', language: 'en-US' });
    const dialog2 = await app.db.dialogs.create({ title: 'Dialog 2', language: 'en-US' });
    await app.db.annotations.create({ dialog_id: dialog1.id, provider_id: 'elevenlabs', title: 'D1 annotation' });
    await app.db.annotations.create({ dialog_id: dialog2.id, provider_id: 'google', title: 'D2 annotation' });

    const res = await app.inject({ method: 'GET', url: `/dialogs/${dialog1.id}/annotations` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe('D1 annotation');
  });

  it('returns 404 when dialog does not exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/dialogs/999/annotations' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /dialogs/:dialogId/annotations', () => {
  it('creates an annotation and returns 201', async () => {
    const dialog = await seedDialog();

    const res = await app.inject({
      method: 'POST',
      url: `/dialogs/${dialog.id}/annotations`,
      payload: { provider_id: 'elevenlabs', title: 'ElevenLabs v1' },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.dialog_id).toBe(dialog.id);
    expect(body.provider_id).toBe('elevenlabs');
    expect(body.title).toBe('ElevenLabs v1');
    expect(body.created_by).toBeNull();
    expect(body.created_at).toBeDefined();
  });

  it('returns 404 when dialog does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/dialogs/999/annotations',
      payload: { provider_id: 'elevenlabs', title: 'Ghost' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when required fields are missing', async () => {
    const dialog = await seedDialog();

    const res = await app.inject({
      method: 'POST',
      url: `/dialogs/${dialog.id}/annotations`,
      payload: { title: 'Missing provider_id' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// --- Annotation-specific routes ---

describe('GET /annotations/:id', () => {
  it('returns annotation with messages', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'ElevenLabs v1',
    });
    await app.db.annotations.createMessage({
      annotated_dialog_id: annotation.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Hello</speak>',
    });
    await app.db.annotations.createMessage({
      annotated_dialog_id: annotation.id,
      dialog_message_id: messages[1].id,
      text: '<speak>Hi there</speak>',
    });

    const res = await app.inject({ method: 'GET', url: `/annotations/${annotation.id}` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.id).toBe(annotation.id);
    expect(body.dialog_id).toBe(dialog.id);
    expect(body.provider_id).toBe('elevenlabs');
    expect(body.title).toBe('ElevenLabs v1');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].text).toBe('<speak>Hello</speak>');
    expect(body.messages[1].text).toBe('<speak>Hi there</speak>');
  });

  it('returns annotation with empty messages array', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({ method: 'GET', url: `/annotations/${annotation.id}` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.id).toBe(annotation.id);
    expect(body.messages).toEqual([]);
  });

  it('returns 404 for non-existent annotation', async () => {
    const res = await app.inject({ method: 'GET', url: '/annotations/999' });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /annotations/:id', () => {
  it('deletes an annotation and returns 204', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({ method: 'DELETE', url: `/annotations/${annotation.id}` });
    expect(res.statusCode).toBe(204);

    const check = await app.inject({ method: 'GET', url: `/annotations/${annotation.id}` });
    expect(check.statusCode).toBe(404);
  });

  it('returns 404 for non-existent annotation', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/annotations/999' });
    expect(res.statusCode).toBe(404);
  });
});

// --- Annotated message routes ---

describe('POST /annotations/:id/messages', () => {
  it('creates an annotated message and returns 201', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'ElevenLabs v1',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/annotations/${annotation.id}/messages`,
      payload: { dialog_message_id: messages[0].id, text: '<speak>Hello</speak>' },
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.annotated_dialog_id).toBe(annotation.id);
    expect(body.dialog_message_id).toBe(messages[0].id);
    expect(body.text).toBe('<speak>Hello</speak>');
  });

  it('returns 404 when annotation does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/annotations/999/messages',
      payload: { dialog_message_id: 1, text: '<speak>Orphan</speak>' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when required fields are missing', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({
      method: 'POST',
      url: `/annotations/${annotation.id}/messages`,
      payload: { text: 'Missing dialog_message_id' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /annotations/:id/messages/:messageId', () => {
  it('updates an annotated message', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'ElevenLabs v1',
    });
    const annotMsg = await app.db.annotations.createMessage({
      annotated_dialog_id: annotation.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Original</speak>',
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/annotations/${annotation.id}/messages/${annotMsg.id}`,
      payload: { text: '<speak>Updated</speak>' },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.id).toBe(annotMsg.id);
    expect(body.text).toBe('<speak>Updated</speak>');
    expect(body.annotated_dialog_id).toBe(annotation.id);
    expect(body.dialog_message_id).toBe(messages[0].id);
  });

  it('returns 404 when annotation does not exist', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/annotations/999/messages/1',
      payload: { text: '<speak>Ghost</speak>' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message does not exist', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({
      method: 'PUT',
      url: `/annotations/${annotation.id}/messages/999`,
      payload: { text: '<speak>Ghost</speak>' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message belongs to a different annotation', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation1 = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'Annotation 1',
    });
    const annotation2 = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'google',
      title: 'Annotation 2',
    });
    const annotMsg = await app.db.annotations.createMessage({
      annotated_dialog_id: annotation1.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Belongs to A1</speak>',
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/annotations/${annotation2.id}/messages/${annotMsg.id}`,
      payload: { text: '<speak>Wrong parent</speak>' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /annotations/:id/messages/:messageId', () => {
  it('deletes an annotated message and returns 204', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'ElevenLabs v1',
    });
    const annotMsg = await app.db.annotations.createMessage({
      annotated_dialog_id: annotation.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Bye</speak>',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/annotations/${annotation.id}/messages/${annotMsg.id}`,
    });
    expect(res.statusCode).toBe(204);

    const check = await app.inject({ method: 'GET', url: `/annotations/${annotation.id}` });
    expect(check.json().messages).toHaveLength(0);
  });

  it('returns 404 when annotation does not exist', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/annotations/999/messages/1',
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message does not exist', async () => {
    const { annotation } = await seedAnnotation();

    const res = await app.inject({
      method: 'DELETE',
      url: `/annotations/${annotation.id}/messages/999`,
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when message belongs to a different annotation', async () => {
    const { dialog, messages } = await seedDialogWithMessages();
    const annotation1 = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'elevenlabs',
      title: 'Annotation 1',
    });
    const annotation2 = await app.db.annotations.create({
      dialog_id: dialog.id,
      provider_id: 'google',
      title: 'Annotation 2',
    });
    const annotMsg = await app.db.annotations.createMessage({
      annotated_dialog_id: annotation1.id,
      dialog_message_id: messages[0].id,
      text: '<speak>Belongs to A1</speak>',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/annotations/${annotation2.id}/messages/${annotMsg.id}`,
    });
    expect(res.statusCode).toBe(404);
  });
});
```
