import { createLLMProvider, getSupportedLLMProviders } from '../../src/providers/llm/registry.js';
import { OpenAILLMProvider } from '../../src/providers/llm/openai.js';
import { AnthropicLLMProvider } from '../../src/providers/llm/anthropic.js';

vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    models: { list: vi.fn() },
    chat: { completions: { create: vi.fn() } },
  }));
  return { default: MockOpenAI };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

describe('LLM Provider Registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLLMProvider', () => {
    it('returns OpenAILLMProvider for "openai"', () => {
      const provider = createLLMProvider('openai', 'test-key');

      expect(provider).toBeInstanceOf(OpenAILLMProvider);
      expect(provider.id).toBe('openai');
    });

    it('returns AnthropicLLMProvider for "anthropic"', () => {
      const provider = createLLMProvider('anthropic', 'test-key');

      expect(provider).toBeInstanceOf(AnthropicLLMProvider);
      expect(provider.id).toBe('anthropic');
    });

    it('throws for unsupported provider ID', () => {
      expect(() => createLLMProvider('unknown', 'key')).toThrow(
        'Unsupported LLM provider: unknown',
      );
    });
  });

  describe('getSupportedLLMProviders', () => {
    it('returns array containing all registered providers', () => {
      const providers = getSupportedLLMProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toHaveLength(2);
    });
  });
});
