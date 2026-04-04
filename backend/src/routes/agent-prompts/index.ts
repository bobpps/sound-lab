import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import * as S from '../../schemas/prompt.js';
import { IdParam, ErrorResponse } from '../../schemas/common.js';

const agentPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(S.AgentPrompt) },
    },
  }, async () => {
    return fastify.db.agentPrompts.list();
  });

  fastify.post('/', {
    schema: {
      body: S.CreateAgentPrompt,
      response: {
        201: S.AgentPrompt,
      },
    },
  }, async (req, reply) => {
    const prompt = await fastify.db.agentPrompts.create(req.body);
    return reply.status(201).send(prompt);
  });

  fastify.get('/:id', {
    schema: {
      params: IdParam,
      response: {
        200: S.AgentPrompt,
        404: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const prompt = await fastify.db.agentPrompts.getById(req.params.id);
    if (!prompt) return reply.notFound();
    return prompt;
  });
  fastify.put('/:id', {
    schema: {
      params: IdParam,
      body: S.UpdateAgentPrompt,
      response: {
        200: S.AgentPrompt,
        404: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const existing = await fastify.db.agentPrompts.getById(req.params.id);
    if (!existing) return reply.notFound();
    const updated = await fastify.db.agentPrompts.update(req.params.id, req.body);
    return updated;
  });

  fastify.delete('/:id', {
    schema: {
      params: IdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const existing = await fastify.db.agentPrompts.getById(req.params.id);
    if (!existing) return reply.notFound();
    await fastify.db.agentPrompts.delete(req.params.id);
    return reply.status(204).send();
  });
};

export default agentPromptRoutes;
