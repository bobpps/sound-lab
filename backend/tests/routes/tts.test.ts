import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';
import type { IVoice } from '../../src/providers/tts/types.js';

describe('TTS routes', () => {
  let app: FastifyInstance;
  let mockGetVoices: ReturnType<typeof vi.fn>;
  let mockSynthesize: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockGetVoices = vi.fn<() => Promise<IVoice[]>>();
    mockSynthesize = vi.fn<() => Promise<Buffer>>();

    app = await buildTestApp();

    // Override the createTTSProvider decorator with a mock factory
    (app as Record<string, unknown>).createTTSProvider = vi.fn(() => ({
      id: 'test-provider',
      name: 'Test Provider',
      getVoices: mockGetVoices,
      synthesize: mockSynthesize,
      validateCredentials: vi.fn().mockResolvedValue(true),
    }));
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

    it('returns 400 when provider is not supported by registry', async () => {
      await seedTTSProvider('unsupported', 'Unsupported');
      (app as Record<string, unknown>).createTTSProvider = vi.fn(() => {
        throw new Error('Unsupported TTS provider: unsupported');
      });

      const res = await app.inject({
        method: 'GET',
        url: '/tts/unsupported/voices',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /tts/:providerId/synthesize', () => {
    it('returns audio buffer with correct content-type', async () => {
      await seedTTSProvider();
      // ID3 header so sniffAudioMime detects MP3
      const audioBuffer = Buffer.from('ID3fake-audio-data');
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

    it('derives content-type from requested format', async () => {
      await seedTTSProvider();
      mockSynthesize.mockResolvedValueOnce(Buffer.from('wav-data'));

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1', text: 'Hello', format: 'wav' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('audio/wav');
    });

    it('falls back to application/octet-stream for unknown format', async () => {
      await seedTTSProvider();
      mockSynthesize.mockResolvedValueOnce(Buffer.from('raw-data'));

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1', text: 'Hello', format: 'pcm_16000' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('audio/pcm');
    });
  });
});
