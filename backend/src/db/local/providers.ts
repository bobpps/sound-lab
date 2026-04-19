import type Database from 'better-sqlite3';
import type { Provider, CreateProvider, UpdateProvider, ProviderType } from '../types.js';
import type { IProviderRepository } from '../interfaces.js';
import { encrypt, decrypt } from './crypto.js';

type ProviderRow = Omit<Provider, 'enabled' | 'has_key'> & {
  enabled: number | boolean;
  has_key: number | boolean;
};

const PROVIDER_SELECT =
  'id, name, type, enabled, created_at, (encrypted_key IS NOT NULL) AS has_key';

function mapProvider(row: ProviderRow): Provider {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    has_key: Boolean(row.has_key),
  };
}

export class LocalProviderRepository implements IProviderRepository {
  constructor(
    private db: Database.Database,
    private encryptionKey: string,
  ) {}

  async list(type?: ProviderType): Promise<Provider[]> {
    if (type) {
      const rows = this.db
        .prepare(`SELECT ${PROVIDER_SELECT} FROM providers WHERE type = ? ORDER BY name`)
        .all(type) as ProviderRow[];
      return rows.map(mapProvider);
    }
    const rows = this.db
      .prepare(`SELECT ${PROVIDER_SELECT} FROM providers ORDER BY name`)
      .all() as ProviderRow[];
    return rows.map(mapProvider);
  }

  async getById(id: string): Promise<Provider | null> {
    const row = this.db
      .prepare(`SELECT ${PROVIDER_SELECT} FROM providers WHERE id = ?`)
      .get(id) as ProviderRow | undefined;
    return row ? mapProvider(row) : null;
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
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : (current.enabled ? 1 : 0),
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
