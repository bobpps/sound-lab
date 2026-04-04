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
