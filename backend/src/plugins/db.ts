import fp from 'fastify-plugin';
import { createDatabase } from '../db/factory.js';
import type { IDatabase } from '../db/interfaces.js';
import type { DbConfig } from '../db/config.js';
import { bootstrapProviders } from '../bootstrap/providers.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: IDatabase;
  }
}

export interface DbPluginOptions {
  testing?: boolean;
}

export default fp<DbPluginOptions>(
  async (fastify, opts) => {
    let config: DbConfig | undefined;

    if (opts.testing) {
      config = {
        provider: 'local',
        local: { path: ':memory:' },
        encryptionKey: 'test-encryption-key',
      };
    }

    const db = await createDatabase(config);
    fastify.decorate('db', db);

    if (!opts.testing) {
      await bootstrapProviders(db);
    }

    fastify.addHook('onClose', async () => {
      await db.close();
    });
  },
  { name: 'db' },
);
