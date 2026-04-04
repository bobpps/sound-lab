import { buildApp } from '../src/app.js';

export async function buildTestApp() {
  const app = await buildApp({ testing: true });
  await app.ready();
  return app;
}
