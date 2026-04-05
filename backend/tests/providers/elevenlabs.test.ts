import { ElevenLabsTTSProvider } from '../../src/providers/tts/elevenlabs.js';

describe('ElevenLabsTTSProvider', () => {
  let provider: ElevenLabsTTSProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    provider = new ElevenLabsTTSProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "elevenlabs"', () => {
      expect(provider.id).toBe('elevenlabs');
    });

    it('has name "ElevenLabs"', () => {
      expect(provider.name).toBe('ElevenLabs');
    });
  });

  describe('validateCredentials', () => {
    it('returns true when API returns 200', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/user',
        { headers: { 'xi-api-key': 'test-api-key' } },
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
    const voicesResponse = {
      voices: [
        {
          voice_id: 'voice-1',
          name: 'Rachel',
          category: 'professional',
          labels: { gender: 'female', accent: 'American', age: 'young' },
          description: 'A warm voice',
          preview_url: 'https://example.com/rachel.mp3',
          verified_languages: [{ language: 'en', locale: 'en-US' }],
          settings: { stability: 0.5, similarity_boost: 0.75 },
        },
        {
          voice_id: 'voice-2',
          name: 'Adam',
          category: 'premade',
          labels: { gender: 'male' },
          description: null,
          preview_url: null,
          verified_languages: [],
        },
      ],
    };

    it('returns mapped IVoice array', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices).toHaveLength(2);
      expect(voices[0]).toEqual({
        id: 'voice-1',
        name: 'Rachel',
        language: 'en-US',
        gender: 'female',
        description: 'A warm voice',
        previewUrl: 'https://example.com/rachel.mp3',
        providerMeta: {
          category: 'professional',
          labels: { gender: 'female', accent: 'American', age: 'young' },
          settings: { stability: 0.5, similarity_boost: 0.75 },
        },
      });
    });

    it('handles voice with missing optional fields', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices[1]).toEqual({
        id: 'voice-2',
        name: 'Adam',
        language: 'en',
        gender: 'male',
        description: undefined,
        previewUrl: undefined,
        providerMeta: {
          category: 'premade',
          labels: { gender: 'male' },
          settings: undefined,
        },
      });
    });

    it('sends correct request with API key', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ voices: [] }), { status: 200 }),
      );

      await provider.getVoices();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/voices',
        { headers: { 'xi-api-key': 'test-api-key' } },
      );
    });

    it('returns empty array for empty voice list', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ voices: [] }), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices).toEqual([]);
    });

    it('throws on non-200 response', async () => {
      mockFetch.mockResolvedValue(
        new Response('Server Error', { status: 500 }),
      );

      await expect(provider.getVoices()).rejects.toThrow(
        'ElevenLabs API error: 500',
      );
    });
  });
});
