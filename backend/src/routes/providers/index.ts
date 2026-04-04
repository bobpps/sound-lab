import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { Provider, ProviderTypeQuery } from '../../schemas/provider.js';
import { StringIdParam, ErrorResponse } from '../../schemas/common.js';

const providerRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /providers?type=tts
  fastify.get('/', {
    schema: {
      querystring: ProviderTypeQuery,
      response: { 200: Type.Array(Provider) },
    },
  }, async (request) => {
    return fastify.db.providers.list(request.query.type);
  });

  // GET /providers/:id
  fastify.get('/:id', {
    schema: {
      params: StringIdParam,
      response: {
        200: Provider,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const provider = await fastify.db.providers.getById(request.params.id);
    if (!provider) {
      return reply.notFound(`Provider ${request.params.id} not found`);
    }
    return provider;
  });
};

export default providerRoutes;
