import type Database from 'better-sqlite3';
import type {
  Dialog, DialogMessage, DialogWithMessages,
  CreateDialog, UpdateDialog, CreateDialogMessage, UpdateDialogMessage,
} from '../types.js';
import type { IDialogRepository } from '../interfaces.js';

export class LocalDialogRepository implements IDialogRepository {
  constructor(private db: Database.Database) {}

  async list(): Promise<Dialog[]> {
    return this.db.prepare('SELECT * FROM dialogs ORDER BY created_at DESC').all() as Dialog[];
  }

  async getById(id: number): Promise<Dialog | null> {
    return (this.db.prepare('SELECT * FROM dialogs WHERE id = ?').get(id) as Dialog) ?? null;
  }

  async getWithMessages(id: number): Promise<DialogWithMessages | null> {
    const dialog = await this.getById(id);
    if (!dialog) return null;
    const messages = this.db
      .prepare('SELECT * FROM dialog_messages WHERE dialog_id = ? ORDER BY "order"')
      .all(id) as DialogMessage[];
    return { ...dialog, messages };
  }

  async create(data: CreateDialog): Promise<Dialog> {
    const result = this.db
      .prepare('INSERT INTO dialogs (title, description, language, created_by) VALUES (?, ?, ?, ?)')
      .run(data.title, data.description ?? null, data.language, data.created_by ?? null);
    return (await this.getById(result.lastInsertRowid as number))!;
  }

  async update(id: number, data: UpdateDialog): Promise<Dialog> {
    const current = await this.getById(id);
    if (!current) throw new Error(`Dialog ${id} not found`);
    this.db.prepare('UPDATE dialogs SET title = ?, description = ?, language = ? WHERE id = ?').run(
      data.title ?? current.title,
      data.description !== undefined ? data.description : current.description,
      data.language ?? current.language,
      id,
    );
    return (await this.getById(id))!;
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM dialogs WHERE id = ?').run(id);
  }

  async createMessage(data: CreateDialogMessage): Promise<DialogMessage> {
    const result = this.db
      .prepare('INSERT INTO dialog_messages (dialog_id, "order", character, text) VALUES (?, ?, ?, ?)')
      .run(data.dialog_id, data.order, data.character, data.text);
    return this.db.prepare('SELECT * FROM dialog_messages WHERE id = ?').get(result.lastInsertRowid) as DialogMessage;
  }

  async updateMessage(id: number, data: UpdateDialogMessage): Promise<DialogMessage> {
    const current = this.db.prepare('SELECT * FROM dialog_messages WHERE id = ?').get(id) as DialogMessage | undefined;
    if (!current) throw new Error(`Message ${id} not found`);
    this.db.prepare('UPDATE dialog_messages SET character = ?, text = ? WHERE id = ?').run(
      data.character ?? current.character,
      data.text ?? current.text,
      id,
    );
    return this.db.prepare('SELECT * FROM dialog_messages WHERE id = ?').get(id) as DialogMessage;
  }

  async deleteMessage(id: number): Promise<void> {
    this.db.prepare('DELETE FROM dialog_messages WHERE id = ?').run(id);
  }
}
