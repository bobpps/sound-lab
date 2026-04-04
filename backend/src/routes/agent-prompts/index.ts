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
};

export default agentPromptRoutes;
