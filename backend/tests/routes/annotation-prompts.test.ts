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
    const titles = body.map((p: { title: string }) => p.title);
    expect(titles).toContain('Prompt A');
    expect(titles).toContain('Prompt B');
  });
});

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
