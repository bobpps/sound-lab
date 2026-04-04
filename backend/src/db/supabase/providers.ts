import type { AppSupabaseClient } from './client.js';
import type { Provider, CreateProvider, UpdateProvider, ProviderType } from '../types.js';
import type { IProviderRepository } from '../interfaces.js';
import { encrypt, decrypt } from '../local/crypto.js';

export class SupabaseProviderRepository implements IProviderRepository {
  constructor(
    private client: AppSupabaseClient,
    private encryptionKey: string,
  ) {}

  async list(type?: ProviderType): Promise<Provider[]> {
    let query = this.client.from('providers').select('id, name, type, enabled, created_at').order('name');
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getById(id: string): Promise<Provider | null> {
    const { data, error } = await this.client
      .from('providers').select('id, name, type, enabled, created_at').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async create(data: CreateProvider): Promise<Provider> {
    const { data: created, error } = await this.client
      .from('providers').insert(data).select('id, name, type, enabled, created_at').single();
    if (error) throw error;
    return created;
  }

  async update(id: string, data: UpdateProvider): Promise<Provider> {
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.type !== undefined) updates.type = data.type;
    if (data.enabled !== undefined) updates.enabled = data.enabled;
    const { data: updated, error } = await this.client
      .from('providers').update(updates).eq('id', id).select('id, name, type, enabled, created_at').single();
    if (error) throw error;
    return updated;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('providers').delete().eq('id', id);
    if (error) throw error;
  }

  async getDecryptedKey(id: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('providers').select('encrypted_key').eq('id', id).single();
    if (error) throw error;
    if (!data?.encrypted_key) return null;
    return decrypt(data.encrypted_key, this.encryptionKey);
  }

  async setKey(id: string, key: string): Promise<void> {
    const encrypted = encrypt(key, this.encryptionKey);
    const { error } = await this.client
      .from('providers').update({ encrypted_key: encrypted }).eq('id', id);
    if (error) throw error;
  }
}
