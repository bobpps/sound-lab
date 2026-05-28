import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://api.elevenlabs.io';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const MODELS = [DEFAULT_MODEL] as const;

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
      supportedModels: [...MODELS],
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const SAMPLE_RATE_FORMAT: Record<number, string> = {
  8000: 'ulaw_8000',
  16000: 'pcm_16000',
  22050: 'mp3_22050_32',
  24000: 'pcm_24000',
  44100: 'mp3_44100_128',
};

function resolveFormat(opts: ISynthesizeOptions): string {
  if (opts.format) return opts.format;
  if (opts.sampleRate !== undefined) {
    const mapped = SAMPLE_RATE_FORMAT[opts.sampleRate];
    if (!mapped) {
      throw new Error(`Unsupported sample rate: ${opts.sampleRate}. Supported: ${Object.keys(SAMPLE_RATE_FORMAT).join(', ')}`);
    }
    return mapped;
  }
  return 'mp3_44100_128';
}

export class ElevenLabsTTSProvider implements ITTSProvider {
  readonly id = 'elevenlabs';
  readonly name = 'ElevenLabs';

  constructor(private readonly apiKey: string) {}

  async getModels(): Promise<string[]> {
    return [...MODELS];
  }

  async getVoices(): Promise<IVoice[]> {
    const response = await fetch(`${BASE_URL}/v1/voices`, {
      headers: { 'xi-api-key': this.apiKey },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${body}`);
    }

    const data = (await response.json()) as ElevenLabsVoicesResponse;
    return data.voices.map(mapVoice);
  }

  async synthesize(opts: ISynthesizeOptions): Promise<Buffer> {
    const format = resolveFormat(opts);
    const speed = opts.speed ?? 1.0;
    const stability = opts.temperature !== undefined
      ? 1 - clamp(opts.temperature, 0, 1)
      : 0.5;

    const url = `${BASE_URL}/v1/text-to-speech/${opts.voiceId}?output_format=${format}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text: opts.text,
        model_id: opts.model ?? DEFAULT_MODEL,
        voice_settings: {
          stability,
          similarity_boost: 0.75,
          speed,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${body}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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
