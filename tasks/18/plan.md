# Auto-Annotation Service + Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `POST /services/annotate` endpoint that auto-annotates a dialog's messages using an LLM provider, producing SSML-annotated versions stored as `AnnotatedDialog` + `AnnotatedMessage` entries.

**Architecture:** Pure service function `autoAnnotate(params, deps)` with dependency injection for testability. The service fetches the dialog and annotation prompt from DB, iterates over each message building a growing conversation history (system prompt + prior user/assistant pairs + current user message), calls the LLM for each, then writes all results to the DB in a collect-then-write pattern. A thin Fastify route handler resolves dependencies from decorators and delegates to the service.

**Tech Stack:** Fastify 5, TypeBox schemas, Vitest, better-sqlite3 (in-memory for tests), ESM imports with `.js` extensions.

---

## File Map

| File | Responsibility |
|---|---|
| `backend/src/schemas/service.ts` | TypeBox schema for `POST /services/annotate` request body |
| `backend/src/services/auto-annotation.ts` | Pure `autoAnnotate()` function — no Fastify dependency |
| `backend/tests/services/auto-annotation.test.ts` | Unit tests for service with mocked deps |
| `backend/src/routes/services/index.ts` | Fastify route handler, resolves deps, calls service |
| `backend/tests/routes/services.test.ts` | Integration tests via `app.inject()` |

---

### Task 1: Request Body Schema

**Files:**
- Create: `backend/src/schemas/service.ts`

- [ ] **Step 1: Create the TypeBox schema file**

```typescript
// backend/src/schemas/service.ts
import { Type, type Static } from '@sinclair/typebox';

export const AutoAnnotateBody = Type.Object({
  dialogId: Type.Integer(),
  providerId: Type.String(),
  model: Type.String(),
  annotationPromptId: Type.Integer(),
  ttsProviderId: Type.String(),
  title: Type.String(),
}, { additionalProperties: false });
export type AutoAnnotateBody = Static<typeof AutoAnnotateBody>;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit src/schemas/service.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/service.ts
git commit -m "feat(services): add TypeBox schema for auto-annotate request body"
```

---

### Task 2: Auto-Annotation Service — Unit Tests

**Files:**
- Create: `backend/tests/services/auto-annotation.test.ts`

This task writes ALL the failing tests for the service function. The tests mock `IDatabase` and `ILLMProvider` with `vi.fn()`.

- [ ] **Step 1: Write the test file with all service tests**

