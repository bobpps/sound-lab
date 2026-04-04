# Architecture

## Project Structure

```
sound-labs/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── types.ts              # Domain types
│   │   │   ├── interfaces.ts         # Repository interfaces + IDatabase
│   │   │   ├── config.ts             # Env-based DB config
│   │   │   ├── factory.ts            # createDatabase() — returns IDatabase
│   │   │   ├── local/
│   │   │   │   ├── client.ts         # SQLite init + migrations
│   │   │   │   ├── crypto.ts         # AES-256-GCM encrypt/decrypt
│   │   │   │   ├── dialogs.ts
│   │   │   │   ├── annotations.ts
│   │   │   │   ├── prompts.ts
│   │   │   │   ├── providers.ts
│   │   │   │   └── migrations/
│   │   │   │       └── 001_initial.sql
│   │   │   └── supabase/
│   │   │       ├── client.ts         # Supabase client (sound_lab schema)
│   │   │       ├── dialogs.ts
│   │   │       ├── annotations.ts
│   │   │       ├── prompts.ts
│   │   │       ├── providers.ts
│   │   │       └── migrations/
│   │   │           └── 001_initial.sql
│   │   ├── routes/
│   │   │   ├── datasets.ts
│   │   │   ├── tts.ts
│   │   │   ├── realtime.ts
│   │   │   └── providers.ts
│   │   ├── providers/
│   │   │   ├── tts/                # TTS provider adapters
│   │   │   │   ├── base.ts         # ITTSProvider interface
│   │   │   │   ├── google.ts
│   │   │   │   ├── elevenlabs.ts
│   │   │   │   └── inworld.ts
│   │   │   └── llm/                # LLM provider adapters
│   │   │       ├── base.ts         # ILLMProvider interface
│   │   │       ├── openai.ts
│   │   │       └── anthropic.ts
│   │   ├── services/           # business logic
│   │   └── index.ts
│   ├── tests/
│   │   └── db/                 # Repository tests (SQLite in-memory)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Datasets/       # test datasets (dialogs + prompts)
│       │   ├── TTS/            # TTS testing
│       │   └── Realtime/       # realtime agents
│       │       ├── OpenAI/
│       │       ├── Gemini/
│       │       ├── ElevenLabs/
│       │       └── Inworld/
│       ├── components/
│       ├── hooks/
│       └── api/                # backend requests
│
└── docs/
```

## Database Layer

### Abstraction

The DB layer uses the **repository pattern** with two interchangeable backends:

- **Supabase** (Postgres) — production, multi-user with auth
- **Local** (SQLite via better-sqlite3) — development, single-user, zero-config

