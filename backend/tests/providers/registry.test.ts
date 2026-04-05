import { createTTSProvider, getSupportedTTSProviders } from '../../src/providers/tts/registry.js';
import { ElevenLabsTTSProvider } from '../../src/providers/tts/elevenlabs.js';
import { GoogleTTSProvider } from '../../src/providers/tts/google.js';

// Mock Google TTS client so GoogleTTSProvider constructor doesn't need real credentials
vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: vi.fn().mockImplementation(() => ({
    listVoices: vi.fn(),
    synthesizeSpeech: vi.fn(),
  })),
}));

describe('TTS Provider Registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTTSProvider', () => {
    it('returns ElevenLabsTTSProvider for "elevenlabs"', () => {
      const provider = createTTSProvider('elevenlabs', 'test-key');

      expect(provider).toBeInstanceOf(ElevenLabsTTSProvider);
      expect(provider.id).toBe('elevenlabs');
    });

    it('returns GoogleTTSProvider for "google"', () => {
      const credentials = JSON.stringify({
        client_email: 'test@test.iam.gserviceaccount.com',
        private_key: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n',
      });

      const provider = createTTSProvider('google', credentials);

      expect(provider).toBeInstanceOf(GoogleTTSProvider);
      expect(provider.id).toBe('google');
    });

    it('throws for unsupported provider ID', () => {
      expect(() => createTTSProvider('unknown', 'key')).toThrow(
        'Unsupported TTS provider: unknown',
      );
    });
  });

  describe('getSupportedTTSProviders', () => {
    it('returns array containing all registered providers', () => {
      const providers = getSupportedTTSProviders();

      expect(providers).toContain('elevenlabs');
      expect(providers).toContain('google');
      expect(providers).toHaveLength(2);
    });
  });
});
