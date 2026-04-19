import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import {
  Provider, ProviderTypeQuery, CreateProvider, UpdateProvider,
  SetKeyBody, GetKeyResponse, ProviderKeyTestResponse as ProviderKeyTestResponseSchema,
} from '../../schemas/provider.js';
import { StringIdParam, ErrorResponse } from '../../schemas/common.js';
import { createKeyTestResponse, testProviderKey } from '../../services/provider-key-validation.js';

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
    const existing = await fastify.db.providers.getById(request.body.id);
    if (existing) {
      return reply.conflict(`Provider ${request.body.id} already exists`);
    }
    const provider = await fastify.db.providers.create(request.body);
    return reply.status(201).send(provider);
  });

  // PUT /providers/:id/key - registered before /:id to avoid routing conflicts
  fastify.put('/:id/key', {
    schema: {
      params: StringIdParam,
      body: SetKeyBody,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const provider = await fastify.db.providers.getById(request.params.id);
    if (!provider) {
      return reply.notFound(`Provider ${request.params.id} not found`);
    }
    await fastify.db.providers.setKey(request.params.id, request.body.key);
    return reply.status(204).send(null);
  });

  // GET /providers/:id/key - registered before /:id to avoid routing conflicts
  fastify.get('/:id/key', {
    schema: {
      params: StringIdParam,
      response: {
        200: GetKeyResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const provider = await fastify.db.providers.getById(request.params.id);
    if (!provider) {
      return reply.notFound(`Provider ${request.params.id} not found`);
    }
    const key = await fastify.db.providers.getDecryptedKey(request.params.id);
    if (key === null) {
      return reply.notFound(`No API key set for provider ${request.params.id}`);
    }
    return { key };
  });

  // POST /providers/:id/key/test - registered before /:id to avoid routing conflicts
  fastify.post('/:id/key/test', {
    schema: {
      params: StringIdParam,
      response: {
        200: ProviderKeyTestResponseSchema,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const provider = await fastify.db.providers.getById(request.params.id);
    if (!provider) {
      return reply.notFound(`Provider ${request.params.id} not found`);
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(request.params.id);
    if (!apiKey) {
      return createKeyTestResponse(request.params.id, 'not_configured');
    }

    return testProviderKey(provider, apiKey, {
      createTTSProvider: fastify.createTTSProvider,
      createLLMProvider: fastify.createLLMProvider,
      createRealtimeProvider: fastify.createRealtimeProvider,
      onValidationError: (event) => {
        fastify.log.warn(event, 'Provider key validation failed');
      },
    });
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
    const existing = await fastify.db.providers.getById(request.params.id);
    if (!existing) {
      return reply.notFound(`Provider ${request.params.id} not found`);
    }
    const provider = await fastify.db.providers.update(request.params.id, request.body);
    return provider;
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
    const existing = await fastify.db.providers.getById(request.params.id);
    if (!existing) {
      return reply.notFound(`Provider ${request.params.id} not found`);
    }
    await fastify.db.providers.delete(request.params.id);
    return reply.status(204).send(null);
  });
};

export default providerRoutes;
