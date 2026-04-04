import type { IDatabase } from './interfaces.js';
import { loadDbConfig, type DbConfig } from './config.js';

export async function createDatabase(config?: DbConfig): Promise<IDatabase> {
  const cfg = config ?? loadDbConfig();

  if (cfg.provider === 'supabase') {
    const { createSupabaseClient } = await import('./supabase/client.js');
    const { SupabaseDialogRepository } = await import('./supabase/dialogs.js');
    const { SupabaseAnnotationRepository } = await import('./supabase/annotations.js');
    const { SupabaseAnnotationPromptRepository, SupabaseAgentPromptRepository } = await import('./supabase/prompts.js');
    const { SupabaseProviderRepository } = await import('./supabase/providers.js');

    const client = createSupabaseClient(cfg.supabase!.url, cfg.supabase!.serviceKey);

    return {
      dialogs: new SupabaseDialogRepository(client),
      annotations: new SupabaseAnnotationRepository(client),
      annotationPrompts: new SupabaseAnnotationPromptRepository(client),
      agentPrompts: new SupabaseAgentPromptRepository(client),
      providers: new SupabaseProviderRepository(client, cfg.encryptionKey),
      async close() { /* Supabase client has no explicit close */ },
    };
  }

  const { createLocalDb } = await import('./local/client.js');
  const { LocalDialogRepository } = await import('./local/dialogs.js');
  const { LocalAnnotationRepository } = await import('./local/annotations.js');
  const { LocalAnnotationPromptRepository, LocalAgentPromptRepository } = await import('./local/prompts.js');
  const { LocalProviderRepository } = await import('./local/providers.js');

  const sqliteDb = createLocalDb(cfg.local!.path);

  return {
    dialogs: new LocalDialogRepository(sqliteDb),
    annotations: new LocalAnnotationRepository(sqliteDb),
    annotationPrompts: new LocalAnnotationPromptRepository(sqliteDb),
    agentPrompts: new LocalAgentPromptRepository(sqliteDb),
    providers: new LocalProviderRepository(sqliteDb, cfg.encryptionKey),
    async close() { sqliteDb.close(); },
  };
}
