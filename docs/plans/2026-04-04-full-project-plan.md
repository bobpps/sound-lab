# Sound Lab — Full Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Sound Lab application — an internal tool for testing TTS providers, realtime voice agents, and managing dialog datasets.

**Architecture:** Full-stack TypeScript monorepo with Fastify 5 backend and React 19 frontend. Repository pattern for dual-database support (SQLite/Supabase) is already implemented. Provider adapter pattern for TTS (Google, ElevenLabs, Inworld), LLM (OpenAI, Anthropic), and Realtime services. Feature-based frontend with TanStack Query for server state.

**Tech Stack:** TypeScript, Fastify 5, React 19, Vite 8, TypeBox, TanStack Query, Zustand, React Router v7, Tailwind CSS, better-sqlite3, Supabase, Vitest

---

## Prerequisites

The database layer is already fully implemented and tested (44+ tests):

- Domain types: `backend/src/db/types.ts`
- Repository interfaces: `backend/src/db/interfaces.ts`
- SQLite implementations: `backend/src/db/local/*.ts`
- Supabase implementations: `backend/src/db/supabase/*.ts`
- Factory: `backend/src/db/factory.ts`
- Config: `backend/src/db/config.ts`
- Crypto: `backend/src/db/local/crypto.ts`
- Tests: `backend/tests/db/*.test.ts`

Key types from `backend/src/db/types.ts`:
- `Provider` (id: string natural key, name, type: 'tts'|'llm'|'realtime', enabled, created_at)
- `Dialog` (id: number, title, description, language, created_by, created_at)
- `DialogMessage` (id, dialog_id, order, character: 1|2, text)
- `AnnotatedDialog` (id, dialog_id, provider_id, title, created_by, created_at)
- `AnnotatedMessage` (id, annotated_dialog_id, dialog_message_id, text)
- `AnnotationPrompt` (id, title, provider_id, language, prompt, created_by, created_at)
- `AgentPrompt` (id, title, provider_id, language, prompt, created_by, created_at)

Key interfaces from `backend/src/db/interfaces.ts`:
- `IDialogRepository` — list, getById, getWithMessages, create, update, delete, createMessage, updateMessage, deleteMessage
- `IAnnotationRepository` — listByDialog, getWithMessages, create, delete, createMessage, updateMessage, deleteMessage
- `IAnnotationPromptRepository` — list, getById, create, update, delete
- `IAgentPromptRepository` — list, getById, create, update, delete
- `IProviderRepository` — list(type?), getById, create, update, delete, getDecryptedKey, setKey
- `IDatabase` — aggregates all repos + close()

---

## File Structure (new files to create)

```
backend/
├── src/
│   ├── app.ts                              # buildApp() factory
│   ├── index.ts                            # entry point (calls buildApp + listen)
│   ├── plugins/
│   │   └── db.ts                           # DB decorator plugin (fastify-plugin)
│   ├── schemas/
│   │   ├── common.ts                       # Shared TypeBox schemas (id params, errors)
│   │   ├── provider.ts                     # Provider request/response schemas
│   │   ├── dialog.ts                       # Dialog + message schemas
│   │   ├── annotation.ts                   # Annotation schemas
│   │   └── prompt.ts                       # Annotation prompt + agent prompt schemas
│   ├── routes/
│   │   ├── health/
│   │   │   └── index.ts                    # GET /health
│   │   ├── providers/
│   │   │   └── index.ts                    # CRUD + key management
│   │   ├── dialogs/
│   │   │   └── index.ts                    # CRUD + messages
│   │   ├── annotation-prompts/
│   │   │   └── index.ts                    # CRUD
│   │   ├── agent-prompts/
│   │   │   └── index.ts                    # CRUD
│   │   ├── annotations/
│   │   │   └── index.ts                    # CRUD + messages
│   │   ├── tts/
│   │   │   └── index.ts                    # voices, synthesize
│   │   ├── llm/
│   │   │   └── index.ts                    # models, complete
│   │   └── services/
│   │       └── index.ts                    # generate, edit, annotate
│   ├── providers/
│   │   ├── tts/
│   │   │   ├── types.ts                    # ITTSProvider, IVoice, ISynthesizeOptions
│   │   │   ├── registry.ts                 # createTTSProvider(id, apiKey)
│   │   │   ├── elevenlabs.ts
│   │   │   ├── google.ts
│   │   │   └── inworld.ts
│   │   ├── llm/
│   │   │   ├── types.ts                    # ILLMProvider, ILLMMessage
│   │   │   ├── registry.ts                 # createLLMProvider(id, apiKey)
│   │   │   ├── openai.ts
│   │   │   └── anthropic.ts
│   │   └── realtime/
│   │       ├── types.ts                    # IRealtimeProvider, session types
│   │       ├── registry.ts                 # createRealtimeProvider(id, apiKey)
│   │       ├── openai.ts
│   │       ├── gemini.ts
│   │       ├── elevenlabs.ts
│   │       └── inworld.ts
│   └── services/
│       ├── dialog-generation.ts
│       ├── dialog-editing.ts
│       └── auto-annotation.ts
├── tests/
│   ├── helpers.ts                          # buildTestApp(), inject helpers
│   ├── routes/
│   │   ├── providers.test.ts
│   │   ├── dialogs.test.ts
│   │   ├── annotation-prompts.test.ts
│   │   ├── agent-prompts.test.ts
│   │   ├── annotations.test.ts
│   │   ├── tts.test.ts
│   │   ├── llm.test.ts
│   │   └── services.test.ts
│   ├── providers/
│   │   ├── elevenlabs.test.ts
│   │   ├── google-tts.test.ts
│   │   ├── openai-llm.test.ts
│   │   └── anthropic-llm.test.ts
│   └── services/
│       ├── dialog-generation.test.ts
│       ├── dialog-editing.test.ts
│       └── auto-annotation.test.ts

frontend/
├── src/
│   ├── main.tsx                            # entry (modify)
│   ├── App.tsx                             # root (rewrite)
│   ├── App.css                             # delete
│   ├── index.css                           # replace with Tailwind
│   ├── router.tsx                          # React Router config
│   ├── lib/
│   │   └── api-client.ts                   # typed fetch wrapper
│   ├── types/
│   │   └── api.ts                          # shared API response types
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx               # sidebar + header + Outlet
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Modal.tsx
│   │       ├── Tabs.tsx
│   │       └── LoadingSpinner.tsx
│   └── features/
│       ├── providers/
│       │   ├── api/
│       │   │   └── queries.ts              # TanStack Query hooks
│       │   ├── components/
│       │   │   ├── ProvidersPage.tsx
│       │   │   ├── ProviderList.tsx
│       │   │   ├── ProviderCard.tsx
│       │   │   └── ApiKeyDialog.tsx
│       │   └── types/
│       │       └── index.ts
│       ├── datasets/
│       │   ├── api/
│       │   │   └── queries.ts
│       │   ├── components/
│       │   │   ├── DatasetsPage.tsx         # tabs: Dialogs | Prompts
│       │   │   ├── DialogList.tsx
│       │   │   ├── DialogEditor.tsx
│       │   │   ├── MessageEditor.tsx
│       │   │   ├── LlmActionDialog.tsx
│       │   │   ├── PromptList.tsx
│       │   │   └── PromptEditor.tsx
│       │   └── types/
│       │       └── index.ts
│       ├── tts/
│       │   ├── api/
│       │   │   └── queries.ts
│       │   ├── components/
│       │   │   ├── TtsPage.tsx
│       │   │   ├── ProviderSelector.tsx
│       │   │   ├── DialogSelector.tsx
│       │   │   ├── AnnotationSelector.tsx
│       │   │   ├── AnnotationEditor.tsx
│       │   │   ├── VoiceAssignment.tsx
│       │   │   └── PlaybackControls.tsx
│       │   ├── hooks/
│       │   │   └── useAudioPlayback.ts
│       │   └── types/
│       │       └── index.ts
│       └── realtime/
│           ├── api/
│           │   └── queries.ts
│           ├── components/
│           │   ├── RealtimePage.tsx
│           │   ├── OpenAiTab.tsx
│           │   ├── GeminiTab.tsx
│           │   ├── ElevenLabsTab.tsx
│           │   ├── InworldTab.tsx
│           │   ├── TranscriptionPanel.tsx
│           │   └── SessionControls.tsx
│           ├── hooks/
│           │   ├── useRealtimeSession.ts
│           │   └── useMicrophone.ts
│           └── types/
│               └── index.ts
├── tailwind.config.ts                       # (not needed with @tailwindcss/vite)
└── vite.config.ts                           # modify: add proxy + tailwind
```

---

## Phase 1: Backend API Infrastructure

### Task 1: buildApp() factory + DB plugin + autoload

**Goal:** Refactor `src/index.ts` into app factory pattern per CLAUDE.md. DB as Fastify decorator. Route autoloading.

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/src/plugins/db.ts`
- Create: `backend/src/routes/health/index.ts`
- Create: `backend/tests/helpers.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/package.json`

**Steps:**

- [ ] **Step 1: Install new dependencies**

```bash
cd backend
npm install @fastify/autoload @fastify/sensible @sinclair/typebox @fastify/type-provider-typebox fastify-plugin
```

- [ ] **Step 2: Write route test helper `tests/helpers.ts`**

```typescript
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({ testing: true });
  await app.ready();
  return app;
}
```

- [ ] **Step 3: Write health route test**

```typescript
// tests/routes/health.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('GET /health', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns status ok', async () => {
    app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 4: Run test — verify it fails**

