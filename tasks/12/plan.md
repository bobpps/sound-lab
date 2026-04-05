# TTS API Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /tts/:providerId/voices` and `POST /tts/:providerId/synthesize` routes that proxy to the existing TTS provider abstraction layer.

**Architecture:** Two routes under `/tts/:providerId/` — one returns JSON voice list, one returns binary audio. Both look up the provider in DB, verify it is type `tts`, decrypt the API key, instantiate the provider via `createTTSProvider()`, and delegate. Tests mock `createTTSProvider` to avoid real API calls.

**Tech Stack:** Fastify 5, TypeBox schemas, Vitest, `vi.mock()` for provider mocking, `app.inject()` for HTTP simulation.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/schemas/tts.ts` | Create | TypeBox schemas for TTS route params and request body |
| `backend/src/routes/tts/index.ts` | Create | Route handlers for voices and synthesize |
| `backend/tests/routes/tts.test.ts` | Create | Route-level tests with mocked TTS provider |

---

### Task 1: TypeBox Schemas (`backend/src/schemas/tts.ts`)

**Files:**
- Create: `backend/src/schemas/tts.ts`

- [ ] **Step 1: Create the schema file**

Create `backend/src/schemas/tts.ts` with all schemas needed by the TTS routes:

```typescript
import { Type, type Static } from '@sinclair/typebox';

export const ProviderIdParam = Type.Object({
  providerId: Type.String(),
});
export type ProviderIdParam = Static<typeof ProviderIdParam>;

