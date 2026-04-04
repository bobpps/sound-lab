import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AnnotationPrompt } from '../../schemas/prompt.js';
import { IdParam, ErrorResponse } from '../../schemas/common.js';

const annotationPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(AnnotationPrompt) },
    },
  }, async () => {
    return fastify.db.annotationPrompts.list();
  });

  fastify.get('/:id', {
    schema: {
      params: IdParam,
      response: {
        200: AnnotationPrompt,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const prompt = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!prompt) {
      return reply.notFound('Annotation prompt not found');
    }
    return prompt;
  });
};

export default annotationPromptRoutes;
