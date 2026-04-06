# Dialog Editing Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a service that edits an existing dialog's messages via LLM, exposed through `POST /services/edit-dialog`.

**Architecture:** Pure function `editDialog()` in a service module takes a dialog ID, LLM provider instance, model name, and editing instructions. It fetches the dialog with messages from DB, sends them to the LLM with a system prompt asking for JSON-formatted edits, parses the response, validates structure (same message count, same characters), updates each changed message via `updateMessage()`, and re-fetches the updated dialog. The route handler resolves the LLM provider from DB (same pattern as TTS routes) and delegates to the service.

**Tech Stack:** Fastify 5, TypeBox schemas, Vitest, `ILLMProvider.complete()`, `IDialogRepository.getWithMessages()` / `updateMessage()`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `backend/src/plugins/llm.ts` | Fastify plugin: decorate instance with `createLLMProvider` factory |
| Create | `backend/src/services/dialog-editing.ts` | Pure service function `editDialog()` |
| Create | `backend/src/schemas/service.ts` | TypeBox request/response schemas for `/services/*` routes |
| Create | `backend/src/routes/services/index.ts` | Route handler for `POST /services/edit-dialog` |
| Create | `backend/tests/services/dialog-editing.test.ts` | Unit tests for the service (mocked DB + LLM) |
| Create | `backend/tests/routes/services.test.ts` | Integration tests for the route (real DB, mocked LLM factory) |
| Modify | `backend/src/app.ts` | Register LLM plugin |

---

### Task 1: LLM Plugin

Create a Fastify plugin that decorates the instance with `createLLMProvider`, mirroring the existing TTS plugin pattern.

**Files:**
- Create: `backend/src/plugins/llm.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create the LLM plugin**

```typescript
// backend/src/plugins/llm.ts
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

- [ ] **Step 2: Register the LLM plugin in app.ts**

Add the import and registration to `backend/src/app.ts`. After the existing `ttsPlugin` import, add:

```typescript
import llmPlugin from './plugins/llm.js';
```

After `await app.register(ttsPlugin);`, add:

```typescript
await app.register(llmPlugin);
```

- [ ] **Step 3: Verify the app still builds and tests pass**

Run from `backend/`:
```bash
npx vitest run --reporter=verbose
```
Expected: All existing tests pass. No regressions.

- [ ] **Step 4: Commit**

```bash
git add backend/src/plugins/llm.ts backend/src/app.ts
git commit -m "feat(llm): add LLM provider Fastify plugin"
```

---

### Task 2: Service Unit Tests (Red Phase)

Write failing tests for `editDialog()` before implementing it. These tests mock both the DB and the LLM provider.

**Files:**
- Create: `backend/tests/services/dialog-editing.test.ts`

- [ ] **Step 1: Write the test file with all test cases**