export const Voice = Type.Object({
  id: Type.String(),
  name: Type.String(),
  language: Type.String(),
  gender: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  previewUrl: Type.Optional(Type.String()),
  providerMeta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type Voice = Static<typeof Voice>;

export const SynthesizeBody = Type.Object({
  voiceId: Type.String(),
  text: Type.String({ minLength: 1 }),
  speed: Type.Optional(Type.Number()),
  temperature: Type.Optional(Type.Number()),
  format: Type.Optional(Type.String()),
  sampleRate: Type.Optional(Type.Number()),
}, { additionalProperties: false });
export type SynthesizeBody = Static<typeof SynthesizeBody>;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit src/schemas/tts.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/tts.ts
git commit -m "feat(tts): add TypeBox schemas for TTS routes"
```

---

### Task 2: Write Failing Tests (`backend/tests/routes/tts.test.ts`)

**Files:**
- Create: `backend/tests/routes/tts.test.ts`

- [ ] **Step 1: Create the test file with all test cases**

Create `backend/tests/routes/tts.test.ts`. The `vi.mock()` call is hoisted, so declare it at the top. The mock path is relative to the test file: `../src/providers/tts/registry.js` resolves from `backend/tests/` to `backend/src/providers/tts/registry.js`.

```typescript
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';
import type { IVoice } from '../../src/providers/tts/types.js';

const mockGetVoices = vi.fn<() => Promise<IVoice[]>>();
const mockSynthesize = vi.fn<() => Promise<Buffer>>();

vi.mock('../../src/providers/tts/registry.js', () => ({
  createTTSProvider: vi.fn(() => ({
    id: 'test-provider',
    name: 'Test Provider',
    getVoices: mockGetVoices,
    synthesize: mockSynthesize,
    validateCredentials: vi.fn().mockResolvedValue(true),
  })),
}));

describe('TTS routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  async function seedTTSProvider(id = 'elevenlabs', name = 'ElevenLabs') {
    await app.db.providers.create({ id, name, type: 'tts' });
    await app.db.providers.setKey(id, 'test-api-key');
  }

  describe('GET /tts/:providerId/voices', () => {
    it('returns voices from the TTS provider', async () => {
      await seedTTSProvider();
      const voices: IVoice[] = [
        { id: 'v1', name: 'Alice', language: 'en' },
        { id: 'v2', name: 'Bob', language: 'en', gender: 'male' },
      ];
      mockGetVoices.mockResolvedValueOnce(voices);

      const res = await app.inject({
        method: 'GET',
        url: '/tts/elevenlabs/voices',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(voices);
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/tts/nonexistent/voices',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not TTS type', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      await app.db.providers.setKey('openai', 'test-key');

      const res = await app.inject({
        method: 'GET',
        url: '/tts/openai/voices',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      // No setKey call — key is null

      const res = await app.inject({
        method: 'GET',
        url: '/tts/elevenlabs/voices',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /tts/:providerId/synthesize', () => {
    it('returns audio buffer with correct content-type', async () => {
      await seedTTSProvider();
      const audioBuffer = Buffer.from('fake-audio-data');
      mockSynthesize.mockResolvedValueOnce(audioBuffer);

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1', text: 'Hello world' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('audio/mpeg');
      expect(Buffer.from(res.rawPayload)).toEqual(audioBuffer);
    });

    it('passes all options to the provider', async () => {
      await seedTTSProvider();
      mockSynthesize.mockResolvedValueOnce(Buffer.from('audio'));

      const payload = {
        voiceId: 'v1',
        text: 'Hello',
        speed: 1.2,
        temperature: 0.7,
        format: 'mp3',
        sampleRate: 44100,
      };

      await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload,
      });

      expect(mockSynthesize).toHaveBeenCalledWith(payload);
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tts/nonexistent/synthesize',
        payload: { voiceId: 'v1', text: 'Hello' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not TTS type', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      await app.db.providers.setKey('openai', 'test-key');

      const res = await app.inject({
        method: 'POST',
        url: '/tts/openai/synthesize',
        payload: { voiceId: 'v1', text: 'Hello' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1', text: 'Hello' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when body is missing required fields', async () => {
      await seedTTSProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1' }, // missing text
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when text is empty', async () => {
      await seedTTSProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/tts/elevenlabs/synthesize',
        payload: { voiceId: 'v1', text: '' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run tests/routes/tts.test.ts`
Expected: All tests FAIL because `backend/src/routes/tts/index.ts` does not exist yet, so the routes are not registered. Most tests will get 404 (route not found) or unexpected status codes.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/tts.test.ts
git commit -m "test(tts): add failing tests for TTS API routes"
```

---

### Task 3: Route Handlers (`backend/src/routes/tts/index.ts`)

**Files:**
- Create: `backend/src/routes/tts/index.ts`

- [ ] **Step 1: Create the route handler file**

Create `backend/src/routes/tts/index.ts`. Autoload will pick it up at the `/tts` prefix automatically.

```typescript
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { ProviderIdParam, Voice, SynthesizeBody } from '../../schemas/tts.js';
import { ErrorResponse } from '../../schemas/common.js';
import { createTTSProvider } from '../../providers/tts/registry.js';

const ttsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /tts/:providerId/voices
  fastify.get('/:providerId/voices', {
    schema: {
      params: ProviderIdParam,
      response: {
        200: Type.Array(Voice),
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { providerId } = request.params;

    const provider = await fastify.db.providers.getById(providerId);
    if (!provider || provider.type !== 'tts') {
      return reply.notFound(`TTS provider ${providerId} not found`);
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      return reply.badRequest(`No API key configured for provider ${providerId}`);
    }

    const tts = createTTSProvider(providerId, apiKey);
    const voices = await tts.getVoices();
    return voices;
  });

  // POST /tts/:providerId/synthesize
  fastify.post('/:providerId/synthesize', {
    schema: {
      params: ProviderIdParam,
      body: SynthesizeBody,
      response: {
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { providerId } = request.params;

    const provider = await fastify.db.providers.getById(providerId);
    if (!provider || provider.type !== 'tts') {
      return reply.notFound(`TTS provider ${providerId} not found`);
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      return reply.badRequest(`No API key configured for provider ${providerId}`);
    }

    const tts = createTTSProvider(providerId, apiKey);
    const audio = await tts.synthesize(request.body);
    return reply.type('audio/mpeg').send(audio);
  });
};

export default ttsRoutes;
```

Key design notes:
- The 200 response schema is **omitted** for the synthesize endpoint. Defining a schema for binary data would cause `fast-json-stringify` to mangle the buffer. Fastify skips serialization when no 200 schema is defined.
- The voices endpoint **does** have a 200 response schema (`Type.Array(Voice)`) for JSON serialization safety.
- `provider.type !== 'tts'` check is combined with the null check into a single 404 — no information leak about non-TTS providers.

- [ ] **Step 2: Run the tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/tts.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: If any tests fail, debug and fix**

Common issues to watch for:
- `vi.mock()` path resolution: the mock path `../../src/providers/tts/registry.js` is relative to the test file at `backend/tests/routes/tts.test.ts`. If the mock is not intercepting, check this path.
- Binary response: if `content-type` is not `audio/mpeg`, ensure `reply.type('audio/mpeg').send(audio)` is used (not `return audio`).
- Serialization: if voices come back with missing optional fields, the `Type.Optional()` wrappers in the Voice schema may be stripping them. Verify the schema matches `IVoice`.

- [ ] **Step 4: Run the full backend test suite**

Run: `cd backend && npx vitest run`
Expected: All existing tests still pass. No regressions.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/tts/index.ts
git commit -m "feat(tts): implement GET /tts/:providerId/voices and POST /tts/:providerId/synthesize"
```

---

### Task 4: Verify Build and Final Cleanup

**Files:**
- Review: all three new files

- [ ] **Step 1: Run TypeScript type check on the full backend**

Run: `cd backend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 2: Run the full test suite one more time**

Run: `cd backend && npx vitest run`
Expected: All tests pass, including the new TTS route tests.

- [ ] **Step 3: Verify the routes register correctly (smoke check)**

Run: `cd backend && npx tsx -e "import { buildApp } from './src/app.js'; const app = await buildApp(); await app.ready(); console.log(app.printRoutes()); await app.close();"`
Expected: Output includes `/tts/:providerId/voices (GET)` and `/tts/:providerId/synthesize (POST)`.

- [ ] **Step 4: Final commit if any cleanup was needed**

Only if changes were made during cleanup:
```bash
git add -A
git commit -m "refactor(tts): cleanup after review"
```
