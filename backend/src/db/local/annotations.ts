import type { WrappedDatabase } from './client.js';
import type {
  AnnotatedDialog, AnnotatedDialogWithMessages, AnnotatedMessage,
  CreateAnnotatedDialog, CreateAnnotatedMessage, UpdateAnnotatedMessage,
} from '../types.js';
import type { IAnnotationRepository } from '../interfaces.js';

export class LocalAnnotationRepository implements IAnnotationRepository {
  constructor(private db: WrappedDatabase) {}

  async listByDialog(dialogId: number): Promise<AnnotatedDialog[]> {
    return this.db
      .prepare('SELECT * FROM annotated_dialogs WHERE dialog_id = ? ORDER BY created_at DESC')
      .all(dialogId) as AnnotatedDialog[];
  }

  async getWithMessages(id: number): Promise<AnnotatedDialogWithMessages | null> {
    const dialog = this.db.prepare('SELECT * FROM annotated_dialogs WHERE id = ?').get(id) as AnnotatedDialog | undefined;
    if (!dialog) return null;
    const messages = this.db
      .prepare('SELECT * FROM annotated_messages WHERE annotated_dialog_id = ? ORDER BY id')
      .all(id) as AnnotatedMessage[];
    return { ...dialog, messages };
  }

  async create(data: CreateAnnotatedDialog): Promise<AnnotatedDialog> {
    const result = this.db
      .prepare('INSERT INTO annotated_dialogs (dialog_id, provider_id, title, created_by) VALUES (?, ?, ?, ?)')
      .run(data.dialog_id, data.provider_id, data.title, data.created_by ?? null);
    return this.db.prepare('SELECT * FROM annotated_dialogs WHERE id = ?').get(result.lastInsertRowid) as AnnotatedDialog;
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM annotated_dialogs WHERE id = ?').run(id);
  }

  async createMessage(data: CreateAnnotatedMessage): Promise<AnnotatedMessage> {
    const result = this.db
      .prepare('INSERT INTO annotated_messages (annotated_dialog_id, dialog_message_id, text) VALUES (?, ?, ?)')
      .run(data.annotated_dialog_id, data.dialog_message_id, data.text);
    return this.db.prepare('SELECT * FROM annotated_messages WHERE id = ?').get(result.lastInsertRowid) as AnnotatedMessage;
  }

  async updateMessage(id: number, data: UpdateAnnotatedMessage): Promise<AnnotatedMessage> {
    this.db.prepare('UPDATE annotated_messages SET text = ? WHERE id = ?').run(data.text, id);
    return this.db.prepare('SELECT * FROM annotated_messages WHERE id = ?').get(id) as AnnotatedMessage;
  }

  async deleteMessage(id: number): Promise<void> {
    this.db.prepare('DELETE FROM annotated_messages WHERE id = ?').run(id);
  }
}
