import { existsSync } from 'node:fs';
import { buildApp } from './app.js';

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

try {
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
}
