import type { IRealtimeProvider } from './types.js';
import { InworldRealtimeProvider } from './inworld.js';
import { ElevenLabsRealtimeProvider } from './elevenlabs.js';
import { GeminiRealtimeProvider } from './gemini.js';
import { OpenAIRealtimeProvider } from './openai.js';

export type RealtimeProviderConstructor = new (apiKey: string) => IRealtimeProvider;

const PROVIDERS: Record<string, RealtimeProviderConstructor> = {
  'openai-realtime': OpenAIRealtimeProvider,
};

export function createRealtimeProvider(providerId: string, apiKey: string): IRealtimeProvider {
  const Provider = PROVIDERS[providerId];

  if (!Provider) {
    throw new Error(`Unsupported realtime provider: ${providerId}`);
  }

  return new Provider(apiKey);
}

export function registerRealtimeProvider(
  providerId: string,
  provider: RealtimeProviderConstructor,
): void {
  PROVIDERS[providerId] = provider;
}

export function getSupportedRealtimeProviders(): string[] {
  return Object.keys(PROVIDERS);
}

registerRealtimeProvider('elevenlabs-realtime', ElevenLabsRealtimeProvider);
registerRealtimeProvider('gemini-realtime', GeminiRealtimeProvider);
registerRealtimeProvider('inworld-realtime', InworldRealtimeProvider);
