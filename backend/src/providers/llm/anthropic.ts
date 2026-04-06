import Anthropic from '@anthropic-ai/sdk';
import type { ILLMMessage, ILLMProvider } from './types.js';

export class AnthropicLLMProvider implements ILLMProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  private readonly client: Anthropic;

  private static readonly MODELS = [
    'claude-sonnet-4-5-20250929',
    'claude-haiku-3-5-20241022',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ];

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async getModels(): Promise<string[]> {
    return AnthropicLLMProvider.MODELS;
  }

  async complete(messages: ILLMMessage[], model: string): Promise<string> {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const params: Anthropic.MessageCreateParams = {
      model,
      max_tokens: 4096,
      messages: nonSystemMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    };

    if (systemMessages.length > 0) {
      params.system = systemMessages.map((m) => m.content).join('\n\n');
    }

    let response;
    try {
      response = await this.client.messages.create(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Anthropic API error: ${message}`);
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : '';
  }
}
