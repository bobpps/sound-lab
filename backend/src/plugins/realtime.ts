import fp from 'fastify-plugin';
import { createRealtimeProvider } from '../providers/realtime/registry.js';
import type { IRealtimeProvider } from '../providers/realtime/types.js';

export type RealtimeProviderFactory = (
  providerId: string,
  apiKey: string,
) => IRealtimeProvider;

declare module 'fastify' {
  interface FastifyInstance {
    createRealtimeProvider: RealtimeProviderFactory;
  }
}

export default fp(
  async (fastify) => {
    fastify.decorate('createRealtimeProvider', createRealtimeProvider);
  },
  { name: 'realtime' },
);
