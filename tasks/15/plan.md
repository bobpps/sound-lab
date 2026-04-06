# LLM API Routes (models + complete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two HTTP endpoints (`GET /llm/:providerId/models` and `POST /llm/:providerId/complete`) that mirror the existing TTS route pattern -- resolve provider from DB, decrypt API key, create adapter, call method.

**Architecture:** Follows the established plugin + route + schema pattern from TTS routes. A `fastify-plugin` decorator exposes `createLLMProvider` on the Fastify instance. Route plugin uses a `resolveLLMProvider()` helper to do DB lookup (verify type='llm'), decrypt API key, and instantiate the adapter. Two endpoints delegate to `ILLMProvider.getModels()` and `ILLMProvider.complete()`. The `complete()` method returns a raw `string`; the route wraps it in `{ text: string }`.

**Tech Stack:** Fastify 5, TypeBox schemas, `fastify-plugin`, Vitest, ESM (`.js` imports)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/plugins/llm.ts` | Fastify plugin decorator exposing `createLLMProvider` factory |
| Create | `backend/src/schemas/llm.ts` | TypeBox schemas: params, request body, response types |
| Create | `backend/src/routes/llm/index.ts` | Route plugin with `resolveLLMProvider()` + 2 endpoints |
| Create | `backend/tests/routes/llm.test.ts` | Route tests (happy path + error cases) |
| Modify | `backend/src/app.ts` | Import and register `llmPlugin` |

---

### Task 1: Create schemas and plugin (infrastructure)

**Files:**
- Create: `backend/src/schemas/llm.ts`
- Create: `backend/src/plugins/llm.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create the LLM TypeBox schemas**

Create `backend/src/schemas/llm.ts`:

```typescript
import { Type, type Static } from '@sinclair/typebox';

export const LLMProviderIdParam = Type.Object({
  providerId: Type.String(),
});
export type LLMProviderIdParam = Static<typeof LLMProviderIdParam>;

export const LLMMessage = Type.Object({
  role: Type.Union([
    Type.Literal('system'),
    Type.Literal('user'),
    Type.Literal('assistant'),
  ]),
  content: Type.String(),
});
export type LLMMessage = Static<typeof LLMMessage>;

export const CompleteBody = Type.Object({
  messages: Type.Array(LLMMessage, { minItems: 1 }),
  model: Type.String(),
}, { additionalProperties: false });
export type CompleteBody = Static<typeof CompleteBody>;

export const CompleteResponse = Type.Object({
  text: Type.String(),
});
export type CompleteResponse = Static<typeof CompleteResponse>;

export const ModelsResponse = Type.Array(Type.String());
export type ModelsResponse = Static<typeof ModelsResponse>;
```

Note: `additionalProperties: false` on `CompleteBody` prevents extra fields leaking through. `LLMProviderIdParam` reuses the same shape as TTS's `ProviderIdParam` but is defined separately to keep schemas self-contained per domain.

- [ ] **Step 2: Create the LLM plugin decorator**

Create `backend/src/plugins/llm.ts`:

```typescript
import fp from 'fastify-plugin';
import { createLLMProvider } from '../providers/llm/registry.js';
import type { ILLMProvider } from '../providers/llm/types.js';

export type LLMProviderFactory = (providerId: string, apiKey: string) => ILLMProvider;

declare module 'fastify' {
  interface FastifyInstance {
    createLLMProvider: LLMProviderFactory;
  }
}

export default fp(
  async (fastify) => {
    fastify.decorate('createLLMProvider', createLLMProvider);
  },
  { name: 'llm' },
);
```

- [ ] **Step 3: Register the LLM plugin in app.ts**

In `backend/src/app.ts`, add the import and registration. The file currently imports `ttsPlugin` and registers it. Add `llmPlugin` the same way.

Add import at top (after the `ttsPlugin` import):
```typescript
import llmPlugin from './plugins/llm.js';
```

Add registration (after `await app.register(ttsPlugin);`):
```typescript
await app.register(llmPlugin);
```

- [ ] **Step 4: Verify the app still builds**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors. The plugin and schemas compile, and app.ts registers the new plugin.

- [ ] **Step 5: Commit infrastructure**

```bash
git add backend/src/schemas/llm.ts backend/src/plugins/llm.ts backend/src/app.ts
git commit -m "feat(llm): add LLM schemas and plugin decorator"
```

---

### Task 2: Write route tests (RED phase)

**Files:**
- Create: `backend/tests/routes/llm.test.ts`

These tests mirror `backend/tests/routes/tts.test.ts`. The mock pattern: override the `createLLMProvider` decorator on the app instance with a `vi.fn()` factory that returns an object implementing `ILLMProvider`. Seed a provider row with `type: 'llm'` and an API key.

- [ ] **Step 1: Write the full test file**

Create `backend/tests/routes/llm.test.ts`:

