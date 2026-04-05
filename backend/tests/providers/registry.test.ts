import { createTTSProvider, getSupportedTTSProviders } from '../../src/providers/tts/registry.js';
import { ElevenLabsTTSProvider } from '../../src/providers/tts/elevenlabs.js';

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

    it('throws for unsupported provider ID', () => {
      expect(() => createTTSProvider('unknown', 'key')).toThrow(
        'Unsupported TTS provider: unknown',
      );
    });
  });

  describe('getSupportedTTSProviders', () => {
    it('returns array containing "elevenlabs"', () => {
      const providers = getSupportedTTSProviders();

      expect(providers).toEqual(['elevenlabs']);
    });
  });
});
