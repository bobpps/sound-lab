import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://api.inworld.ai';
const DEFAULT_MODEL = 'inworld-tts-1.5-max';

// Private interfaces for Inworld API responses
interface InworldVoice {
  voiceId: string;
  displayName: string;
  langCode: string;
  description: string | null;
  tags: string[];
  source: string;
  name?: string;
}

interface InworldVoicesResponse {
  voices: InworldVoice[];
}

interface InworldSynthesizeResponse {
  audioContent: string;
  usage?: { processedCharactersCount: number; modelId: string };
}

// Module-level helpers
function mapVoice(v: InworldVoice): IVoice {
  const language = v.langCode?.split('_')[0]?.toLowerCase() || 'en';
  const gender = v.tags?.find((t) => t === 'male' || t === 'female');
  return {
    id: v.voiceId,
    name: v.displayName,
    language,
    gender,
    description: v.description ?? undefined,
    previewUrl: undefined,
    providerMeta: { langCode: v.langCode, tags: v.tags, source: v.source },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildAudioConfig(opts: ISynthesizeOptions): Record<string, unknown> | undefined {
  const config: Record<string, unknown> = {};
  if (opts.speed !== undefined) config.speakingRate = clamp(opts.speed, 0.5, 1.5);
  if (opts.format !== undefined) config.audioEncoding = opts.format.toUpperCase();
  if (opts.sampleRate !== undefined) config.sampleRateHertz = opts.sampleRate;
  return Object.keys(config).length > 0 ? config : undefined;
}

// Provider class
export class InworldTTSProvider implements ITTSProvider {
  readonly id = 'inworld';
  readonly name = 'Inworld';

  constructor(private readonly apiKey: string) {}

  async getVoices(): Promise<IVoice[]> {
    const response = await fetch(`${BASE_URL}/voices/v1/voices`, {
      headers: { Authorization: `Basic ${this.apiKey}` },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Inworld API error: ${response.status} ${body}`);
    }
    const data = (await response.json()) as InworldVoicesResponse;
    return data.voices.map(mapVoice);
  }

  async synthesize(opts: ISynthesizeOptions): Promise<Buffer> {
    const audioConfig = buildAudioConfig(opts);
    const body: Record<string, unknown> = {
      text: opts.text,
      voiceId: opts.voiceId,
      modelId: DEFAULT_MODEL,
    };
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (audioConfig !== undefined) body.audioConfig = audioConfig;

    const response = await fetch(`${BASE_URL}/tts/v1/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Inworld API error: ${response.status} ${text}`);
    }
    const data = (await response.json()) as InworldSynthesizeResponse;
    return Buffer.from(data.audioContent, 'base64');
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/voices/v1/voices`, {
        headers: { Authorization: `Basic ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
