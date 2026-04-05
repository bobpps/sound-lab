import type { ITTSProvider } from './types.js';
import { ElevenLabsTTSProvider } from './elevenlabs.js';
import { GoogleTTSProvider } from './google.js';

const PROVIDERS: Record<string, new (apiKey: string) => ITTSProvider> = {
  elevenlabs: ElevenLabsTTSProvider,
  google: GoogleTTSProvider,
};

export function createTTSProvider(providerId: string, apiKey: string): ITTSProvider {
  const Provider = PROVIDERS[providerId];

  if (!Provider) {
    throw new Error(`Unsupported TTS provider: ${providerId}`);
  }

  return new Provider(apiKey);
}

export function getSupportedTTSProviders(): string[] {
  return Object.keys(PROVIDERS);
}
