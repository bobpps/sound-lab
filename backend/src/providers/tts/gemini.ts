import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-tts';
const MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'] as const;

const VOICE_NAMES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir',
  'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe',
  'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
  'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
  'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird',
  'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
] as const;

function buildStaticVoices(): IVoice[] {
  return VOICE_NAMES.map((name) => ({
    id: name,
    name,
    language: 'multi',
    gender: undefined,
    description: undefined,
    previewUrl: undefined,
    providerMeta: { models: [...MODELS] },
  }));
}

/** Prepend a 44-byte WAV header to raw PCM 16-bit mono audio. */
function wrapPcmInWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2; // 16-bit mono = 2 bytes per sample
  const dataSize = pcm.length;
  const fileSize = 36 + dataSize;

  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);      // fmt chunk size
  header.writeUInt16LE(1, 20);       // PCM format
  header.writeUInt16LE(1, 22);       // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);       // block align (16-bit mono = 2)
  header.writeUInt16LE(16, 34);      // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

export class GeminiTTSProvider implements ITTSProvider {
  readonly id = 'gemini-tts';
  readonly name = 'Gemini TTS';

  constructor(private readonly apiKey: string) {}

  async getVoices(): Promise<IVoice[]> {
    return buildStaticVoices();
  }

  async synthesize(opts: ISynthesizeOptions): Promise<Buffer> {
    const model = opts.model ?? DEFAULT_MODEL;
    const url = `${BASE_URL}/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: opts.text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: opts.voiceId },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini TTS API error: ${response.status} ${body}`);
    }

    const json = await response.json();
    const audioData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      throw new Error('Gemini TTS API error: no audio data in response');
    }

    const pcm = Buffer.from(audioData, 'base64');
    return wrapPcmInWav(pcm, 24000);
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(
        `${BASE_URL}/${DEFAULT_MODEL}?key=${this.apiKey}`,
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