```typescript
// backend/tests/services/auto-annotation.test.ts
import { autoAnnotate } from '../../src/services/auto-annotation.js';
import type { IDatabase } from '../../src/db/interfaces.js';
import type { ILLMProvider } from '../../src/providers/llm/types.js';
import type {
  DialogWithMessages,
  AnnotationPrompt,
  AnnotatedDialog,
  AnnotatedMessage,
  AnnotatedDialogWithMessages,
} from '../../src/db/types.js';

function createMockDb(overrides: Partial<IDatabase> = {}): IDatabase {
  return {
    dialogs: {
      list: vi.fn(),
      getById: vi.fn(),
      getWithMessages: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMessage: vi.fn(),
      updateMessage: vi.fn(),
      deleteMessage: vi.fn(),
    },
    annotations: {
      listByDialog: vi.fn(),
      getWithMessages: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      createMessage: vi.fn(),
      updateMessage: vi.fn(),
      deleteMessage: vi.fn(),
    },
    annotationPrompts: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    agentPrompts: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    providers: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getDecryptedKey: vi.fn(),
      setKey: vi.fn(),
    },
    close: vi.fn(),
    ...overrides,
  };
}

function createMockLLMProvider(): ILLMProvider {
  return {
    id: 'openai',
    name: 'OpenAI',
    getModels: vi.fn(),
    complete: vi.fn(),
    validateCredentials: vi.fn(),
  };
}

// --- Fixtures ---

const dialog: DialogWithMessages = {
  id: 1,
  title: 'Test Dialog',
  description: null,
  language: 'en-US',
  created_by: null,
  created_at: '2026-01-01T00:00:00.000Z',
  messages: [
    { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hello there' },
    { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?' },
    { id: 12, dialog_id: 1, order: 3, character: 1, text: 'I am fine, thanks' },
  ],
};

const annotationPrompt: AnnotationPrompt = {
  id: 5,
  title: 'SSML ElevenLabs',
  provider_id: 'elevenlabs',
  language: 'en-US',
  prompt: 'Convert the following text to SSML for ElevenLabs TTS.',
  created_by: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

const createdAnnotation: AnnotatedDialog = {
  id: 100,
  dialog_id: 1,
  provider_id: 'elevenlabs',
  title: 'SSML v1 auto',
  created_by: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('autoAnnotate', () => {
  let db: IDatabase;
  let llm: ILLMProvider;

  beforeEach(() => {
    db = createMockDb();
    llm = createMockLLMProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls LLM once per message with growing conversation history', async () => {
    vi.mocked(db.dialogs.getWithMessages).mockResolvedValue(dialog);
    vi.mocked(db.annotationPrompts.getById).mockResolvedValue(annotationPrompt);
    vi.mocked(db.annotations.create).mockResolvedValue(createdAnnotation);
    vi.mocked(llm.complete)
      .mockResolvedValueOnce('<speak>Hello there</speak>')
      .mockResolvedValueOnce('<speak>Hi, how are you?</speak>')
      .mockResolvedValueOnce('<speak>I am fine, thanks</speak>');

    let messageIdCounter = 200;
    vi.mocked(db.annotations.createMessage).mockImplementation(async (data) => ({
      id: messageIdCounter++,
      annotated_dialog_id: data.annotated_dialog_id,
      dialog_message_id: data.dialog_message_id,
      text: data.text,
    }));

    vi.mocked(db.annotations.getWithMessages).mockResolvedValue({
      ...createdAnnotation,
      messages: [
        { id: 200, annotated_dialog_id: 100, dialog_message_id: 10, text: '<speak>Hello there</speak>' },
        { id: 201, annotated_dialog_id: 100, dialog_message_id: 11, text: '<speak>Hi, how are you?</speak>' },
        { id: 202, annotated_dialog_id: 100, dialog_message_id: 12, text: '<speak>I am fine, thanks</speak>' },
      ],
    });

    await autoAnnotate({
      dialogId: 1,
      providerId: 'openai',
      model: 'gpt-4o',
      annotationPromptId: 5,
      ttsProviderId: 'elevenlabs',
      title: 'SSML v1 auto',
    }, { db, llmProvider: llm });

    expect(llm.complete).toHaveBeenCalledTimes(3);

    // First call: system prompt + first user message
    const call1 = vi.mocked(llm.complete).mock.calls[0];
    expect(call1[0]).toHaveLength(2); // system + user
    expect(call1[0][0]).toEqual({ role: 'system', content: annotationPrompt.prompt });
    expect(call1[0][1]).toEqual({ role: 'user', content: 'Hello there' });
    expect(call1[1]).toBe('gpt-4o');

    // Second call: system + msg1 user + msg1 assistant + msg2 user
    const call2 = vi.mocked(llm.complete).mock.calls[1];
    expect(call2[0]).toHaveLength(4); // system + user + assistant + user
    expect(call2[0][0]).toEqual({ role: 'system', content: annotationPrompt.prompt });
    expect(call2[0][1]).toEqual({ role: 'user', content: 'Hello there' });
    expect(call2[0][2]).toEqual({ role: 'assistant', content: '<speak>Hello there</speak>' });
    expect(call2[0][3]).toEqual({ role: 'user', content: 'Hi, how are you?' });

    // Third call: system + msg1 user + msg1 assistant + msg2 user + msg2 assistant + msg3 user
    const call3 = vi.mocked(llm.complete).mock.calls[2];
    expect(call3[0]).toHaveLength(6);
    expect(call3[0][4]).toEqual({ role: 'assistant', content: '<speak>Hi, how are you?</speak>' });
    expect(call3[0][5]).toEqual({ role: 'user', content: 'I am fine, thanks' });
  });

  it('creates AnnotatedDialog with correct fields', async () => {
    vi.mocked(db.dialogs.getWithMessages).mockResolvedValue(dialog);
    vi.mocked(db.annotationPrompts.getById).mockResolvedValue(annotationPrompt);
    vi.mocked(db.annotations.create).mockResolvedValue(createdAnnotation);
    vi.mocked(llm.complete).mockResolvedValue('<speak>SSML</speak>');
    vi.mocked(db.annotations.createMessage).mockImplementation(async (data) => ({
      id: 200,
      annotated_dialog_id: data.annotated_dialog_id,
      dialog_message_id: data.dialog_message_id,
      text: data.text,
    }));
    vi.mocked(db.annotations.getWithMessages).mockResolvedValue({
      ...createdAnnotation,
      messages: [],
    });

    await autoAnnotate({
      dialogId: 1,
      providerId: 'openai',
      model: 'gpt-4o',
      annotationPromptId: 5,
      ttsProviderId: 'elevenlabs',
      title: 'SSML v1 auto',
    }, { db, llmProvider: llm });

    expect(db.annotations.create).toHaveBeenCalledWith({
      dialog_id: 1,
      provider_id: 'elevenlabs',
      title: 'SSML v1 auto',
    });
  });

  it('creates AnnotatedMessage for each dialog message', async () => {
    vi.mocked(db.dialogs.getWithMessages).mockResolvedValue(dialog);
    vi.mocked(db.annotationPrompts.getById).mockResolvedValue(annotationPrompt);
    vi.mocked(db.annotations.create).mockResolvedValue(createdAnnotation);
    vi.mocked(llm.complete)
      .mockResolvedValueOnce('<speak>Hello there</speak>')
      .mockResolvedValueOnce('<speak>Hi, how are you?</speak>')
      .mockResolvedValueOnce('<speak>I am fine, thanks</speak>');
    vi.mocked(db.annotations.createMessage).mockImplementation(async (data) => ({
      id: 200,
      annotated_dialog_id: data.annotated_dialog_id,
      dialog_message_id: data.dialog_message_id,
      text: data.text,
    }));
    vi.mocked(db.annotations.getWithMessages).mockResolvedValue({
      ...createdAnnotation,
      messages: [],
    });

    await autoAnnotate({
      dialogId: 1,
      providerId: 'openai',
      model: 'gpt-4o',
      annotationPromptId: 5,
      ttsProviderId: 'elevenlabs',
      title: 'SSML v1 auto',
    }, { db, llmProvider: llm });

    expect(db.annotations.createMessage).toHaveBeenCalledTimes(3);
    expect(db.annotations.createMessage).toHaveBeenCalledWith({
      annotated_dialog_id: 100,
      dialog_message_id: 10,
      text: '<speak>Hello there</speak>',
    });
    expect(db.annotations.createMessage).toHaveBeenCalledWith({
      annotated_dialog_id: 100,
      dialog_message_id: 11,
      text: '<speak>Hi, how are you?</speak>',
    });
    expect(db.annotations.createMessage).toHaveBeenCalledWith({
      annotated_dialog_id: 100,
      dialog_message_id: 12,
      text: '<speak>I am fine, thanks</speak>',
    });
  });

  it('returns AnnotatedDialogWithMessages', async () => {
    vi.mocked(db.dialogs.getWithMessages).mockResolvedValue(dialog);
    vi.mocked(db.annotationPrompts.getById).mockResolvedValue(annotationPrompt);
    vi.mocked(db.annotations.create).mockResolvedValue(createdAnnotation);
    vi.mocked(llm.complete)
      .mockResolvedValueOnce('<speak>Hello there</speak>')
      .mockResolvedValueOnce('<speak>Hi, how are you?</speak>')
      .mockResolvedValueOnce('<speak>I am fine, thanks</speak>');
    vi.mocked(db.annotations.createMessage).mockImplementation(async (data) => ({
      id: 200,
      annotated_dialog_id: data.annotated_dialog_id,
      dialog_message_id: data.dialog_message_id,
      text: data.text,
    }));

    const expectedResult: AnnotatedDialogWithMessages = {
      ...createdAnnotation,
      messages: [
        { id: 200, annotated_dialog_id: 100, dialog_message_id: 10, text: '<speak>Hello there</speak>' },
        { id: 201, annotated_dialog_id: 100, dialog_message_id: 11, text: '<speak>Hi, how are you?</speak>' },
        { id: 202, annotated_dialog_id: 100, dialog_message_id: 12, text: '<speak>I am fine, thanks</speak>' },
      ],
    };
    vi.mocked(db.annotations.getWithMessages).mockResolvedValue(expectedResult);

    const result = await autoAnnotate({
      dialogId: 1,
      providerId: 'openai',
      model: 'gpt-4o',
      annotationPromptId: 5,
      ttsProviderId: 'elevenlabs',
      title: 'SSML v1 auto',
    }, { db, llmProvider: llm });

    expect(result).toEqual(expectedResult);
  });

  it('throws when dialog not found', async () => {
    vi.mocked(db.dialogs.getWithMessages).mockResolvedValue(null);

    await expect(autoAnnotate({
      dialogId: 999,
      providerId: 'openai',
      model: 'gpt-4o',
      annotationPromptId: 5,
      ttsProviderId: 'elevenlabs',
      title: 'SSML v1 auto',
    }, { db, llmProvider: llm })).rejects.toThrow('Dialog 999 not found');
  });

  it('throws when annotation prompt not found', async () => {
    vi.mocked(db.dialogs.getWithMessages).mockResolvedValue(dialog);
    vi.mocked(db.annotationPrompts.getById).mockResolvedValue(null);

    await expect(autoAnnotate({
      dialogId: 1,
      providerId: 'openai',
      model: 'gpt-4o',
      annotationPromptId: 999,
      ttsProviderId: 'elevenlabs',
      title: 'SSML v1 auto',
    }, { db, llmProvider: llm })).rejects.toThrow('Annotation prompt 999 not found');
  });

  it('throws when dialog has no messages', async () => {
    const emptyDialog: DialogWithMessages = { ...dialog, messages: [] };
    vi.mocked(db.dialogs.getWithMessages).mockResolvedValue(emptyDialog);
    vi.mocked(db.annotationPrompts.getById).mockResolvedValue(annotationPrompt);

    await expect(autoAnnotate({
      dialogId: 1,
      providerId: 'openai',
      model: 'gpt-4o',
      annotationPromptId: 5,
      ttsProviderId: 'elevenlabs',
      title: 'SSML v1 auto',
    }, { db, llmProvider: llm })).rejects.toThrow('Dialog 1 has no messages');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/services/auto-annotation.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/auto-annotation.js'`

