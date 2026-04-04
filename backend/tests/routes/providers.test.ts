import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('Provider routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // Helper: seed a provider via the DB layer directly
  async function seedProvider(id: string, name: string, type: 'tts' | 'llm' | 'realtime' = 'tts') {
    return app.db.providers.create({ id, name, type });
  }

  describe('GET /providers', () => {
    it('returns empty array when no providers exist', async () => {
      const res = await app.inject({ method: 'GET', url: '/providers' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('returns all providers', async () => {
      await seedProvider('google', 'Google');
      await seedProvider('openai', 'OpenAI', 'llm');

      const res = await app.inject({ method: 'GET', url: '/providers' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({ id: 'google', name: 'Google', type: 'tts' });
    });

    it('filters by type query param', async () => {
      await seedProvider('google', 'Google', 'tts');
      await seedProvider('openai', 'OpenAI', 'llm');
      await seedProvider('elevenlabs', 'ElevenLabs', 'tts');

      const res = await app.inject({ method: 'GET', url: '/providers?type=tts' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body.every((p: { type: string }) => p.type === 'tts')).toBe(true);
    });

    it('returns providers with enabled as boolean', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({ method: 'GET', url: '/providers' });
      const body = res.json();
      expect(body[0].enabled).toBe(true);
    });
  });

  describe('GET /providers/:id', () => {
    it('returns a provider by id', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({ method: 'GET', url: '/providers/google' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: 'google', name: 'Google', type: 'tts', enabled: true });
    });

    it('returns 404 for non-existent provider', async () => {
      const res = await app.inject({ method: 'GET', url: '/providers/nonexistent' });
      expect(res.statusCode).toBe(404);
    });
  });
});
