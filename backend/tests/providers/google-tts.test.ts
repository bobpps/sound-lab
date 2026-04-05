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
    vi.restoreAllMocks();
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
});
