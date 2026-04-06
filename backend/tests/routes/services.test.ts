import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('Services routes', () => {
  let app: FastifyInstance;
  let mockComplete: ReturnType<typeof vi.fn>;

  const VALID_LLM_RESPONSE = JSON.stringify([
    { character: 1, text: 'Hello, tech support?' },
    { character: 2, text: 'Yes, how can I help you today?' },
    { character: 1, text: 'My printer is not working.' },
    { character: 2, text: 'Have you tried turning it off and on again?' },
  ]);

  beforeEach(async () => {
    mockComplete = vi.fn<() => Promise<string>>().mockResolvedValue(VALID_LLM_RESPONSE);

    app = await buildTestApp();

    (app as Record<string, unknown>).createLLMProvider = vi.fn(() => ({
      id: 'openai',
      name: 'OpenAI',
      getModels: vi.fn().mockResolvedValue(['gpt-4o']),
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

  describe('POST /services/generate-dialog', () => {
    it('generates a dialog and returns DialogWithMessages', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'A customer calling tech support',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.language).toBe('en-US');
      expect(body.messages).toHaveLength(4);
      expect(body.messages[0].character).toBe(1);
      expect(body.messages[0].text).toBe('Hello, tech support?');
      expect(body.messages[0].order).toBe(1);
      expect(body.messages[1].character).toBe(2);
      expect(body.messages[1].order).toBe(2);
    });

    it('calls LLM complete with the provided model', async () => {
      await seedLLMProvider();

      await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          language: 'en-US',
          prompt: 'Two friends chatting',
          messageCount: 4,
        },
      });

      expect(mockComplete).toHaveBeenCalledOnce();
      const [, model] = mockComplete.mock.calls[0];
      expect(model).toBe('gpt-4o-mini');
    });

    it('persists the dialog in the database', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'fr-FR',
          prompt: 'A conversation at a bakery',
          messageCount: 4,
        },
      });

      const body = res.json();
      const persisted = await app.db.dialogs.getWithMessages(body.id);
      expect(persisted).not.toBeNull();
      expect(persisted!.language).toBe('fr-FR');
      expect(persisted!.messages).toHaveLength(4);
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'nonexistent',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not LLM type', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await app.db.providers.setKey('elevenlabs', 'test-key');

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'elevenlabs',
          model: 'some-model',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      // No setKey call

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when body is missing required fields', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          // missing language, prompt, messageCount
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when messageCount is less than 2', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 1,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when prompt is empty', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: '',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('strips additional properties from body', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test prompt',
          messageCount: 4,
          extraField: 'should-be-stripped',
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('returns 500 when LLM returns invalid JSON', async () => {
      await seedLLMProvider();
      mockComplete.mockResolvedValueOnce('This is not valid JSON');

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(500);
    });
  });
});
