import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply } from 'fastify';
import {
  LLMProviderIdParam,
  CompleteBody,
  CompleteResponse,
  ModelsResponse,
} from '../../schemas/llm.js';
import { ErrorResponse } from '../../schemas/common.js';
import type { ILLMProvider } from '../../providers/llm/types.js';

const llmRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  async function resolveLLMProvider(
    providerId: string,
    reply: FastifyReply,
  ): Promise<ILLMProvider | null> {
    const provider = await fastify.db.providers.getById(providerId);
    if (!provider || provider.type !== 'llm') {
      reply.notFound(`LLM provider ${providerId} not found`);
      return null;
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      reply.badRequest(`No API key configured for provider ${providerId}`);
      return null;
    }

    try {
      return fastify.createLLMProvider(providerId, apiKey);
    } catch {
      reply.badRequest(`Provider ${providerId} is not supported`);
      return null;
    }
  }

  // GET /llm/:providerId/models
  fastify.get('/:providerId/models', {
    schema: {
      params: LLMProviderIdParam,
      response: {
        200: ModelsResponse,
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const llm = await resolveLLMProvider(request.params.providerId, reply);
    if (!llm) return;

    const models = await llm.getModels();
    return models;
  });

  // POST /llm/:providerId/complete
  fastify.post('/:providerId/complete', {
    schema: {
      params: LLMProviderIdParam,
      body: CompleteBody,
      response: {
        200: CompleteResponse,
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const llm = await resolveLLMProvider(request.params.providerId, reply);
    if (!llm) return;

    const hasNonSystemMessage = request.body.messages.some((m) => m.role !== 'system');
    if (!hasNonSystemMessage) {
      reply.badRequest('Messages must contain at least one non-system message');
      return;
    }

    const text = await llm.complete(request.body.messages, request.body.model);
    return { text };
  });
};

export default llmRoutes;
