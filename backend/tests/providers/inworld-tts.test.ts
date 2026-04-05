import { InworldTTSProvider } from '../../src/providers/tts/inworld.js';

describe('InworldTTSProvider', () => {
  let provider: InworldTTSProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    provider = new InworldTTSProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "inworld"', () => {
      expect(provider.id).toBe('inworld');
    });

    it('has name "Inworld"', () => {
      expect(provider.name).toBe('Inworld');
    });
  });

  describe('validateCredentials', () => {
    it('returns true when API returns 200', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ voices: [] }), { status: 200 }));

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.inworld.ai/tts/v1/voices',
        { headers: { Authorization: 'Basic test-api-key' } },
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
          voiceId: 'voice-1',
          displayName: 'Luna',
          languages: ['en-US', 'es-ES'],
          description: 'A warm conversational voice',
          tags: ['female', 'conversational', 'warm'],
          isCustom: false,
        },
        {
          voiceId: 'voice-2',
          displayName: 'Atlas',
          languages: ['en-GB'],
          description: null,
          tags: ['male', 'authoritative'],
          isCustom: true,
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
        name: 'Luna',
        language: 'en-US',
        gender: 'female',
        description: 'A warm conversational voice',
        previewUrl: undefined,
        providerMeta: {
          languages: ['en-US', 'es-ES'],
          tags: ['female', 'conversational', 'warm'],
          isCustom: false,
        },
      });
    });

    it('extracts male gender from tags', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices[1].gender).toBe('male');
    });

    it('uses first language from array and falls back to en', async () => {
      const responseWithEmpty = {
        voices: [
          {
            voiceId: 'voice-3',
            displayName: 'Echo',
            languages: [],
            description: null,
            tags: [],
            isCustom: false,
          },
        ],
      };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(responseWithEmpty), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices[0].language).toBe('en');
    });

    it('handles voice with no tags and null description', async () => {
      const responseNoTags = {
        voices: [
          {
            voiceId: 'voice-4',
            displayName: 'Silent',
            languages: ['fr-FR'],
            description: null,
            tags: [],
            isCustom: false,
          },
        ],
      };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(responseNoTags), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices[0]).toEqual({
        id: 'voice-4',
        name: 'Silent',
        language: 'fr-FR',
        gender: undefined,
        description: undefined,
        previewUrl: undefined,
        providerMeta: {
          languages: ['fr-FR'],
          tags: [],
          isCustom: false,
        },
      });
    });

    it('sends correct auth header', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ voices: [] }), { status: 200 }),
      );

      await provider.getVoices();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.inworld.ai/tts/v1/voices',
        { headers: { Authorization: 'Basic test-api-key' } },
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
        'Inworld API error: 500 Server Error',
      );
    });
  });

  describe('synthesize', () => {
    const fakeBase64 = Buffer.from('hello audio').toString('base64');
    const synthesizeResponse = {
      audioContent: fakeBase64,
      usage: { processedCharactersCount: 11, modelId: 'inworld-tts-1.5-max' },
    };

    it('returns Buffer from base64 audioContent', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      const result = await provider.synthesize({
        voiceId: 'voice-1',
        text: 'Hello world',
      });

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(Buffer.from('hello audio'));
    });

    it('sends correct URL and auth header', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.inworld.ai/tts/v1/voice',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic test-api-key',
          },
        }),
      );
    });

    it('sends correct body with defaults', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        text: 'Hello',
        voiceId: 'voice-1',
        modelId: 'inworld-tts-1.5-max',
      });
    });

    it('includes audioConfig when speed is provided', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello', speed: 1.2 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig).toEqual({ speakingRate: 1.2 });
    });

    it('clamps speed to minimum 0.5', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello', speed: 0.1 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig.speakingRate).toBe(0.5);
    });

    it('clamps speed to maximum 1.5', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello', speed: 3.0 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig.speakingRate).toBe(1.5);
    });

    it('passes temperature directly when provided', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello', temperature: 0.7 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.temperature).toBe(0.7);
    });

    it('omits temperature when not provided', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.temperature).toBeUndefined();
    });

    it('maps format to uppercase in audioConfig', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello', format: 'mp3' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig.audioEncoding).toBe('MP3');
    });

    it('maps sampleRate to sampleRateHertz in audioConfig', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello', sampleRate: 24000 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig.sampleRateHertz).toBe(24000);
    });

    it('builds combined audioConfig with all options', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({
        voiceId: 'voice-1',
        text: 'Hello',
        speed: 1.1,
        format: 'wav',
        sampleRate: 16000,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig).toEqual({
        speakingRate: 1.1,
        audioEncoding: 'WAV',
        sampleRateHertz: 16000,
      });
    });

    it('omits audioConfig when no options provided', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig).toBeUndefined();
    });

    it('throws on non-200 response', async () => {
      mockFetch.mockResolvedValue(
        new Response('Bad Request', { status: 400 }),
      );

      await expect(
        provider.synthesize({ voiceId: 'voice-1', text: 'Hello' }),
      ).rejects.toThrow('Inworld API error: 400 Bad Request');
    });
  });
});
