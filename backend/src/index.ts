import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createDatabase } from './db/factory.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: 'http://localhost:5173',
});

const db = await createDatabase();
app.log.info(`Database provider: ${process.env.DB_PROVIDER || 'local (auto)'}`);

app.addHook('onClose', async () => {
  await db.close();
});

app.get('/health', async () => {
  return { status: 'ok' };
});

await app.listen({ port: 3000, host: '0.0.0.0' });
