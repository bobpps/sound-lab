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
});