```typescript
// backend/tests/services/dialog-editing.test.ts
import { editDialog } from '../../src/services/dialog-editing.js';
import type { IDatabase } from '../../src/db/interfaces.js';
import type { ILLMProvider, ILLMMessage } from '../../src/providers/llm/types.js';
import type { DialogWithMessages } from '../../src/db/types.js';

function createMockDb(dialog: DialogWithMessages | null): IDatabase {
  return {
    dialogs: {
      getWithMessages: vi.fn().mockResolvedValue(dialog),
      updateMessage: vi.fn().mockImplementation(
        async (id: number, data: { text?: string }) => ({
          id,
          dialog_id: dialog?.id ?? 0,
          order: dialog?.messages.find(m => m.id === id)?.order ?? 0,
          character: dialog?.messages.find(m => m.id === id)?.character ?? 1,
          text: data.text ?? '',
        }),
      ),
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMessage: vi.fn(),
      deleteMessage: vi.fn(),
    },
    annotations: {} as IDatabase['annotations'],
    annotationPrompts: {} as IDatabase['annotationPrompts'],
    agentPrompts: {} as IDatabase['agentPrompts'],
    providers: {} as IDatabase['providers'],
    close: vi.fn(),
  } as unknown as IDatabase;
}

function createMockLLM(responseJson: unknown): ILLMProvider {
  return {
    id: 'openai',
    name: 'OpenAI',
    getModels: vi.fn(),
    complete: vi.fn().mockResolvedValue(JSON.stringify(responseJson)),
    validateCredentials: vi.fn(),
  };
}

const SAMPLE_DIALOG: DialogWithMessages = {
  id: 1,
  title: 'Test Dialog',
  description: null,
  language: 'en-US',
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  messages: [
    { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hello there' },
    { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?' },
    { id: 12, dialog_id: 1, order: 3, character: 1, text: 'Good, thanks!' },
  ],
};

describe('editDialog', () => {
  it('sends dialog messages to LLM and updates changed messages', async () => {
    const editedMessages = [
      { order: 1, character: 1, text: 'Hello there' },
      { order: 2, character: 2, text: 'Greetings, how do you do?' },
      { order: 3, character: 1, text: 'Good, thanks!' },
    ];
    const llm = createMockLLM({ messages: editedMessages });

    const updatedDialog: DialogWithMessages = {
      ...SAMPLE_DIALOG,
      messages: [
        { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hello there' },
        { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Greetings, how do you do?' },
        { id: 12, dialog_id: 1, order: 3, character: 1, text: 'Good, thanks!' },
      ],
    };
    const db = createMockDb(SAMPLE_DIALOG);
    // After updates, the second getWithMessages call returns the updated dialog
    (db.dialogs.getWithMessages as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(SAMPLE_DIALOG)
      .mockResolvedValueOnce(updatedDialog);

    const result = await editDialog({
      dialogId: 1,
      llmProvider: llm,
      instructions: 'Make character 2 more formal',
      model: 'gpt-4o',
      db,
    });

    // LLM was called with system prompt + user message
    expect(llm.complete).toHaveBeenCalledOnce();
    const callArgs = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages: ILLMMessage[] = callArgs[0];
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('Hello there');
    expect(callArgs[1]).toBe('gpt-4o');

    // Only the changed message (id=11) was updated
    expect(db.dialogs.updateMessage).toHaveBeenCalledOnce();
    expect(db.dialogs.updateMessage).toHaveBeenCalledWith(11, {
      text: 'Greetings, how do you do?',
    });

    // Returns the re-fetched dialog
    expect(result).toEqual(updatedDialog);
  });

  it('throws when dialog is not found', async () => {
    const db = createMockDb(null);
    const llm = createMockLLM({ messages: [] });

    await expect(
      editDialog({
        dialogId: 999,
        llmProvider: llm,
        instructions: 'anything',
        model: 'gpt-4o',
        db,
      }),
    ).rejects.toThrow('Dialog 999 not found');

    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('throws when LLM returns wrong message count', async () => {
    const editedMessages = [
      { order: 1, character: 1, text: 'Hello there' },
      // Missing 2 messages -- should be 3
    ];
    const db = createMockDb(SAMPLE_DIALOG);
    const llm = createMockLLM({ messages: editedMessages });

    await expect(
      editDialog({
        dialogId: 1,
        llmProvider: llm,
        instructions: 'shorten it',
        model: 'gpt-4o',
        db,
      }),
    ).rejects.toThrow('message count');
  });

  it('throws when LLM returns mismatched character values', async () => {
    const editedMessages = [
      { order: 1, character: 2, text: 'Hello there' },   // was character 1
      { order: 2, character: 2, text: 'Hi' },
      { order: 3, character: 1, text: 'Good' },
    ];
    const db = createMockDb(SAMPLE_DIALOG);
    const llm = createMockLLM({ messages: editedMessages });

    await expect(
      editDialog({
        dialogId: 1,
        llmProvider: llm,
        instructions: 'swap roles',
        model: 'gpt-4o',
        db,
      }),
    ).rejects.toThrow('character');
  });

  it('throws when LLM returns invalid JSON', async () => {
    const db = createMockDb(SAMPLE_DIALOG);
    const llm: ILLMProvider = {
      id: 'openai',
      name: 'OpenAI',
      getModels: vi.fn(),
      complete: vi.fn().mockResolvedValue('This is not JSON at all'),
      validateCredentials: vi.fn(),
    };

    await expect(
      editDialog({
        dialogId: 1,
        llmProvider: llm,
        instructions: 'anything',
        model: 'gpt-4o',
        db,
      }),
    ).rejects.toThrow('parse');
  });

  it('skips update when no messages changed', async () => {
    const editedMessages = [
      { order: 1, character: 1, text: 'Hello there' },
      { order: 2, character: 2, text: 'Hi, how are you?' },
      { order: 3, character: 1, text: 'Good, thanks!' },
    ];
    const db = createMockDb(SAMPLE_DIALOG);
    const llm = createMockLLM({ messages: editedMessages });

    await editDialog({
      dialogId: 1,
      llmProvider: llm,
      instructions: 'keep it the same',
      model: 'gpt-4o',
      db,
    });

    expect(db.dialogs.updateMessage).not.toHaveBeenCalled();
  });

  it('handles LLM response wrapped in markdown code fence', async () => {
    const editedMessages = [
      { order: 1, character: 1, text: 'Hey!' },
      { order: 2, character: 2, text: 'Hello!' },
      { order: 3, character: 1, text: 'Good, thanks!' },
    ];
    const db = createMockDb(SAMPLE_DIALOG);

    const updatedDialog: DialogWithMessages = {
      ...SAMPLE_DIALOG,
      messages: [
        { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hey!' },
        { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hello!' },
        { id: 12, dialog_id: 1, order: 3, character: 1, text: 'Good, thanks!' },
      ],
    };
    (db.dialogs.getWithMessages as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(SAMPLE_DIALOG)
      .mockResolvedValueOnce(updatedDialog);

    const wrappedResponse = '```json\n' + JSON.stringify({ messages: editedMessages }) + '\n```';
    const llm: ILLMProvider = {
      id: 'openai',
      name: 'OpenAI',
      getModels: vi.fn(),
      complete: vi.fn().mockResolvedValue(wrappedResponse),
      validateCredentials: vi.fn(),
    };

    const result = await editDialog({
      dialogId: 1,
      llmProvider: llm,
      instructions: 'make it casual',
      model: 'gpt-4o',
      db,
    });

    expect(result).toEqual(updatedDialog);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/services/dialog-editing.test.ts --reporter=verbose
```
Expected: FAIL -- `Cannot find module '../../src/services/dialog-editing.js'`

