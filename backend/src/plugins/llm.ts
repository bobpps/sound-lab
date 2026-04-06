import fp from 'fastify-plugin';
import { createLLMProvider } from '../providers/llm/registry.js';
import type { ILLMProvider } from '../providers/llm/types.js';

export type LLMProviderFactory = (providerId: string, apiKey: string) => ILLMProvider;

declare module 'fastify' {
  interface FastifyInstance {
    createLLMProvider: LLMProviderFactory;
  }
}

export default fp(
  async (fastify) => {
    fastify.decorate('createLLMProvider', createLLMProvider);
  },
  { name: 'llm' },
);