- [ ] **Step 3: Commit**

```bash
git add backend/tests/services/auto-annotation.test.ts
git commit -m "test(services): add failing unit tests for autoAnnotate service"
```

---

### Task 3: Auto-Annotation Service — Implementation

**Files:**
- Create: `backend/src/services/auto-annotation.ts`

- [ ] **Step 1: Create the service file**

```typescript
// backend/src/services/auto-annotation.ts
import type { IDatabase } from '../db/interfaces.js';
import type { ILLMProvider, ILLMMessage } from '../providers/llm/types.js';
import type { AnnotatedDialogWithMessages } from '../db/types.js';

export interface AutoAnnotateParams {
  dialogId: number;
  providerId: string;
  model: string;
  annotationPromptId: number;
  ttsProviderId: string;
  title: string;
}

export interface AutoAnnotateDeps {
  db: IDatabase;
  llmProvider: ILLMProvider;
}

export async function autoAnnotate(
  params: AutoAnnotateParams,
  deps: AutoAnnotateDeps,
): Promise<AnnotatedDialogWithMessages> {
  const { db, llmProvider } = deps;

  // 1. Fetch dialog with messages
  const dialog = await db.dialogs.getWithMessages(params.dialogId);
  if (!dialog) {
    throw new Error(`Dialog ${params.dialogId} not found`);
  }

  // 2. Fetch annotation prompt
  const prompt = await db.annotationPrompts.getById(params.annotationPromptId);
  if (!prompt) {
    throw new Error(`Annotation prompt ${params.annotationPromptId} not found`);
  }

  // 3. Validate dialog has messages
  if (dialog.messages.length === 0) {
    throw new Error(`Dialog ${params.dialogId} has no messages`);
  }

  // 4. Collect LLM responses — one per message with growing history
  const systemMessage: ILLMMessage = { role: 'system', content: prompt.prompt };
  const history: ILLMMessage[] = [];
  const llmResponses: string[] = [];

  for (const message of dialog.messages) {
    const userMessage: ILLMMessage = { role: 'user', content: message.text };
    const messages: ILLMMessage[] = [systemMessage, ...history, userMessage];

    const response = await llmProvider.complete(messages, params.model);
    llmResponses.push(response);

    // Add the user message and assistant response to history for next iteration
    history.push(userMessage);
    history.push({ role: 'assistant', content: response });
  }

  // 5. Write to DB: create annotated dialog
  const annotatedDialog = await db.annotations.create({
    dialog_id: params.dialogId,
    provider_id: params.ttsProviderId,
    title: params.title,
  });

  // 6. Write to DB: create annotated messages
  for (let i = 0; i < dialog.messages.length; i++) {
    await db.annotations.createMessage({
      annotated_dialog_id: annotatedDialog.id,
      dialog_message_id: dialog.messages[i].id,
      text: llmResponses[i],
    });
  }

  // 7. Return the full annotated dialog with messages
  const result = await db.annotations.getWithMessages(annotatedDialog.id);
  if (!result) {
    throw new Error('Failed to retrieve created annotation');
  }

  return result;
}
```