- [ ] **Step 3: Commit the failing tests**

```bash
git add backend/tests/services/dialog-editing.test.ts
git commit -m "test(services): add failing tests for editDialog service"
```

---

### Task 3: Service Implementation (Green Phase)

Implement the `editDialog()` service function to make all tests from Task 2 pass.

**Files:**
- Create: `backend/src/services/dialog-editing.ts`

- [ ] **Step 1: Create the service file**

```typescript
// backend/src/services/dialog-editing.ts
import type { IDatabase } from '../db/interfaces.js';
import type { DialogWithMessages } from '../db/types.js';
import type { ILLMProvider, ILLMMessage } from '../providers/llm/types.js';

export interface EditDialogParams {
  dialogId: number;
  llmProvider: ILLMProvider;
  instructions: string;
  model: string;
  db: IDatabase;
}

interface EditedMessage {
  order: number;
  character: 1 | 2;
  text: string;
}

interface LLMEditResponse {
  messages: EditedMessage[];
}

function buildPromptMessages(
  dialog: DialogWithMessages,
  instructions: string,
): ILLMMessage[] {
  const systemPrompt = `You are a dialog editor. You will receive a dialog as a JSON array of messages. Each message has "order", "character" (1 or 2), and "text" fields.

Apply the user's editing instructions to the dialog. Return the result as JSON with this exact structure:
{"messages": [{"order": 1, "character": 1, "text": "..."}, ...]}

Rules:
- Keep the same number of messages.
- Keep the same "order" and "character" values for each message.
- Only modify the "text" fields according to the instructions.
- Return ONLY valid JSON, no extra text or markdown.`;

  const userMessage = `Dialog (${dialog.language}):
${JSON.stringify(dialog.messages.map(m => ({ order: m.order, character: m.character, text: m.text })))}

Instructions: ${instructions}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
}

function extractJson(raw: string): string {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw.trim();
}

