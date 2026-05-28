import { OpenAITTSProvider } from '../../src/providers/tts/openai.js';

describe('OpenAITTSProvider', () => {
  let provider: OpenAITTSProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    provider = new OpenAITTSProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "openai-tts"', () => {
      expect(provider.id).toBe('openai-tts');
    });

    it('has name "OpenAI TTS"', () => {
      expect(provider.name).toBe('OpenAI TTS');
    });
  });

  describe('validateCredentials', () => {
    it('returns true when API returns 200', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        { headers: { Authorization: 'Bearer test-api-key' } },
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

  describe('getVoices', () => {
    it('returns 13 built-in voices', async () => {
      const voices = await provider.getVoices();

      expect(voices).toHaveLength(13);
      expect(voices.map((v) => v.id)).toEqual([
        'alloy', 'ash', 'coral', 'echo', 'fable',
        'onyx', 'nova', 'sage', 'shimmer',
        'ballad', 'verse', 'marin', 'cedar',
      ]);
    });

    it('does not call fetch', async () => {
      await provider.getVoices();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('voices have correct structure', async () => {
      const voices = await provider.getVoices();
      const alloy = voices.find((v) => v.id === 'alloy')!;

      expect(alloy).toEqual({
        id: 'alloy',
        name: 'Alloy',
        language: 'multi',
        gender: undefined,
        description: undefined,
        previewUrl: undefined,
        providerMeta: {
          type: 'builtin',
          supportedModels: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
        },
      });
    });

    it('universal voices support all 3 models', async () => {
      const voices = await provider.getVoices();
      const universal = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

      for (const id of universal) {
        const voice = voices.find((v) => v.id === id)!;
        expect(voice.providerMeta!.supportedModels).toEqual(
          ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
        );
      }
    });

    it('mini-tts-only voices support only gpt-4o-mini-tts', async () => {
      const voices = await provider.getVoices();
      const miniOnly = ['ballad', 'verse', 'marin', 'cedar'];

      for (const id of miniOnly) {
        const voice = voices.find((v) => v.id === id)!;
        expect(voice.providerMeta!.supportedModels).toEqual(['gpt-4o-mini-tts']);
      }
    });

    it('filters voices by model', async () => {
      const voices = await provider.getVoices('tts-1');

      expect(voices).toHaveLength(9);
      expect(voices.map((v) => v.id)).not.toContain('ballad');
    });
  });

  describe('getModels', () => {
    it('returns supported models', async () => {
      await expect(provider.getModels()).resolves.toEqual([
        'gpt-4o-mini-tts',
        'tts-1',
        'tts-1-hd',
      ]);
    });
  });

  describe('synthesize', () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]);

    it('sends POST to OpenAI speech endpoint', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'alloy', text: 'Hello' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/speech',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
        }),
      );
    });

    it('sends built-in voice as string', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'alloy', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.voice).toBe('alloy');
    });

    it('sends custom voice as object with id', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'voice_123abc', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.voice).toEqual({ id: 'voice_123abc' });
    });

    it('sends correct body with defaults', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'alloy', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: 'Hello',
        response_format: 'mp3',
        speed: 1.0,
      });
    });

    it('returns Buffer from response', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      const result = await provider.synthesize({ voiceId: 'alloy', text: 'Hello' });

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(Buffer.from(fakeAudio));
    });

    it('uses provided model when specified', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'alloy', text: 'Hello', model: 'tts-1-hd' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('tts-1-hd');
    });

    it('uses provided format as response_format', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'alloy', text: 'Hello', format: 'opus' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.response_format).toBe('opus');
    });

    it('maps speed parameter, defaults to 1.0', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'alloy', text: 'Hello', speed: 1.5 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.speed).toBe(1.5);
    });

    it('clamps speed to minimum 0.25', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'alloy', text: 'Hello', speed: 0.1 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.speed).toBe(0.25);
    });

    it('clamps speed to maximum 4.0', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'alloy', text: 'Hello', speed: 5.0 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.speed).toBe(4.0);
    });

    it('throws on non-200 response', async () => {
      mockFetch.mockResolvedValue(new Response('Bad Request', { status: 400 }));

      await expect(
        provider.synthesize({ voiceId: 'alloy', text: 'Hello' }),
      ).rejects.toThrow('OpenAI TTS API error: 400 Bad Request');
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        provider.synthesize({ voiceId: 'alloy', text: 'Hello' }),
      ).rejects.toThrow('Network error');
    });
  });
});
