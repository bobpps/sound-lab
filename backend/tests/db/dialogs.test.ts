import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers.js';
import { LocalDialogRepository } from '../../src/db/local/dialogs.js';
import type { WrappedDatabase } from '../../src/db/local/client.js';

describe('LocalDialogRepository', () => {
  let db: WrappedDatabase;
  let repo: LocalDialogRepository;

  beforeEach(async () => {
    db = await createTestDb();
    repo = new LocalDialogRepository(db);
  });

  describe('create and getById', () => {
    it('creates a dialog and retrieves it by id', async () => {
      const dialog = await repo.create({ title: 'Test', language: 'en-US' });
      expect(dialog.id).toBe(1);
      expect(dialog.title).toBe('Test');
      expect(dialog.language).toBe('en-US');
      expect(dialog.description).toBeNull();
      expect(dialog.created_by).toBeNull();
      expect(dialog.created_at).toBeDefined();

      const found = await repo.getById(dialog.id);
      expect(found).toMatchObject({ id: 1, title: 'Test' });
    });

    it('returns null for non-existent id', async () => {
      expect(await repo.getById(999)).toBeNull();
    });
  });

  describe('list', () => {
    it('returns empty array when no dialogs', async () => {
      expect(await repo.list()).toEqual([]);
    });

    it('returns all dialogs', async () => {
      await repo.create({ title: 'First', language: 'en-US' });
      await repo.create({ title: 'Second', language: 'ru-RU' });
      const list = await repo.list();
      expect(list).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('updates specified fields, preserves others', async () => {
      const created = await repo.create({ title: 'Old', description: 'Desc', language: 'en-US' });
      const updated = await repo.update(created.id, { title: 'New' });
      expect(updated.title).toBe('New');
      expect(updated.description).toBe('Desc');
      expect(updated.language).toBe('en-US');
    });
  });

  describe('delete', () => {
    it('removes a dialog', async () => {
      const created = await repo.create({ title: 'Test', language: 'en-US' });
      await repo.delete(created.id);
      expect(await repo.getById(created.id)).toBeNull();
    });
  });

  describe('messages', () => {
    it('creates messages and retrieves with dialog', async () => {
      const dialog = await repo.create({ title: 'Test', language: 'en-US' });
      await repo.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Hello' });
      await repo.createMessage({ dialog_id: dialog.id, order: 2, character: 2, text: 'Hi' });

      const result = await repo.getWithMessages(dialog.id);
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0].text).toBe('Hello');
      expect(result?.messages[1].text).toBe('Hi');
    });

    it('updates a message', async () => {
      const dialog = await repo.create({ title: 'Test', language: 'en-US' });
      const msg = await repo.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Original' });
      const updated = await repo.updateMessage(msg.id, { text: 'Modified' });
      expect(updated.text).toBe('Modified');
      expect(updated.character).toBe(1);
    });

    it('deletes a message', async () => {
      const dialog = await repo.create({ title: 'Test', language: 'en-US' });
      const msg = await repo.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Bye' });
      await repo.deleteMessage(msg.id);
      const result = await repo.getWithMessages(dialog.id);
      expect(result?.messages).toHaveLength(0);
    });

    it('cascade deletes messages when dialog is deleted', async () => {
      const dialog = await repo.create({ title: 'Test', language: 'en-US' });
      await repo.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Gone' });
      await repo.delete(dialog.id);
      expect(await repo.getWithMessages(dialog.id)).toBeNull();
    });

    it('returns null from getWithMessages for non-existent dialog', async () => {
      expect(await repo.getWithMessages(999)).toBeNull();
    });
  });
});