Selection is automatic: if `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set, Supabase is used. Otherwise, falls back to local SQLite at `./data/sound-lab.db`. Can be overridden via `DB_PROVIDER` env var.

### IDatabase interface

```typescript
interface IDatabase {
  dialogs: IDialogRepository;
  annotations: IAnnotationRepository;
  annotationPrompts: IAnnotationPromptRepository;
  agentPrompts: IAgentPromptRepository;
  providers: IProviderRepository;
  close(): Promise<void>;
}
```

All repository methods return `Promise<T>` — synchronous for SQLite, truly async for Supabase.

### Local mode specifics

- **Auth**: single-user, no authentication. `created_by` fields are always `null`.
- **API key encryption**: application-level AES-256-GCM via `node:crypto`. Encryption key from `ENCRYPTION_KEY` env var.
- **Migrations**: separate SQL files from Supabase (different dialects, no RLS).

### Supabase specifics

- **Schema**: all tables live in the `sound_lab` schema (isolated from `public` and other services in the same Supabase project).
- **Auth**: Supabase Auth. `created_by` references `auth.users`.
- **RLS**: enabled on all tables. Basic policy: authenticated users have full access (tighten as needed).
- **API key encryption**: same application-level AES-256-GCM as local (portable between backends).
- **Migrations**: separate SQL files with Postgres syntax, RLS policies, `sound_lab.` prefixed tables.

## Database Schema

### Primary Keys

- All entity tables use **integer autoincrement** PKs (`SERIAL` in Postgres, `INTEGER PRIMARY KEY AUTOINCREMENT` in SQLite).
- Exception: `providers.id` is a **text natural key** (e.g. `"elevenlabs"`, `"google"`, `"openai"`).

### Datasets

**`dialogs`** — dialog metadata
```
id            integer PK autoincrement
title         text
description   text
language      text  (BCP 47 code, e.g. "en-US", "ru-RU")
created_by    text/uuid (null in local mode)
created_at    timestamptz
```

**`dialog_messages`** — clean dialog lines
```
id            integer PK autoincrement
dialog_id     integer FK → dialogs (CASCADE)
order         integer
character     integer (1 or 2)
text          text
```

**`annotated_dialogs`** — annotated version of a dialog, bound to a provider
```
id            integer PK autoincrement
dialog_id     integer FK → dialogs (CASCADE)
provider_id   text
title         text
created_by    text/uuid (null in local mode)
created_at    timestamptz
```

**`annotated_messages`** — annotated lines
```
id                  integer PK autoincrement
annotated_dialog_id integer FK → annotated_dialogs (CASCADE)
dialog_message_id   integer FK → dialog_messages
text                text
```

**`annotation_prompts`** — reusable LLM prompts for auto-annotation
```
id            integer PK autoincrement
title         text
provider_id   text
language      text  (BCP 47 code)
prompt        text
created_by    text/uuid (null in local mode)
created_at    timestamptz
```

**`agent_prompts`** — prompts for realtime voice agents
```
id            integer PK autoincrement
title         text
provider_id   text
language      text  (BCP 47 code)
prompt        text
created_by    text/uuid (null in local mode)
created_at    timestamptz
```

### Providers

**`providers`** — provider list with encrypted API keys
```
id              text PK  (e.g. "elevenlabs", "google", "openai")
name            text
type            text  ('tts' | 'llm' | 'realtime')
enabled         boolean
encrypted_key   text  (AES-256-GCM encrypted, application-level)
created_at      timestamptz
```

## Provider Interfaces

### TTS

Each TTS provider implements `ITTSProvider`:

```typescript
interface IVoice {
  id: string
  name: string
  language: string
  gender?: 'male' | 'female' | 'neutral'
  description?: string
  previewUrl?: string
  providerMeta?: Record<string, unknown>
}

interface ISynthesizeOptions {
  voiceId: string
  text: string
  speed?: number
  temperature?: number
  format?: 'mp3' | 'opus' | 'linear16'
  sampleRate?: 16000 | 24000 | 48000
}

interface ITTSProvider {
  id: string
  name: string
  getVoices(): Promise<IVoice[]>
  synthesize(options: ISynthesizeOptions): Promise<Buffer | ReadableStream>
  validateCredentials(credentials: Record<string, string>): Promise<boolean>
}
```

Provider-specific settings (e.g. `stability` for ElevenLabs) are loaded dynamically per model and passed via `providerMeta`.

### LLM

Each LLM provider implements `ILLMProvider`:

```typescript
interface ILLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ILLMProvider {
  id: string
  name: string
  getModels(): Promise<string[]>
  complete(messages: ILLMMessage[], model: string): Promise<string>
}
```

Used for: dialog generation, dialog editing, auto-annotation.

## Key Decisions

- **DB abstraction**: repository pattern with factory. Supabase for production, SQLite for local dev. Auto-detect based on env vars.
- **Integer PKs**: all tables use integer autoincrement for simplicity and cross-DB compatibility. `providers.id` is the exception (text natural key).
- **Supabase schema**: `sound_lab` — isolates tables from `public` and other services sharing the same project.
- **Separate migrations**: each backend has its own SQL migration files. Postgres has RLS, UUID references, `TIMESTAMPTZ`; SQLite has `INTEGER`, `TEXT` datetime, no RLS.
- **API key encryption**: AES-256-GCM at the application level (node:crypto) in both backends. Same encryption key, portable data.
- **Local auth**: single-user mode, no authentication. `created_by` is always null.
- **Realtime pages**: each provider has its own isolated page/component under `/realtime/{provider}` — no shared abstraction, each handles its own connection logic (WebSocket/WebRTC)
- **Voices**: fetched from provider on each request — no caching in v1
- **Auto-annotation**: LLM processes dialog messages one by one with conversation history, simulating a real-time pipeline
- **LLM providers**: same `providers` table as TTS/Realtime, distinguished by `type` field. User selects LLM provider + model at the point of each generation action
- **Language codes**: BCP 47 format (e.g. `en-US`, `ru-RU`) stored on `dialogs`, `annotation_prompts`, `agent_prompts` — inherited by child records, not duplicated per message (v1)
