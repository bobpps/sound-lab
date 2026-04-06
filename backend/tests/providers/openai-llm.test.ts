import { OpenAILLMProvider } from '../../src/providers/llm/openai.js';

vi.mock('openai', () => {
  const MockOpenAI = vi.fn();
  return { default: MockOpenAI };
});

import OpenAI from 'openai';

const MockOpenAI = vi.mocked(OpenAI);

describe('OpenAILLMProvider', () => {
  let provider: OpenAILLMProvider;
  let mockModels: { list: ReturnType<typeof vi.fn> };
  let mockCompletions: { create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockModels = { list: vi.fn() };
    mockCompletions = { create: vi.fn() };

    MockOpenAI.mockImplementation(() => ({
      models: mockModels,
      chat: { completions: mockCompletions },
    }) as unknown as OpenAI);

    provider = new OpenAILLMProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "openai"', () => {
      expect(provider.id).toBe('openai');
    });

    it('has name "OpenAI"', () => {
      expect(provider.name).toBe('OpenAI');
    });
  });

  describe('constructor', () => {
    it('creates OpenAI client with provided API key', () => {
      expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });
  });

  describe('getModels', () => {
    it('returns filtered and sorted model IDs starting with "gpt-"', async () => {
      const modelsData = [
        { id: 'gpt-4o', owned_by: 'openai' },
        { id: 'dall-e-3', owned_by: 'openai' },
        { id: 'gpt-4o-mini', owned_by: 'openai' },
        { id: 'whisper-1', owned_by: 'openai' },
        { id: 'gpt-3.5-turbo', owned_by: 'openai' },
      ];

      async function* generateModels() {
        for (const model of modelsData) {
          yield model;
        }
      }

      mockModels.list.mockReturnValue(generateModels());

      const models = await provider.getModels();

      expect(models).toEqual(['gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini']);
    });

    it('returns empty array when no gpt models exist', async () => {
      async function* generateModels() {
        yield { id: 'dall-e-3', owned_by: 'openai' };
        yield { id: 'whisper-1', owned_by: 'openai' };
      }

      mockModels.list.mockReturnValue(generateModels());

      const models = await provider.getModels();

      expect(models).toEqual([]);
    });
  });

  describe('complete', () => {
    it('returns message content from chat completion', async () => {
      mockCompletions.create.mockResolvedValue({
        choices: [{ message: { content: 'Hello! How can I help you?' } }],
      });

      const result = await provider.complete(
        [{ role: 'user', content: 'Hello' }],
        'gpt-4o',
      );

      expect(result).toBe('Hello! How can I help you?');
    });

    it('sends correct parameters to chat.completions.create', async () => {
      mockCompletions.create.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
      });

      await provider.complete(
        [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
        'gpt-4o-mini',
      );

      expect(mockCompletions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
      });
    });

    it('throws when response content is null', async () => {
      mockCompletions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await expect(
        provider.complete([{ role: 'user', content: 'Hi' }], 'gpt-4o'),
      ).rejects.toThrow('OpenAI returned empty response');
    });
  });

  describe('validateCredentials', () => {
    it('returns true when models.list succeeds', async () => {
      async function* generateModels() {
        yield { id: 'gpt-4o', owned_by: 'openai' };
      }

      mockModels.list.mockReturnValue(generateModels());

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
    });

    it('returns false when models.list throws', async () => {
      mockModels.list.mockImplementation(() => {
        throw new Error('Invalid API key');
      });

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });
  });
});
