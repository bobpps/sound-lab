import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply } from 'fastify';
import { GenerateDialogBody } from '../../schemas/service.js';
import { DialogWithMessages } from '../../schemas/dialog.js';
import { ErrorResponse } from '../../schemas/common.js';
import type { ILLMProvider } from '../../providers/llm/types.js';
import { generateDialog } from '../../services/dialog-generation.js';

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
};

export default serviceRoutes;
