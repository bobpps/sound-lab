import { AnthropicLLMProvider } from '../../src/providers/llm/anthropic.js';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK -- vi.mock is hoisted before imports
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

describe('AnthropicLLMProvider', () => {
  let provider: AnthropicLLMProvider;

  beforeEach(() => {
    mockCreate.mockReset();
    vi.mocked(Anthropic).mockImplementation(
      () => ({ messages: { create: mockCreate } }) as unknown as Anthropic,
    );
    provider = new AnthropicLLMProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "anthropic"', () => {
      expect(provider.id).toBe('anthropic');
    });

    it('has name "Anthropic"', () => {
      expect(provider.name).toBe('Anthropic');
    });
  });

  describe('getModels', () => {
    it('returns an array of model ID strings', async () => {
      const models = await provider.getModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      models.forEach((m) => expect(typeof m).toBe('string'));
    });

    it('includes claude-sonnet-4-5-20250929', async () => {
      const models = await provider.getModels();

      expect(models).toContain('claude-sonnet-4-5-20250929');
    });

    it('does not call any SDK method', async () => {
      await provider.getModels();

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('passes non-system messages to messages.create', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello back' }],
      });

      await provider.complete(
        [{ role: 'user', content: 'Hi' }],
        'claude-sonnet-4-5-20250929',
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      );
    });

    it('extracts system messages into the system parameter', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'I am helpful' }],
      });

      await provider.complete(
        [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        'claude-sonnet-4-5-20250929',
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });

    it('concatenates multiple system messages with double newline', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Sure' }],
      });

      await provider.complete(
        [
          { role: 'system', content: 'You are helpful.' },
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Hello' },
        ],
        'claude-sonnet-4-5-20250929',
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful.\n\nBe concise.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });

    it('omits system parameter when no system messages exist', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hi' }],
      });

      await provider.complete(
        [{ role: 'user', content: 'Hello' }],
        'claude-sonnet-4-5-20250929',
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('system');
    });

    it('returns text content from the response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'The answer is 42' }],
      });

      const result = await provider.complete(
        [{ role: 'user', content: 'What is the answer?' }],
        'claude-sonnet-4-5-20250929',
      );

      expect(result).toBe('The answer is 42');
    });

    it('returns empty string when response has no text blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      const result = await provider.complete(
        [{ role: 'user', content: 'Hello' }],
        'claude-sonnet-4-5-20250929',
      );

      expect(result).toBe('');
    });
  });
});
