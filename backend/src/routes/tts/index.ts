import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ProviderIdParam, Voice, SynthesizeBody } from '../../schemas/tts.js';
import { ErrorResponse } from '../../schemas/common.js';
import type { ITTSProvider } from '../../providers/tts/types.js';

const FORMAT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  pcm: 'audio/pcm',
  linear16: 'audio/wav',
  ogg_opus: 'audio/ogg',
  aac: 'audio/aac',
  opus: 'audio/opus',
};

function audioContentType(format?: string): string {
  if (!format) return 'audio/mpeg';
  const key = format.toLowerCase().split('_')[0];
  return FORMAT_MIME[key] ?? FORMAT_MIME[format.toLowerCase()] ?? 'application/octet-stream';
}

const ttsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  async function resolveTTSProvider(
    providerId: string,
    reply: FastifyReply,
  ): Promise<ITTSProvider | null> {
    const provider = await fastify.db.providers.getById(providerId);
    if (!provider || provider.type !== 'tts') {
      reply.notFound(`TTS provider ${providerId} not found`);
      return null;
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      reply.badRequest(`No API key configured for provider ${providerId}`);
      return null;
    }

    try {
      return fastify.createTTSProvider(providerId, apiKey);
    } catch {
      reply.badRequest(`Provider ${providerId} is not supported`);
      return null;
    }
  }

  // GET /tts/:providerId/voices
  fastify.get('/:providerId/voices', {
    schema: {
      params: ProviderIdParam,
      response: {
        200: Type.Array(Voice),
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const tts = await resolveTTSProvider(request.params.providerId, reply);
    if (!tts) return;

    const voices = await tts.getVoices();
    return voices;
  });

  // POST /tts/:providerId/synthesize
  fastify.post('/:providerId/synthesize', {
    schema: {
      params: ProviderIdParam,
      body: SynthesizeBody,
      response: {
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const tts = await resolveTTSProvider(request.params.providerId, reply);
    if (!tts) return;

    const audio = await tts.synthesize(request.body);
    void reply.type(audioContentType(request.body.format));
    return reply.send(audio as never);
  });
};

export default ttsRoutes;