```typescript
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('LLM routes', () => {
  let app: FastifyInstance;
  let mockGetModels: ReturnType<typeof vi.fn>;
  let mockComplete: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockGetModels = vi.fn<() => Promise<string[]>>();
    mockComplete = vi.fn<() => Promise<string>>();

    app = await buildTestApp();

    // Override the createLLMProvider decorator with a mock factory
    (app as Record<string, unknown>).createLLMProvider = vi.fn(() => ({
      id: 'test-provider',
      name: 'Test Provider',
      getModels: mockGetModels,
      complete: mockComplete,
      validateCredentials: vi.fn().mockResolvedValue(true),
    }));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  async function seedLLMProvider(id = 'openai', name = 'OpenAI') {
    await app.db.providers.create({ id, name, type: 'llm' });
    await app.db.providers.setKey(id, 'test-api-key');
  }

  describe('GET /llm/:providerId/models', () => {
    it('returns models from the LLM provider', async () => {
      await seedLLMProvider();
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'];
      mockGetModels.mockResolvedValueOnce(models);

      const res = await app.inject({
        method: 'GET',
        url: '/llm/openai/models',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(models);
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/llm/nonexistent/models',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not LLM type', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await app.db.providers.setKey('elevenlabs', 'test-key');

      const res = await app.inject({
        method: 'GET',
        url: '/llm/elevenlabs/models',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      // No setKey call — key is null

      const res = await app.inject({
        method: 'GET',
        url: '/llm/openai/models',
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when provider is not supported by registry', async () => {
      await seedLLMProvider('unsupported', 'Unsupported');
      (app as Record<string, unknown>).createLLMProvider = vi.fn(() => {
        throw new Error('Unsupported LLM provider: unsupported');
      });

      const res = await app.inject({
        method: 'GET',
        url: '/llm/unsupported/models',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /llm/:providerId/complete', () => {
    it('returns completion text from the LLM provider', async () => {
      await seedLLMProvider();
      mockComplete.mockResolvedValueOnce('Hello! How can I help you?');

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ text: 'Hello! How can I help you?' });
    });

    it('passes messages and model to the provider', async () => {
      await seedLLMProvider();
      mockComplete.mockResolvedValueOnce('response');

      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hi' },
      ];

      await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: { messages, model: 'gpt-4o-mini' },
      });

      expect(mockComplete).toHaveBeenCalledWith(messages, 'gpt-4o-mini');
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/llm/nonexistent/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not LLM type', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await app.db.providers.setKey('elevenlabs', 'test-key');

      const res = await app.inject({
        method: 'POST',
        url: '/llm/elevenlabs/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'some-model',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when messages array is empty', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when body is missing required fields', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          // missing model
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when message has invalid role', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'invalid', content: 'Hello' }],
          model: 'gpt-4o',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects additional properties in body', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/llm/openai/complete',
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o',
          extraField: 'should-be-rejected',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail (RED)**

Run: `cd backend && npx vitest run tests/routes/llm.test.ts`
Expected: All tests FAIL. The route file `routes/llm/index.ts` does not exist yet, so the endpoints return 404 for everything. The 404 tests may pass incidentally -- that is fine. The key is that the happy-path tests and specific error tests fail.

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/tests/routes/llm.test.ts
git commit -m "test(llm): add route tests for GET /models and POST /complete (RED)"
```

---

### Task 3: Implement routes (GREEN phase)

**Files:**
- Create: `backend/src/routes/llm/index.ts`

- [ ] **Step 1: Create the LLM route plugin**

Create `backend/src/routes/llm/index.ts`:

```typescript
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  LLMProviderIdParam,
  CompleteBody,
  CompleteResponse,
  ModelsResponse,
} from '../../schemas/llm.js';
import { ErrorResponse } from '../../schemas/common.js';
import type { ILLMProvider } from '../../providers/llm/types.js';

const llmRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  async function resolveLLMProvider(
    providerId: string,
    reply: FastifyReply,
  ): Promise<ILLMProvider | null> {
    const provider = await fastify.db.providers.getById(providerId);
    if (!provider || provider.type !== 'llm') {
      reply.notFound(`LLM provider ${providerId} not found`);
      return null;
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      reply.badRequest(`No API key configured for provider ${providerId}`);
      return null;
    }

    try {
      return fastify.createLLMProvider(providerId, apiKey);
    } catch {
      reply.badRequest(`Provider ${providerId} is not supported`);
      return null;
    }
  }

  // GET /llm/:providerId/models
  fastify.get('/:providerId/models', {
    schema: {
      params: LLMProviderIdParam,
      response: {
        200: ModelsResponse,
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const llm = await resolveLLMProvider(request.params.providerId, reply);
    if (!llm) return;

    const models = await llm.getModels();
    return models;
  });

  // POST /llm/:providerId/complete
  fastify.post('/:providerId/complete', {
    schema: {
      params: LLMProviderIdParam,
      body: CompleteBody,
      response: {
        200: CompleteResponse,
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const llm = await resolveLLMProvider(request.params.providerId, reply);
    if (!llm) return;

    const text = await llm.complete(request.body.messages, request.body.model);
    return { text };
  });
};

export default llmRoutes;
```

Key details:
- `resolveLLMProvider()` checks `provider.type !== 'llm'` (not `'tts'`).
- `complete()` returns raw `string`, route wraps it in `{ text }` to match `CompleteResponse` schema.
- Response schemas on both endpoints enable `fast-json-stringify`.
- `@fastify/autoload` picks up the `routes/llm/` directory automatically with prefix `/llm`.

- [ ] **Step 2: Run the tests to confirm they pass (GREEN)**

Run: `cd backend && npx vitest run tests/routes/llm.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: Run the full test suite to check for regressions**

Run: `cd backend && npx vitest run`
Expected: All tests pass, including existing TTS route tests.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit the route implementation**

```bash
git add backend/src/routes/llm/index.ts
git commit -m "feat(llm): implement GET /models and POST /complete routes (GREEN)"
```
