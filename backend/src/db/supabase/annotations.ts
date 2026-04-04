import type { AppSupabaseClient } from './client.js';
import type {
  AnnotatedDialog, AnnotatedDialogWithMessages, AnnotatedMessage,
  CreateAnnotatedDialog, CreateAnnotatedMessage, UpdateAnnotatedMessage,
} from '../types.js';
import type { IAnnotationRepository } from '../interfaces.js';

export class SupabaseAnnotationRepository implements IAnnotationRepository {
  constructor(private client: AppSupabaseClient, private userId?: string) {}

  async listByDialog(dialogId: number): Promise<AnnotatedDialog[]> {
    const { data, error } = await this.client
      .from('annotated_dialogs').select('*').eq('dialog_id', dialogId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getWithMessages(id: number): Promise<AnnotatedDialogWithMessages | null> {
    const { data: dialog, error: dErr } = await this.client
      .from('annotated_dialogs').select('*').eq('id', id).single();
    if (dErr) {
      if (dErr.code === 'PGRST116') return null;
      throw dErr;
    }
    const { data: messages, error: mErr } = await this.client
      .from('annotated_messages').select('*').eq('annotated_dialog_id', id).order('id');
    if (mErr) throw mErr;
    return { ...dialog, messages: messages ?? [] };
  }

  async create(data: CreateAnnotatedDialog): Promise<AnnotatedDialog> {
    const { data: created, error } = await this.client
      .from('annotated_dialogs')
      .insert({
        dialog_id: data.dialog_id,
        provider_id: data.provider_id,
        title: data.title,
        created_by: data.created_by ?? this.userId ?? null,
      })
      .select().single();
    if (error) throw error;
    return created;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client.from('annotated_dialogs').delete().eq('id', id);
    if (error) throw error;
  }

  async createMessage(data: CreateAnnotatedMessage): Promise<AnnotatedMessage> {
    const { data: created, error } = await this.client
      .from('annotated_messages').insert(data).select().single();
    if (error) throw error;
    return created;
  }

  async updateMessage(id: number, data: UpdateAnnotatedMessage): Promise<AnnotatedMessage> {
    const { data: updated, error } = await this.client
      .from('annotated_messages').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  }

  async deleteMessage(id: number): Promise<void> {
    const { error } = await this.client.from('annotated_messages').delete().eq('id', id);
    if (error) throw error;
  }
}
