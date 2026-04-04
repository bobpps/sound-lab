import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('app.db decorator', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes db with all repositories', () => {
    expect(app.db).toBeDefined();
    expect(app.db.dialogs).toBeDefined();
    expect(app.db.annotations).toBeDefined();
    expect(app.db.annotationPrompts).toBeDefined();
    expect(app.db.agentPrompts).toBeDefined();
    expect(app.db.providers).toBeDefined();
  });

  it('can call db methods through decorator', async () => {
    const dialogs = await app.db.dialogs.list();
    expect(dialogs).toEqual([]);
  });
});
