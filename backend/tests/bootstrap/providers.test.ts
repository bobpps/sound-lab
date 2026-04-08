import type { IDatabase } from '../../src/db/interfaces.js';
import { LocalProviderRepository } from '../../src/db/local/providers.js';
import { bootstrapProviders, DEFAULT_PROVIDER_SEEDS } from '../../src/bootstrap/providers.js';
import { createTestDb } from '../db/test-helpers.js';

const ENCRYPTION_KEY = 'test-encryption-key';

async function createTestProviderDatabase(): Promise<IDatabase> {
  const sqliteDb = await createTestDb();

  return {
    dialogs: null as never,
    annotations: null as never,
    annotationPrompts: null as never,
    agentPrompts: null as never,
    providers: new LocalProviderRepository(sqliteDb, ENCRYPTION_KEY),
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      sqliteDb.exec('BEGIN');
      try {
        const result = await fn();
        sqliteDb.exec('COMMIT');
        return result;
      } catch (error) {
        sqliteDb.exec('ROLLBACK');
        throw error;
      }
    },
    async close(): Promise<void> {
      sqliteDb.close();
    },
  };
}

describe('bootstrapProviders', () => {
  it('seeds the default provider catalog into an empty database', async () => {
    const db = await createTestProviderDatabase();

    try {
      await bootstrapProviders(db);

      const providers = await db.providers.list();
      expect(providers).toHaveLength(DEFAULT_PROVIDER_SEEDS.length);
      expect(providers.map((provider) => provider.id).sort()).toEqual(
        DEFAULT_PROVIDER_SEEDS.map((provider) => provider.id).sort(),
      );
    } finally {
      await db.close();
    }
  });

  it('does not overwrite existing providers or their keys', async () => {
    const db = await createTestProviderDatabase();

    try {
      await db.providers.create({ id: 'openai', name: 'Custom OpenAI', type: 'llm' });
      await db.providers.update('openai', { enabled: false });
      await db.providers.setKey('openai', 'custom-secret-key');

      await bootstrapProviders(db);

      const provider = await db.providers.getById('openai');
      const key = await db.providers.getDecryptedKey('openai');
      const providers = await db.providers.list();

      expect(provider).toMatchObject({
        id: 'openai',
        name: 'Custom OpenAI',
        type: 'llm',
      });
      expect(Boolean(provider?.enabled)).toBe(false);
      expect(key).toBe('custom-secret-key');
      expect(providers).toHaveLength(DEFAULT_PROVIDER_SEEDS.length);
    } finally {
      await db.close();
    }
  });
});
