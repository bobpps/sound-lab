import { GeminiTTSProvider } from '../../src/providers/tts/gemini.js';

describe('GeminiTTSProvider', () => {
  let provider: GeminiTTSProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    provider = new GeminiTTSProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "gemini-tts"', () => {
      expect(provider.id).toBe('gemini-tts');
    });

    it('has name "Gemini TTS"', () => {
      expect(provider.name).toBe('Gemini TTS');
    });
  });

  describe('getVoices', () => {
    it('returns 30 voices', async () => {
      const voices = await provider.getVoices();
      expect(voices).toHaveLength(30);
    });

    it('does not call fetch', async () => {
      await provider.getVoices();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('voices have correct structure', async () => {
      const voices = await provider.getVoices();
      const zephyr = voices.find((v) => v.id === 'zephyr')!;

      expect(zephyr).toEqual({
        id: 'zephyr',
        name: 'Zephyr',
        language: 'multi',
        gender: undefined,
        description: undefined,
        previewUrl: undefined,
        providerMeta: {
          models: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'],
        },
      });
    });

    it('includes all 30 voice names', async () => {
      const voices = await provider.getVoices();
      const ids = voices.map((v) => v.id);

      expect(ids).toEqual([
        'zephyr', 'puck', 'charon', 'kore', 'fenrir',
        'leda', 'orus', 'aoede', 'callirrhoe', 'autonoe',
        'enceladus', 'iapetus', 'umbriel', 'algieba', 'despina',
        'erinome', 'algenib', 'rasalgethi', 'laomedeia', 'achernar',
        'alnilam', 'schedar', 'gacrux', 'pulcherrima', 'achird',
        'zubenelgenubi', 'vindemiatrix', 'sadachbia', 'sadaltager', 'sulafat',
      ]);
    });
  });
});
