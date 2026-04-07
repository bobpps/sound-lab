import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini-tts';

const ALL_MODELS = ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'] as const;

/** Voices supported by all models (tts-1, tts-1-hd, gpt-4o-mini-tts). */
const UNIVERSAL_VOICE_IDS = [
  'alloy', 'ash', 'coral', 'echo', 'fable',
  'onyx', 'nova', 'sage', 'shimmer',
] as const;

/** Voices only supported by gpt-4o-mini-tts. */
const MINI_TTS_ONLY_VOICE_IDS = [
  'ballad', 'verse', 'marin', 'cedar',
] as const;

const BUILT_IN_VOICE_IDS: readonly string[] = [
  ...UNIVERSAL_VOICE_IDS,
  ...MINI_TTS_ONLY_VOICE_IDS,
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildStaticVoices(): IVoice[] {
  const universal = UNIVERSAL_VOICE_IDS.map((id) => ({
    id,
    name: capitalize(id),
    language: 'multi',
    gender: undefined,
    description: undefined,
    previewUrl: undefined,
    providerMeta: { type: 'builtin', supportedModels: [...ALL_MODELS] },
  }));

  const miniOnly = MINI_TTS_ONLY_VOICE_IDS.map((id) => ({
    id,
    name: capitalize(id),
    language: 'multi',
    gender: undefined,
    description: undefined,
    previewUrl: undefined,
    providerMeta: { type: 'builtin', supportedModels: ['gpt-4o-mini-tts'] },
  }));

  return [...universal, ...miniOnly];
}

function resolveVoiceParam(voiceId: string): string | { id: string } {
  return BUILT_IN_VOICE_IDS.includes(voiceId) ? voiceId : { id: voiceId };
}

export class OpenAITTSProvider implements ITTSProvider {
  readonly id = 'openai-tts';
  readonly name = 'OpenAI TTS';

  constructor(private readonly apiKey: string) {}

  async getVoices(): Promise<IVoice[]> {
    return buildStaticVoices();
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
        voice: resolveVoiceParam(opts.voiceId),
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
