import { createDatabase } from '../../src/db/factory.js';
import { bootstrapProviders, DEFAULT_PROVIDER_SEEDS } from '../../src/bootstrap/providers.js';

describe('bootstrapProviders', () => {
  it('seeds the default provider catalog into an empty database', async () => {
    const db = await createDatabase({
      provider: 'local',
      local: { path: ':memory:' },
      encryptionKey: 'test-encryption-key',
    });

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
    const db = await createDatabase({
      provider: 'local',
      local: { path: ':memory:' },
      encryptionKey: 'test-encryption-key',
    });

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
