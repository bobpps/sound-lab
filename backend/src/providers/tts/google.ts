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

export class GoogleTTSProvider implements ITTSProvider {
  readonly id = 'google';
  readonly name = 'Google Cloud TTS';

  private readonly client: TextToSpeechClient;

  constructor(apiKey: string) {
    const credentials = parseCredentials(apiKey);
    this.client = new TextToSpeechClient({ credentials });
  }

  async getVoices(): Promise<IVoice[]> {
    throw new Error('Not implemented');
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