```bash
cd backend && npx vitest run tests/routes/health.test.ts
```

Expected: FAIL — `buildApp` not found.

- [ ] **Step 5: Create DB decorator plugin `src/plugins/db.ts`**

```typescript
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createDatabase } from '../db/factory.js';
import type { IDatabase } from '../db/interfaces.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: IDatabase;
  }
}

export default fp(async (fastify: FastifyInstance, opts: { testing?: boolean }) => {
  const db = await createDatabase(
    opts.testing ? { provider: 'local', local: { path: ':memory:' }, encryptionKey: 'test-key' } : undefined
  );
  fastify.decorate('db', db);
  fastify.addHook('onClose', async () => {
    await db.close();
  });
});
```

- [ ] **Step 6: Create health route `src/routes/health/index.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    return { status: 'ok' };
  });
};

export default healthRoutes;
```

- [ ] **Step 7: Create app factory `src/app.ts`**

```typescript
import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  testing?: boolean;
}

export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: !opts.testing,
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  });

  await app.register(sensible);

  await app.register(import('./plugins/db.js'), { testing: opts.testing });

  await app.register(autoload, {
    dir: join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
  });

  return app;
}
```

- [ ] **Step 8: Rewrite `src/index.ts` as thin entry point**

```typescript
import { buildApp } from './app.js';

const app = await buildApp();
await app.listen({ port: 3000, host: '0.0.0.0' });
```

- [ ] **Step 9: Run tests — verify they pass**

```bash
cd backend && npx vitest run
```

Expected: all existing DB tests + new health route test pass.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: buildApp() factory, DB plugin, route autoload, health route"
```

---

### Task 2: TypeBox request/response schemas

**Goal:** Define TypeBox schemas for all entities. These serve as both JSON Schema (Fastify validation/serialization) and TypeScript types for route handlers.

**Files:**
- Create: `backend/src/schemas/common.ts`
- Create: `backend/src/schemas/provider.ts`
- Create: `backend/src/schemas/dialog.ts`
- Create: `backend/src/schemas/annotation.ts`
- Create: `backend/src/schemas/prompt.ts`

**Steps:**

- [ ] **Step 1: Create `src/schemas/common.ts`**

```typescript
import { Type, type Static } from '@sinclair/typebox';

export const IdParam = Type.Object({
  id: Type.Number(),
});
export type IdParam = Static<typeof IdParam>;

export const StringIdParam = Type.Object({
  id: Type.String(),
});
export type StringIdParam = Static<typeof StringIdParam>;

export const ErrorResponse = Type.Object({
  statusCode: Type.Number(),
  error: Type.String(),
  message: Type.String(),
});
```

- [ ] **Step 2: Create `src/schemas/provider.ts`**

```typescript
import { Type, type Static } from '@sinclair/typebox';

export const ProviderType = Type.Union([
  Type.Literal('tts'),
  Type.Literal('llm'),
  Type.Literal('realtime'),
]);

export const Provider = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: ProviderType,
  enabled: Type.Boolean(),
  created_at: Type.String(),
});
export type Provider = Static<typeof Provider>;

export const CreateProvider = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: ProviderType,
});
export type CreateProvider = Static<typeof CreateProvider>;

export const UpdateProvider = Type.Object({
  name: Type.Optional(Type.String()),
  type: Type.Optional(ProviderType),
  enabled: Type.Optional(Type.Boolean()),
});
export type UpdateProvider = Static<typeof UpdateProvider>;

export const SetKeyBody = Type.Object({
  key: Type.String(),
});
export type SetKeyBody = Static<typeof SetKeyBody>;

export const ProviderTypeQuery = Type.Object({
  type: Type.Optional(ProviderType),
});
export type ProviderTypeQuery = Static<typeof ProviderTypeQuery>;
```

- [ ] **Step 3: Create `src/schemas/dialog.ts`**

Schemas for Dialog, DialogMessage, DialogWithMessages, and all Create/Update variants. Follow the same pattern as provider schemas, mirroring fields from `db/types.ts`.

```typescript
import { Type, type Static } from '@sinclair/typebox';

export const DialogMessage = Type.Object({
  id: Type.Number(),
  dialog_id: Type.Number(),
  order: Type.Number(),
  character: Type.Union([Type.Literal(1), Type.Literal(2)]),
  text: Type.String(),
});

