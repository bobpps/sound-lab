import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AnnotationPrompt } from '../../schemas/prompt.js';

const annotationPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(AnnotationPrompt) },
    },
  }, async () => {
    return fastify.db.annotationPrompts.list();
  });
};

export default annotationPromptRoutes;
