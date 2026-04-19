import type { WrappedDatabase } from './client.js';
import type { Provider, CreateProvider, UpdateProvider, ProviderType } from '../types.js';
import type { IProviderRepository } from '../interfaces.js';
import { encrypt, decrypt } from './crypto.js';

export class LocalProviderRepository implements IProviderRepository {
  constructor(
    private db: WrappedDatabase,
    private encryptionKey: string,
  ) {}

  async list(type?: ProviderType): Promise<Provider[]> {
    if (type) {
      return this.db
        .prepare('SELECT id, name, type, enabled, created_at FROM providers WHERE type = ? ORDER BY name')
        .all(type) as Provider[];
    }
    return this.db
      .prepare('SELECT id, name, type, enabled, created_at FROM providers ORDER BY name')
      .all() as Provider[];
  }

  async getById(id: string): Promise<Provider | null> {
    return (
      this.db
        .prepare('SELECT id, name, type, enabled, created_at FROM providers WHERE id = ?')
        .get(id) as Provider
    ) ?? null;
  }

  async create(data: CreateProvider): Promise<Provider> {
    this.db
      .prepare('INSERT INTO providers (id, name, type) VALUES (?, ?, ?)')
      .run(data.id, data.name, data.type);
    return (await this.getById(data.id))!;
  }

  async update(id: string, data: UpdateProvider): Promise<Provider> {
    const current = await this.getById(id);
    if (!current) throw new Error(`Provider ${id} not found`);
    this.db.prepare('UPDATE providers SET name = ?, type = ?, enabled = ? WHERE id = ?').run(
      data.name ?? current.name,
      data.type ?? current.type,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : current.enabled,
      id,
    );
    return (await this.getById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM providers WHERE id = ?').run(id);
  }

  async getDecryptedKey(id: string): Promise<string | null> {
    const row = this.db.prepare('SELECT encrypted_key FROM providers WHERE id = ?').get(id) as
      { encrypted_key: string | null } | undefined;
    if (!row?.encrypted_key) return null;
    return decrypt(row.encrypted_key, this.encryptionKey);
  }

  async setKey(id: string, key: string): Promise<void> {
    const encrypted = encrypt(key, this.encryptionKey);
    this.db.prepare('UPDATE providers SET encrypted_key = ? WHERE id = ?').run(encrypted, id);
  }
}
