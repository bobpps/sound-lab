import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  AnnotatedDialogWithMessages,
  AnnotatedMessage,
  AnnotationIdParam,
  AnnotationMessageIdParam,
  CreateAnnotatedMessage,
  UpdateAnnotatedMessage,
} from '../../schemas/annotation.js';
import { ErrorResponse } from '../../schemas/common.js';

const annotationRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /annotations/:id
  fastify.get('/:id', {
    schema: {
      params: AnnotationIdParam,
      response: {
        200: AnnotatedDialogWithMessages,
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    return annotation;
  });

  // DELETE /annotations/:id
  fastify.delete('/:id', {
    schema: {
      params: AnnotationIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!existing) throw fastify.httpErrors.notFound('Annotation not found');
    await fastify.db.annotations.delete(request.params.id);
    reply.status(204);
  });
};

export default annotationRoutes;
