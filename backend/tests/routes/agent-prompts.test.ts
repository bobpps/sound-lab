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
