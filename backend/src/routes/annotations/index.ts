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

  // POST /annotations/:id/messages
  fastify.post('/:id/messages', {
    schema: {
      params: AnnotationIdParam,
      body: CreateAnnotatedMessage,
      response: {
        201: AnnotatedMessage,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    const msg = await fastify.db.annotations.createMessage({
      annotated_dialog_id: request.params.id,
      ...request.body,
    });
    reply.status(201);
    return msg;
  });

  // PUT /annotations/:id/messages/:messageId
  fastify.put('/:id/messages/:messageId', {
    schema: {
      params: AnnotationMessageIdParam,
      body: UpdateAnnotatedMessage,
      response: {
        200: AnnotatedMessage,
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    const messageExists = annotation.messages.some(m => m.id === request.params.messageId);
    if (!messageExists) throw fastify.httpErrors.notFound('Message not found');
    return fastify.db.annotations.updateMessage(request.params.messageId, request.body);
  });

  // DELETE /annotations/:id/messages/:messageId
  fastify.delete('/:id/messages/:messageId', {
    schema: {
      params: AnnotationMessageIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const annotation = await fastify.db.annotations.getWithMessages(request.params.id);
    if (!annotation) throw fastify.httpErrors.notFound('Annotation not found');
    const messageExists = annotation.messages.some(m => m.id === request.params.messageId);
    if (!messageExists) throw fastify.httpErrors.notFound('Message not found');
    await fastify.db.annotations.deleteMessage(request.params.messageId);
    reply.status(204);
  });
};

export default annotationRoutes;
