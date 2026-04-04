import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt } from '../../schemas/prompt.js';
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

  fastify.post('/', {
    schema: {
      body: CreateAnnotationPrompt,
      response: {
        201: AnnotationPrompt,
      },
    },
  }, async (request, reply) => {
    const prompt = await fastify.db.annotationPrompts.create(request.body);
    return reply.status(201).send(prompt);
  });

  fastify.put('/:id', {
    schema: {
      params: IdParam,
      body: UpdateAnnotationPrompt,
      response: {
        200: AnnotationPrompt,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!existing) {
      return reply.notFound('Annotation prompt not found');
    }
    const updated = await fastify.db.annotationPrompts.update(request.params.id, request.body);
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
  }, async (request, reply) => {
    const existing = await fastify.db.annotationPrompts.getById(request.params.id);
    if (!existing) {
      return reply.notFound('Annotation prompt not found');
    }
    await fastify.db.annotationPrompts.delete(request.params.id);
    return reply.status(204).send();
  });
};

export default annotationPromptRoutes;
