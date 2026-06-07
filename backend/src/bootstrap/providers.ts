import type { IDatabase } from '../db/interfaces.js';
import type { ProviderType } from '../db/types.js';

interface ProviderSeed {
  id: string;
  name: string;
  type: ProviderType;
}

export const DEFAULT_PROVIDER_SEEDS: ProviderSeed[] = [
  { id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' },
  { id: 'google', name: 'Google', type: 'tts' },
  { id: 'inworld', name: 'Inworld', type: 'tts' },
  { id: 'openai-tts', name: 'OpenAI TTS', type: 'tts' },
  { id: 'gemini-tts', name: 'Gemini TTS', type: 'tts' },
  { id: 'openai', name: 'OpenAI', type: 'llm' },
  { id: 'anthropic', name: 'Anthropic', type: 'llm' },
  // Provider IDs are globally unique across all types.
  { id: 'openai-realtime', name: 'OpenAI Realtime', type: 'realtime' },
  { id: 'gemini-realtime', name: 'Gemini Realtime', type: 'realtime' },
  { id: 'gemini-realtime-sdk', name: 'Gemini Realtime SDK', type: 'realtime' },
  { id: 'elevenlabs-realtime', name: 'ElevenLabs Realtime', type: 'realtime' },
  { id: 'inworld-realtime', name: 'Inworld Realtime', type: 'realtime' },
];

export async function bootstrapProviders(db: IDatabase): Promise<void> {
  await db.transaction(async () => {
    for (const seed of DEFAULT_PROVIDER_SEEDS) {
      const existing = await db.providers.getById(seed.id);
      if (!existing) {
        await db.providers.create(seed);
      }
    }
  });
}