function parseAndValidate(
  raw: string,
  expectedCount: number,
  originalMessages: DialogWithMessages['messages'],
): EditedMessage[] {
  const json = extractJson(raw);

  let parsed: LLMEditResponse;
  try {
    parsed = JSON.parse(json) as LLMEditResponse;
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${json.slice(0, 200)}`);
  }

  if (!parsed.messages || !Array.isArray(parsed.messages)) {
    throw new Error('LLM response missing "messages" array');
  }

  if (parsed.messages.length !== expectedCount) {
    throw new Error(
      `LLM returned ${parsed.messages.length} messages but expected message count ${expectedCount}`,
    );
  }

  for (let i = 0; i < expectedCount; i++) {
    const edited = parsed.messages[i];
    const original = originalMessages[i];
    if (edited.character !== original.character) {
      throw new Error(
        `Message at order ${original.order}: character mismatch (expected ${original.character}, got ${edited.character})`,
      );
    }
  }

  return parsed.messages;
}

export async function editDialog(params: EditDialogParams): Promise<DialogWithMessages> {
  const { dialogId, llmProvider, instructions, model, db } = params;

  const dialog = await db.dialogs.getWithMessages(dialogId);
  if (!dialog) {
    throw new Error(`Dialog ${dialogId} not found`);
  }

  const promptMessages = buildPromptMessages(dialog, instructions);
  const llmResponse = await llmProvider.complete(promptMessages, model);
  const editedMessages = parseAndValidate(llmResponse, dialog.messages.length, dialog.messages);

  // Update only messages whose text actually changed
  for (let i = 0; i < dialog.messages.length; i++) {
    const original = dialog.messages[i];
    const edited = editedMessages[i];
    if (original.text !== edited.text) {
      await db.dialogs.updateMessage(original.id, { text: edited.text });
    }
  }

  // Re-fetch to return the up-to-date dialog
  const updated = await db.dialogs.getWithMessages(dialogId);
  return updated!;
}
```

- [ ] **Step 2: Run the service tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/services/dialog-editing.test.ts --reporter=verbose
```
Expected: All 6 tests PASS.

- [ ] **Step 3: Run all existing tests to verify no regressions**

Run from `backend/`:
```bash
npx vitest run --reporter=verbose
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/dialog-editing.ts
git commit -m "feat(services): implement editDialog service"
```

---

### Task 4: Route Schema + Route Tests (Red Phase)

Create the TypeBox schemas for the edit-dialog endpoint and write failing route integration tests.

**Files:**
- Create: `backend/src/schemas/service.ts`
- Create: `backend/tests/routes/services.test.ts`

- [ ] **Step 1: Create the TypeBox schema file**

```typescript
// backend/src/schemas/service.ts
import { Type, type Static } from '@sinclair/typebox';

export const EditDialogBody = Type.Object({
  dialogId: Type.Integer(),
  providerId: Type.String(),
  model: Type.String(),
  instructions: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type EditDialogBody = Static<typeof EditDialogBody>;
```

- [ ] **Step 2: Write the route integration test file**

```typescript
// backend/tests/routes/services.test.ts
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('POST /services/edit-dialog', () => {
  let app: FastifyInstance;
  let mockComplete: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockComplete = vi.fn();

    app = await buildTestApp();

    // Override the createLLMProvider decorator with a mock factory
    (app as Record<string, unknown>).createLLMProvider = vi.fn(() => ({
      id: 'openai',
      name: 'OpenAI',
      getModels: vi.fn(),
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

  async function seedDialog() {
    const dialog = await app.db.dialogs.create({
      title: 'Test Dialog',
      language: 'en-US',
    });
    await app.db.dialogs.createMessage({
      dialog_id: dialog.id, order: 1, character: 1, text: 'Hello',
    });
    await app.db.dialogs.createMessage({
      dialog_id: dialog.id, order: 2, character: 2, text: 'Hi there',
    });
    return dialog;
  }

  it('edits a dialog and returns the updated DialogWithMessages', async () => {
    await seedLLMProvider();
    const dialog = await seedDialog();

    mockComplete.mockResolvedValueOnce(JSON.stringify({
      messages: [
        { order: 1, character: 1, text: 'Hey!' },
        { order: 2, character: 2, text: 'Hello, nice to meet you' },
      ],
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/services/edit-dialog',
      payload: {
        dialogId: dialog.id,
        providerId: 'openai',
        model: 'gpt-4o',
        instructions: 'Make it more casual',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(dialog.id);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].text).toBe('Hey!');
    expect(body.messages[1].text).toBe('Hello, nice to meet you');
  });

  it('returns 404 when dialog does not exist', async () => {
    await seedLLMProvider();

    const res = await app.inject({
      method: 'POST',
      url: '/services/edit-dialog',
      payload: {
        dialogId: 999,
        providerId: 'openai',
        model: 'gpt-4o',
        instructions: 'anything',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when LLM provider does not exist', async () => {
    const dialog = await seedDialog();

    const res = await app.inject({
      method: 'POST',
      url: '/services/edit-dialog',
      payload: {
        dialogId: dialog.id,
        providerId: 'nonexistent',
        model: 'gpt-4o',
        instructions: 'anything',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when provider has no API key', async () => {
    await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
    // No setKey call
    const dialog = await seedDialog();

    const res = await app.inject({
      method: 'POST',
      url: '/services/edit-dialog',
      payload: {
        dialogId: dialog.id,
        providerId: 'openai',
        model: 'gpt-4o',
        instructions: 'anything',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when provider is not LLM type', async () => {
    await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
    await app.db.providers.setKey('elevenlabs', 'test-key');
    const dialog = await seedDialog();

    const res = await app.inject({
      method: 'POST',
      url: '/services/edit-dialog',
      payload: {
        dialogId: dialog.id,
        providerId: 'elevenlabs',
        model: 'gpt-4o',
        instructions: 'anything',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/services/edit-dialog',
      payload: {
        dialogId: 1,
        providerId: 'openai',
        // missing model and instructions
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for empty instructions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/services/edit-dialog',
      payload: {
        dialogId: 1,
        providerId: 'openai',
        model: 'gpt-4o',
        instructions: '',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 502 when LLM returns unparseable response', async () => {
    await seedLLMProvider();
    const dialog = await seedDialog();

    mockComplete.mockResolvedValueOnce('not valid json');

    const res = await app.inject({
      method: 'POST',
      url: '/services/edit-dialog',
      payload: {
        dialogId: dialog.id,
        providerId: 'openai',
        model: 'gpt-4o',
        instructions: 'anything',
      },
    });

    expect(res.statusCode).toBe(502);
  });
});
```

- [ ] **Step 3: Run route tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/routes/services.test.ts --reporter=verbose
```
Expected: FAIL -- route `/services/edit-dialog` does not exist (404 for all requests).

- [ ] **Step 4: Commit the failing tests and schema**

```bash
git add backend/src/schemas/service.ts backend/tests/routes/services.test.ts
git commit -m "test(routes): add failing tests for POST /services/edit-dialog"
```

---

### Task 5: Route Implementation (Green Phase)

Implement the route handler to make all route tests pass.

**Files:**
- Create: `backend/src/routes/services/index.ts`

- [ ] **Step 1: Create the route file**

```typescript
// backend/src/routes/services/index.ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply } from 'fastify';
import { EditDialogBody } from '../../schemas/service.js';
import { DialogWithMessages } from '../../schemas/dialog.js';
import { ErrorResponse } from '../../schemas/common.js';
import { editDialog } from '../../services/dialog-editing.js';
import type { ILLMProvider } from '../../providers/llm/types.js';

const serviceRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
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

  // POST /services/edit-dialog
  fastify.post('/edit-dialog', {
    schema: {
      body: EditDialogBody,
      response: {
        200: DialogWithMessages,
        400: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { dialogId, providerId, model, instructions } = request.body;

    const llmProvider = await resolveLLMProvider(providerId, reply);
    if (!llmProvider) return;

    try {
      const result = await editDialog({
        dialogId,
        llmProvider,
        instructions,
        model,
        db: fastify.db,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('not found')) {
        throw fastify.httpErrors.notFound(message);
      }

      // LLM parse/validation errors -> 502 Bad Gateway
      throw fastify.httpErrors.badGateway(message);
    }
  });
};

export default serviceRoutes;
```

- [ ] **Step 2: Run route tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/routes/services.test.ts --reporter=verbose
```
Expected: All 8 tests PASS.

- [ ] **Step 3: Run ALL tests to verify no regressions**

Run from `backend/`:
```bash
npx vitest run --reporter=verbose
```
Expected: All tests pass (existing + new service tests + new route tests).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/services/index.ts
git commit -m "feat(routes): implement POST /services/edit-dialog"
```

---

### Task 6: Final Verification

Verify everything works together: build, lint, full test suite.

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run from `backend/`:
```bash
npx vitest run --reporter=verbose
```
Expected: All tests pass.

- [ ] **Step 2: Verify TypeScript compilation**

Run from project root:
```bash
npm run build
```
Expected: No type errors, build succeeds.

- [ ] **Step 3: Final commit with all files**

If any adjustments were needed during verification, commit them:

```bash
git add -A
git status
# Only commit if there are staged changes
git commit -m "chore: final adjustments for dialog editing service"
```
