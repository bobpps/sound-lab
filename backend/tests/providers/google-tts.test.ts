import { GoogleTTSProvider } from '../../src/providers/tts/google.js';

// Mock the entire @google-cloud/text-to-speech module
const mockListVoices = vi.fn();
const mockSynthesizeSpeech = vi.fn();

vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: vi.fn().mockImplementation(() => ({
    listVoices: mockListVoices,
    synthesizeSpeech: mockSynthesizeSpeech,
  })),
}));

const FAKE_CREDENTIALS = JSON.stringify({
  client_email: 'test@test.iam.gserviceaccount.com',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n',
});

describe('GoogleTTSProvider', () => {
  let provider: GoogleTTSProvider;

  beforeEach(() => {
    provider = new GoogleTTSProvider(FAKE_CREDENTIALS);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('id and name', () => {
    it('has id "google"', () => {
      expect(provider.id).toBe('google');
    });

    it('has name "Google Cloud TTS"', () => {
      expect(provider.name).toBe('Google Cloud TTS');
    });
  });

  describe('constructor', () => {
    it('throws when apiKey is not valid JSON', () => {
      expect(() => new GoogleTTSProvider('not-json')).toThrow(
        'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
      );
    });

    it('throws when JSON lacks required fields', () => {
      expect(() => new GoogleTTSProvider(JSON.stringify({ foo: 'bar' }))).toThrow(
        'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
      );
    });

    it('throws when JSON parses to a non-object value', () => {
      expect(() => new GoogleTTSProvider('null')).toThrow(
        'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
      );
      expect(() => new GoogleTTSProvider('"string"')).toThrow(
        'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
      );
      expect(() => new GoogleTTSProvider('123')).toThrow(
        'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
      );
      expect(() => new GoogleTTSProvider('[]')).toThrow(
        'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
      );
    });
  });

  describe('validateCredentials', () => {
    it('returns true when listVoices succeeds', async () => {
      mockListVoices.mockResolvedValue([{ voices: [] }]);

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockListVoices).toHaveBeenCalledWith({ languageCode: 'en-US' });
    });

    it('returns false when listVoices throws', async () => {
      mockListVoices.mockRejectedValue(new Error('UNAUTHENTICATED'));

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });
  });

  describe('getVoices', () => {
    const googleVoicesResponse = [
      {
        voices: [
          {
            name: 'en-US-Wavenet-A',
            languageCodes: ['en-US'],
            ssmlGender: 'FEMALE',
            naturalSampleRateHertz: 24000,
          },
          {
            name: 'de-DE-Standard-B',
            languageCodes: ['de-DE'],
            ssmlGender: 'MALE',
            naturalSampleRateHertz: 24000,
          },
          {
            name: 'ja-JP-Neural2-C',
            languageCodes: ['ja-JP'],
            ssmlGender: 'NEUTRAL',
            naturalSampleRateHertz: 24000,
          },
        ],
      },
    ];

    it('returns mapped IVoice array', async () => {
      mockListVoices.mockResolvedValue(googleVoicesResponse);

      const voices = await provider.getVoices();

      expect(voices).toHaveLength(3);
      expect(voices[0]).toEqual({
        id: 'en-US-Wavenet-A',
        name: 'en-US-Wavenet-A',
        language: 'en-US',
        gender: 'female',
        description: undefined,
        previewUrl: undefined,
        providerMeta: {
          naturalSampleRateHertz: 24000,
          ssmlGender: 'FEMALE',
        },
      });
    });

    it('maps gender to lowercase', async () => {
      mockListVoices.mockResolvedValue(googleVoicesResponse);

      const voices = await provider.getVoices();

      expect(voices[0]!.gender).toBe('female');
      expect(voices[1]!.gender).toBe('male');
      expect(voices[2]!.gender).toBe('neutral');
    });

    it('handles numeric ssmlGender enum values', async () => {
      mockListVoices.mockResolvedValue([
        {
          voices: [
            {
              name: 'en-US-Wavenet-A',
              languageCodes: ['en-US'],
              ssmlGender: 1,
              naturalSampleRateHertz: 24000,
            },
            {
              name: 'en-US-Wavenet-B',
              languageCodes: ['en-US'],
              ssmlGender: 2,
              naturalSampleRateHertz: 24000,
            },
            {
              name: 'en-US-Wavenet-C',
              languageCodes: ['en-US'],
              ssmlGender: 3,
              naturalSampleRateHertz: 24000,
            },
            {
              name: 'en-US-Wavenet-D',
              languageCodes: ['en-US'],
              ssmlGender: 0,
              naturalSampleRateHertz: 24000,
            },
          ],
        },
      ]);

      const voices = await provider.getVoices();

      expect(voices[0]!.gender).toBe('male');
      expect(voices[1]!.gender).toBe('female');
      expect(voices[2]!.gender).toBe('neutral');
      expect(voices[3]!.gender).toBeUndefined();
    });

    it('returns empty array when no voices returned', async () => {
      mockListVoices.mockResolvedValue([{ voices: [] }]);

      const voices = await provider.getVoices();

      expect(voices).toEqual([]);
    });

    it('handles null voices array', async () => {
      mockListVoices.mockResolvedValue([{ voices: null }]);

      const voices = await provider.getVoices();

      expect(voices).toEqual([]);
    });

    it('filters out voices with null name', async () => {
      mockListVoices.mockResolvedValue([
        {
          voices: [
            {
              name: 'en-US-Wavenet-A',
              languageCodes: ['en-US'],
              ssmlGender: 'FEMALE',
              naturalSampleRateHertz: 24000,
            },
            {
              name: null,
              languageCodes: ['en-US'],
              ssmlGender: 'MALE',
              naturalSampleRateHertz: 24000,
            },
          ],
        },
      ]);

      const voices = await provider.getVoices();

      expect(voices).toHaveLength(1);
      expect(voices[0]!.id).toBe('en-US-Wavenet-A');
    });

    it('calls listVoices with empty request', async () => {
      mockListVoices.mockResolvedValue([{ voices: [] }]);

      await provider.getVoices();

      expect(mockListVoices).toHaveBeenCalledWith({});
    });

    it('throws on API error', async () => {
      mockListVoices.mockRejectedValue(new Error('API unavailable'));

      await expect(provider.getVoices()).rejects.toThrow(
        'Google TTS API error: API unavailable',
      );
    });
  });

  describe('synthesize', () => {
    const fakeAudioContent = new Uint8Array([0x49, 0x44, 0x33, 0x04]);

    it('returns audio Buffer for valid request', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      const result = await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello world',
      });

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(Buffer.from(fakeAudioContent));
    });

    it('sends correct request with defaults', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello world',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith({
        input: { text: 'Hello world' },
        voice: { languageCode: 'en-US', name: 'en-US-Wavenet-A' },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
        },
      });
    });

    it('extracts languageCode from voiceId prefix', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'de-DE-Standard-B',
        text: 'Hallo Welt',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: { languageCode: 'de-DE', name: 'de-DE-Standard-B' },
        }),
      );
    });

    it('extracts languageCode from three-part locale voiceId', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'cmn-CN-Wavenet-A',
        text: 'Hello',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-A' },
        }),
      );
    });

    it('uses custom speed as speakingRate', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello',
        speed: 1.5,
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({ speakingRate: 1.5 }),
        }),
      );
    });

    it('maps format string to audioEncoding', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello',
        format: 'OGG_OPUS',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({ audioEncoding: 'OGG_OPUS' }),
        }),
      );
    });

    it('includes sampleRateHertz when sampleRate is provided', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello',
        sampleRate: 16000,
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({ sampleRateHertz: 16000 }),
        }),
      );
    });

    it('does not include sampleRateHertz when sampleRate is not provided', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello',
      });

      const callArgs = mockSynthesizeSpeech.mock.calls[0]![0];
      expect(callArgs.audioConfig).not.toHaveProperty('sampleRateHertz');
    });

    it('throws on empty audio response', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: null }]);

      await expect(
        provider.synthesize({ voiceId: 'en-US-Wavenet-A', text: 'Hello' }),
      ).rejects.toThrow('Google TTS API error: empty audio response');
    });

    it('throws on API error', async () => {
      mockSynthesizeSpeech.mockRejectedValue(new Error('Quota exceeded'));

      await expect(
        provider.synthesize({ voiceId: 'en-US-Wavenet-A', text: 'Hello' }),
      ).rejects.toThrow('Google TTS API error: Quota exceeded');
    });
  });
});
