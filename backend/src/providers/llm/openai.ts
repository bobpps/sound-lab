import OpenAI from 'openai';
import type { ILLMProvider, ILLMMessage } from './types.js';

export class OpenAILLMProvider implements ILLMProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async getModels(): Promise<string[]> {
    const models: string[] = [];

    for await (const model of this.client.models.list()) {
      if (model.id.startsWith('gpt-')) {
        models.push(model.id);
      }
    }

    return models.sort();
  }

  async complete(messages: ILLMMessage[], model: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model,
      messages,
    });

    const content = response.choices[0]?.message?.content;

    if (content === null || content === undefined) {
      throw new Error('OpenAI returned empty response');
    }

    return content;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Consume first item to verify API key is valid
      const iterator = this.client.models.list()[Symbol.asyncIterator]();
      await iterator.next();
      return true;
    } catch {
      return false;
    }
  }
}
