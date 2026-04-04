import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import * as S from '../../schemas/prompt.js';

const agentPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(S.AgentPrompt) },
    },
  }, async () => {
    return fastify.db.agentPrompts.list();
  });
};

export default agentPromptRoutes;
