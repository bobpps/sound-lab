import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { protos } from '@google-cloud/text-to-speech';
import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

type IAudioConfig = protos.google.cloud.texttospeech.v1.IAudioConfig;

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

function extractLanguageCode(voiceId: string): string {
  // Voice IDs follow the pattern: "languageCode-VoiceType-Letter"
  // e.g. "en-US-Wavenet-A" → "en-US", "cmn-CN-Wavenet-A" → "cmn-CN"
  const parts = voiceId.split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return voiceId;
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

    const voices = (response.voices ?? []).filter((v) => v.name);

    return voices.map((v) => ({
      id: v.name as string,
      name: v.name as string,
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

  async synthesize(opts: ISynthesizeOptions): Promise<Buffer> {
    const audioConfig: IAudioConfig = {
      audioEncoding: (opts.format ?? 'MP3') as IAudioConfig['audioEncoding'],
      speakingRate: opts.speed ?? 1.0,
    };

    if (opts.sampleRate !== undefined) {
      audioConfig.sampleRateHertz = opts.sampleRate;
    }

    let response;
    try {
      [response] = await this.client.synthesizeSpeech({
        input: { text: opts.text },
        voice: {
          languageCode: extractLanguageCode(opts.voiceId),
          name: opts.voiceId,
        },
        audioConfig,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Google TTS API error: ${message}`);
    }

    if (!response?.audioContent) {
      throw new Error('Google TTS API error: empty audio response');
    }

    return Buffer.from(response.audioContent as Uint8Array);
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