- [ ] **Step 2: Run the unit tests to verify they pass**

Run: `cd backend && npx vitest run tests/services/auto-annotation.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/auto-annotation.ts
git commit -m "feat(services): implement autoAnnotate service with growing conversation history"
```

---

### Task 4: Route Integration Tests

**Files:**
- Create: `backend/tests/routes/services.test.ts`

These tests use `buildTestApp()` and `app.inject()` with a mocked `createLLMProvider` decorator (same pattern as `tests/routes/llm.test.ts`). The DB is real (in-memory SQLite) so we seed actual data.

- [ ] **Step 1: Write the route integration test file**

```typescript
// backend/tests/routes/services.test.ts
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('POST /services/annotate', () => {
  let app: FastifyInstance;
  let mockComplete: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockComplete = vi.fn<() => Promise<string>>();

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

  async function seedTTSProvider(id = 'elevenlabs', name = 'ElevenLabs') {
    await app.db.providers.create({ id, name, type: 'tts' });
  }

  async function seedDialogWithMessages() {
    const dialog = await app.db.dialogs.create({ title: 'Test Dialog', language: 'en-US' });
    const msg1 = await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Hello' });
    const msg2 = await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 2, character: 2, text: 'Hi there' });
    const msg3 = await app.db.dialogs.createMessage({ dialog_id: dialog.id, order: 3, character: 1, text: 'How are you?' });
    return { dialog, messages: [msg1, msg2, msg3] };
  }

  async function seedAnnotationPrompt(providerId = 'elevenlabs') {
    return app.db.annotationPrompts.create({
      title: 'SSML Prompt',
      provider_id: providerId,
      language: 'en-US',
      prompt: 'Convert to SSML.',
    });
  }

  it('annotates a dialog and returns AnnotatedDialogWithMessages', async () => {
    await seedLLMProvider();
    await seedTTSProvider();
    const { dialog } = await seedDialogWithMessages();
    const prompt = await seedAnnotationPrompt();

    mockComplete
      .mockResolvedValueOnce('<speak>Hello</speak>')
      .mockResolvedValueOnce('<speak>Hi there</speak>')
      .mockResolvedValueOnce('<speak>How are you?</speak>');

    const res = await app.inject({
      method: 'POST',
      url: '/services/annotate',
      payload: {
        dialogId: dialog.id,
        providerId: 'openai',
        model: 'gpt-4o',
        annotationPromptId: prompt.id,
        ttsProviderId: 'elevenlabs',
        title: 'SSML v1 auto',
      },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.dialog_id).toBe(dialog.id);
    expect(body.provider_id).toBe('elevenlabs');
    expect(body.title).toBe('SSML v1 auto');
    expect(body.messages).toHaveLength(3);
    expect(body.messages[0].text).toBe('<speak>Hello</speak>');
    expect(body.messages[1].text).toBe('<speak>Hi there</speak>');
    expect(body.messages[2].text).toBe('<speak>How are you?</speak>');
  });

  it('calls createLLMProvider with correct providerId and apiKey', async () => {
    await seedLLMProvider();
    await seedTTSProvider();
    const { dialog } = await seedDialogWithMessages();
    const prompt = await seedAnnotationPrompt();

    mockComplete.mockResolvedValue('<speak>text</speak>');

    await app.inject({
      method: 'POST',
      url: '/services/annotate',
      payload: {
        dialogId: dialog.id,
        providerId: 'openai',
        model: 'gpt-4o',
        annotationPromptId: prompt.id,
        ttsProviderId: 'elevenlabs',
        title: 'Auto',
      },
    });

    expect(app.createLLMProvider).toHaveBeenCalledWith('openai', 'test-api-key');
  });

  it('returns 404 when dialog does not exist', async () => {
    await seedLLMProvider();
    await seedTTSProvider();
    const prompt = await seedAnnotationPrompt();

    const res = await app.inject({
      method: 'POST',
      url: '/services/annotate',
      payload: {
        dialogId: 999,
        providerId: 'openai',
        model: 'gpt-4o',
        annotationPromptId: prompt.id,
        ttsProviderId: 'elevenlabs',
        title: 'Ghost',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when annotation prompt does not exist', async () => {
    await seedLLMProvider();
    await seedTTSProvider();
    const { dialog } = await seedDialogWithMessages();

    const res = await app.inject({
      method: 'POST',
      url: '/services/annotate',
      payload: {
        dialogId: dialog.id,
        providerId: 'openai',
        model: 'gpt-4o',
        annotationPromptId: 999,
        ttsProviderId: 'elevenlabs',
        title: 'Ghost',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when LLM provider does not exist', async () => {
    await seedTTSProvider();
    const { dialog } = await seedDialogWithMessages();
    const prompt = await seedAnnotationPrompt();

    const res = await app.inject({
      method: 'POST',
      url: '/services/annotate',
      payload: {
        dialogId: dialog.id,
        providerId: 'nonexistent',
        model: 'gpt-4o',
        annotationPromptId: prompt.id,
        ttsProviderId: 'elevenlabs',
        title: 'Ghost',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when LLM provider has no API key', async () => {
    await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
    // No setKey call
    await seedTTSProvider();
    const { dialog } = await seedDialogWithMessages();
    const prompt = await seedAnnotationPrompt();

    const res = await app.inject({
      method: 'POST',
      url: '/services/annotate',
      payload: {
        dialogId: dialog.id,
        providerId: 'openai',
        model: 'gpt-4o',
        annotationPromptId: prompt.id,
        ttsProviderId: 'elevenlabs',
        title: 'No key',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when LLM provider is not of type llm', async () => {
    await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
    await app.db.providers.setKey('elevenlabs', 'test-key');
    const { dialog } = await seedDialogWithMessages();
    const prompt = await seedAnnotationPrompt();

    const res = await app.inject({
      method: 'POST',
      url: '/services/annotate',
      payload: {
        dialogId: dialog.id,
        providerId: 'elevenlabs',
        model: 'some-model',
        annotationPromptId: prompt.id,
        ttsProviderId: 'elevenlabs',
        title: 'Wrong type',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when required body fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/services/annotate',
      payload: {
        dialogId: 1,
        // missing other required fields
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when dialog has no messages', async () => {
    await seedLLMProvider();
    await seedTTSProvider();
    const dialog = await app.db.dialogs.create({ title: 'Empty Dialog', language: 'en-US' });
    const prompt = await seedAnnotationPrompt();

    const res = await app.inject({
      method: 'POST',
      url: '/services/annotate',
      payload: {
        dialogId: dialog.id,
        providerId: 'openai',
        model: 'gpt-4o',
        annotationPromptId: prompt.id,
        ttsProviderId: 'elevenlabs',
        title: 'Empty',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/routes/services.test.ts`
