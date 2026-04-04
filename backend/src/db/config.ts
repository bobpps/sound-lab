export interface DbConfig {
  provider: 'supabase' | 'local';
  supabase?: {
    url: string;
    serviceKey: string;
  };
  local?: {
    path: string;
  };
  encryptionKey: string;
}

export function loadDbConfig(): DbConfig {
  const provider = process.env.DB_PROVIDER as 'supabase' | 'local' | undefined;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const encryptionKey = process.env.ENCRYPTION_KEY || 'dev-encryption-key-do-not-use-in-prod';

  if (provider === 'supabase' || (!provider && supabaseUrl && supabaseKey)) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for supabase provider');
    }
    return {
      provider: 'supabase',
      supabase: { url: supabaseUrl, serviceKey: supabaseKey },
      encryptionKey,
    };
  }

  return {
    provider: 'local',
    local: { path: process.env.SQLITE_PATH || './data/sound-lab.db' },
    encryptionKey,
  };
}
