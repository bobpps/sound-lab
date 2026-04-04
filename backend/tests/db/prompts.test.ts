import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers.js';
import { LocalAnnotationPromptRepository, LocalAgentPromptRepository } from '../../src/db/local/prompts.js';
import type Database from 'better-sqlite3';

describe('LocalAnnotationPromptRepository', () => {
  let db: Database.Database;
  let repo: LocalAnnotationPromptRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new LocalAnnotationPromptRepository(db);
  });

  it('creates and retrieves a prompt', async () => {
    const prompt = await repo.create({
      title: 'SSML Annotation',
      provider_id: 'elevenlabs',
      language: 'en-US',
      prompt: 'Annotate the following dialog line with SSML tags...',
    });
    expect(prompt.id).toBe(1);
    expect(prompt.title).toBe('SSML Annotation');

    const found = await repo.getById(prompt.id);
    expect(found?.prompt).toContain('SSML');
  });

  it('lists all prompts', async () => {
    await repo.create({ title: 'P1', provider_id: 'google', language: 'en-US', prompt: 'prompt1' });
    await repo.create({ title: 'P2', provider_id: 'elevenlabs', language: 'ru-RU', prompt: 'prompt2' });
    const list = await repo.list();
    expect(list).toHaveLength(2);
  });

  it('updates a prompt', async () => {
    const created = await repo.create({ title: 'Old', provider_id: 'google', language: 'en-US', prompt: 'old' });
    const updated = await repo.update(created.id, { title: 'New', prompt: 'new' });
    expect(updated.title).toBe('New');
    expect(updated.prompt).toBe('new');
    expect(updated.provider_id).toBe('google');
  });

  it('deletes a prompt', async () => {
    const created = await repo.create({ title: 'Del', provider_id: 'google', language: 'en-US', prompt: 'x' });
    await repo.delete(created.id);
    expect(await repo.getById(created.id)).toBeNull();
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.getById(999)).toBeNull();
  });
});

describe('LocalAgentPromptRepository', () => {
  let db: Database.Database;
  let repo: LocalAgentPromptRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new LocalAgentPromptRepository(db);
  });

  it('creates and retrieves an agent prompt', async () => {
    const prompt = await repo.create({
      title: 'Support Agent',
      provider_id: 'openai',
      language: 'en-US',
      prompt: 'You are a helpful support agent...',
    });
    expect(prompt.id).toBe(1);
    const found = await repo.getById(prompt.id);
    expect(found?.title).toBe('Support Agent');
  });

  it('lists all agent prompts', async () => {
    await repo.create({ title: 'A1', provider_id: 'openai', language: 'en-US', prompt: 'p1' });
    await repo.create({ title: 'A2', provider_id: 'gemini', language: 'ru-RU', prompt: 'p2' });
    expect(await repo.list()).toHaveLength(2);
  });

  it('updates an agent prompt', async () => {
    const created = await repo.create({ title: 'Old', provider_id: 'openai', language: 'en-US', prompt: 'old' });
    const updated = await repo.update(created.id, { prompt: 'new' });
    expect(updated.prompt).toBe('new');
    expect(updated.title).toBe('Old');
  });

  it('deletes an agent prompt', async () => {
    const created = await repo.create({ title: 'Del', provider_id: 'openai', language: 'en-US', prompt: 'x' });
    await repo.delete(created.id);
    expect(await repo.getById(created.id)).toBeNull();
  });
});
