import type { IVoice } from './tts/types.js';

export const GEMINI_VOICES = [
  { name: 'Zephyr', gender: 'female' },
  { name: 'Puck', gender: 'male' },
  { name: 'Charon', gender: 'male' },
  { name: 'Kore', gender: 'female' },
  { name: 'Fenrir', gender: 'male' },
  { name: 'Leda', gender: 'female' },
  { name: 'Orus', gender: 'male' },
  { name: 'Aoede', gender: 'female' },
  { name: 'Callirrhoe', gender: 'female' },
  { name: 'Autonoe', gender: 'female' },
  { name: 'Enceladus', gender: 'male' },
  { name: 'Iapetus', gender: 'male' },
  { name: 'Umbriel', gender: 'male' },
  { name: 'Algieba', gender: 'male' },
  { name: 'Despina', gender: 'female' },
  { name: 'Erinome', gender: 'female' },
  { name: 'Algenib', gender: 'male' },
  { name: 'Rasalgethi', gender: 'male' },
  { name: 'Laomedeia', gender: 'female' },
  { name: 'Achernar', gender: 'female' },
  { name: 'Alnilam', gender: 'male' },
  { name: 'Schedar', gender: 'male' },
  { name: 'Gacrux', gender: 'female' },
  { name: 'Pulcherrima', gender: 'female' },
  { name: 'Achird', gender: 'male' },
  { name: 'Zubenelgenubi', gender: 'male' },
  { name: 'Vindemiatrix', gender: 'female' },
  { name: 'Sadachbia', gender: 'male' },
  { name: 'Sadaltager', gender: 'male' },
  { name: 'Sulafat', gender: 'female' },
] as const;

export function buildGeminiVoices(supportedModels: string[]): IVoice[] {
  return GEMINI_VOICES.map((voice) => ({
    id: voice.name,
    name: voice.name,
    language: 'multi',
    gender: voice.gender,
    providerMeta: { supportedModels },
  }));
}
