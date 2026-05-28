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
      const zephyr = voices.find((v) => v.id === 'Zephyr')!;

      expect(zephyr).toEqual({
        id: 'Zephyr',
        name: 'Zephyr',
        language: 'multi',
        gender: undefined,
        description: undefined,
        previewUrl: undefined,
        providerMeta: {
          supportedModels: [
            'gemini-3.1-flash-tts-preview',
            'gemini-2.5-flash-preview-tts',
            'gemini-2.5-pro-preview-tts',
          ],
        },
      });
    });

    it('filters voices by model', async () => {
      const voices = await provider.getVoices('gemini-2.5-pro-preview-tts');
      expect(voices).toHaveLength(30);
    });

    it('includes all 30 voice names', async () => {
      const voices = await provider.getVoices();
      const ids = voices.map((v) => v.id);

      expect(ids).toEqual([
        'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir',
        'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe',
        'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
        'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
        'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird',
        'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
      ]);
    });
  });

  describe('getModels', () => {
    it('returns supported models', async () => {
      await expect(provider.getModels()).resolves.toEqual([
        'gemini-3.1-flash-tts-preview',
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-pro-preview-tts',
      ]);
    });
  });

  describe('validateCredentials', () => {
    it('returns true when API returns 200', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ name: 'models/gemini-3.1-flash-tts-preview' }), { status: 200 }));

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview',
        { headers: { 'x-goog-api-key': 'test-api-key' } },
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

  describe('synthesize', () => {
    // 4 bytes of fake PCM data, base64-encoded
    const fakePcm = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const fakePcmBase64 = fakePcm.toString('base64');

    function geminiResponse(base64Audio: string) {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              inlineData: {
                mimeType: 'audio/L16;rate=24000',
                data: base64Audio,
              },
            }],
          },
        }],
      }), { status: 200 });
    }

    it('sends POST to Gemini generateContent endpoint', async () => {
      mockFetch.mockResolvedValue(geminiResponse(fakePcmBase64));

      await provider.synthesize({ voiceId: 'Kore', text: 'Hello' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': 'test-api-key',
          },
        }),
      );
    });

    it('sends correct request body with voice config', async () => {
      mockFetch.mockResolvedValue(geminiResponse(fakePcmBase64));

      await provider.synthesize({ voiceId: 'Kore', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        contents: [{ parts: [{ text: 'Hello' }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
    });

    it('uses provided model when specified', async () => {
      mockFetch.mockResolvedValue(geminiResponse(fakePcmBase64));

      await provider.synthesize({ voiceId: 'Kore', text: 'Hello', model: 'gemini-2.5-pro-preview-tts' });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('gemini-2.5-pro-preview-tts:generateContent');
    });

    it('returns Buffer with WAV header prepended', async () => {
      mockFetch.mockResolvedValue(geminiResponse(fakePcmBase64));

      const result = await provider.synthesize({ voiceId: 'Kore', text: 'Hello' });

      expect(Buffer.isBuffer(result)).toBe(true);
      // 44-byte WAV header + 4 bytes PCM
      expect(result.length).toBe(48);
    });

    it('produces valid WAV header', async () => {
      mockFetch.mockResolvedValue(geminiResponse(fakePcmBase64));

      const result = await provider.synthesize({ voiceId: 'Kore', text: 'Hello' });

      // RIFF header
      expect(result.toString('ascii', 0, 4)).toBe('RIFF');
      expect(result.readUInt32LE(4)).toBe(36 + fakePcm.length); // file size
      expect(result.toString('ascii', 8, 12)).toBe('WAVE');

      // fmt chunk
      expect(result.toString('ascii', 12, 16)).toBe('fmt ');
      expect(result.readUInt32LE(16)).toBe(16);     // chunk size
      expect(result.readUInt16LE(20)).toBe(1);       // PCM format
      expect(result.readUInt16LE(22)).toBe(1);       // mono
      expect(result.readUInt32LE(24)).toBe(24000);   // sample rate
      expect(result.readUInt32LE(28)).toBe(48000);   // byte rate (24000 * 2)
      expect(result.readUInt16LE(32)).toBe(2);       // block align
      expect(result.readUInt16LE(34)).toBe(16);      // bits per sample

      // data chunk
      expect(result.toString('ascii', 36, 40)).toBe('data');
      expect(result.readUInt32LE(40)).toBe(fakePcm.length);

      // actual PCM data after header
      expect(result.subarray(44)).toEqual(fakePcm);
    });

    it('accepts format "wav" without error', async () => {
      mockFetch.mockResolvedValue(geminiResponse(fakePcmBase64));

      const result = await provider.synthesize({ voiceId: 'Kore', text: 'Hello', format: 'wav' });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('throws when unsupported format is requested', async () => {
      await expect(
        provider.synthesize({ voiceId: 'Kore', text: 'Hello', format: 'mp3' }),
      ).rejects.toThrow('Gemini TTS only supports wav format, got: mp3');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws on non-200 response', async () => {
      mockFetch.mockResolvedValue(new Response('Bad Request', { status: 400 }));

      await expect(
        provider.synthesize({ voiceId: 'Kore', text: 'Hello' }),
      ).rejects.toThrow('Gemini TTS API error: 400 Bad Request');
    });

    it('throws when response has no audio data', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'no audio' }] } }],
      }), { status: 200 }));

      await expect(
        provider.synthesize({ voiceId: 'Kore', text: 'Hello' }),
      ).rejects.toThrow('Gemini TTS API error: no audio data in response');
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        provider.synthesize({ voiceId: 'Kore', text: 'Hello' }),
      ).rejects.toThrow('Network error');
    });
  });
});
