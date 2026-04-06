import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import autoload from '@fastify/autoload';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import dbPlugin from './plugins/db.js';
import ttsPlugin from './plugins/tts.js';
import llmPlugin from './plugins/llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  testing?: boolean;
}

export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: !opts.testing,
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  });

  await app.register(sensible);

  await app.register(dbPlugin, { testing: opts.testing });
  await app.register(ttsPlugin);
  await app.register(llmPlugin);

  await app.register(autoload, {
    dir: join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
  });

  return app;
}
