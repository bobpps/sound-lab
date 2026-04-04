import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const HealthResponse = Type.Object({
  status: Type.Literal('ok'),
});

const healthRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', { schema: { response: { 200: HealthResponse } } }, async () => {
    return { status: 'ok' as const };
  });
};

export default healthRoutes;
