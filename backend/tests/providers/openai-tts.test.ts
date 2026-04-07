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
    const voicesResponse = [
      {
        voice_id: 'alloy',
        name: 'Alloy',
        type: 'builtin',
        description: 'A neutral and balanced voice',
      },
      {
        voice_id: 'nova',
        name: 'Nova',
        type: 'builtin',
        description: 'A warm and expressive voice',
      },
    ];

    it('fetches from OpenAI voices endpoint with Bearer auth', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      await provider.getVoices();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/voices',
        { headers: { Authorization: 'Bearer test-api-key' } },
      );
    });

    it('returns mapped IVoice array from API response', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices).toHaveLength(2);
      expect(voices[0]).toEqual({
        id: 'alloy',
        name: 'Alloy',
        language: 'multi',
        gender: undefined,
        description: 'A neutral and balanced voice',
        previewUrl: undefined,
        providerMeta: { type: 'builtin' },
      });
    });

    it('falls back to static voice list when API returns non-200', async () => {
      mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));

      const voices = await provider.getVoices();

      expect(voices).toHaveLength(13);
      expect(voices.map((v) => v.id)).toEqual([
        'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable',
        'onyx', 'nova', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
      ]);
    });

    it('falls back to static voice list when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const voices = await provider.getVoices();

      expect(voices).toHaveLength(13);
    });

    it('static fallback voices have correct structure', async () => {
      mockFetch.mockResolvedValue(new Response('Error', { status: 500 }));

      const voices = await provider.getVoices();
      const alloy = voices.find((v) => v.id === 'alloy')!;

      expect(alloy.name).toBe('Alloy');
      expect(alloy.language).toBe('multi');
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
