import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://api.elevenlabs.io';

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string | null;
  preview_url?: string | null;
  verified_languages?: Array<{ language: string; locale?: string }>;
  settings?: Record<string, unknown>;
}

interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

function mapVoice(v: ElevenLabsVoice): IVoice {
  const language =
    v.verified_languages?.[0]?.locale ??
    v.verified_languages?.[0]?.language ??
    'en';

  return {
    id: v.voice_id,
    name: v.name,
    language,
    gender: v.labels?.gender,
    description: v.description ?? undefined,
    previewUrl: v.preview_url ?? undefined,
    providerMeta: {
      category: v.category,
      labels: v.labels,
      settings: v.settings,
    },
  };
}

export class ElevenLabsTTSProvider implements ITTSProvider {
  readonly id = 'elevenlabs';
  readonly name = 'ElevenLabs';

  constructor(private readonly apiKey: string) {}

  async getVoices(): Promise<IVoice[]> {
    const response = await fetch(`${BASE_URL}/v1/voices`, {
      headers: { 'xi-api-key': this.apiKey },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const data = (await response.json()) as ElevenLabsVoicesResponse;
    return data.voices.map(mapVoice);
  }

  async synthesize(_opts: ISynthesizeOptions): Promise<Buffer> {
    throw new Error('Not implemented');
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/v1/user`, {
        headers: { 'xi-api-key': this.apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
