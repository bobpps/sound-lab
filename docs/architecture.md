# Architecture

## Project Structure

```
sound-labs/
├── backend/
│   ├── src/
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
│   │   └── supabase/           # DB client
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

## Database Schema (Supabase)

### Datasets

**`dialogs`** — dialog metadata
```
id            uuid PK
title         text
description   text
language      text  (BCP 47 code, e.g. "en-US", "ru-RU")
created_by    uuid FK → auth.users
created_at    timestamptz
```

**`dialog_messages`** — clean dialog lines
```
id            uuid PK
dialog_id     uuid FK → dialogs
order         int
character     int (1 or 2)
text          text
```

**`annotated_dialogs`** — annotated version of a dialog, bound to a provider
```
id            uuid PK
dialog_id     uuid FK → dialogs
provider_id   text
title         text
created_by    uuid FK → auth.users
created_at    timestamptz
```

**`annotated_messages`** — annotated lines
```
id                  uuid PK
annotated_dialog_id uuid FK → annotated_dialogs
dialog_message_id   uuid FK → dialog_messages
text                text
```

**`annotation_prompts`** — reusable LLM prompts for auto-annotation
```
id            uuid PK
title         text
provider_id   text
language      text  (BCP 47 code, e.g. "en-US", "ru-RU")
prompt        text
created_by    uuid FK → auth.users
created_at    timestamptz
```

**`agent_prompts`** — prompts for realtime voice agents
```
id            uuid PK
title         text
provider_id   text
language      text  (BCP 47 code, e.g. "en-US", "ru-RU")
prompt        text
created_by    uuid FK → auth.users
created_at    timestamptz
```

### Providers

**`providers`** — provider list with encrypted API keys
```
id              text PK  (e.g. "elevenlabs", "google", "openai")
name            text
type            text  ('tts' | 'llm' | 'realtime')
enabled         bool
encrypted_key   text
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

- **Realtime pages**: each provider has its own isolated page/component under `/realtime/{provider}` — no shared abstraction, each handles its own connection logic (WebSocket/WebRTC)
- **API keys**: stored in Supabase, encrypted at rest
- **Voices**: fetched from provider on each request — no caching in v1
- **Auto-annotation**: LLM processes dialog messages one by one with conversation history, simulating a real-time pipeline
- **Auth**: Supabase Auth
- **LLM providers**: same `providers` table as TTS/Realtime, distinguished by `type` field. User selects LLM provider + model at the point of each generation action
- **Language codes**: BCP 47 format (e.g. `en-US`, `ru-RU`) stored on `dialogs`, `annotation_prompts`, `agent_prompts` — inherited by child records, not duplicated per message (v1)
