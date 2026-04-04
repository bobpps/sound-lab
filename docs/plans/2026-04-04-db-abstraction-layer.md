# DB Abstraction Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Create a database abstraction layer with repository pattern, supporting Supabase (Postgres) and SQLite (local) backends, auto-selecting based on environment.

**Architecture:** Repository interfaces define the data contract. Two implementations — `local/` (better-sqlite3) and `supabase/` (@supabase/supabase-js with `sound_lab` schema). A factory reads env config and returns the appropriate `IDatabase` instance. Encryption for API keys via `node:crypto` in both backends.

**Tech Stack:** TypeScript, better-sqlite3, @supabase/supabase-js, node:crypto, vitest

---

## File Structure

```
backend/
  src/
    db/
      types.ts                        # Domain types (Dialog, Provider, etc.)
      interfaces.ts                   # Repository interfaces + IDatabase
      config.ts                       # Env-based DB config loader
      factory.ts                      # createDatabase() factory
      local/
        client.ts                     # SQLite init + migration runner
        crypto.ts                     # encrypt/decrypt via node:crypto
        dialogs.ts                    # LocalDialogRepository
        annotations.ts               # LocalAnnotationRepository
        prompts.ts                    # LocalPromptRepository
        providers.ts                  # LocalProviderRepository
        migrations/
          001_initial.sql             # SQLite schema
      supabase/
        client.ts                     # Supabase client init
        dialogs.ts                    # SupabaseDialogRepository
        annotations.ts               # SupabaseAnnotationRepository
        prompts.ts                    # SupabasePromptRepository
        providers.ts                  # SupabaseProviderRepository
        migrations/
          001_initial.sql             # Postgres schema (sound_lab schema)
    index.ts                          # (modify) Wire DB into server
  tests/
    db/
      test-helpers.ts                 # In-memory SQLite test helper
      crypto.test.ts
      dialogs.test.ts
      annotations.test.ts
      prompts.test.ts
      providers.test.ts
  vitest.config.ts                    # Vitest configuration
  package.json                        # (modify) Add deps
  .env.example                        # Env var documentation
```

---

## Task 1: Project Setup

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`

- [ ] **Step 1: Add dependencies**

In `backend/package.json`, add to `dependencies`:

```json
"better-sqlite3": "^11.0.0",
"@supabase/supabase-js": "^2.0.0"
```

Add to `devDependencies`:

```json
"@types/better-sqlite3": "^7.0.0",
"vitest": "^3.0.0"
```

Add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Create vitest config**

Create `backend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 3: Create .env.example**

Create `backend/.env.example`:

```bash
# Database provider: "supabase" or "local" (default: auto-detect)
# If SUPABASE_URL and SUPABASE_SERVICE_KEY are set, defaults to "supabase"
# Otherwise defaults to "local"
DB_PROVIDER=

# Supabase (required if DB_PROVIDER=supabase)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Local SQLite (optional, default: ./data/sound-lab.db)
SQLITE_PATH=./data/sound-lab.db

# Encryption key for provider API keys (required in production)
ENCRYPTION_KEY=
```

- [ ] **Step 4: Install dependencies**

Run: `cd backend && npm install`

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/vitest.config.ts backend/.env.example
git commit -m "chore: add DB layer dependencies (better-sqlite3, supabase-js, vitest)"
```

---

## Task 2: Domain Types and Repository Interfaces

**Files:**
- Create: `backend/src/db/types.ts`
- Create: `backend/src/db/interfaces.ts`

- [ ] **Step 1: Create domain types**

Create `backend/src/db/types.ts`:

```typescript
// --- Provider ---

export type ProviderType = 'tts' | 'llm' | 'realtime';

export interface Provider {
  id: string; // natural key: "elevenlabs", "google", "openai", etc.
  name: string;
  type: ProviderType;
  enabled: boolean;
  created_at: string;
}

export interface CreateProvider {
  id: string;
  name: string;
  type: ProviderType;
}

export interface UpdateProvider {
  name?: string;
  type?: ProviderType;
  enabled?: boolean;
}

// --- Dialog ---

export interface Dialog {
  id: number;
  title: string;
  description: string | null;
  language: string; // BCP 47
  created_by: string | null;
  created_at: string;
}

export interface DialogMessage {
  id: number;
  dialog_id: number;
  order: number;
  character: 1 | 2;
  text: string;
}

export interface DialogWithMessages extends Dialog {
  messages: DialogMessage[];
}

export interface CreateDialog {
  title: string;
  description?: string;
  language: string;
  created_by?: string;
}

export interface UpdateDialog {
  title?: string;
  description?: string;
  language?: string;
}