Expected: FAIL — `Cannot find module '../../src/routes/services/index.js'` (or 404 for all routes since the route file does not exist yet).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/services.test.ts
git commit -m "test(routes): add failing integration tests for POST /services/annotate"
```

---

### Task 5: Route Handler — Implementation

**Files:**
- Create: `backend/src/routes/services/index.ts`

The route handler resolves LLM provider (same pattern as `routes/llm/index.ts`), then delegates to the service. It maps service-level errors to HTTP status codes.

- [ ] **Step 1: Create the route file**

```typescript
// backend/src/routes/services/index.ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AutoAnnotateBody } from '../../schemas/service.js';
import { AnnotatedDialogWithMessages } from '../../schemas/annotation.js';
import { ErrorResponse } from '../../schemas/common.js';
import { autoAnnotate } from '../../services/auto-annotation.js';

const serviceRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // POST /services/annotate
  fastify.post('/annotate', {
    schema: {
      body: AutoAnnotateBody,
      response: {
        200: AnnotatedDialogWithMessages,
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { providerId } = request.body;

    // Resolve LLM provider (same pattern as routes/llm)
    const provider = await fastify.db.providers.getById(providerId);
    if (!provider || provider.type !== 'llm') {
      throw fastify.httpErrors.notFound(`LLM provider ${providerId} not found`);
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      throw fastify.httpErrors.badRequest(`No API key configured for provider ${providerId}`);
    }

    let llmProvider;
    try {
      llmProvider = fastify.createLLMProvider(providerId, apiKey);
    } catch {
      throw fastify.httpErrors.badRequest(`Provider ${providerId} is not supported`);
    }

    // Call service
    try {
      const result = await autoAnnotate(request.body, { db: fastify.db, llmProvider });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('not found')) {
        throw fastify.httpErrors.notFound(message);
      }
      if (message.includes('no messages')) {
        throw fastify.httpErrors.badRequest(message);
      }

      throw err;
    }
  });
};

export default serviceRoutes;
```

- [ ] **Step 2: Run route integration tests**

Run: `cd backend && npx vitest run tests/routes/services.test.ts`
Expected: All 9 tests PASS.

- [ ] **Step 3: Run service unit tests too (regression check)**

Run: `cd backend && npx vitest run tests/services/auto-annotation.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 4: Run the full test suite**

Run: `cd backend && npx vitest run`
Expected: All tests across all files PASS.

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/services/index.ts
git commit -m "feat(routes): add POST /services/annotate route handler"
```

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | TypeBox request schema | `schemas/service.ts` | compile check |
| 2 | Service unit tests (RED) | `tests/services/auto-annotation.test.ts` | 7 failing |
| 3 | Service implementation (GREEN) | `services/auto-annotation.ts` | 7 passing |
| 4 | Route integration tests (RED) | `tests/routes/services.test.ts` | 9 failing |
| 5 | Route handler (GREEN) | `routes/services/index.ts` | 9 passing + full suite |

Total: 5 files created, 16 tests, 5 commits.
