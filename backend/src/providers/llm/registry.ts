import type { ILLMProvider } from './types.js';
import { OpenAILLMProvider } from './openai.js';

const PROVIDERS: Record<string, new (apiKey: string) => ILLMProvider> = {
  openai: OpenAILLMProvider,
};

export function createLLMProvider(providerId: string, apiKey: string): ILLMProvider {
  const Provider = PROVIDERS[providerId];

  if (!Provider) {
    throw new Error(`Unsupported LLM provider: ${providerId}`);
  }

  return new Provider(apiKey);
}

export function getSupportedLLMProviders(): string[] {
  return Object.keys(PROVIDERS);
}
