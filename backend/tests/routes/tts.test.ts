import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';
import type { IVoice } from '../../src/providers/tts/types.js';

const mockGetVoices = vi.fn<() => Promise<IVoice[]>>();
const mockSynthesize = vi.fn<() => Promise<Buffer>>();

vi.mock('../../src/providers/tts/registry.js', () => ({
  createTTSProvider: vi.fn(() => ({
    id: 'test-provider',
    name: 'Test Provider',
    getVoices: mockGetVoices,
    synthesize: mockSynthesize,
    validateCredentials: vi.fn().mockResolvedValue(true),
  })),
}));

describe('TTS routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  async function seedTTSProvider(id = 'elevenlabs', name = 'ElevenLabs') {
    await app.db.providers.create({ id, name, type: 'tts' });
    await app.db.providers.setKey(id, 'test-api-key');
  }

  describe('GET /tts/:providerId/voices', () => {
    it('returns voices from the TTS provider', async () => {
      await seedTTSProvider();
      const voices: IVoice[] = [
        { id: 'v1', name: 'Alice', language: 'en' },
        { id: 'v2', name: 'Bob', language: 'en', gender: 'male' },
      ];
      mockGetVoices.mockResolvedValueOnce(voices);

      const res = await app.inject({
        method: 'GET',
        url: '/tts/elevenlabs/voices',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(voices);
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/tts/nonexistent/voices',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not TTS type', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      await app.db.providers.setKey('openai', 'test-key');

      const res = await app.inject({
        method: 'GET',
        url: '/tts/openai/voices',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      // No setKey call — key is null

      const res = await app.inject({
        method: 'GET',
        url: '/tts/elevenlabs/voices',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /tts/:providerId/synthesize', () => {
    it('returns audio buffer with correct content-type', async () => {
      await seedTTSProvider();
      const audioBuffer = Buffer.from('fake-audio-data');
      mockSynthesize.mockResolvedValueOnce(audioBuffer);

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1', text: 'Hello world' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('audio/mpeg');
      expect(Buffer.from(res.rawPayload)).toEqual(audioBuffer);
    });

    it('passes all options to the provider', async () => {
      await seedTTSProvider();
      mockSynthesize.mockResolvedValueOnce(Buffer.from('audio'));

      const payload = {
        voiceId: 'v1',
        text: 'Hello',
        speed: 1.2,
        temperature: 0.7,
        format: 'mp3',
        sampleRate: 44100,
      };

      await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload,
      });

      expect(mockSynthesize).toHaveBeenCalledWith(payload);
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tts/nonexistent/synthesize',
        payload: { voiceId: 'v1', text: 'Hello' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not TTS type', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      await app.db.providers.setKey('openai', 'test-key');

      const res = await app.inject({
        method: 'POST',
        url: '/tts/openai/synthesize',
        payload: { voiceId: 'v1', text: 'Hello' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1', text: 'Hello' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when body is missing required fields', async () => {
      await seedTTSProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1' }, // missing text
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when text is empty', async () => {
      await seedTTSProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1', text: '' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
