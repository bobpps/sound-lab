import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers.js';
import { LocalProviderRepository } from '../../src/db/local/providers.js';
import type { WrappedDatabase } from '../../src/db/local/client.js';

const ENCRYPTION_KEY = 'test-encryption-key-for-testing!';

describe('LocalProviderRepository', () => {
  let db: WrappedDatabase;
  let repo: LocalProviderRepository;

  beforeEach(async () => {
    db = await createTestDb();
    repo = new LocalProviderRepository(db, ENCRYPTION_KEY);
  });

  describe('create and getById', () => {
    it('creates a provider and retrieves it', async () => {
      const provider = await repo.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      expect(provider.id).toBe('elevenlabs');
      expect(provider.name).toBe('ElevenLabs');
      expect(provider.type).toBe('tts');
      expect(provider.has_key).toBe(false);

      const found = await repo.getById('elevenlabs');
      expect(found?.name).toBe('ElevenLabs');
      expect(found?.has_key).toBe(false);
    });

    it('returns null for non-existent id', async () => {
      expect(await repo.getById('nonexistent')).toBeNull();
    });
  });

  describe('list', () => {
    it('lists all providers', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      await repo.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      expect(await repo.list()).toHaveLength(2);
    });

    it('filters by type', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      await repo.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      await repo.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      const ttsList = await repo.list('tts');
      expect(ttsList).toHaveLength(2);
      expect(ttsList.every(p => p.type === 'tts')).toBe(true);
    });

    it('includes safe API key presence without exposing encrypted keys', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      await repo.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      await repo.setKey('openai', 'sk-secret-key-12345');

      const providers = await repo.list();

      expect(providers).toEqual([
        expect.objectContaining({ id: 'google', has_key: false }),
        expect.objectContaining({ id: 'openai', has_key: true }),
      ]);
      expect(JSON.stringify(providers)).not.toContain('encrypted_key');
      expect(JSON.stringify(providers)).not.toContain('sk-secret-key-12345');
    });
  });

  describe('update', () => {
    it('updates provider fields', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      const updated = await repo.update('google', { name: 'Google Cloud' });
      expect(updated.name).toBe('Google Cloud');
    });
  });

  describe('delete', () => {
    it('removes a provider', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      await repo.delete('google');
      expect(await repo.getById('google')).toBeNull();
    });
  });

  describe('API key encryption', () => {
    it('stores and retrieves encrypted key', async () => {
      await repo.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await repo.setKey('elevenlabs', 'sk-secret-key-12345');

      const decrypted = await repo.getDecryptedKey('elevenlabs');
      const provider = await repo.getById('elevenlabs');
      expect(decrypted).toBe('sk-secret-key-12345');
      expect(provider?.has_key).toBe(true);
    });

    it('returns null when no key is set', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      expect(await repo.getDecryptedKey('google')).toBeNull();
    });

    it('encrypted value is not plaintext in DB', async () => {
      await repo.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await repo.setKey('elevenlabs', 'sk-secret');

      const row = db.prepare('SELECT encrypted_key FROM providers WHERE id = ?').get('elevenlabs') as { encrypted_key: string };
      expect(row.encrypted_key).not.toBe('sk-secret');
      expect(row.encrypted_key).toBeDefined();
    });
  });
});
