import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://api.elevenlabs.io';

export class ElevenLabsTTSProvider implements ITTSProvider {
  readonly id = 'elevenlabs';
  readonly name = 'ElevenLabs';

  constructor(private readonly apiKey: string) {}

  async getVoices(): Promise<IVoice[]> {
    throw new Error('Not implemented');
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
