import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { ProviderIdParam, Voice, SynthesizeBody } from '../../schemas/tts.js';
import { ErrorResponse } from '../../schemas/common.js';

const ttsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
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
    const { providerId } = request.params;

    const provider = await fastify.db.providers.getById(providerId);
    if (!provider || provider.type !== 'tts') {
      return reply.notFound(`TTS provider ${providerId} not found`);
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      return reply.badRequest(`No API key configured for provider ${providerId}`);
    }

    const tts = fastify.createTTSProvider(providerId, apiKey);
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
    const { providerId } = request.params;

    const provider = await fastify.db.providers.getById(providerId);
    if (!provider || provider.type !== 'tts') {
      return reply.notFound(`TTS provider ${providerId} not found`);
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      return reply.badRequest(`No API key configured for provider ${providerId}`);
    }

    const tts = fastify.createTTSProvider(providerId, apiKey);
    const audio = await tts.synthesize(request.body);
    // Binary response — no 200 schema defined, so we bypass TypeBox's strict send() typing
    void reply.type('audio/mpeg');
    return reply.send(audio as never);
  });
};

export default ttsRoutes;
