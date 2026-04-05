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
