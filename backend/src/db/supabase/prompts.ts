import type { AppSupabaseClient } from './client.js';
import type {
  AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt,
  AgentPrompt, CreateAgentPrompt, UpdateAgentPrompt,
} from '../types.js';
import type { IAnnotationPromptRepository, IAgentPromptRepository } from '../interfaces.js';

export class SupabaseAnnotationPromptRepository implements IAnnotationPromptRepository {
  constructor(private client: AppSupabaseClient, private userId?: string) {}

  async list(): Promise<AnnotationPrompt[]> {
    const { data, error } = await this.client
      .from('annotation_prompts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getById(id: number): Promise<AnnotationPrompt | null> {
    const { data, error } = await this.client
      .from('annotation_prompts').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async create(data: CreateAnnotationPrompt): Promise<AnnotationPrompt> {
    const { data: created, error } = await this.client
      .from('annotation_prompts')
      .insert({ ...data, created_by: data.created_by ?? this.userId ?? null })
      .select().single();
    if (error) throw error;
    return created;
  }

  async update(id: number, data: UpdateAnnotationPrompt): Promise<AnnotationPrompt> {
    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.provider_id !== undefined) updates.provider_id = data.provider_id;
    if (data.language !== undefined) updates.language = data.language;
    if (data.prompt !== undefined) updates.prompt = data.prompt;
    const { data: updated, error } = await this.client
      .from('annotation_prompts').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client.from('annotation_prompts').delete().eq('id', id);
    if (error) throw error;
  }
}

export class SupabaseAgentPromptRepository implements IAgentPromptRepository {
  constructor(private client: AppSupabaseClient, private userId?: string) {}

  async list(): Promise<AgentPrompt[]> {
    const { data, error } = await this.client
      .from('agent_prompts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getById(id: number): Promise<AgentPrompt | null> {
    const { data, error } = await this.client
      .from('agent_prompts').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async create(data: CreateAgentPrompt): Promise<AgentPrompt> {
    const { data: created, error } = await this.client
      .from('agent_prompts')
      .insert({ ...data, created_by: data.created_by ?? this.userId ?? null })
      .select().single();
    if (error) throw error;
    return created;
  }

  async update(id: number, data: UpdateAgentPrompt): Promise<AgentPrompt> {
    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.provider_id !== undefined) updates.provider_id = data.provider_id;
    if (data.language !== undefined) updates.language = data.language;
    if (data.prompt !== undefined) updates.prompt = data.prompt;
    const { data: updated, error } = await this.client
      .from('agent_prompts').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client.from('agent_prompts').delete().eq('id', id);
    if (error) throw error;
  }
}
