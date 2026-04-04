import type { AppSupabaseClient } from './client.js';
import type {
  Dialog, DialogMessage, DialogWithMessages,
  CreateDialog, UpdateDialog, CreateDialogMessage, UpdateDialogMessage,
} from '../types.js';
import type { IDialogRepository } from '../interfaces.js';

export class SupabaseDialogRepository implements IDialogRepository {
  constructor(private client: AppSupabaseClient, private userId?: string) {}

  async list(): Promise<Dialog[]> {
    const { data, error } = await this.client
      .from('dialogs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getById(id: number): Promise<Dialog | null> {
    const { data, error } = await this.client
      .from('dialogs').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async getWithMessages(id: number): Promise<DialogWithMessages | null> {
    const dialog = await this.getById(id);
    if (!dialog) return null;
    const { data: messages, error } = await this.client
      .from('dialog_messages').select('*').eq('dialog_id', id).order('order');
    if (error) throw error;
    return { ...dialog, messages: messages ?? [] };
  }

  async create(data: CreateDialog): Promise<Dialog> {
    const { data: created, error } = await this.client
      .from('dialogs')
      .insert({
        title: data.title,
        description: data.description ?? null,
        language: data.language,
        created_by: data.created_by ?? this.userId ?? null,
      })
      .select().single();
    if (error) throw error;
    return created;
  }

  async update(id: number, data: UpdateDialog): Promise<Dialog> {
    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.language !== undefined) updates.language = data.language;
    const { data: updated, error } = await this.client
      .from('dialogs').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client.from('dialogs').delete().eq('id', id);
    if (error) throw error;
  }

  async createMessage(data: CreateDialogMessage): Promise<DialogMessage> {
    const { data: created, error } = await this.client
      .from('dialog_messages').insert(data).select().single();
    if (error) throw error;
    return created;
  }

  async updateMessage(id: number, data: UpdateDialogMessage): Promise<DialogMessage> {
    const { data: updated, error } = await this.client
      .from('dialog_messages').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  }

  async deleteMessage(id: number): Promise<void> {
    const { error } = await this.client.from('dialog_messages').delete().eq('id', id);
    if (error) throw error;
  }
}
