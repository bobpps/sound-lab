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
});
