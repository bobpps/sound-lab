import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

function parseCredentials(apiKey: string): GoogleCredentials {
  let parsed: unknown;
  try {
    parsed = JSON.parse(apiKey);
  } catch {
    throw new Error(
      'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
    );
  }

  const creds = parsed as Record<string, unknown>;
  if (
    typeof creds.client_email !== 'string' ||
    typeof creds.private_key !== 'string'
  ) {
    throw new Error(
      'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
    );
  }

  return { client_email: creds.client_email, private_key: creds.private_key };
}

const GENDER_MAP: Record<number, string> = {
  1: 'male',
  2: 'female',
  3: 'neutral',
};

function resolveGender(ssmlGender: string | number | null | undefined): string | undefined {
  if (typeof ssmlGender === 'number') {
    return GENDER_MAP[ssmlGender];
  }
  if (typeof ssmlGender === 'string') {
    const lower = ssmlGender.toLowerCase();
    if (lower === 'male' || lower === 'female' || lower === 'neutral') {
      return lower;
    }
  }
  return undefined;
}

export class GoogleTTSProvider implements ITTSProvider {
  readonly id = 'google';
  readonly name = 'Google Cloud TTS';

  private readonly client: TextToSpeechClient;

  constructor(apiKey: string) {
    const credentials = parseCredentials(apiKey);
    this.client = new TextToSpeechClient({ credentials });
  }

  async getVoices(): Promise<IVoice[]> {
    let response;
    try {
      [response] = await this.client.listVoices({});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Google TTS API error: ${message}`);
    }

    const voices = response.voices ?? [];

    return voices.map((v) => ({
      id: v.name!,
      name: v.name!,
      language: v.languageCodes?.[0] ?? 'unknown',
      gender: resolveGender(v.ssmlGender),
      description: undefined,
      previewUrl: undefined,
      providerMeta: {
        naturalSampleRateHertz: v.naturalSampleRateHertz,
        ssmlGender: v.ssmlGender,
      },
    }));
  }

  async synthesize(_opts: ISynthesizeOptions): Promise<Buffer> {
    throw new Error('Not implemented');
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.client.listVoices({ languageCode: 'en-US' });
      return true;
    } catch {
      return false;
    }
  }
}
