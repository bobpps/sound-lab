CREATE SCHEMA IF NOT EXISTS sound_lab;

CREATE TABLE IF NOT EXISTS sound_lab.providers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('tts', 'llm', 'realtime')),
  enabled       BOOLEAN NOT NULL DEFAULT true,
  encrypted_key TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sound_lab.dialogs (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  language      TEXT NOT NULL,
  created_by    UUID REFERENCES auth.users,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sound_lab.dialog_messages (
  id            SERIAL PRIMARY KEY,
  dialog_id     INTEGER NOT NULL REFERENCES sound_lab.dialogs(id) ON DELETE CASCADE,
  "order"       INTEGER NOT NULL,
  character     INTEGER NOT NULL CHECK (character IN (1, 2)),
  text          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sound_lab.annotated_dialogs (
  id            SERIAL PRIMARY KEY,
  dialog_id     INTEGER NOT NULL REFERENCES sound_lab.dialogs(id) ON DELETE CASCADE,
  provider_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  created_by    UUID REFERENCES auth.users,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sound_lab.annotated_messages (
  id                    SERIAL PRIMARY KEY,
  annotated_dialog_id   INTEGER NOT NULL REFERENCES sound_lab.annotated_dialogs(id) ON DELETE CASCADE,
  dialog_message_id     INTEGER NOT NULL REFERENCES sound_lab.dialog_messages(id),
  text                  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sound_lab.annotation_prompts (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  provider_id   TEXT NOT NULL,
  language      TEXT NOT NULL,
  prompt        TEXT NOT NULL,
  created_by    UUID REFERENCES auth.users,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sound_lab.agent_prompts (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  provider_id   TEXT NOT NULL,
  language      TEXT NOT NULL,
  prompt        TEXT NOT NULL,
  created_by    UUID REFERENCES auth.users,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE sound_lab.dialogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_lab.dialog_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_lab.annotated_dialogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_lab.annotated_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_lab.annotation_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_lab.agent_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_lab.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON sound_lab.dialogs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON sound_lab.dialog_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON sound_lab.annotated_dialogs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON sound_lab.annotated_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON sound_lab.annotation_prompts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON sound_lab.agent_prompts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON sound_lab.providers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
