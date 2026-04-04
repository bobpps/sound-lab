CREATE TABLE IF NOT EXISTS providers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('tts', 'llm', 'realtime')),
  enabled     INTEGER NOT NULL DEFAULT 1,
  encrypted_key TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dialogs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  language    TEXT NOT NULL,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dialog_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dialog_id   INTEGER NOT NULL REFERENCES dialogs(id) ON DELETE CASCADE,
  "order"     INTEGER NOT NULL,
  character   INTEGER NOT NULL CHECK (character IN (1, 2)),
  text        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annotated_dialogs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dialog_id   INTEGER NOT NULL REFERENCES dialogs(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  title       TEXT NOT NULL,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS annotated_messages (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  annotated_dialog_id   INTEGER NOT NULL REFERENCES annotated_dialogs(id) ON DELETE CASCADE,
  dialog_message_id     INTEGER NOT NULL REFERENCES dialog_messages(id),
  text                  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annotation_prompts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  language    TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_prompts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  language    TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
