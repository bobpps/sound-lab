import { createClient } from '@supabase/supabase-js';

export type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;

export function createSupabaseClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    db: { schema: 'sound_lab' },
    auth: { persistSession: false },
  });
}
