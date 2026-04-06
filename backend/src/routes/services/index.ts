import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply } from 'fastify';
import { GenerateDialogBody, EditDialogBody } from '../../schemas/service.js';
import { DialogWithMessages } from '../../schemas/dialog.js';
import { ErrorResponse } from '../../schemas/common.js';
import type { ILLMProvider } from '../../providers/llm/types.js';
import { generateDialog } from '../../services/dialog-generation.js';
import { editDialog, DialogNotFoundError, LLMResponseError } from '../../services/dialog-editing.js';

const serviceRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
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

  // POST /services/generate-dialog
  fastify.post('/generate-dialog', {
    schema: {
      body: GenerateDialogBody,
      response: {
        201: DialogWithMessages,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { providerId, model, language, prompt, messageCount } = request.body;

    const llm = await resolveLLMProvider(providerId, reply);
    if (!llm) return;

    const result = await generateDialog({
      llmProvider: llm,
      dialogRepo: fastify.db.dialogs,
      model,
      language,
      prompt,
      messageCount,
    });

    reply.status(201);
    return result;
  });

  // POST /services/edit-dialog
  fastify.post('/edit-dialog', {
    schema: {
      body: EditDialogBody,
      response: { 200: DialogWithMessages, 400: ErrorResponse, 404: ErrorResponse, 502: ErrorResponse },
    },
  }, async (request, reply) => {
    const { dialogId, providerId, model, instructions } = request.body;

    const llm = await resolveLLMProvider(providerId, reply);
    if (!llm) return;

    try {
      const result = await editDialog({
        dialogId,
        llmProvider: llm,
        instructions,
        model,
        db: fastify.db,
      });
      return result;
    } catch (error) {
      if (error instanceof DialogNotFoundError) {
        return reply.notFound(error.message);
      }
      if (error instanceof LLMResponseError) {
        return reply.badGateway(error.message);
      }
      throw error;
    }
  });
};

export default serviceRoutes;
