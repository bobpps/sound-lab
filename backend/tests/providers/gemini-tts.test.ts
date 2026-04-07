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

  describe('validateCredentials', () => {
    it('returns true when API returns 200', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ name: 'models/gemini-2.5-flash-preview-tts' }), { status: 200 }));

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts?key=test-api-key',
      );
    });

    it('returns false when API returns 401', async () => {
      mockFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });

    it('returns false when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });
  });
});
