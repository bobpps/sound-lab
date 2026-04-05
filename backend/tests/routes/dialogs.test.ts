import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

// --- Dialog CRUD ---

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

// --- Message CRUD ---

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
