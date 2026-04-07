import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini-tts';

const BUILT_IN_VOICE_IDS = [
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable',
  'onyx', 'nova', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
] as const;

interface OpenAIVoice {
  voice_id: string;
  name: string;
  type?: string;
  description?: string | null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function mapVoice(v: OpenAIVoice): IVoice {
  return {
    id: v.voice_id,
    name: v.name,
    language: 'multi',
    gender: undefined,
    description: v.description ?? undefined,
    previewUrl: undefined,
    providerMeta: v.type ? { type: v.type } : undefined,
  };
}

function buildStaticVoices(): IVoice[] {
  return BUILT_IN_VOICE_IDS.map((id) => ({
    id,
    name: capitalize(id),
    language: 'multi',
    gender: undefined,
    description: undefined,
    previewUrl: undefined,
    providerMeta: { type: 'builtin' },
  }));
}

export class OpenAITTSProvider implements ITTSProvider {
  readonly id = 'openai-tts';
  readonly name = 'OpenAI TTS';

  constructor(private readonly apiKey: string) {}

  async getVoices(): Promise<IVoice[]> {
    try {
      const response = await fetch(`${BASE_URL}/audio/voices`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        return buildStaticVoices();
      }

      const data = (await response.json()) as OpenAIVoice[];
      return data.map(mapVoice);
    } catch {
      return buildStaticVoices();
    }
  }

  async synthesize(opts: ISynthesizeOptions): Promise<Buffer> {
    const response = await fetch(`${BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_MODEL,
        voice: opts.voiceId,
        input: opts.text,
        response_format: opts.format ?? 'mp3',
        speed: clamp(opts.speed ?? 1.0, 0.25, 4.0),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI TTS API error: ${response.status} ${body}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
