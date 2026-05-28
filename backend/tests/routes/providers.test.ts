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

    it('returns safe API key presence without exposing secrets', async () => {
      await seedProvider('google', 'Google');
      await seedProvider('openai', 'OpenAI', 'llm');
      await app.db.providers.setKey('openai', 'sk-secret-key-12345');

      const res = await app.inject({ method: 'GET', url: '/providers' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([
        expect.objectContaining({ id: 'google', has_key: false }),
        expect.objectContaining({ id: 'openai', has_key: true }),
      ]);
      expect(res.body).not.toContain('encrypted_key');
      expect(res.body).not.toContain('sk-secret-key-12345');
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

  describe('POST /providers', () => {
    it('creates a provider and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: { id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts', enabled: true });
    });

    it('returns 409 for duplicate provider id', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: { id: 'elevenlabs', name: 'ElevenLabs Duplicate', type: 'tts' },
      });
      expect(res.statusCode).toBe(409);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: { id: 'test' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: { id: 'test', name: 'Test', type: 'invalid' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /providers/:id', () => {
    it('updates a provider', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/google',
        payload: { name: 'Google Cloud' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: 'google', name: 'Google Cloud' });
    });

    it('updates enabled field', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/google',
        payload: { enabled: false },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().enabled).toBe(false);
    });

    it('returns 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/nonexistent',
        payload: { name: 'Test' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /providers/:id', () => {
    it('deletes a provider and returns 204', async () => {
      await seedProvider('google', 'Google');
      const res = await app.inject({
        method: 'DELETE',
        url: '/providers/google',
      });
      expect(res.statusCode).toBe(204);

      const check = await app.inject({ method: 'GET', url: '/providers/google' });
      expect(check.statusCode).toBe(404);
    });

    it('returns 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/providers/nonexistent',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /providers/:id/key', () => {
    it('sets an API key and returns 204', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/elevenlabs/key',
        payload: { key: 'sk-secret-12345' },
      });
      expect(res.statusCode).toBe(204);
    });

    it('returns 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/nonexistent/key',
        payload: { key: 'sk-secret' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when key is missing', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/elevenlabs/key',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /providers/:id/key', () => {
    it('returns the decrypted key', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      await app.db.providers.setKey('elevenlabs', 'sk-secret-12345');

      const res = await app.inject({
        method: 'GET',
        url: '/providers/elevenlabs/key',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ key: 'sk-secret-12345' });
    });

    it('returns 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/providers/nonexistent/key',
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider exists but no key is set', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      const res = await app.inject({
        method: 'GET',
        url: '/providers/elevenlabs/key',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /providers/:id/key/test', () => {
    it('returns not_configured when the provider has no key', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      const createTTSProvider = vi.fn();
      (app as Record<string, unknown>).createTTSProvider = createTTSProvider;

      const res = await app.inject({
        method: 'POST',
        url: '/providers/elevenlabs/key/test',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        provider_id: 'elevenlabs',
        status: 'not_configured',
        message: 'Add an API key before testing this provider.',
      });
      expect(res.json().checked_at).toEqual(expect.any(String));
      expect(createTTSProvider).not.toHaveBeenCalled();
    });

    it('validates a saved TTS provider key', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      await app.db.providers.setKey('elevenlabs', 'test-api-key');
      const validateCredentials = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
      (app as Record<string, unknown>).createTTSProvider = vi.fn(() => ({
        id: 'elevenlabs',
        name: 'ElevenLabs',
        getModels: vi.fn(),
        getVoices: vi.fn(),
        synthesize: vi.fn(),
        validateCredentials,
      }));

      const res = await app.inject({
        method: 'POST',
        url: '/providers/elevenlabs/key/test',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        provider_id: 'elevenlabs',
        status: 'valid',
        message: 'Saved API key is active.',
      });
      expect(validateCredentials).toHaveBeenCalledTimes(1);
    });

    it('returns invalid when the provider rejects a saved key', async () => {
      await seedProvider('elevenlabs', 'ElevenLabs');
      await app.db.providers.setKey('elevenlabs', 'test-api-key');
      (app as Record<string, unknown>).createTTSProvider = vi.fn(() => ({
        id: 'elevenlabs',
        name: 'ElevenLabs',
        getModels: vi.fn(),
        getVoices: vi.fn(),
        synthesize: vi.fn(),
        validateCredentials: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
      }));

      const res = await app.inject({
        method: 'POST',
        url: '/providers/elevenlabs/key/test',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        provider_id: 'elevenlabs',
        status: 'invalid',
        message: 'The saved API key was rejected or lacks required access.',
      });
    });

    it('returns invalid when a supported provider has malformed credentials', async () => {
      await seedProvider('google', 'Google');
      await app.db.providers.setKey('google', 'not-json');

      const res = await app.inject({
        method: 'POST',
        url: '/providers/google/key/test',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        provider_id: 'google',
        status: 'invalid',
        message: 'The saved API key was rejected or lacks required access.',
      });
    });

    it('returns unsupported when the provider has no validation adapter', async () => {
      await seedProvider('unsupported', 'Unsupported');
      await app.db.providers.setKey('unsupported', 'test-api-key');
      (app as Record<string, unknown>).createTTSProvider = vi.fn(() => {
        throw new Error('Unsupported TTS provider: unsupported');
      });

      const res = await app.inject({
        method: 'POST',
        url: '/providers/unsupported/key/test',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        provider_id: 'unsupported',
        status: 'unsupported',
        message: 'This provider does not support key validation yet.',
      });
    });

    it('uses model lookup as realtime provider validation', async () => {
      await seedProvider('openai-realtime', 'OpenAI Realtime', 'realtime');
      await app.db.providers.setKey('openai-realtime', 'test-api-key');
      const getModels = vi.fn<() => Promise<string[]>>().mockResolvedValue(['gpt-realtime']);
      (app as Record<string, unknown>).createRealtimeProvider = vi.fn(() => ({
        id: 'openai-realtime',
        name: 'OpenAI Realtime',
        getModels,
        createSession: vi.fn(),
      }));

      const res = await app.inject({
        method: 'POST',
        url: '/providers/openai-realtime/key/test',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        provider_id: 'openai-realtime',
        status: 'valid',
        message: 'Saved API key is active.',
      });
      expect(getModels).toHaveBeenCalledTimes(1);
    });

    it('does not expose secrets in validation failure messages', async () => {
      await seedProvider('openai-realtime', 'OpenAI Realtime', 'realtime');
      await app.db.providers.setKey('openai-realtime', 'sk-secret-key-12345');
      (app as Record<string, unknown>).createRealtimeProvider = vi.fn(() => ({
        id: 'openai-realtime',
        name: 'OpenAI Realtime',
        getModels: vi.fn<() => Promise<string[]>>().mockRejectedValue(
          new Error('network failed with sk-secret-key-12345'),
        ),
        createSession: vi.fn(),
      }));

      const res = await app.inject({
        method: 'POST',
        url: '/providers/openai-realtime/key/test',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        provider_id: 'openai-realtime',
        status: 'error',
        message: 'Unable to verify the key right now. Try again later.',
      });
      expect(res.body).not.toContain('sk-secret-key-12345');
    });

    it('returns 404 for a missing provider', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/providers/missing/key/test',
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
