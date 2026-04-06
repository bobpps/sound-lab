import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('LLM routes', () => {
  let app: FastifyInstance;
  let mockGetModels: ReturnType<typeof vi.fn>;
  let mockComplete: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockGetModels = vi.fn<() => Promise<string[]>>();
    mockComplete = vi.fn<() => Promise<string>>();

    app = await buildTestApp();

    // Override the createLLMProvider decorator with a mock factory
    (app as Record<string, unknown>).createLLMProvider = vi.fn(() => ({
      id: 'test-provider',
      name: 'Test Provider',
      getModels: mockGetModels,
      complete: mockComplete,
      validateCredentials: vi.fn().mockResolvedValue(true),
    }));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  async function seedLLMProvider(id = 'openai', name = 'OpenAI') {
    await app.db.providers.create({ id, name, type: 'llm' });
    await app.db.providers.setKey(id, 'test-api-key');
  }

  describe('GET /llm/:providerId/models', () => {
    it('returns models from the LLM provider', async () => {
      await seedLLMProvider();
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'];
      mockGetModels.mockResolvedValueOnce(models);

      const res = await app.inject({
        method: 'GET',
        url: '/llm/openai/models',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(models);
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/llm/nonexistent/models',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not LLM type', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await app.db.providers.setKey('elevenlabs', 'test-key');

      const res = await app.inject({
        method: 'GET',
        url: '/llm/elevenlabs/models',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      // No setKey call — key is null

      const res = await app.inject({
        method: 'GET',
        url: '/llm/openai/models',
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when provider is not supported by registry', async () => {
      await seedLLMProvider('unsupported', 'Unsupported');
      (app as Record<string, unknown>).createLLMProvider = vi.fn(() => {
        throw new Error('Unsupported LLM provider: unsupported');
      });

      const res = await app.inject({
        method: 'GET',
        url: '/llm/unsupported/models',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /llm/:providerId/complete', () => {
    it('returns completion text from the LLM provider', async () => {
      await seedLLMProvider();
      mockComplete.mockResolvedValueOnce('Hello! How can I help you?');

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ text: 'Hello! How can I help you?' });
    });

    it('passes messages and model to the provider', async () => {
      await seedLLMProvider();
      mockComplete.mockResolvedValueOnce('response');

      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hi' },
      ];

      await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: { messages, model: 'gpt-4o-mini' },
      });

      expect(mockComplete).toHaveBeenCalledWith(messages, 'gpt-4o-mini');
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/llm/nonexistent/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not LLM type', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await app.db.providers.setKey('elevenlabs', 'test-key');

      const res = await app.inject({
        method: 'POST',
        url: '/llm/elevenlabs/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'some-model',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when messages array is empty', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when body is missing required fields', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          // missing model
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when message has invalid role', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'invalid', content: 'Hello' }],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('strips additional properties from body', async () => {
      await seedLLMProvider();
      mockComplete.mockResolvedValueOnce('response');

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o',
          extraField: 'should-be-stripped',
        },
      });

      // Fastify's default Ajv config has removeAdditional: true,
      // so extra fields are silently stripped rather than rejected
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ text: 'response' });
    });
  });
});
