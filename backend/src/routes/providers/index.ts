import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { Provider, ProviderTypeQuery, CreateProvider, UpdateProvider } from '../../schemas/provider.js';
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

  // POST /providers
  fastify.post('/', {
    schema: {
      body: CreateProvider,
      response: {
        201: Provider,
        409: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    try {
      const provider = await fastify.db.providers.create(request.body);
      return reply.status(201).send(provider);
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        return reply.conflict(`Provider ${request.body.id} already exists`);
      }
      throw err;
    }
  });

  // PUT /providers/:id
  fastify.put('/:id', {
    schema: {
      params: StringIdParam,
      body: UpdateProvider,
      response: {
        200: Provider,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    try {
      const provider = await fastify.db.providers.update(request.params.id, request.body);
      return provider;
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return reply.notFound(`Provider ${request.params.id} not found`);
      }
      throw err;
    }
  });

  // DELETE /providers/:id
  fastify.delete('/:id', {
    schema: {
      params: StringIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    await fastify.db.providers.delete(request.params.id);
    return reply.status(204).send();
  });
};

export default providerRoutes;
