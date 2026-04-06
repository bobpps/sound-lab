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

  async function seedDialog() {
    const dialog = await app.db.dialogs.create({ title: 'Test', language: 'en' });
    await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Hello' });
    await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 2, character: 2, text: 'Hi there' });
    return dialog;
  }

  async function seedTTSProvider(id = 'elevenlabs', name = 'ElevenLabs') {
    await app.db.providers.create({ id, name, type: 'tts' });
  }

  async function seedDialogWithMessages() {
    const dialog = await app.db.dialogs.create({
      title: 'Test Dialog',
      language: 'en',
    });
    const messages = [
      await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Hello there' }),
      await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 2, character: 2, text: 'Hi, how are you?' }),
      await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 3, character: 1, text: 'I am fine' }),
    ];
    return { dialog, messages };
  }

  async function seedAnnotationPrompt(providerId = 'elevenlabs') {
    return app.db.annotationPrompts.create({
      title: 'SSML Prompt',
      provider_id: providerId,
      language: 'en',
      prompt: 'Annotate with SSML tags.',
    });
  }

  function makeAnnotatePayload(overrides: Record<string, unknown> = {}) {
    return {
      dialogId: 1,
      providerId: 'openai',
      model: 'gpt-4o',
      annotationPromptId: 1,
      ttsProviderId: 'elevenlabs',
      title: 'Annotated Dialog',
      ...overrides,
    };
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

  describe('POST /services/edit-dialog', () => {
    it('edits dialog and returns 200 with updated DialogWithMessages', async () => {
      await seedLLMProvider();
      const dialog = await seedDialog();

      mockComplete.mockResolvedValueOnce(JSON.stringify({
        messages: [
          { order: 1, character: 1, text: 'New hello' },
          { order: 2, character: 2, text: 'Hi there' },
        ],
      }));

      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: {
          dialogId: dialog.id,
          providerId: 'openai',
          model: 'gpt-4o',
          instructions: 'change greeting',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].text).toBe('New hello');
    });

    it('returns 404 when dialog does not exist', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: { dialogId: 999, providerId: 'openai', model: 'gpt-4o', instructions: 'change greeting' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider does not exist', async () => {
      const dialog = await seedDialog();

      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: { dialogId: dialog.id, providerId: 'nonexistent', model: 'gpt-4o', instructions: 'change greeting' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      const dialog = await seedDialog();

      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: { dialogId: dialog.id, providerId: 'openai', model: 'gpt-4o', instructions: 'change greeting' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when provider is not LLM type', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await app.db.providers.setKey('elevenlabs', 'test-key');
      const dialog = await seedDialog();

      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: { dialogId: dialog.id, providerId: 'elevenlabs', model: 'some-model', instructions: 'change greeting' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: { dialogId: 1, providerId: 'openai' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when instructions is empty string', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: { dialogId: 1, providerId: 'openai', model: 'gpt-4o', instructions: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 500 when LLM throws an unexpected error', async () => {
      await seedLLMProvider();
      const dialog = await seedDialog();
      mockComplete.mockRejectedValueOnce(new Error('Connection timeout'));

      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: { dialogId: dialog.id, providerId: 'openai', model: 'gpt-4o', instructions: 'change greeting' },
      });

      expect(res.statusCode).toBe(500);
    });

    it('returns 400 when LLM provider factory throws', async () => {
      await seedLLMProvider();
      const dialog = await seedDialog();
      (app as Record<string, unknown>).createLLMProvider = vi.fn(() => { throw new Error('Unsupported provider'); });

      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: { dialogId: dialog.id, providerId: 'openai', model: 'gpt-4o', instructions: 'change greeting' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 502 when LLM returns unparseable response', async () => {
      await seedLLMProvider();
      const dialog = await seedDialog();
      mockComplete.mockResolvedValueOnce('I cannot do that');

      const res = await app.inject({
        method: 'POST',
        url: '/services/edit-dialog',
        payload: { dialogId: dialog.id, providerId: 'openai', model: 'gpt-4o', instructions: 'change greeting' },
      });

      expect(res.statusCode).toBe(502);
    });
  });

  describe('POST /services/annotate', () => {
    it('annotates dialog and returns AnnotatedDialogWithMessages', async () => {
      await seedLLMProvider();
      await seedTTSProvider();
      const { dialog } = await seedDialogWithMessages();
      const prompt = await seedAnnotationPrompt();

      mockComplete
        .mockResolvedValueOnce('<speak>Hello there</speak>')
        .mockResolvedValueOnce('<speak>Hi, how are you?</speak>')
        .mockResolvedValueOnce('<speak>I am fine</speak>');

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: prompt.id,
        }),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.dialog_id).toBe(dialog.id);
      expect(body.provider_id).toBe('elevenlabs');
      expect(body.title).toBe('Annotated Dialog');
      expect(body.messages).toHaveLength(3);
      expect(body.messages[0].text).toBe('<speak>Hello there</speak>');
      expect(body.messages[1].text).toBe('<speak>Hi, how are you?</speak>');
      expect(body.messages[2].text).toBe('<speak>I am fine</speak>');
    });

    it('calls createLLMProvider with correct providerId and apiKey', async () => {
      await seedLLMProvider();
      await seedTTSProvider();
      const { dialog } = await seedDialogWithMessages();
      const prompt = await seedAnnotationPrompt();

      mockComplete.mockResolvedValue('<speak>text</speak>');

      await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: prompt.id,
        }),
      });

      expect(app.createLLMProvider).toHaveBeenCalledWith('openai', 'test-api-key');
    });

    it('returns 404 when dialog does not exist', async () => {
      await seedLLMProvider();
      await seedTTSProvider();
      const prompt = await seedAnnotationPrompt();

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: 999,
          annotationPromptId: prompt.id,
        }),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('not found');
    });

    it('returns 404 when annotation prompt does not exist', async () => {
      await seedLLMProvider();
      await seedTTSProvider();
      const { dialog } = await seedDialogWithMessages();

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: 999,
        }),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('not found');
    });

    it('returns 404 when LLM provider does not exist', async () => {
      await seedTTSProvider();
      const { dialog } = await seedDialogWithMessages();
      const prompt = await seedAnnotationPrompt();

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: prompt.id,
          providerId: 'nonexistent',
        }),
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when LLM provider has no API key', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      await seedTTSProvider();
      const { dialog } = await seedDialogWithMessages();
      const prompt = await seedAnnotationPrompt();

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: prompt.id,
        }),
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when LLM provider is not of type llm', async () => {
      await seedTTSProvider('openai', 'OpenAI-as-TTS');
      await seedTTSProvider();
      const { dialog } = await seedDialogWithMessages();
      const prompt = await seedAnnotationPrompt();

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: prompt.id,
          providerId: 'openai',
        }),
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when required body fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: { dialogId: 1 },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when dialog has no messages', async () => {
      await seedLLMProvider();
      await seedTTSProvider();
      const dialog = await app.db.dialogs.create({
        title: 'Empty Dialog',
        language: 'en',
      });
      const prompt = await seedAnnotationPrompt();

      mockComplete.mockResolvedValue('<speak>text</speak>');

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: prompt.id,
        }),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('no messages');
    });

    it('returns 404 when TTS provider does not exist', async () => {
      await seedLLMProvider();
      const { dialog } = await seedDialogWithMessages();
      const prompt = await seedAnnotationPrompt('elevenlabs');

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: prompt.id,
          ttsProviderId: 'nonexistent',
        }),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('TTS provider');
    });

    it('returns 404 when TTS provider is not of type tts', async () => {
      await seedLLMProvider();
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'llm' });
      const { dialog } = await seedDialogWithMessages();
      const prompt = await seedAnnotationPrompt('elevenlabs');

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: prompt.id,
          ttsProviderId: 'elevenlabs',
        }),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('TTS provider');
    });

    it('returns 400 when annotation prompt provider does not match ttsProviderId', async () => {
      await seedLLMProvider();
      await seedTTSProvider();
      const { dialog } = await seedDialogWithMessages();
      const prompt = await seedAnnotationPrompt('google');

      const res = await app.inject({
        method: 'POST',
        url: '/services/annotate',
        payload: makeAnnotatePayload({
          dialogId: dialog.id,
          annotationPromptId: prompt.id,
          ttsProviderId: 'elevenlabs',
        }),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('google');
      expect(res.json().message).toContain('elevenlabs');
    });
  });
});
