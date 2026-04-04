import type Database from 'better-sqlite3';
import type {
  AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt,
  AgentPrompt, CreateAgentPrompt, UpdateAgentPrompt,
} from '../types.js';
import type { IAnnotationPromptRepository, IAgentPromptRepository } from '../interfaces.js';

export class LocalAnnotationPromptRepository implements IAnnotationPromptRepository {
  constructor(private db: Database.Database) {}

  async list(): Promise<AnnotationPrompt[]> {
    return this.db.prepare('SELECT * FROM annotation_prompts ORDER BY created_at DESC').all() as AnnotationPrompt[];
  }

  async getById(id: number): Promise<AnnotationPrompt | null> {
    return (this.db.prepare('SELECT * FROM annotation_prompts WHERE id = ?').get(id) as AnnotationPrompt) ?? null;
  }

  async create(data: CreateAnnotationPrompt): Promise<AnnotationPrompt> {
    const result = this.db
      .prepare('INSERT INTO annotation_prompts (title, provider_id, language, prompt, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(data.title, data.provider_id, data.language, data.prompt, data.created_by ?? null);
    return this.db.prepare('SELECT * FROM annotation_prompts WHERE id = ?').get(result.lastInsertRowid) as AnnotationPrompt;
  }

  async update(id: number, data: UpdateAnnotationPrompt): Promise<AnnotationPrompt> {
    const current = await this.getById(id);
    if (!current) throw new Error(`AnnotationPrompt ${id} not found`);
    this.db.prepare('UPDATE annotation_prompts SET title = ?, provider_id = ?, language = ?, prompt = ? WHERE id = ?').run(
      data.title ?? current.title,
      data.provider_id ?? current.provider_id,
      data.language ?? current.language,
      data.prompt ?? current.prompt,
      id,
    );
    return (await this.getById(id))!;
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM annotation_prompts WHERE id = ?').run(id);
  }
}

export class LocalAgentPromptRepository implements IAgentPromptRepository {
  constructor(private db: Database.Database) {}

  async list(): Promise<AgentPrompt[]> {
    return this.db.prepare('SELECT * FROM agent_prompts ORDER BY created_at DESC').all() as AgentPrompt[];
  }

  async getById(id: number): Promise<AgentPrompt | null> {
    return (this.db.prepare('SELECT * FROM agent_prompts WHERE id = ?').get(id) as AgentPrompt) ?? null;
  }

  async create(data: CreateAgentPrompt): Promise<AgentPrompt> {
    const result = this.db
      .prepare('INSERT INTO agent_prompts (title, provider_id, language, prompt, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(data.title, data.provider_id, data.language, data.prompt, data.created_by ?? null);
    return this.db.prepare('SELECT * FROM agent_prompts WHERE id = ?').get(result.lastInsertRowid) as AgentPrompt;
  }

  async update(id: number, data: UpdateAgentPrompt): Promise<AgentPrompt> {
    const current = await this.getById(id);
    if (!current) throw new Error(`AgentPrompt ${id} not found`);
    this.db.prepare('UPDATE agent_prompts SET title = ?, provider_id = ?, language = ?, prompt = ? WHERE id = ?').run(
      data.title ?? current.title,
      data.provider_id ?? current.provider_id,
      data.language ?? current.language,
      data.prompt ?? current.prompt,
      id,
    );
    return (await this.getById(id))!;
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM agent_prompts WHERE id = ?').run(id);
  }
}
