import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers.js';
import { LocalDialogRepository } from '../../src/db/local/dialogs.js';
import { LocalAnnotationRepository } from '../../src/db/local/annotations.js';
import type Database from 'better-sqlite3';

describe('LocalAnnotationRepository', () => {
  let db: Database.Database;
  let dialogRepo: LocalDialogRepository;
  let repo: LocalAnnotationRepository;

  beforeEach(async () => {
    db = createTestDb();
    dialogRepo = new LocalDialogRepository(db);
    repo = new LocalAnnotationRepository(db);
  });

  async function seedDialog() {
    const dialog = await dialogRepo.create({ title: 'Test Dialog', language: 'en-US' });
    const msg1 = await dialogRepo.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Hello' });
    const msg2 = await dialogRepo.createMessage({ dialog_id: dialog.id, order: 2, character: 2, text: 'Hi' });
    return { dialog, messages: [msg1, msg2] };
  }

  describe('create and listByDialog', () => {
    it('creates an annotated dialog and lists by dialog id', async () => {
      const { dialog } = await seedDialog();
      const annotation = await repo.create({
        dialog_id: dialog.id,
        provider_id: 'elevenlabs',
        title: 'Annotation v1',
      });
      expect(annotation.id).toBe(1);
      expect(annotation.dialog_id).toBe(dialog.id);

      const list = await repo.listByDialog(dialog.id);
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Annotation v1');
    });

    it('returns empty array for dialog with no annotations', async () => {
      const { dialog } = await seedDialog();
      expect(await repo.listByDialog(dialog.id)).toEqual([]);
    });
  });

  describe('messages', () => {
    it('creates annotated messages and retrieves with dialog', async () => {
      const { dialog, messages } = await seedDialog();
      const annotation = await repo.create({
        dialog_id: dialog.id,
        provider_id: 'elevenlabs',
        title: 'v1',
      });
      await repo.createMessage({
        annotated_dialog_id: annotation.id,
        dialog_message_id: messages[0].id,
        text: '<speak>Hello</speak>',
      });
      await repo.createMessage({
        annotated_dialog_id: annotation.id,
        dialog_message_id: messages[1].id,
        text: '<speak>Hi</speak>',
      });

      const result = await repo.getWithMessages(annotation.id);
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0].text).toBe('<speak>Hello</speak>');
    });

    it('updates an annotated message', async () => {
      const { dialog, messages } = await seedDialog();
      const annotation = await repo.create({ dialog_id: dialog.id, provider_id: 'google', title: 'v1' });
      const msg = await repo.createMessage({
        annotated_dialog_id: annotation.id,
        dialog_message_id: messages[0].id,
        text: 'original',
      });
      const updated = await repo.updateMessage(msg.id, { text: 'modified' });
      expect(updated.text).toBe('modified');
    });

    it('deletes an annotated message', async () => {
      const { dialog, messages } = await seedDialog();
      const annotation = await repo.create({ dialog_id: dialog.id, provider_id: 'google', title: 'v1' });
      const msg = await repo.createMessage({
        annotated_dialog_id: annotation.id,
        dialog_message_id: messages[0].id,
        text: 'to delete',
      });
      await repo.deleteMessage(msg.id);
      const result = await repo.getWithMessages(annotation.id);
      expect(result?.messages).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('cascade deletes annotated messages when annotation is deleted', async () => {
      const { dialog, messages } = await seedDialog();
      const annotation = await repo.create({ dialog_id: dialog.id, provider_id: 'google', title: 'v1' });
      await repo.createMessage({
        annotated_dialog_id: annotation.id,
        dialog_message_id: messages[0].id,
        text: 'gone',
      });
      await repo.delete(annotation.id);
      expect(await repo.getWithMessages(annotation.id)).toBeNull();
    });
  });
});