export interface CreateDialogMessage {
  dialog_id: number;
  order: number;
  character: 1 | 2;
  text: string;
}

export interface UpdateDialogMessage {
  character?: 1 | 2;
  text?: string;
}

// --- Annotated Dialog ---

export interface AnnotatedDialog {
  id: number;
  dialog_id: number;
  provider_id: string;
  title: string;
  created_by: string | null;
  created_at: string;
}

export interface AnnotatedMessage {
  id: number;
  annotated_dialog_id: number;
  dialog_message_id: number;
  text: string;
}

export interface AnnotatedDialogWithMessages extends AnnotatedDialog {
  messages: AnnotatedMessage[];
}

export interface CreateAnnotatedDialog {
  dialog_id: number;
  provider_id: string;
  title: string;
  created_by?: string;
}

export interface CreateAnnotatedMessage {
  annotated_dialog_id: number;
  dialog_message_id: number;
  text: string;
}

export interface UpdateAnnotatedMessage {
  text: string;
}

// --- Annotation Prompt ---

export interface AnnotationPrompt {
  id: number;
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateAnnotationPrompt {
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by?: string;
}

export interface UpdateAnnotationPrompt {
  title?: string;
  provider_id?: string;
  language?: string;
  prompt?: string;
}

// --- Agent Prompt ---

export interface AgentPrompt {
  id: number;
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateAgentPrompt {
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by?: string;
}

export interface UpdateAgentPrompt {
  title?: string;
  provider_id?: string;
  language?: string;
  prompt?: string;
}
```

- [ ] **Step 2: Create repository interfaces**

Create `backend/src/db/interfaces.ts`:

```typescript
import type {
  Dialog, DialogMessage, DialogWithMessages,
  CreateDialog, UpdateDialog, CreateDialogMessage, UpdateDialogMessage,
  AnnotatedDialog, AnnotatedDialogWithMessages, CreateAnnotatedDialog,
  AnnotatedMessage, CreateAnnotatedMessage, UpdateAnnotatedMessage,
  AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt,
  AgentPrompt, CreateAgentPrompt, UpdateAgentPrompt,
  Provider, CreateProvider, UpdateProvider, ProviderType,
} from './types.js';

export interface IDialogRepository {
  list(): Promise<Dialog[]>;
  getById(id: number): Promise<Dialog | null>;
  getWithMessages(id: number): Promise<DialogWithMessages | null>;
  create(data: CreateDialog): Promise<Dialog>;
  update(id: number, data: UpdateDialog): Promise<Dialog>;
  delete(id: number): Promise<void>;
  createMessage(data: CreateDialogMessage): Promise<DialogMessage>;
  updateMessage(id: number, data: UpdateDialogMessage): Promise<DialogMessage>;
  deleteMessage(id: number): Promise<void>;
}

export interface IAnnotationRepository {
  listByDialog(dialogId: number): Promise<AnnotatedDialog[]>;
  getWithMessages(id: number): Promise<AnnotatedDialogWithMessages | null>;
  create(data: CreateAnnotatedDialog): Promise<AnnotatedDialog>;
  delete(id: number): Promise<void>;
  createMessage(data: CreateAnnotatedMessage): Promise<AnnotatedMessage>;
  updateMessage(id: number, data: UpdateAnnotatedMessage): Promise<AnnotatedMessage>;
  deleteMessage(id: number): Promise<void>;
}

export interface IAnnotationPromptRepository {
  list(): Promise<AnnotationPrompt[]>;
  getById(id: number): Promise<AnnotationPrompt | null>;
  create(data: CreateAnnotationPrompt): Promise<AnnotationPrompt>;
  update(id: number, data: UpdateAnnotationPrompt): Promise<AnnotationPrompt>;
  delete(id: number): Promise<void>;
}

export interface IAgentPromptRepository {
  list(): Promise<AgentPrompt[]>;
  getById(id: number): Promise<AgentPrompt | null>;
  create(data: CreateAgentPrompt): Promise<AgentPrompt>;
  update(id: number, data: UpdateAgentPrompt): Promise<AgentPrompt>;
  delete(id: number): Promise<void>;
}

export interface IProviderRepository {
  list(type?: ProviderType): Promise<Provider[]>;
  getById(id: string): Promise<Provider | null>;
  create(data: CreateProvider): Promise<Provider>;
  update(id: string, data: UpdateProvider): Promise<Provider>;
  delete(id: string): Promise<void>;
  getDecryptedKey(id: string): Promise<string | null>;
  setKey(id: string, key: string): Promise<void>;
}

export interface IDatabase {
  dialogs: IDialogRepository;
  annotations: IAnnotationRepository;
  annotationPrompts: IAnnotationPromptRepository;
  agentPrompts: IAgentPromptRepository;
  providers: IProviderRepository;
  close(): Promise<void>;
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/types.ts backend/src/db/interfaces.ts
git commit -m "feat: add domain types and repository interfaces for DB layer"
```

---

## Task 3: Config and Crypto Utility

**Files:**
- Create: `backend/src/db/config.ts`
- Create: `backend/src/db/local/crypto.ts`
- Create: `backend/tests/db/crypto.test.ts`

- [ ] **Step 1: Create DB config loader**

Create `backend/src/db/config.ts`:

```typescript
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
```

- [ ] **Step 2: Write crypto tests**

Create `backend/tests/db/crypto.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/db/local/crypto.js';

describe('crypto', () => {
  const key = 'test-encryption-key-32chars-long!';

  it('encrypts and decrypts a string', () => {
    const original = 'sk-test-api-key-12345';
    const encrypted = encrypt(original, key);
    expect(encrypted).not.toBe(original);
    expect(decrypt(encrypted, key)).toBe(original);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const original = 'same-input';
    const a = encrypt(original, key);
    const b = encrypt(original, key);
    expect(a).not.toBe(b);
  });

  it('throws on wrong key', () => {
    const encrypted = encrypt('secret', key);
    expect(() => decrypt(encrypted, 'wrong-key-that-is-32chars-long!')).toThrow();
  });

  it('handles empty string', () => {
    const encrypted = encrypt('', key);
    expect(decrypt(encrypted, key)).toBe('');
  });

  it('handles unicode', () => {
    const original = 'key-test-unicode';
    const encrypted = encrypt(original, key);
    expect(decrypt(encrypted, key)).toBe(original);
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

Run: `cd backend && npx vitest run tests/db/crypto.test.ts`
Expected: FAIL — module `../../src/db/local/crypto.js` not found

- [ ] **Step 4: Implement crypto utility**

Create `backend/src/db/local/crypto.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string, password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export function decrypt(data: string, password: string): string {
  const buf = Buffer.from(data, 'base64');
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const tag = buf.subarray(28, 44);
  const encrypted = buf.subarray(44);
  const key = scryptSync(password, salt, 32);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd backend && npx vitest run tests/db/crypto.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/config.ts backend/src/db/local/crypto.ts backend/tests/db/crypto.test.ts
git commit -m "feat: add DB config loader and crypto utility for API key encryption"
```

---

## Task 4: SQLite Migration and Client

**Files:**
- Create: `backend/src/db/local/migrations/001_initial.sql`
- Create: `backend/src/db/local/client.ts`
- Create: `backend/tests/db/test-helpers.ts`

- [ ] **Step 1: Create SQLite migration**

Create `backend/src/db/local/migrations/001_initial.sql`:

```sql
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
```

- [ ] **Step 2: Create SQLite client**

Create `backend/src/db/local/client.ts`:

```typescript
import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createLocalDb(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function createMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  const migrationPath = resolve(__dirname, 'migrations/001_initial.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  db.exec(sql);
}
```

- [ ] **Step 3: Create test helper**

Create `backend/tests/db/test-helpers.ts`:

```typescript
import { createMemoryDb } from '../../src/db/local/client.js';
import type Database from 'better-sqlite3';

export function createTestDb(): Database.Database {
  return createMemoryDb();
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/local/migrations/001_initial.sql backend/src/db/local/client.ts backend/tests/db/test-helpers.ts
git commit -m "feat: add SQLite migration schema and client with migration runner"
```

---

## Task 5: Local DialogRepository (TDD)

**Files:**
- Create: `backend/tests/db/dialogs.test.ts`
- Create: `backend/src/db/local/dialogs.ts`

- [ ] **Step 1: Write tests**

Create `backend/tests/db/dialogs.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers.js';
import { LocalDialogRepository } from '../../src/db/local/dialogs.js';
import type Database from 'better-sqlite3';

describe('LocalDialogRepository', () => {
  let db: Database.Database;
  let repo: LocalDialogRepository;

  beforeEach(() => {
    db = createTestDb();
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd backend && npx vitest run tests/db/dialogs.test.ts`
Expected: FAIL — cannot resolve `../../src/db/local/dialogs.js`

- [ ] **Step 3: Implement LocalDialogRepository**

Create `backend/src/db/local/dialogs.ts`:

```typescript
import type Database from 'better-sqlite3';
import type {
  Dialog, DialogMessage, DialogWithMessages,
  CreateDialog, UpdateDialog, CreateDialogMessage, UpdateDialogMessage,
} from '../types.js';
import type { IDialogRepository } from '../interfaces.js';

export class LocalDialogRepository implements IDialogRepository {
  constructor(private db: Database.Database) {}

  async list(): Promise<Dialog[]> {
    return this.db.prepare('SELECT * FROM dialogs ORDER BY created_at DESC').all() as Dialog[];
  }

  async getById(id: number): Promise<Dialog | null> {
    return (this.db.prepare('SELECT * FROM dialogs WHERE id = ?').get(id) as Dialog) ?? null;
  }

  async getWithMessages(id: number): Promise<DialogWithMessages | null> {
    const dialog = await this.getById(id);
    if (!dialog) return null;
    const messages = this.db
      .prepare('SELECT * FROM dialog_messages WHERE dialog_id = ? ORDER BY "order"')
      .all(id) as DialogMessage[];
    return { ...dialog, messages };
  }

  async create(data: CreateDialog): Promise<Dialog> {
    const result = this.db
      .prepare('INSERT INTO dialogs (title, description, language, created_by) VALUES (?, ?, ?, ?)')
      .run(data.title, data.description ?? null, data.language, data.created_by ?? null);
    return (await this.getById(result.lastInsertRowid as number))!;
  }

  async update(id: number, data: UpdateDialog): Promise<Dialog> {
    const current = await this.getById(id);
    if (!current) throw new Error(`Dialog ${id} not found`);
    this.db.prepare('UPDATE dialogs SET title = ?, description = ?, language = ? WHERE id = ?').run(
      data.title ?? current.title,
      data.description !== undefined ? data.description : current.description,
      data.language ?? current.language,
      id,
    );
    return (await this.getById(id))!;
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM dialogs WHERE id = ?').run(id);
  }

  async createMessage(data: CreateDialogMessage): Promise<DialogMessage> {
    const result = this.db
      .prepare('INSERT INTO dialog_messages (dialog_id, "order", character, text) VALUES (?, ?, ?, ?)')
      .run(data.dialog_id, data.order, data.character, data.text);
    return this.db.prepare('SELECT * FROM dialog_messages WHERE id = ?').get(result.lastInsertRowid) as DialogMessage;
  }

  async updateMessage(id: number, data: UpdateDialogMessage): Promise<DialogMessage> {
    const current = this.db.prepare('SELECT * FROM dialog_messages WHERE id = ?').get(id) as DialogMessage | undefined;
    if (!current) throw new Error(`Message ${id} not found`);
    this.db.prepare('UPDATE dialog_messages SET character = ?, text = ? WHERE id = ?').run(
      data.character ?? current.character,
      data.text ?? current.text,
      id,
    );
    return this.db.prepare('SELECT * FROM dialog_messages WHERE id = ?').get(id) as DialogMessage;
  }

  async deleteMessage(id: number): Promise<void> {
    this.db.prepare('DELETE FROM dialog_messages WHERE id = ?').run(id);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd backend && npx vitest run tests/db/dialogs.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/local/dialogs.ts backend/tests/db/dialogs.test.ts
git commit -m "feat: add LocalDialogRepository with tests"
```

---

## Task 6: Local AnnotationRepository (TDD)

**Files:**
- Create: `backend/tests/db/annotations.test.ts`
- Create: `backend/src/db/local/annotations.ts`

- [ ] **Step 1: Write tests**

Create `backend/tests/db/annotations.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd backend && npx vitest run tests/db/annotations.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement LocalAnnotationRepository**

Create `backend/src/db/local/annotations.ts`:

```typescript
import type Database from 'better-sqlite3';
import type {
  AnnotatedDialog, AnnotatedDialogWithMessages, AnnotatedMessage,
  CreateAnnotatedDialog, CreateAnnotatedMessage, UpdateAnnotatedMessage,
} from '../types.js';
import type { IAnnotationRepository } from '../interfaces.js';

export class LocalAnnotationRepository implements IAnnotationRepository {
  constructor(private db: Database.Database) {}

  async listByDialog(dialogId: number): Promise<AnnotatedDialog[]> {
    return this.db
      .prepare('SELECT * FROM annotated_dialogs WHERE dialog_id = ? ORDER BY created_at DESC')
      .all(dialogId) as AnnotatedDialog[];
  }

  async getWithMessages(id: number): Promise<AnnotatedDialogWithMessages | null> {
    const dialog = this.db.prepare('SELECT * FROM annotated_dialogs WHERE id = ?').get(id) as AnnotatedDialog | undefined;
    if (!dialog) return null;
    const messages = this.db
      .prepare('SELECT * FROM annotated_messages WHERE annotated_dialog_id = ? ORDER BY id')
      .all(id) as AnnotatedMessage[];
    return { ...dialog, messages };
  }

  async create(data: CreateAnnotatedDialog): Promise<AnnotatedDialog> {
    const result = this.db
      .prepare('INSERT INTO annotated_dialogs (dialog_id, provider_id, title, created_by) VALUES (?, ?, ?, ?)')
      .run(data.dialog_id, data.provider_id, data.title, data.created_by ?? null);
    return this.db.prepare('SELECT * FROM annotated_dialogs WHERE id = ?').get(result.lastInsertRowid) as AnnotatedDialog;
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM annotated_dialogs WHERE id = ?').run(id);
  }

  async createMessage(data: CreateAnnotatedMessage): Promise<AnnotatedMessage> {
    const result = this.db
      .prepare('INSERT INTO annotated_messages (annotated_dialog_id, dialog_message_id, text) VALUES (?, ?, ?)')
      .run(data.annotated_dialog_id, data.dialog_message_id, data.text);
    return this.db.prepare('SELECT * FROM annotated_messages WHERE id = ?').get(result.lastInsertRowid) as AnnotatedMessage;
  }

  async updateMessage(id: number, data: UpdateAnnotatedMessage): Promise<AnnotatedMessage> {
    this.db.prepare('UPDATE annotated_messages SET text = ? WHERE id = ?').run(data.text, id);
    return this.db.prepare('SELECT * FROM annotated_messages WHERE id = ?').get(id) as AnnotatedMessage;
  }

  async deleteMessage(id: number): Promise<void> {
    this.db.prepare('DELETE FROM annotated_messages WHERE id = ?').run(id);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd backend && npx vitest run tests/db/annotations.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/local/annotations.ts backend/tests/db/annotations.test.ts
git commit -m "feat: add LocalAnnotationRepository with tests"
```

---

## Task 7: Local PromptRepository (TDD)

**Files:**
- Create: `backend/tests/db/prompts.test.ts`
- Create: `backend/src/db/local/prompts.ts`

Handles both `annotation_prompts` and `agent_prompts` tables via `LocalAnnotationPromptRepository` and `LocalAgentPromptRepository`.

- [ ] **Step 1: Write tests**

Create `backend/tests/db/prompts.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd backend && npx vitest run tests/db/prompts.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement prompt repositories**

Create `backend/src/db/local/prompts.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd backend && npx vitest run tests/db/prompts.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/local/prompts.ts backend/tests/db/prompts.test.ts
git commit -m "feat: add LocalAnnotationPromptRepository and LocalAgentPromptRepository with tests"
```

---

## Task 8: Local ProviderRepository (TDD)

**Files:**
- Create: `backend/tests/db/providers.test.ts`
- Create: `backend/src/db/local/providers.ts`

- [ ] **Step 1: Write tests**

Create `backend/tests/db/providers.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers.js';
import { LocalProviderRepository } from '../../src/db/local/providers.js';
import type Database from 'better-sqlite3';

const ENCRYPTION_KEY = 'test-encryption-key-for-testing!';

describe('LocalProviderRepository', () => {
  let db: Database.Database;
  let repo: LocalProviderRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new LocalProviderRepository(db, ENCRYPTION_KEY);
  });

  describe('create and getById', () => {
    it('creates a provider and retrieves it', async () => {
      const provider = await repo.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      expect(provider.id).toBe('elevenlabs');
      expect(provider.name).toBe('ElevenLabs');
      expect(provider.type).toBe('tts');

      const found = await repo.getById('elevenlabs');
      expect(found?.name).toBe('ElevenLabs');
    });

    it('returns null for non-existent id', async () => {
      expect(await repo.getById('nonexistent')).toBeNull();
    });
  });

  describe('list', () => {
    it('lists all providers', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      await repo.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      expect(await repo.list()).toHaveLength(2);
    });

    it('filters by type', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      await repo.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      await repo.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      const ttsList = await repo.list('tts');
      expect(ttsList).toHaveLength(2);
      expect(ttsList.every(p => p.type === 'tts')).toBe(true);
    });
  });

  describe('update', () => {
    it('updates provider fields', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      const updated = await repo.update('google', { name: 'Google Cloud' });
      expect(updated.name).toBe('Google Cloud');
    });
  });

  describe('delete', () => {
    it('removes a provider', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      await repo.delete('google');
      expect(await repo.getById('google')).toBeNull();
    });
  });

  describe('API key encryption', () => {
    it('stores and retrieves encrypted key', async () => {
      await repo.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await repo.setKey('elevenlabs', 'sk-secret-key-12345');

      const decrypted = await repo.getDecryptedKey('elevenlabs');
      expect(decrypted).toBe('sk-secret-key-12345');
    });

    it('returns null when no key is set', async () => {
      await repo.create({ id: 'google', name: 'Google', type: 'tts' });
      expect(await repo.getDecryptedKey('google')).toBeNull();
    });

    it('encrypted value is not plaintext in DB', async () => {
      await repo.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await repo.setKey('elevenlabs', 'sk-secret');

      const row = db.prepare('SELECT encrypted_key FROM providers WHERE id = ?').get('elevenlabs') as { encrypted_key: string };
      expect(row.encrypted_key).not.toBe('sk-secret');
      expect(row.encrypted_key).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd backend && npx vitest run tests/db/providers.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement LocalProviderRepository**

Create `backend/src/db/local/providers.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { Provider, CreateProvider, UpdateProvider, ProviderType } from '../types.js';
import type { IProviderRepository } from '../interfaces.js';
import { encrypt, decrypt } from './crypto.js';

export class LocalProviderRepository implements IProviderRepository {
  constructor(
    private db: Database.Database,
    private encryptionKey: string,
  ) {}

  async list(type?: ProviderType): Promise<Provider[]> {
    if (type) {
      return this.db
        .prepare('SELECT id, name, type, enabled, created_at FROM providers WHERE type = ? ORDER BY name')
        .all(type) as Provider[];
    }
    return this.db
      .prepare('SELECT id, name, type, enabled, created_at FROM providers ORDER BY name')
      .all() as Provider[];
  }

  async getById(id: string): Promise<Provider | null> {
    return (
      this.db
        .prepare('SELECT id, name, type, enabled, created_at FROM providers WHERE id = ?')
        .get(id) as Provider
    ) ?? null;
  }

  async create(data: CreateProvider): Promise<Provider> {
    this.db
      .prepare('INSERT INTO providers (id, name, type) VALUES (?, ?, ?)')
      .run(data.id, data.name, data.type);
    return (await this.getById(data.id))!;
  }

  async update(id: string, data: UpdateProvider): Promise<Provider> {
    const current = await this.getById(id);
    if (!current) throw new Error(`Provider ${id} not found`);
    this.db.prepare('UPDATE providers SET name = ?, type = ?, enabled = ? WHERE id = ?').run(
      data.name ?? current.name,
      data.type ?? current.type,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : current.enabled,
      id,
    );
    return (await this.getById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM providers WHERE id = ?').run(id);
  }

  async getDecryptedKey(id: string): Promise<string | null> {
    const row = this.db.prepare('SELECT encrypted_key FROM providers WHERE id = ?').get(id) as
      { encrypted_key: string | null } | undefined;
    if (!row?.encrypted_key) return null;
    return decrypt(row.encrypted_key, this.encryptionKey);
  }

  async setKey(id: string, key: string): Promise<void> {
    const encrypted = encrypt(key, this.encryptionKey);
    this.db.prepare('UPDATE providers SET encrypted_key = ? WHERE id = ?').run(encrypted, id);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd backend && npx vitest run tests/db/providers.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Run all tests**

Run: `cd backend && npx vitest run`
Expected: all tests across all files PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/local/providers.ts backend/tests/db/providers.test.ts
git commit -m "feat: add LocalProviderRepository with encrypted key storage"
```

---

## Task 9: Supabase Migration, Client and Repositories

**Files:**
- Create: `backend/src/db/supabase/migrations/001_initial.sql`
- Create: `backend/src/db/supabase/client.ts`
- Create: `backend/src/db/supabase/dialogs.ts`
- Create: `backend/src/db/supabase/annotations.ts`
- Create: `backend/src/db/supabase/prompts.ts`
- Create: `backend/src/db/supabase/providers.ts`

Note: Supabase repositories are not unit-tested in this plan (requires a live Supabase instance). They follow the same interface contract validated by local repository tests.

- [ ] **Step 1: Create Supabase migration**

Create `backend/src/db/supabase/migrations/001_initial.sql`:

```sql
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
```

- [ ] **Step 2: Create Supabase client**

Create `backend/src/db/supabase/client.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, {
    db: { schema: 'sound_lab' },
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 3: Create SupabaseDialogRepository**

Create `backend/src/db/supabase/dialogs.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Dialog, DialogMessage, DialogWithMessages,
  CreateDialog, UpdateDialog, CreateDialogMessage, UpdateDialogMessage,
} from '../types.js';
import type { IDialogRepository } from '../interfaces.js';

export class SupabaseDialogRepository implements IDialogRepository {
  constructor(private client: SupabaseClient, private userId?: string) {}

  async list(): Promise<Dialog[]> {
    const { data, error } = await this.client
      .from('dialogs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getById(id: number): Promise<Dialog | null> {
    const { data, error } = await this.client
      .from('dialogs').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async getWithMessages(id: number): Promise<DialogWithMessages | null> {
    const dialog = await this.getById(id);
    if (!dialog) return null;
    const { data: messages, error } = await this.client
      .from('dialog_messages').select('*').eq('dialog_id', id).order('order');
    if (error) throw error;
    return { ...dialog, messages: messages ?? [] };
  }

  async create(data: CreateDialog): Promise<Dialog> {
    const { data: created, error } = await this.client
      .from('dialogs')
      .insert({
        title: data.title,
        description: data.description ?? null,
        language: data.language,
        created_by: data.created_by ?? this.userId ?? null,
      })
      .select().single();
    if (error) throw error;
    return created;
  }

  async update(id: number, data: UpdateDialog): Promise<Dialog> {
    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.language !== undefined) updates.language = data.language;
    const { data: updated, error } = await this.client
      .from('dialogs').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client.from('dialogs').delete().eq('id', id);
    if (error) throw error;
  }

  async createMessage(data: CreateDialogMessage): Promise<DialogMessage> {
    const { data: created, error } = await this.client
      .from('dialog_messages').insert(data).select().single();
    if (error) throw error;
    return created;
  }

  async updateMessage(id: number, data: UpdateDialogMessage): Promise<DialogMessage> {
    const { data: updated, error } = await this.client
      .from('dialog_messages').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  }

  async deleteMessage(id: number): Promise<void> {
    const { error } = await this.client.from('dialog_messages').delete().eq('id', id);
    if (error) throw error;
  }
}
```

- [ ] **Step 4: Create SupabaseAnnotationRepository**

Create `backend/src/db/supabase/annotations.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnnotatedDialog, AnnotatedDialogWithMessages, AnnotatedMessage,
  CreateAnnotatedDialog, CreateAnnotatedMessage, UpdateAnnotatedMessage,
} from '../types.js';
import type { IAnnotationRepository } from '../interfaces.js';

export class SupabaseAnnotationRepository implements IAnnotationRepository {
  constructor(private client: SupabaseClient, private userId?: string) {}

  async listByDialog(dialogId: number): Promise<AnnotatedDialog[]> {
    const { data, error } = await this.client
      .from('annotated_dialogs').select('*').eq('dialog_id', dialogId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getWithMessages(id: number): Promise<AnnotatedDialogWithMessages | null> {
    const { data: dialog, error: dErr } = await this.client
      .from('annotated_dialogs').select('*').eq('id', id).single();
    if (dErr) {
      if (dErr.code === 'PGRST116') return null;
      throw dErr;
    }
    const { data: messages, error: mErr } = await this.client
      .from('annotated_messages').select('*').eq('annotated_dialog_id', id).order('id');
    if (mErr) throw mErr;
    return { ...dialog, messages: messages ?? [] };
  }

  async create(data: CreateAnnotatedDialog): Promise<AnnotatedDialog> {
    const { data: created, error } = await this.client
      .from('annotated_dialogs')
      .insert({
        dialog_id: data.dialog_id,
        provider_id: data.provider_id,
        title: data.title,
        created_by: data.created_by ?? this.userId ?? null,
      })
      .select().single();
    if (error) throw error;
    return created;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client.from('annotated_dialogs').delete().eq('id', id);
    if (error) throw error;
  }

  async createMessage(data: CreateAnnotatedMessage): Promise<AnnotatedMessage> {
    const { data: created, error } = await this.client
      .from('annotated_messages').insert(data).select().single();
    if (error) throw error;
    return created;
  }

  async updateMessage(id: number, data: UpdateAnnotatedMessage): Promise<AnnotatedMessage> {
    const { data: updated, error } = await this.client
      .from('annotated_messages').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  }

  async deleteMessage(id: number): Promise<void> {
    const { error } = await this.client.from('annotated_messages').delete().eq('id', id);
    if (error) throw error;
  }
}
```

- [ ] **Step 5: Create SupabasePromptRepositories**

Create `backend/src/db/supabase/prompts.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt,
  AgentPrompt, CreateAgentPrompt, UpdateAgentPrompt,
} from '../types.js';
import type { IAnnotationPromptRepository, IAgentPromptRepository } from '../interfaces.js';

export class SupabaseAnnotationPromptRepository implements IAnnotationPromptRepository {
  constructor(private client: SupabaseClient, private userId?: string) {}

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
  constructor(private client: SupabaseClient, private userId?: string) {}

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
```

- [ ] **Step 6: Create SupabaseProviderRepository**

Create `backend/src/db/supabase/providers.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Provider, CreateProvider, UpdateProvider, ProviderType } from '../types.js';
import type { IProviderRepository } from '../interfaces.js';
import { encrypt, decrypt } from '../local/crypto.js';

export class SupabaseProviderRepository implements IProviderRepository {
  constructor(
    private client: SupabaseClient,
    private encryptionKey: string,
  ) {}

  async list(type?: ProviderType): Promise<Provider[]> {
    let query = this.client.from('providers').select('id, name, type, enabled, created_at').order('name');
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getById(id: string): Promise<Provider | null> {
    const { data, error } = await this.client
      .from('providers').select('id, name, type, enabled, created_at').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async create(data: CreateProvider): Promise<Provider> {
    const { data: created, error } = await this.client
      .from('providers').insert(data).select('id, name, type, enabled, created_at').single();
    if (error) throw error;
    return created;
  }

  async update(id: string, data: UpdateProvider): Promise<Provider> {
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.type !== undefined) updates.type = data.type;
    if (data.enabled !== undefined) updates.enabled = data.enabled;
    const { data: updated, error } = await this.client
      .from('providers').update(updates).eq('id', id).select('id, name, type, enabled, created_at').single();
    if (error) throw error;
    return updated;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('providers').delete().eq('id', id);
    if (error) throw error;
  }

  async getDecryptedKey(id: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('providers').select('encrypted_key').eq('id', id).single();
    if (error) throw error;
    if (!data?.encrypted_key) return null;
    return decrypt(data.encrypted_key, this.encryptionKey);
  }

  async setKey(id: string, key: string): Promise<void> {
    const encrypted = encrypt(key, this.encryptionKey);
    const { error } = await this.client
      .from('providers').update({ encrypted_key: encrypted }).eq('id', id);
    if (error) throw error;
  }
}
```

- [ ] **Step 7: Verify types compile**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add backend/src/db/supabase/
git commit -m "feat: add Supabase migration, client, and all repository implementations"
```

---

## Task 10: Database Factory and Server Integration

**Files:**
- Create: `backend/src/db/factory.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create database factory**

Create `backend/src/db/factory.ts`:

```typescript
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
```

- [ ] **Step 2: Wire DB into server**

Replace `backend/src/index.ts` with:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createDatabase } from './db/factory.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: 'http://localhost:5173',
});

const db = await createDatabase();
app.log.info(`Database provider: ${process.env.DB_PROVIDER || 'local (auto)'}`);

app.addHook('onClose', async () => {
  await db.close();
});

app.get('/health', async () => {
  return { status: 'ok' };
});

await app.listen({ port: 3000, host: '0.0.0.0' });
```

- [ ] **Step 3: Add `data/` to .gitignore**

Append to root `.gitignore`:

```
data/
```

- [ ] **Step 4: Verify server starts**

Run: `cd backend && npx tsx src/index.ts`
Expected: server starts on port 3000, logs "Database provider: local (auto)", creates `data/sound-lab.db` file

- [ ] **Step 5: Run all tests one final time**

Run: `cd backend && npx vitest run`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/factory.ts backend/src/index.ts .gitignore
git commit -m "feat: add database factory and wire DB into Fastify server"
```

---

## Task 11: Documentation Updates

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update architecture.md**

Replace `docs/architecture.md` with updated content that reflects:
- New `db/` subtree in project structure
- DB abstraction layer explanation (repository pattern, two backends, factory)
- Integer autoincrement PKs (except `providers.id` which stays TEXT)
- `sound_lab` schema for Supabase
- Local mode: SQLite, single-user (no auth), node:crypto for key encryption
- Separate migrations per backend
- Updated schema definitions showing integer PKs
- Updated Key Decisions section

- [ ] **Step 2: Verify docs are accurate against implemented code**

Read through the updated doc and cross-check file paths and interface names against actual files.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: update architecture with DB abstraction layer"
```

---

## Execution Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Project setup (deps, vitest) | -- |
| 2 | Types and interfaces | compile check |
| 3 | Config and crypto | 5 tests |
| 4 | SQLite migration and client | -- |
| 5 | LocalDialogRepository | 9 tests |
| 6 | LocalAnnotationRepository | 5 tests |
| 7 | LocalPromptRepository | 9 tests |
| 8 | LocalProviderRepository | 7 tests |
| 9 | Supabase migration + all repos | compile check |
| 10 | Factory + server wiring | manual smoke |
| 11 | Documentation | -- |

**Total: ~35 tests, 11 tasks, ~25 files created/modified**
