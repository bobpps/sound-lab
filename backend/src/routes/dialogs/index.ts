import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  Dialog,
  DialogWithMessages,
  DialogMessage,
  CreateDialog,
  UpdateDialog,
  CreateDialogMessage,
  UpdateDialogMessage,
  DialogIdParam,
  MessageIdParam,
} from '../../schemas/dialog.js';
import { ErrorResponse } from '../../schemas/common.js';

const dialogRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /dialogs
  fastify.get('/', {
    schema: {
      response: { 200: Type.Array(Dialog) },
    },
  }, async () => {
    return fastify.db.dialogs.list();
  });

  // GET /dialogs/:dialogId
  fastify.get('/:dialogId', {
    schema: {
      params: DialogIdParam,
      response: {
        200: DialogWithMessages,
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const dialog = await fastify.db.dialogs.getWithMessages(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');
    return dialog;
  });

  // POST /dialogs
  fastify.post('/', {
    schema: {
      body: CreateDialog,
      response: {
        201: Dialog,
      },
    },
  }, async (request, reply) => {
    const dialog = await fastify.db.dialogs.create(request.body);
    reply.status(201);
    return dialog;
  });

  // PUT /dialogs/:dialogId
  fastify.put('/:dialogId', {
    schema: {
      params: DialogIdParam,
      body: UpdateDialog,
      response: {
        200: Dialog,
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const existing = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!existing) throw fastify.httpErrors.notFound('Dialog not found');
    return fastify.db.dialogs.update(request.params.dialogId, request.body);
  });

  // DELETE /dialogs/:dialogId
  fastify.delete('/:dialogId', {
    schema: {
      params: DialogIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const existing = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!existing) throw fastify.httpErrors.notFound('Dialog not found');
    await fastify.db.dialogs.delete(request.params.dialogId);
    reply.status(204);
  });

  // POST /dialogs/:dialogId/messages
  fastify.post('/:dialogId/messages', {
    schema: {
      params: DialogIdParam,
      body: CreateDialogMessage,
      response: {
        201: DialogMessage,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const dialog = await fastify.db.dialogs.getById(request.params.dialogId);
    if (!dialog) throw fastify.httpErrors.notFound('Dialog not found');
    const msg = await fastify.db.dialogs.createMessage({
      dialog_id: request.params.dialogId,
      ...request.body,
    });
    reply.status(201);
    return msg;
  });

  // PUT /dialogs/:dialogId/messages/:messageId
  fastify.put('/:dialogId/messages/:messageId', {
    schema: {
      params: MessageIdParam,
      body: UpdateDialogMessage,
      response: {
        200: DialogMessage,
        404: ErrorResponse,
      },
    },
  }, async (request) => {
    const dialogWithMsgs = await fastify.db.dialogs.getWithMessages(request.params.dialogId);
    if (!dialogWithMsgs) throw fastify.httpErrors.notFound('Dialog not found');
    const messageExists = dialogWithMsgs.messages.some(m => m.id === request.params.messageId);
    if (!messageExists) throw fastify.httpErrors.notFound('Message not found');
    return fastify.db.dialogs.updateMessage(request.params.messageId, request.body);
  });

  // DELETE /dialogs/:dialogId/messages/:messageId
  fastify.delete('/:dialogId/messages/:messageId', {
    schema: {
      params: MessageIdParam,
      response: {
        204: Type.Null(),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const dialogWithMsgs = await fastify.db.dialogs.getWithMessages(request.params.dialogId);
    if (!dialogWithMsgs) throw fastify.httpErrors.notFound('Dialog not found');
    const messageExists = dialogWithMsgs.messages.some(m => m.id === request.params.messageId);
    if (!messageExists) throw fastify.httpErrors.notFound('Message not found');

    await fastify.db.dialogs.deleteMessage(request.params.messageId);
    reply.status(204);
  });
};

export default dialogRoutes;
