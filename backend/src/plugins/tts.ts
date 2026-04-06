import fp from 'fastify-plugin';
import { createTTSProvider } from '../providers/tts/registry.js';
import type { ITTSProvider } from '../providers/tts/types.js';

export type TTSProviderFactory = (providerId: string, apiKey: string) => ITTSProvider;

declare module 'fastify' {
  interface FastifyInstance {
    createTTSProvider: TTSProviderFactory;
  }
}

export default fp(
  async (fastify) => {
    fastify.decorate('createTTSProvider', createTTSProvider);
  },
  { name: 'tts' },
);
