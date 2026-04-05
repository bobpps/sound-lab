import { buildApp } from './app.js';

try {
  const app = await buildApp();
  await app.listen({ port: 3000, host: '0.0.0.0' });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
}