export const Dialog = Type.Object({
  id: Type.Number(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  language: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});

export const DialogWithMessages = Type.Intersect([
  Dialog,
  Type.Object({ messages: Type.Array(DialogMessage) }),
]);

export const CreateDialog = Type.Object({
  title: Type.String(),
  description: Type.Optional(Type.String()),
  language: Type.String(),
});

export const UpdateDialog = Type.Object({
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
});

export const CreateDialogMessage = Type.Object({
  order: Type.Number(),
  character: Type.Union([Type.Literal(1), Type.Literal(2)]),
  text: Type.String(),
});

export const UpdateDialogMessage = Type.Object({
  character: Type.Optional(Type.Union([Type.Literal(1), Type.Literal(2)])),
  text: Type.Optional(Type.String()),
});

export const DialogIdParam = Type.Object({
  dialogId: Type.Number(),
});

export const MessageIdParam = Type.Object({
  dialogId: Type.Number(),
  messageId: Type.Number(),
});
```

- [ ] **Step 4: Create `src/schemas/annotation.ts`**

```typescript
import { Type, type Static } from '@sinclair/typebox';

export const AnnotatedDialog = Type.Object({
  id: Type.Number(),
  dialog_id: Type.Number(),
  provider_id: Type.String(),
  title: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});

export const AnnotatedMessage = Type.Object({
  id: Type.Number(),
  annotated_dialog_id: Type.Number(),
  dialog_message_id: Type.Number(),
  text: Type.String(),
});

export const AnnotatedDialogWithMessages = Type.Intersect([
  AnnotatedDialog,
  Type.Object({ messages: Type.Array(AnnotatedMessage) }),
]);

export const CreateAnnotatedDialog = Type.Object({
  dialog_id: Type.Number(),
  provider_id: Type.String(),
  title: Type.String(),
});

export const CreateAnnotatedMessage = Type.Object({
  dialog_message_id: Type.Number(),
  text: Type.String(),
});

export const UpdateAnnotatedMessage = Type.Object({
  text: Type.String(),
});

export const AnnotationIdParam = Type.Object({
  id: Type.Number(),
});

export const AnnotationMessageIdParam = Type.Object({
  id: Type.Number(),
  messageId: Type.Number(),
});

export const DialogAnnotationsParam = Type.Object({
  dialogId: Type.Number(),
});
```

- [ ] **Step 5: Create `src/schemas/prompt.ts`**

```typescript
import { Type, type Static } from '@sinclair/typebox';

export const AnnotationPrompt = Type.Object({
  id: Type.Number(),
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});

export const CreateAnnotationPrompt = Type.Object({
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
});

export const UpdateAnnotationPrompt = Type.Object({
  title: Type.Optional(Type.String()),
  provider_id: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
});

export const AgentPrompt = Type.Object({
  id: Type.Number(),
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});

export const CreateAgentPrompt = Type.Object({
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
});

export const UpdateAgentPrompt = Type.Object({
  title: Type.Optional(Type.String()),
  provider_id: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
});
```

- [ ] **Step 6: Run `tsc --noEmit` to verify schemas compile**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: TypeBox schemas for all entities"
```

---

## Phase 2: Backend CRUD Routes

### Task 3: Providers CRUD routes

**Goal:** REST API for provider management: list (with type filter), get, create, update, delete, set/get API key.

**Files:**
- Create: `backend/src/routes/providers/index.ts`
- Create: `backend/tests/routes/providers.test.ts`

**Endpoints:**
- `GET /providers?type=tts` → Provider[]
- `GET /providers/:id` → Provider
- `POST /providers` → Provider
- `PUT /providers/:id` → Provider
- `DELETE /providers/:id` → 204
- `PUT /providers/:id/key` → 204
- `GET /providers/:id/key` → { key: string }

**Steps:**

- [ ] **Step 1: Write tests `tests/routes/providers.test.ts`**

Test each endpoint using `app.inject()`. Use `buildTestApp()` from helpers. Seed test data in `beforeEach`. Test cases:
- List all providers (empty, then with data)
- List filtered by type
- Get by id (found, not found → 404)
- Create (valid, missing fields → 400)
- Update (partial update, not found → 404)
- Delete (found → 204, not found → 404)
- Set key → 204, then get key → returns decrypted value
- Get key when none set → 404

```typescript
// tests/routes/providers.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('Provider routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /providers', () => {
    it('returns empty array initially', async () => {
      const res = await app.inject({ method: 'GET', url: '/providers' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('returns providers filtered by type', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });

      const res = await app.inject({ method: 'GET', url: '/providers?type=tts' });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('elevenlabs');
    });
  });

  describe('GET /providers/:id', () => {
    it('returns provider by id', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      const res = await app.inject({ method: 'GET', url: '/providers/elevenlabs' });
      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe('elevenlabs');
    });

    it('returns 404 for unknown id', async () => {
      const res = await app.inject({ method: 'GET', url: '/providers/unknown' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /providers', () => {
    it('creates a provider', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: { id: 'google', name: 'Google', type: 'tts' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().id).toBe('google');
    });
  });

  describe('PUT /providers/:id', () => {
    it('updates a provider', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      const res = await app.inject({
        method: 'PUT',
        url: '/providers/elevenlabs',
        payload: { enabled: false },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().enabled).toBe(false);
    });
  });

  describe('DELETE /providers/:id', () => {
    it('deletes a provider', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      const res = await app.inject({ method: 'DELETE', url: '/providers/elevenlabs' });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('Key management', () => {
    it('sets and gets API key', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });

      const setRes = await app.inject({
        method: 'PUT',
        url: '/providers/elevenlabs/key',
        payload: { key: 'sk-test-123' },
      });
      expect(setRes.statusCode).toBe(204);

      const getRes = await app.inject({ method: 'GET', url: '/providers/elevenlabs/key' });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().key).toBe('sk-test-123');
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && npx vitest run tests/routes/providers.test.ts
```

- [ ] **Step 3: Implement `src/routes/providers/index.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import * as S from '../../schemas/provider.js';
import { StringIdParam, ErrorResponse } from '../../schemas/common.js';

const providerRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /providers?type=tts
  fastify.get('/', {
    schema: {
      querystring: S.ProviderTypeQuery,
      response: { 200: Type.Array(S.Provider) },
    },
  }, async (req) => {
    const { type } = req.query as { type?: 'tts' | 'llm' | 'realtime' };
    return fastify.db.providers.list(type);
  });

  // GET /providers/:id
  fastify.get('/:id', {
    schema: {
      params: StringIdParam,
      response: { 200: S.Provider, 404: ErrorResponse },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const provider = await fastify.db.providers.getById(id);
    if (!provider) return reply.notFound(`Provider '${id}' not found`);
    return provider;
  });

  // POST /providers
  fastify.post('/', {
    schema: {
      body: S.CreateProvider,
      response: { 201: S.Provider },
    },
  }, async (req, reply) => {
    const provider = await fastify.db.providers.create(req.body as any);
    return reply.status(201).send(provider);
  });

  // PUT /providers/:id
  fastify.put('/:id', {
    schema: {
      params: StringIdParam,
      body: S.UpdateProvider,
      response: { 200: S.Provider, 404: ErrorResponse },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await fastify.db.providers.getById(id);
    if (!existing) return reply.notFound(`Provider '${id}' not found`);
    return fastify.db.providers.update(id, req.body as any);
  });

  // DELETE /providers/:id
  fastify.delete('/:id', {
    schema: {
      params: StringIdParam,
      response: { 204: Type.Null(), 404: ErrorResponse },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await fastify.db.providers.getById(id);
    if (!existing) return reply.notFound(`Provider '${id}' not found`);
    await fastify.db.providers.delete(id);
    return reply.status(204).send();
  });

  // PUT /providers/:id/key
  fastify.put('/:id/key', {
    schema: {
      params: StringIdParam,
      body: S.SetKeyBody,
      response: { 204: Type.Null(), 404: ErrorResponse },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await fastify.db.providers.getById(id);
    if (!existing) return reply.notFound(`Provider '${id}' not found`);
    await fastify.db.providers.setKey(id, (req.body as any).key);
    return reply.status(204).send();
  });

  // GET /providers/:id/key
  fastify.get('/:id/key', {
    schema: {
      params: StringIdParam,
      response: { 200: Type.Object({ key: Type.String() }), 404: ErrorResponse },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const key = await fastify.db.providers.getDecryptedKey(id);
    if (key === null) return reply.notFound(`No API key set for provider '${id}'`);
    return { key };
  });
};

export default providerRoutes;
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && npx vitest run tests/routes/providers.test.ts
```

- [ ] **Step 5: Run all tests**

```bash
cd backend && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: providers CRUD routes with tests"
```

---

### Task 4: Dialogs + Messages CRUD routes

**Goal:** REST API for dialog management including nested messages.

**Files:**
- Create: `backend/src/routes/dialogs/index.ts`
- Create: `backend/tests/routes/dialogs.test.ts`

**Endpoints:**
- `GET /dialogs` → Dialog[]
- `GET /dialogs/:dialogId` → DialogWithMessages
- `POST /dialogs` → Dialog
- `PUT /dialogs/:dialogId` → Dialog
- `DELETE /dialogs/:dialogId` → 204
- `POST /dialogs/:dialogId/messages` → DialogMessage
- `PUT /dialogs/:dialogId/messages/:messageId` → DialogMessage
- `DELETE /dialogs/:dialogId/messages/:messageId` → 204

**Steps:**

- [ ] **Step 1: Write tests `tests/routes/dialogs.test.ts`**

Same pattern as providers test. Test each endpoint. Key cases:
- List dialogs (empty, with data)
- Get dialog with messages (found → includes messages array, not found → 404)
- Create dialog (valid, missing title → 400)
- Update dialog (partial)
- Delete dialog (cascades messages)
- Create message (valid character 1|2)
- Update message (partial)
- Delete message

- [ ] **Step 2: Run tests — verify they fail**

- [ ] **Step 3: Implement `src/routes/dialogs/index.ts`**

Follow same pattern as providers. Use `DialogIdParam` and `MessageIdParam` from schemas. The `getWithMessages` endpoint returns dialog + messages array. For message routes, use nested params (`:dialogId/messages/:messageId`). Pass `dialog_id` from URL params when creating messages.

- [ ] **Step 4: Run tests — verify they pass**

- [ ] **Step 5: Run all tests, commit**

```bash
git add -A && git commit -m "feat: dialogs + messages CRUD routes with tests"
```

---

### Task 5: Annotation Prompts CRUD routes

**Goal:** REST API for annotation prompt management.

**Files:**
- Create: `backend/src/routes/annotation-prompts/index.ts`
- Create: `backend/tests/routes/annotation-prompts.test.ts`

**Endpoints:**
- `GET /annotation-prompts` → AnnotationPrompt[]
- `GET /annotation-prompts/:id` → AnnotationPrompt
- `POST /annotation-prompts` → AnnotationPrompt
- `PUT /annotation-prompts/:id` → AnnotationPrompt
- `DELETE /annotation-prompts/:id` → 204

**Steps:**

- [ ] **Step 1: Write tests** — same CRUD pattern as providers, but with numeric IDs (`IdParam`)
- [ ] **Step 2: Run tests — fail**
- [ ] **Step 3: Implement routes** — same pattern, using `annotationPrompts` repo
- [ ] **Step 4: Run tests — pass**
- [ ] **Step 5: All tests, commit**

```bash
git add -A && git commit -m "feat: annotation prompts CRUD routes with tests"
```

---

### Task 6: Agent Prompts CRUD routes

**Goal:** REST API for agent prompt management. Identical pattern to annotation prompts.

**Files:**
- Create: `backend/src/routes/agent-prompts/index.ts`
- Create: `backend/tests/routes/agent-prompts.test.ts`

**Endpoints:**
- `GET /agent-prompts` → AgentPrompt[]
- `GET /agent-prompts/:id` → AgentPrompt
- `POST /agent-prompts` → AgentPrompt
- `PUT /agent-prompts/:id` → AgentPrompt
- `DELETE /agent-prompts/:id` → 204

**Steps:**

- [ ] **Step 1: Write tests** — same CRUD pattern as annotation prompts
- [ ] **Step 2: Run tests — fail**
- [ ] **Step 3: Implement routes** — same pattern, using `agentPrompts` repo
- [ ] **Step 4: Run tests — pass**
- [ ] **Step 5: All tests, commit**

```bash
git add -A && git commit -m "feat: agent prompts CRUD routes with tests"
```

---

### Task 7: Annotations + Annotated Messages routes

**Goal:** REST API for annotation management. Annotations are scoped to dialogs.

**Files:**
- Create: `backend/src/routes/annotations/index.ts`
- Create: `backend/tests/routes/annotations.test.ts`

**Endpoints:**
- `GET /dialogs/:dialogId/annotations` → AnnotatedDialog[]
- `GET /annotations/:id` → AnnotatedDialogWithMessages
- `POST /dialogs/:dialogId/annotations` → AnnotatedDialog
- `DELETE /annotations/:id` → 204
- `POST /annotations/:id/messages` → AnnotatedMessage
- `PUT /annotations/:id/messages/:messageId` → AnnotatedMessage
- `DELETE /annotations/:id/messages/:messageId` → 204

**Note:** Annotation listing is nested under dialogs (`/dialogs/:dialogId/annotations`), but single annotation access and messages are at `/annotations/:id` for simplicity.

**Steps:**

- [ ] **Step 1: Write tests**

Test setup requires seeding a dialog with messages first (annotations reference dialog_messages). Key test:

```typescript
// Seed a dialog and message
const dialog = await app.db.dialogs.create({ title: 'Test', language: 'en-US' });
const message = await app.db.dialogs.createMessage({
  dialog_id: dialog.id, order: 1, character: 1, text: 'Hello',
});

// Create annotation
const res = await app.inject({
  method: 'POST',
  url: `/dialogs/${dialog.id}/annotations`,
  payload: { dialog_id: dialog.id, provider_id: 'elevenlabs', title: 'SSML v1' },
});
expect(res.statusCode).toBe(201);

// Create annotated message
const annId = res.json().id;
const msgRes = await app.inject({
  method: 'POST',
  url: `/annotations/${annId}/messages`,
  payload: { dialog_message_id: message.id, text: '<speak>Hello</speak>' },
});
expect(msgRes.statusCode).toBe(201);
```

- [ ] **Step 2: Run tests — fail**
- [ ] **Step 3: Implement routes** — two route files or one with prefix registration. Use `annotations` repo. For `/dialogs/:dialogId/annotations`, register routes inside the `dialogs` route plugin or create a separate annotations plugin that handles both URL patterns.
- [ ] **Step 4: Run tests — pass**
- [ ] **Step 5: All tests, commit**

```bash
git add -A && git commit -m "feat: annotations + messages routes with tests"
```

---

## Phase 3: Backend TTS Providers

### Task 8: TTS provider interface + registry + ElevenLabs adapter

**Goal:** Define the TTS provider abstraction and implement the first adapter (ElevenLabs).

**Files:**
- Create: `backend/src/providers/tts/types.ts`
- Create: `backend/src/providers/tts/registry.ts`
- Create: `backend/src/providers/tts/elevenlabs.ts`
- Create: `backend/tests/providers/elevenlabs.test.ts`

**Steps:**

- [ ] **Step 1: Create `src/providers/tts/types.ts`**

```typescript
export interface IVoice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
  description?: string;
  previewUrl?: string;
  providerMeta?: Record<string, unknown>;
}

export interface ISynthesizeOptions {
  voiceId: string;
  text: string;
  speed?: number;
  temperature?: number;
  format?: 'mp3' | 'opus' | 'linear16';
  sampleRate?: 16000 | 24000 | 48000;
}

export interface ITTSProvider {
  id: string;
  name: string;
  getVoices(): Promise<IVoice[]>;
  synthesize(options: ISynthesizeOptions): Promise<Buffer>;
  validateCredentials(): Promise<boolean>;
}
```

- [ ] **Step 2: Write ElevenLabs adapter tests**

Test with mocked HTTP calls (use `vi.mock` or MSW). Test:
- `getVoices()` returns mapped IVoice array
- `synthesize()` returns audio Buffer
- `validateCredentials()` returns true/false based on API response

```typescript
// tests/providers/elevenlabs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElevenLabsTTSProvider } from '../../src/providers/tts/elevenlabs.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ElevenLabsTTSProvider', () => {
  let provider: ElevenLabsTTSProvider;

  beforeEach(() => {
    provider = new ElevenLabsTTSProvider('test-api-key');
    vi.restoreAllMocks();
  });

  it('getVoices returns mapped voices', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        voices: [
          { voice_id: 'v1', name: 'Rachel', labels: { language: 'en', gender: 'female' } },
        ],
      }),
    });

    const voices = await provider.getVoices();
    expect(voices).toHaveLength(1);
    expect(voices[0]).toMatchObject({ id: 'v1', name: 'Rachel', language: 'en', gender: 'female' });
  });

  it('synthesize returns audio buffer', async () => {
    const audioData = new Uint8Array([1, 2, 3]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => audioData.buffer,
    });

    const result = await provider.synthesize({ voiceId: 'v1', text: 'Hello' });
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('validateCredentials returns true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ voices: [] }) });
    expect(await provider.validateCredentials()).toBe(true);
  });

  it('validateCredentials returns false on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await provider.validateCredentials()).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests — fail**
- [ ] **Step 4: Implement ElevenLabs adapter**

```typescript
// src/providers/tts/elevenlabs.ts
import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://api.elevenlabs.io/v1';

export class ElevenLabsTTSProvider implements ITTSProvider {
  id = 'elevenlabs';
  name = 'ElevenLabs';

  constructor(private apiKey: string) {}

  async getVoices(): Promise<IVoice[]> {
    const res = await fetch(`${BASE_URL}/voices`, {
      headers: { 'xi-api-key': this.apiKey },
    });
    if (!res.ok) throw new Error(`ElevenLabs API error: ${res.status}`);
    const data = await res.json() as { voices: Array<{
      voice_id: string; name: string;
      labels?: { language?: string; gender?: string; description?: string };
      preview_url?: string;
    }> };
    return data.voices.map((v) => ({
      id: v.voice_id,
      name: v.name,
      language: v.labels?.language ?? 'en',
      gender: (v.labels?.gender as IVoice['gender']) ?? undefined,
      description: v.labels?.description,
      previewUrl: v.preview_url,
    }));
  }

  async synthesize(options: ISynthesizeOptions): Promise<Buffer> {
    const res = await fetch(`${BASE_URL}/text-to-speech/${options.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: options.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          speed: options.speed ?? 1.0,
        },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs synthesis error: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/voices`, {
        headers: { 'xi-api-key': this.apiKey },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 5: Create registry `src/providers/tts/registry.ts`**

```typescript
import type { ITTSProvider } from './types.js';
import { ElevenLabsTTSProvider } from './elevenlabs.js';

const constructors: Record<string, new (apiKey: string) => ITTSProvider> = {
  elevenlabs: ElevenLabsTTSProvider,
};

export function createTTSProvider(id: string, apiKey: string): ITTSProvider {
  const Ctor = constructors[id];
  if (!Ctor) throw new Error(`Unknown TTS provider: ${id}`);
  return new Ctor(apiKey);
}

export function getSupportedTTSProviders(): string[] {
  return Object.keys(constructors);
}
```

- [ ] **Step 6: Run tests — pass**
- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: TTS provider interface + ElevenLabs adapter"
```

---

### Task 9: Google TTS adapter

**Goal:** Google Cloud Text-to-Speech adapter.

**Files:**
- Create: `backend/src/providers/tts/google.ts`
- Create: `backend/tests/providers/google-tts.test.ts`
- Modify: `backend/src/providers/tts/registry.ts` (add `google` entry)

**Steps:**

- [ ] **Step 1: Install dependency**

```bash
cd backend && npm install @google-cloud/text-to-speech
```

- [ ] **Step 2: Write tests** — same pattern as ElevenLabs: mock the Google client, test getVoices(), synthesize(), validateCredentials()
- [ ] **Step 3: Run tests — fail**
- [ ] **Step 4: Implement adapter** — use `@google-cloud/text-to-speech` client. Map Google voice format to IVoice. Synthesize returns audio Buffer from Google's `synthesizeSpeech()`.
- [ ] **Step 5: Add to registry** — add `google: GoogleTTSProvider` to constructors map
- [ ] **Step 6: Run tests — pass**
- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Google TTS provider adapter"
```

---

### Task 10: Inworld TTS adapter

**Goal:** Inworld TTS adapter.

**Files:**
- Create: `backend/src/providers/tts/inworld.ts`
- Create: `backend/tests/providers/inworld-tts.test.ts`
- Modify: `backend/src/providers/tts/registry.ts` (add `inworld` entry)

**Steps:**

- [ ] **Step 1: Research Inworld TTS API** — check docs for authentication, voice listing, and synthesis endpoints
- [ ] **Step 2: Write tests** — same pattern: mock HTTP, test getVoices/synthesize/validateCredentials
- [ ] **Step 3: Run tests — fail**
- [ ] **Step 4: Implement adapter** — map Inworld API to ITTSProvider interface
- [ ] **Step 5: Add to registry**
- [ ] **Step 6: Run tests — pass**
- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Inworld TTS provider adapter"
```

---

### Task 11: TTS API routes (voices, synthesize)

**Goal:** HTTP endpoints for fetching voices and synthesizing speech.

**Files:**
- Create: `backend/src/routes/tts/index.ts`
- Create: `backend/tests/routes/tts.test.ts`

**Endpoints:**
- `GET /tts/:providerId/voices` → IVoice[]
- `POST /tts/:providerId/synthesize` → audio binary (Content-Type: audio/mpeg)

**Steps:**

- [ ] **Step 1: Write tests**

```typescript
// tests/routes/tts.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildTestApp } from '../helpers.js';

// Mock the TTS registry
vi.mock('../../src/providers/tts/registry.js', () => ({
  createTTSProvider: vi.fn(() => ({
    id: 'elevenlabs',
    name: 'ElevenLabs',
    getVoices: vi.fn(async () => [
      { id: 'v1', name: 'Rachel', language: 'en' },
    ]),
    synthesize: vi.fn(async () => Buffer.from('audio-data')),
  })),
}));

describe('TTS routes', () => {
  let app;

  beforeEach(async () => {
    app = await buildTestApp();
    // Seed a TTS provider with a key
    await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
    await app.db.providers.setKey('elevenlabs', 'test-key');
  });

  afterEach(async () => { await app.close(); });

  it('GET /tts/:providerId/voices returns voices', async () => {
    const res = await app.inject({ method: 'GET', url: '/tts/elevenlabs/voices' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('POST /tts/:providerId/synthesize returns audio', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tts/elevenlabs/synthesize',
      payload: { voiceId: 'v1', text: 'Hello world' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('audio');
  });

  it('returns 404 for unknown provider', async () => {
    const res = await app.inject({ method: 'GET', url: '/tts/unknown/voices' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 if no API key set', async () => {
    await app.db.providers.create({ id: 'google', name: 'Google', type: 'tts' });
    // No key set for google
    const res = await app.inject({ method: 'GET', url: '/tts/google/voices' });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — fail**
- [ ] **Step 3: Implement routes**

Route handler pattern:
1. Look up provider in DB → 404 if not found
2. Get decrypted API key → 400 if no key
3. Create provider instance via `createTTSProvider(id, apiKey)`
4. Call provider method
5. For synthesize: return Buffer with `Content-Type: audio/mpeg`

- [ ] **Step 4: Run tests — pass**
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: TTS API routes (voices + synthesize)"
```

---

## Phase 4: Backend LLM Providers

### Task 12: LLM provider interface + registry + OpenAI adapter

**Goal:** Define LLM provider abstraction and implement OpenAI adapter.

**Files:**
- Create: `backend/src/providers/llm/types.ts`
- Create: `backend/src/providers/llm/registry.ts`
- Create: `backend/src/providers/llm/openai.ts`
- Create: `backend/tests/providers/openai-llm.test.ts`

**Steps:**

- [ ] **Step 1: Create `src/providers/llm/types.ts`**

```typescript
export interface ILLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ILLMProvider {
  id: string;
  name: string;
  getModels(): Promise<string[]>;
  complete(messages: ILLMMessage[], model: string): Promise<string>;
}
```

- [ ] **Step 2: Install dependency**

```bash
cd backend && npm install openai
```

- [ ] **Step 3: Write OpenAI tests** — mock OpenAI SDK, test getModels() and complete()

```typescript
// tests/providers/openai-llm.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      models: {
        list: vi.fn().mockResolvedValue({
          data: [
            { id: 'gpt-4o', owned_by: 'openai' },
            { id: 'gpt-4o-mini', owned_by: 'openai' },
          ],
        }),
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Hello from GPT' } }],
          }),
        },
      },
    })),
  };
});

import { OpenAILLMProvider } from '../../src/providers/llm/openai.js';

describe('OpenAILLMProvider', () => {
  let provider: OpenAILLMProvider;

  beforeEach(() => {
    provider = new OpenAILLMProvider('test-key');
  });

  it('getModels returns model ids', async () => {
    const models = await provider.getModels();
    expect(models).toContain('gpt-4o');
  });

  it('complete returns response text', async () => {
    const result = await provider.complete(
      [{ role: 'user', content: 'Hi' }],
      'gpt-4o',
    );
    expect(result).toBe('Hello from GPT');
  });
});
```

- [ ] **Step 4: Run tests — fail**
- [ ] **Step 5: Implement OpenAI adapter**

```typescript
// src/providers/llm/openai.ts
import OpenAI from 'openai';
import type { ILLMProvider, ILLMMessage } from './types.js';

export class OpenAILLMProvider implements ILLMProvider {
  id = 'openai';
  name = 'OpenAI';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async getModels(): Promise<string[]> {
    const response = await this.client.models.list();
    return response.data
      .filter((m) => m.id.startsWith('gpt-'))
      .map((m) => m.id)
      .sort();
  }

  async complete(messages: ILLMMessage[], model: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model,
      messages,
    });
    return response.choices[0]?.message?.content ?? '';
  }
}
```

- [ ] **Step 6: Create registry** — same pattern as TTS registry
- [ ] **Step 7: Run tests — pass**
- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: LLM provider interface + OpenAI adapter"
```

---

### Task 13: Anthropic LLM adapter

**Goal:** Anthropic Claude adapter.

**Files:**
- Create: `backend/src/providers/llm/anthropic.ts`
- Create: `backend/tests/providers/anthropic-llm.test.ts`
- Modify: `backend/src/providers/llm/registry.ts` (add `anthropic` entry)

**Steps:**

- [ ] **Step 1: Install dependency**

```bash
cd backend && npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Write tests** — mock Anthropic SDK, test getModels() (returns hardcoded list) and complete()
- [ ] **Step 3: Run tests — fail**
- [ ] **Step 4: Implement adapter** — use `@anthropic-ai/sdk`. `getModels()` returns a curated list (Claude models). `complete()` maps ILLMMessage to Anthropic format (system message extracted separately).
- [ ] **Step 5: Add to registry**
- [ ] **Step 6: Run tests — pass**
- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Anthropic LLM provider adapter"
```

---

### Task 14: LLM API routes (models, complete)

**Goal:** HTTP endpoints for LLM operations.

**Files:**
- Create: `backend/src/routes/llm/index.ts`
- Create: `backend/tests/routes/llm.test.ts`

**Endpoints:**
- `GET /llm/:providerId/models` → string[]
- `POST /llm/:providerId/complete` → { text: string }

**Steps:**

- [ ] **Step 1: Write tests** — same pattern as TTS routes: mock registry, seed provider with key, test endpoints
- [ ] **Step 2: Run tests — fail**
- [ ] **Step 3: Implement routes** — same lookup pattern: get provider from DB → get API key → create instance → call method
- [ ] **Step 4: Run tests — pass**
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: LLM API routes (models + complete)"
```

---

## Phase 5: Backend Services

### Task 15: Dialog generation service + route

**Goal:** Generate a new dialog via LLM. User provides: LLM provider, model, language, prompt describing the dialog.

**Files:**
- Create: `backend/src/services/dialog-generation.ts`
- Create: `backend/tests/services/dialog-generation.test.ts`
- Modify: `backend/src/routes/services/index.ts` (create if not exists)
- Create: `backend/tests/routes/services.test.ts`

**Endpoint:** `POST /services/generate-dialog`

**Request body:**
```json
{
  "providerId": "openai",
  "model": "gpt-4o",
  "language": "en-US",
  "prompt": "A customer calling tech support about a broken printer",
  "messageCount": 6
}
```

**Response:** `DialogWithMessages` (created dialog with generated messages)

**Steps:**

- [ ] **Step 1: Write service tests**

```typescript
// tests/services/dialog-generation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateDialog } from '../../src/services/dialog-generation.js';
import type { ILLMProvider } from '../../src/providers/llm/types.js';
import type { IDialogRepository } from '../../src/db/interfaces.js';

describe('generateDialog', () => {
  it('creates dialog with messages from LLM output', async () => {
    const mockLLM: ILLMProvider = {
      id: 'openai', name: 'OpenAI',
      getModels: vi.fn(),
      complete: vi.fn().mockResolvedValue(JSON.stringify([
        { character: 1, text: 'Hello, tech support?' },
        { character: 2, text: 'Hi, how can I help?' },
      ])),
    };

    const createdDialog = { id: 1, title: 'Generated', description: null, language: 'en-US', created_by: null, created_at: '' };
    const mockDialogRepo = {
      create: vi.fn().mockResolvedValue(createdDialog),
      createMessage: vi.fn().mockImplementation(async (data) => ({ id: 1, ...data })),
      getWithMessages: vi.fn().mockResolvedValue({ ...createdDialog, messages: [] }),
    } as unknown as IDialogRepository;

    const result = await generateDialog({
      llm: mockLLM,
      dialogRepo: mockDialogRepo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Tech support call',
      messageCount: 2,
    });

    expect(mockLLM.complete).toHaveBeenCalled();
    expect(mockDialogRepo.create).toHaveBeenCalled();
    expect(mockDialogRepo.createMessage).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests — fail**
- [ ] **Step 3: Implement service**

```typescript
// src/services/dialog-generation.ts
import type { ILLMProvider } from '../providers/llm/types.js';
import type { IDialogRepository } from '../db/interfaces.js';
import type { DialogWithMessages } from '../db/types.js';

interface GenerateDialogParams {
  llm: ILLMProvider;
  dialogRepo: IDialogRepository;
  model: string;
  language: string;
  prompt: string;
  messageCount?: number;
}

export async function generateDialog(params: GenerateDialogParams): Promise<DialogWithMessages> {
  const { llm, dialogRepo, model, language, prompt, messageCount = 6 } = params;

  const systemPrompt = `You are a dialog generator. Generate a dialog between two characters (character 1 and character 2) based on the user's description. Output ONLY valid JSON: an array of objects with "character" (1 or 2) and "text" fields. Generate exactly ${messageCount} messages. Alternate between characters naturally.`;

  const response = await llm.complete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Language: ${language}\nDialog description: ${prompt}` },
    ],
    model,
  );

  const messages = JSON.parse(response) as Array<{ character: 1 | 2; text: string }>;

  const dialog = await dialogRepo.create({
    title: prompt.slice(0, 100),
    language,
    description: prompt,
  });

  for (let i = 0; i < messages.length; i++) {
    await dialogRepo.createMessage({
      dialog_id: dialog.id,
      order: i + 1,
      character: messages[i].character,
      text: messages[i].text,
    });
  }

  return (await dialogRepo.getWithMessages(dialog.id))!;
}
```

- [ ] **Step 4: Write route test + implement route handler**

Route handler:
1. Validate body (providerId, model, language, prompt)
2. Get provider from DB → 404
3. Get API key → 400
4. Create LLM instance
5. Call `generateDialog()` with instance + dialog repo
6. Return created dialog

- [ ] **Step 5: Run all tests — pass**
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: dialog generation service via LLM"
```

---

### Task 16: Dialog editing service + route

**Goal:** Edit existing dialog via LLM. User provides: dialog ID, LLM provider, model, edit instructions.

**Files:**
- Create: `backend/src/services/dialog-editing.ts`
- Create: `backend/tests/services/dialog-editing.test.ts`
- Modify: `backend/src/routes/services/index.ts`

**Endpoint:** `POST /services/edit-dialog`

**Request body:**
```json
{
  "dialogId": 1,
  "providerId": "openai",
  "model": "gpt-4o",
  "instructions": "Make character 2 more polite and formal"
}
```

**Response:** `DialogWithMessages` (updated dialog)

**Steps:**

- [ ] **Step 1: Write service tests** — mock LLM returns edited messages array, verify existing messages are updated
- [ ] **Step 2: Run tests — fail**
- [ ] **Step 3: Implement service** — fetch existing dialog with messages, send to LLM with edit instructions, update each message with new text
- [ ] **Step 4: Write route test + implement route**
- [ ] **Step 5: Run all tests — pass**
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: dialog editing service via LLM"
```

---

### Task 17: Auto-annotation service + route

**Goal:** Automatically annotate a dialog using LLM. Processes messages one by one with conversation history (simulating a pipeline). Creates an `AnnotatedDialog` with `AnnotatedMessage` entries containing SSML.

**Files:**
- Create: `backend/src/services/auto-annotation.ts`
- Create: `backend/tests/services/auto-annotation.test.ts`
- Modify: `backend/src/routes/services/index.ts`

**Endpoint:** `POST /services/annotate`

**Request body:**
```json
{
  "dialogId": 1,
  "providerId": "openai",
  "model": "gpt-4o",
  "annotationPromptId": 5,
  "ttsProviderId": "elevenlabs",
  "title": "SSML v1 auto"
}
```

**Response:** `AnnotatedDialogWithMessages`

**Steps:**

- [ ] **Step 1: Write service tests**

```typescript
// Test: given a dialog with 3 messages and an annotation prompt,
// the service calls LLM 3 times (once per message) with growing history,
// creates an AnnotatedDialog, and stores annotated messages with SSML text.
```

- [ ] **Step 2: Run tests — fail**
- [ ] **Step 3: Implement service**

```typescript
// src/services/auto-annotation.ts
// For each message in the dialog:
//   1. Build conversation history (all previous annotated messages)
//   2. Call LLM with: system prompt (from annotationPrompt), history, current plain message
//   3. LLM returns SSML-annotated version of the message
//   4. Store as AnnotatedMessage
// Return the complete AnnotatedDialogWithMessages
```

- [ ] **Step 4: Write route test + implement route**
- [ ] **Step 5: Run all tests — pass**
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: auto-annotation service via LLM"
```

---

## Phase 6: Frontend Infrastructure

### Task 18: Dependencies + Tailwind + Vite config

**Goal:** Install all frontend dependencies, configure Tailwind CSS, set up Vite proxy to backend.

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Rewrite: `frontend/src/index.css` (Tailwind directives)
- Delete: `frontend/src/App.css`

**Steps:**

- [ ] **Step 1: Install dependencies**

```bash
cd frontend
npm install react-router-dom @tanstack/react-query zustand react-hook-form @hookform/resolvers zod clsx
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Vite** — add Tailwind plugin and API proxy

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

**Note on proxy:** Frontend calls `/api/providers`, Vite rewrites to `http://localhost:3000/providers`. This avoids CORS in dev and matches production setup.

- [ ] **Step 3: Replace `index.css` with Tailwind**

```css
/* frontend/src/index.css */
@import "tailwindcss";
```

- [ ] **Step 4: Delete `App.css`**

- [ ] **Step 5: Verify dev server starts**

```bash
cd frontend && npm run dev
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: frontend deps, Tailwind CSS, Vite proxy"
```

---

### Task 19: API client + shared types

**Goal:** Typed fetch wrapper and shared API response types.

**Files:**
- Create: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/types/api.ts`

**Steps:**

- [ ] **Step 1: Create `src/types/api.ts`**

Mirror backend types (without DB internals). These are the API response shapes:

```typescript
// frontend/src/types/api.ts
export type ProviderType = 'tts' | 'llm' | 'realtime';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  created_at: string;
}

export interface Dialog {
  id: number;
  title: string;
  description: string | null;
  language: string;
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

export interface AnnotationPrompt {
  id: number;
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by: string | null;
  created_at: string;
}

export interface AgentPrompt {
  id: number;
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by: string | null;
  created_at: string;
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
  description?: string;
  previewUrl?: string;
}
```

- [ ] **Step 2: Create `src/lib/api-client.ts`**

```typescript
// frontend/src/lib/api-client.ts
const BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),

  // Special: returns raw Response for binary data (audio)
  fetchRaw: (path: string, options?: RequestInit) =>
    fetch(`${BASE}${path}`, options).then((res) => {
      if (!res.ok) throw new ApiError(res.status, res.statusText);
      return res;
    }),
};
```

- [ ] **Step 3: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: frontend API client + shared types"
```

---

### Task 20: App shell (routing, layout, sidebar)

**Goal:** Set up React Router with layout routes, sidebar navigation, and header.

**Files:**
- Create: `frontend/src/router.tsx`
- Create: `frontend/src/components/layout/AppLayout.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/Header.tsx`
- Rewrite: `frontend/src/App.tsx`

**Steps:**

- [ ] **Step 1: Create `src/components/layout/Sidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/datasets', label: 'Datasets' },
  { to: '/tts', label: 'TTS Testing' },
  { to: '/realtime', label: 'Realtime' },
  { to: '/providers', label: 'Providers' },
];

export function Sidebar() {
  return (
    <aside className="w-60 h-screen bg-gray-900 text-gray-100 flex flex-col fixed left-0 top-0">
      <div className="p-4 text-xl font-bold border-b border-gray-700">
        Sound Lab
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-4 py-2 rounded mb-1 transition-colors ${
                isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create `src/components/layout/Header.tsx`**

```tsx
export function Header() {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6">
      <span className="text-sm text-gray-500">Local Mode</span>
    </header>
  );
}
```

- [ ] **Step 3: Create `src/components/layout/AppLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-60">
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/router.tsx`**

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';

// Lazy-loaded pages (will be created in subsequent tasks)
const placeholderPage = (name: string) => () => (
  <div className="text-gray-400 text-lg">{name} — coming soon</div>
);

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/datasets" replace /> },
      { path: 'datasets/*', Component: placeholderPage('Datasets') },
      { path: 'tts', Component: placeholderPage('TTS Testing') },
      { path: 'realtime', Component: placeholderPage('Realtime') },
      { path: 'providers', Component: placeholderPage('Providers') },
    ],
  },
]);
```

- [ ] **Step 5: Rewrite `src/App.tsx`**

```tsx
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 6: Verify via Playwright** — start dev server, open browser, check sidebar renders, navigation works, no console errors
- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: app shell with routing, sidebar, header layout"
```

---

## Phase 7: Frontend Pages

### Task 21: Providers page

**Goal:** Providers management page with three tabs (TTS, LLM, Realtime). Each tab lists providers with enable/disable toggle and API key input.

**Files:**
- Create: `frontend/src/features/providers/api/queries.ts`
- Create: `frontend/src/features/providers/components/ProvidersPage.tsx`
- Create: `frontend/src/features/providers/components/ProviderList.tsx`
- Create: `frontend/src/features/providers/components/ProviderCard.tsx`
- Create: `frontend/src/features/providers/components/ApiKeyDialog.tsx`
- Create: `frontend/src/components/ui/Tabs.tsx`
- Modify: `frontend/src/router.tsx` (replace placeholder)

**Steps:**

- [ ] **Step 1: Create reusable `Tabs` component**

```tsx
// src/components/ui/Tabs.tsx
import { useState } from 'react';
import { clsx } from 'clsx';

interface Tab { id: string; label: string }

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  children: (activeTab: string) => React.ReactNode;
}

export function Tabs({ tabs, defaultTab, children }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0].id);
  return (
    <div>
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={clsx(
              'px-4 py-2 -mb-px text-sm font-medium transition-colors',
              active === tab.id
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}
```

- [ ] **Step 2: Create TanStack Query hooks `features/providers/api/queries.ts`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { Provider, ProviderType } from '../../../types/api';

export function useProviders(type?: ProviderType) {
  return useQuery({
    queryKey: ['providers', type],
    queryFn: () => api.get<Provider[]>(`/providers${type ? `?type=${type}` : ''}`),
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Provider>) =>
      api.put<Provider>(`/providers/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  });
}

export function useSetProviderKey() {
  return useMutation({
    mutationFn: ({ id, key }: { id: string; key: string }) =>
      api.put<void>(`/providers/${id}/key`, { key }),
  });
}
```

- [ ] **Step 3: Implement `ProviderCard` component** — shows name, enabled toggle, "Set API Key" button
- [ ] **Step 4: Implement `ProviderList` component** — uses `useProviders(type)`, renders list of `ProviderCard`
- [ ] **Step 5: Implement `ApiKeyDialog` component** — modal with password input, save button, uses `useSetProviderKey`
- [ ] **Step 6: Implement `ProvidersPage`** — uses `Tabs` with three tabs: TTS, LLM, Realtime. Each renders `ProviderList` with appropriate type.
- [ ] **Step 7: Update router** — replace providers placeholder with `ProvidersPage`
- [ ] **Step 8: Verify via Playwright** — open /providers, check tabs switch, provider cards render
- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: providers page with tabs, CRUD, API key management"
```

---

### Task 22: Datasets — Dialogs list + Dialog editor

**Goal:** Datasets page with Dialogs tab showing list of dialogs. Click opens dialog editor page with metadata and message editing.

**Files:**
- Create: `frontend/src/features/datasets/api/queries.ts`
- Create: `frontend/src/features/datasets/components/DatasetsPage.tsx`
- Create: `frontend/src/features/datasets/components/DialogList.tsx`
- Create: `frontend/src/features/datasets/components/DialogEditor.tsx`
- Create: `frontend/src/features/datasets/components/MessageEditor.tsx`
- Modify: `frontend/src/router.tsx`

**Steps:**

- [ ] **Step 1: Create query hooks** — `useDialogs()`, `useDialog(id)`, `useCreateDialog()`, `useUpdateDialog()`, `useDeleteDialog()`, `useCreateMessage()`, `useUpdateMessage()`, `useDeleteMessage()`
- [ ] **Step 2: Create `DialogList`** — table/list showing title, language, date. "New Dialog" button. Click navigates to `/datasets/dialogs/:id`
- [ ] **Step 3: Create `MessageEditor`** — single message row: character select (1|2), text input, delete button
- [ ] **Step 4: Create `DialogEditor`** — form with title, description, language fields. List of messages via `MessageEditor`. Add message button. Save/delete buttons. Uses `useDialog(id)` to fetch, mutations to update.
- [ ] **Step 5: Create `DatasetsPage`** — tabs: Dialogs | Prompts. Dialogs tab renders `DialogList`. Prompts tab placeholder for now.
- [ ] **Step 6: Update router** — nested routes: `/datasets` → `DatasetsPage`, `/datasets/dialogs/:dialogId` → `DialogEditor`
- [ ] **Step 7: Verify via Playwright**
- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: datasets page, dialog list + dialog editor"
```

---

### Task 23: Datasets — LLM dialog generation/editing

**Goal:** Add "Generate" and "Edit with LLM" buttons to the dialog editor. Both open a modal where user selects LLM provider + model and provides a prompt.

**Files:**
- Create: `frontend/src/features/datasets/components/LlmActionDialog.tsx`
- Create: `frontend/src/components/ui/Modal.tsx`
- Modify: `frontend/src/features/datasets/components/DialogEditor.tsx`
- Modify: `frontend/src/features/datasets/api/queries.ts`

**Steps:**

- [ ] **Step 1: Create `Modal` component** — overlay + centered content + close button
- [ ] **Step 2: Create query hooks** — `useGenerateDialog()`, `useEditDialog()`, `useLlmModels(providerId)` wrapping the `/services/generate-dialog`, `/services/edit-dialog`, `/llm/:providerId/models` endpoints
- [ ] **Step 3: Implement `LlmActionDialog`** — modal with: LLM provider dropdown (from `useProviders('llm')`), model dropdown (from `useLlmModels`), prompt textarea, submit button. Props: `mode: 'generate' | 'edit'`, `dialogId?: number`, `onSuccess`
- [ ] **Step 4: Wire into `DialogEditor`** — add "Generate" button (opens LlmActionDialog in generate mode, on success navigates to new dialog), "Edit with LLM" button (opens in edit mode, on success refetches dialog)
- [ ] **Step 5: Also wire "Generate" into `DialogList`** — "Generate New" button alongside "New Dialog"
- [ ] **Step 6: Verify via Playwright**
- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: LLM dialog generation and editing UI"
```

---

### Task 24: Datasets — Prompts tab

**Goal:** Annotation prompts list and editor.

**Files:**
- Create: `frontend/src/features/datasets/components/PromptList.tsx`
- Create: `frontend/src/features/datasets/components/PromptEditor.tsx`
- Modify: `frontend/src/features/datasets/components/DatasetsPage.tsx`
- Modify: `frontend/src/features/datasets/api/queries.ts`
- Modify: `frontend/src/router.tsx`

**Steps:**

- [ ] **Step 1: Add query hooks** — `useAnnotationPrompts()`, `useAnnotationPrompt(id)`, `useCreateAnnotationPrompt()`, `useUpdateAnnotationPrompt()`, `useDeleteAnnotationPrompt()`
- [ ] **Step 2: Implement `PromptList`** — shows title, language, TTS provider, date. "New Prompt" button. Click navigates to `/datasets/prompts/:id`
- [ ] **Step 3: Implement `PromptEditor`** — form: title, language select, TTS provider dropdown, prompt body textarea. Save/delete buttons.
- [ ] **Step 4: Wire into `DatasetsPage`** — Prompts tab renders `PromptList`
- [ ] **Step 5: Add route** — `/datasets/prompts/:promptId` → `PromptEditor`
- [ ] **Step 6: Verify via Playwright**
- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: annotation prompts list + editor"
```

---

### Task 25: TTS Testing — Provider/dialog/annotation selection

**Goal:** First part of TTS testing page: step-by-step selection of TTS provider, dialog, and annotation variant.

**Files:**
- Create: `frontend/src/features/tts/api/queries.ts`
- Create: `frontend/src/features/tts/components/TtsPage.tsx`
- Create: `frontend/src/features/tts/components/ProviderSelector.tsx`
- Create: `frontend/src/features/tts/components/DialogSelector.tsx`
- Create: `frontend/src/features/tts/components/AnnotationSelector.tsx`
- Modify: `frontend/src/router.tsx`

**Steps:**

- [ ] **Step 1: Create query hooks** — `useTtsProviders()`, `useTtsVoices(providerId)`, `useDialogs()`, `useAnnotationsByDialog(dialogId)`
- [ ] **Step 2: Implement `ProviderSelector`** — dropdown of TTS providers (from `useProviders('tts')`)
- [ ] **Step 3: Implement `DialogSelector`** — dropdown/list of dialogs (from `useDialogs()`)
- [ ] **Step 4: Implement `AnnotationSelector`** — dropdown of annotation variants for selected dialog + "Clean (no annotation)" option
- [ ] **Step 5: Implement `TtsPage`** — orchestrates the sequential flow: show ProviderSelector → when selected, show DialogSelector → when selected, show AnnotationSelector → when selected, show annotation editor area (Task 26) and voice assignment (Task 27). Use state to track selections.
- [ ] **Step 6: Update router** — `/tts` → `TtsPage`
- [ ] **Step 7: Verify via Playwright**
- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: TTS testing page - provider/dialog/annotation selection"
```

---

### Task 26: TTS Testing — Annotation editor + auto-annotation

**Goal:** Inline annotation editor on the TTS page. User can edit annotation text directly, save as new variant, or run auto-annotation via LLM.

**Files:**
- Create: `frontend/src/features/tts/components/AnnotationEditor.tsx`
- Modify: `frontend/src/features/tts/components/TtsPage.tsx`
- Modify: `frontend/src/features/tts/api/queries.ts`

**Steps:**

- [ ] **Step 1: Add query hooks** — `useAutoAnnotate()` (calls `/services/annotate`), `useCreateAnnotation()`, `useUpdateAnnotatedMessage()`
- [ ] **Step 2: Implement `AnnotationEditor`**

Shows dialog messages in a list. Each message shows:
- Original text (readonly, gray)
- Annotated text (editable textarea, or original text if no annotation)
- Changes are tracked in local state

Actions:
- "Save as New Variant" — creates new annotation with current texts
- "Auto-Annotate" — opens popover/modal to select LLM provider + model + annotation prompt, then calls auto-annotate endpoint
- Individual message edits auto-save (debounced) via `useUpdateAnnotatedMessage`

- [ ] **Step 3: Wire into TtsPage** — show AnnotationEditor after annotation is selected/created
- [ ] **Step 4: Verify via Playwright**
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: TTS annotation editor + auto-annotation"
```

---

### Task 27: TTS Testing — Voice assignment + audio playback

**Goal:** Assign voices to characters and play dialog line by line with highlighting.

**Files:**
- Create: `frontend/src/features/tts/components/VoiceAssignment.tsx`
- Create: `frontend/src/features/tts/components/PlaybackControls.tsx`
- Create: `frontend/src/features/tts/hooks/useAudioPlayback.ts`
- Modify: `frontend/src/features/tts/components/TtsPage.tsx`

**Steps:**

- [ ] **Step 1: Implement `VoiceAssignment`** — two dropdowns (one per character), populated from `useTtsVoices(providerId)`. Each dropdown selects a voice ID.

- [ ] **Step 2: Implement `useAudioPlayback` hook**

```typescript
// src/features/tts/hooks/useAudioPlayback.ts
// Manages sequential playback of dialog lines.
// State: currentMessageIndex, isPlaying
// synthesizeLine(text, voiceId, providerId) → fetches audio from /api/tts/:providerId/synthesize
// play() → for each message, synthesize + play audio, advance index, highlight current line
// stop() → abort playback, reset state
```

- [ ] **Step 3: Implement `PlaybackControls`** — "Run" button (starts playback), "Stop" button. Shows progress indicator.
- [ ] **Step 4: Wire into TtsPage** — VoiceAssignment after annotation editor, PlaybackControls at bottom. Pass `currentMessageIndex` to AnnotationEditor for highlighting.
- [ ] **Step 5: Verify via Playwright** — check UI renders, buttons are clickable (actual audio playback is hard to test in Playwright, but verify no JS errors)
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: TTS voice assignment + audio playback"
```

---

## Phase 8: Realtime

### Task 28: Backend — Realtime WebSocket infrastructure + types

**Goal:** Set up WebSocket support in Fastify for realtime voice sessions. Define the realtime provider interface.

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/providers/realtime/types.ts`
- Create: `backend/src/providers/realtime/registry.ts`
- Create: `backend/src/routes/realtime/index.ts`

**Steps:**

- [ ] **Step 1: Install WebSocket dependency**

```bash
cd backend && npm install @fastify/websocket
```

- [ ] **Step 2: Register WebSocket plugin in `app.ts`**

```typescript
import websocket from '@fastify/websocket';
// In buildApp():
await app.register(websocket);
```

- [ ] **Step 3: Define realtime provider interface**

```typescript
// src/providers/realtime/types.ts
export interface RealtimeSessionConfig {
  model: string;
  systemPrompt: string;
  voice?: string;
}

export interface RealtimeEvent {
  type: 'transcript' | 'audio' | 'error' | 'session_start' | 'session_end';
  data: unknown;
}

export interface IRealtimeProvider {
  id: string;
  name: string;
  getModels(): Promise<string[]>;
  /** Create a session. Returns methods to send audio and close. */
  createSession(
    config: RealtimeSessionConfig,
    onEvent: (event: RealtimeEvent) => void,
  ): Promise<{
    sendAudio(chunk: Buffer): void;
    close(): Promise<void>;
  }>;
}
```

- [ ] **Step 4: Create empty registry**

```typescript
// src/providers/realtime/registry.ts
import type { IRealtimeProvider } from './types.js';

const constructors: Record<string, new (apiKey: string) => IRealtimeProvider> = {};

export function createRealtimeProvider(id: string, apiKey: string): IRealtimeProvider {
  const Ctor = constructors[id];
  if (!Ctor) throw new Error(`Unknown realtime provider: ${id}`);
  return new Ctor(apiKey);
}

// Will be populated as providers are added
export function registerRealtimeProvider(id: string, ctor: new (apiKey: string) => IRealtimeProvider) {
  constructors[id] = ctor;
}
```

- [ ] **Step 5: Create WebSocket route scaffold**

```typescript
// src/routes/realtime/index.ts
import type { FastifyPluginAsync } from 'fastify';
import { createRealtimeProvider } from '../../providers/realtime/registry.js';

const realtimeRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /realtime/:providerId/models
  fastify.get('/:providerId/models', async (req, reply) => {
    const { providerId } = req.params as { providerId: string };
    const provider = await fastify.db.providers.getById(providerId);
    if (!provider) return reply.notFound();
    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) return reply.badRequest('No API key set');
    const rt = createRealtimeProvider(providerId, apiKey);
    return rt.getModels();
  });

  // WebSocket: /realtime/:providerId/session
  fastify.get('/:providerId/session', { websocket: true }, async (socket, req) => {
    const { providerId } = req.params as { providerId: string };
    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      socket.close(4000, 'No API key');
      return;
    }

    const rt = createRealtimeProvider(providerId, apiKey);

    // Wait for config message from client
    socket.on('message', async (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'session_start') {
        const session = await rt.createSession(
          { model: msg.model, systemPrompt: msg.systemPrompt, voice: msg.voice },
          (event) => socket.send(JSON.stringify(event)),
        );

        socket.on('message', (data) => {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'audio') {
            session.sendAudio(Buffer.from(parsed.data, 'base64'));
          }
          if (parsed.type === 'session_end') {
            session.close();
          }
        });

        socket.on('close', () => session.close());
      }
    });
  });
};

export default realtimeRoutes;
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: realtime WebSocket infrastructure + provider interface"
```

---

### Task 29: OpenAI Realtime provider

**Goal:** OpenAI Realtime API adapter (WebSocket-based).

**Files:**
- Create: `backend/src/providers/realtime/openai.ts`
- Modify: `backend/src/providers/realtime/registry.ts`

**Steps:**

- [ ] **Step 1: Research OpenAI Realtime API** — WebSocket endpoint, session creation, audio format requirements
- [ ] **Step 2: Implement adapter** — connects to OpenAI Realtime WebSocket, forwards audio bidirectionally, parses transcript events, maps to `RealtimeEvent` format
- [ ] **Step 3: Register in registry**
- [ ] **Step 4: Manual test** — start server, connect via WebSocket client, verify session starts
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: OpenAI realtime provider"
```

---

### Task 30: Gemini Realtime provider

**Goal:** Google Gemini Live API adapter.

**Files:**
- Create: `backend/src/providers/realtime/gemini.ts`
- Modify: `backend/src/providers/realtime/registry.ts`

**Steps:**

- [ ] **Step 1: Research Gemini Live API** — WebSocket/gRPC endpoint, authentication, audio handling
- [ ] **Step 2: Implement adapter** — same IRealtimeProvider interface
- [ ] **Step 3: Register in registry**
- [ ] **Step 4: Manual test**
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Gemini realtime provider"
```

---

### Task 31: ElevenLabs Realtime provider

**Goal:** ElevenLabs Conversational AI adapter.

**Files:**
- Create: `backend/src/providers/realtime/elevenlabs.ts`
- Modify: `backend/src/providers/realtime/registry.ts`

**Steps:**

- [ ] **Step 1: Research ElevenLabs Conversational AI API**
- [ ] **Step 2: Implement adapter**
- [ ] **Step 3: Register in registry**
- [ ] **Step 4: Manual test**
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: ElevenLabs realtime provider"
```

---

### Task 32: Inworld Realtime provider

**Goal:** Inworld AI realtime adapter.

**Files:**
- Create: `backend/src/providers/realtime/inworld.ts`
- Modify: `backend/src/providers/realtime/registry.ts`

**Steps:**

- [ ] **Step 1: Research Inworld AI SDK/API** — character sessions, audio streaming
- [ ] **Step 2: Implement adapter**
- [ ] **Step 3: Register in registry**
- [ ] **Step 4: Manual test**
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Inworld realtime provider"
```

---

### Task 33: Frontend — Realtime page (all 4 tabs)

**Goal:** Realtime page with tabs for each provider. Each tab has model selection, agent prompt selection/creation, and a live session interface with transcription.

**Files:**
- Create: `frontend/src/features/realtime/api/queries.ts`
- Create: `frontend/src/features/realtime/hooks/useMicrophone.ts`
- Create: `frontend/src/features/realtime/hooks/useRealtimeSession.ts`
- Create: `frontend/src/features/realtime/components/RealtimePage.tsx`
- Create: `frontend/src/features/realtime/components/SessionControls.tsx`
- Create: `frontend/src/features/realtime/components/TranscriptionPanel.tsx`
- Create: `frontend/src/features/realtime/components/OpenAiTab.tsx`
- Create: `frontend/src/features/realtime/components/GeminiTab.tsx`
- Create: `frontend/src/features/realtime/components/ElevenLabsTab.tsx`
- Create: `frontend/src/features/realtime/components/InworldTab.tsx`
- Modify: `frontend/src/router.tsx`

**Steps:**

- [ ] **Step 1: Create query hooks** — `useAgentPrompts()`, `useCreateAgentPrompt()`, `useRealtimeModels(providerId)`

- [ ] **Step 2: Implement `useMicrophone` hook**

```typescript
// Manages browser microphone access via MediaRecorder API.
// start() → requests mic permission, begins recording, returns audio chunks
// stop() → stops recording
// State: isRecording, error
// Audio format: PCM 16-bit or WebM depending on provider requirements
```

- [ ] **Step 3: Implement `useRealtimeSession` hook**

```typescript
// Manages WebSocket connection to /api/realtime/:providerId/session.
// connect(providerId, config) → opens WebSocket, sends session_start
// sendAudio(chunk) → sends audio data
// disconnect() → sends session_end, closes WebSocket
// State: isConnected, transcripts (array of {role, text}), error
// Listens for: transcript, audio, error, session_end events
// For audio events: plays received audio via Web Audio API
```

- [ ] **Step 4: Implement shared components**

`TranscriptionPanel` — scrollable list of transcript entries (user lines in blue, agent lines in gray). Auto-scrolls to bottom on new entry.

`SessionControls` — model dropdown, agent prompt dropdown (with inline create option), Start/Stop button. Uses `useMicrophone` + `useRealtimeSession`.

- [ ] **Step 5: Implement provider tabs**

Each tab (`OpenAiTab`, `GeminiTab`, `ElevenLabsTab`, `InworldTab`) is isolated but follows the same structure:
1. Render `SessionControls` with `providerId` prop
2. Render `TranscriptionPanel` with transcripts from session hook
3. Provider-specific config if needed (e.g., voice selection)

```tsx
// Example: OpenAiTab.tsx
export function OpenAiTab() {
  const mic = useMicrophone();
  const session = useRealtimeSession('openai');

  const handleStart = async (model: string, prompt: string) => {
    await mic.start();
    await session.connect({ model, systemPrompt: prompt });
    // Pipe mic audio to session
  };

  const handleStop = async () => {
    mic.stop();
    await session.disconnect();
  };

  return (
    <div className="space-y-4">
      <SessionControls
        providerId="openai"
        onStart={handleStart}
        onStop={handleStop}
        isActive={session.isConnected}
      />
      <TranscriptionPanel transcripts={session.transcripts} />
    </div>
  );
}
```

- [ ] **Step 6: Implement `RealtimePage`** — tabs for OpenAI, Gemini, ElevenLabs, Inworld
- [ ] **Step 7: Update router** — `/realtime` → `RealtimePage`
- [ ] **Step 8: Verify via Playwright** — check page loads, tabs switch, controls render
- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: realtime page with all provider tabs"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1–2 | Backend API infrastructure (buildApp, TypeBox) |
| 2 | 3–7 | Backend CRUD routes (providers, dialogs, prompts, annotations) |
| 3 | 8–11 | Backend TTS providers (ElevenLabs, Google, Inworld) + routes |
| 4 | 12–14 | Backend LLM providers (OpenAI, Anthropic) + routes |
| 5 | 15–17 | Backend services (generation, editing, annotation) |
| 6 | 18–20 | Frontend infrastructure (deps, Tailwind, routing, layout) |
| 7 | 21–27 | Frontend pages (Providers, Datasets, TTS Testing) |
| 8 | 28–33 | Realtime (backend providers + frontend page) |

**Total: 33 tasks**

**Parallelization opportunities:**
- Tasks 3–7 are independent after Task 2 (can run in parallel)
- Tasks 8–10 are independent of each other (TTS adapters)
- Tasks 12–13 are independent of each other (LLM adapters)
- Tasks 15–17 are independent of each other (services)
- Tasks 29–32 are independent of each other (realtime providers)
- Frontend tasks 21–27 are mostly independent after Task 20
- Phase 6 (frontend infra) can start in parallel with Phase 3-5 (backend providers/services)

**Dependency chain (critical path):**
Task 1 → Task 2 → Task 3 → Task 8 → Task 11 → Task 15 → Task 18 → Task 20 → Task 22 → Task 25 → Task 27
