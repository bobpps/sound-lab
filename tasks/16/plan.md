# Dialog Generation Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dialog generation service that uses an LLM to generate a multi-message dialog from a user prompt and persist it to the database, exposed via `POST /services/generate-dialog`.

**Architecture:** A pure service function `generateDialog()` accepts an LLM provider instance and dialog repository as dependencies (no Fastify coupling). It constructs a system prompt instructing the LLM to return a JSON array of `{character, text}` objects, parses the response, creates a dialog + messages in the DB, and returns a `DialogWithMessages`. A route handler at `routes/services/index.ts` wires up provider resolution (same pattern as `routes/llm/index.ts`) and delegates to the service.

**Tech Stack:** Fastify 5, TypeBox (request/response schemas), Vitest (testing), ESM imports with `.js` extensions.

---

## File Map

| File | Purpose |
|------|---------|
| Create: `backend/src/schemas/service.ts` | TypeBox schemas for `GenerateDialogBody` request and re-export of `DialogWithMessages` response |
| Create: `backend/src/services/dialog-generation.ts` | Pure service function `generateDialog()` — LLM call, JSON parse, DB writes |
| Create: `backend/tests/services/dialog-generation.test.ts` | Unit tests with mocked `ILLMProvider` + `IDialogRepository` |
| Create: `backend/src/routes/services/index.ts` | Route handler for `POST /services/generate-dialog` |
| Create: `backend/tests/routes/services.test.ts` | Integration tests via `app.inject()` with mocked LLM decorator |

No existing files need modification. `@fastify/autoload` will pick up `routes/services/` automatically.

---

### Task 1: Create TypeBox Request Schema

**Files:**
- Create: `backend/src/schemas/service.ts`

- [ ] **Step 1: Create the schema file**

```ts
import { Type, type Static } from '@sinclair/typebox';

export const GenerateDialogBody = Type.Object({
  providerId: Type.String(),
  model: Type.String(),
  language: Type.String(),
  prompt: Type.String({ minLength: 1 }),
  messageCount: Type.Integer({ minimum: 2, maximum: 50 }),
}, { additionalProperties: false });
export type GenerateDialogBody = Static<typeof GenerateDialogBody>;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend/`:
```bash
npx tsc --noEmit src/schemas/service.ts
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/service.ts
git commit -m "feat(schemas): add GenerateDialogBody TypeBox schema for dialog generation"
```

---

### Task 2: Write Service Unit Tests (RED)

**Files:**
- Create: `backend/tests/services/dialog-generation.test.ts`

This task writes all the unit tests for the `generateDialog()` service function. They will all fail because the service doesn't exist yet.

- [ ] **Step 1: Create the test file with mock setup**

```ts
import type { ILLMProvider, ILLMMessage } from '../../src/providers/llm/types.js';
import type { IDialogRepository } from '../../src/db/interfaces.js';
import type { Dialog, DialogMessage, DialogWithMessages } from '../../src/db/types.js';

// Will be imported once implemented
// import { generateDialog } from '../../src/services/dialog-generation.js';

function createMockLLMProvider(overrides: Partial<ILLMProvider> = {}): ILLMProvider {
  return {
    id: 'openai',
    name: 'OpenAI',
    getModels: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
    complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>().mockResolvedValue('[]'),
    validateCredentials: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    ...overrides,
  };
}

function createMockDialogRepo(): {
  repo: IDialogRepository;
  mockCreate: ReturnType<typeof vi.fn>;
  mockCreateMessage: ReturnType<typeof vi.fn>;
  mockGetWithMessages: ReturnType<typeof vi.fn>;
} {
  const mockCreate = vi.fn<(data: { title: string; language: string }) => Promise<Dialog>>()
    .mockResolvedValue({
      id: 1,
      title: 'Test dialog',
      description: null,
      language: 'en-US',
      created_by: null,
      created_at: '2026-01-01T00:00:00.000Z',
    });

  const mockCreateMessage = vi.fn<(data: { dialog_id: number; order: number; character: 1 | 2; text: string }) => Promise<DialogMessage>>()
    .mockImplementation(async (data) => ({
      id: Math.floor(Math.random() * 1000),
      dialog_id: data.dialog_id,
      order: data.order,
      character: data.character,
      text: data.text,
    }));

  const mockGetWithMessages = vi.fn<(id: number) => Promise<DialogWithMessages | null>>();

  const repo: IDialogRepository = {
    list: vi.fn(),
    getById: vi.fn(),
    getWithMessages: mockGetWithMessages,
    create: mockCreate,
    update: vi.fn(),
    delete: vi.fn(),
    createMessage: mockCreateMessage,
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
  };

  return { repo, mockCreate, mockCreateMessage, mockGetWithMessages };
}

const VALID_LLM_RESPONSE = JSON.stringify([
  { character: 1, text: 'Hello, tech support?' },
  { character: 2, text: 'Yes, how can I help you today?' },
  { character: 1, text: 'My printer is not working.' },
  { character: 2, text: 'I see. Have you tried turning it off and on again?' },
]);

describe('generateDialog service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls LLM with system prompt and user prompt', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const mockComplete = vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
      .mockResolvedValue(VALID_LLM_RESPONSE);
    const llm = createMockLLMProvider({ complete: mockComplete });
    const { repo, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'en-US',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'A customer calling tech support about a broken printer',
      messageCount: 4,
    });

    expect(mockComplete).toHaveBeenCalledOnce();
    const [messages, model] = mockComplete.mock.calls[0];
    expect(model).toBe('gpt-4o');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('A customer calling tech support about a broken printer');
  });

  it('system prompt specifies JSON format, messageCount, and character constraint', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const mockComplete = vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
      .mockResolvedValue(VALID_LLM_RESPONSE);
    const llm = createMockLLMProvider({ complete: mockComplete });
    const { repo, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'en-US',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Two friends discussing lunch',
      messageCount: 6,
    });

    const systemPrompt = mockComplete.mock.calls[0][0][0].content;
    expect(systemPrompt).toContain('JSON');
    expect(systemPrompt).toContain('character');
    expect(systemPrompt).toContain('text');
    expect(systemPrompt).toMatch(/1|2/);
    expect(systemPrompt).toContain('6');
  });

  it('creates dialog with title derived from prompt and correct language', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(VALID_LLM_RESPONSE),
    });
    const { repo, mockCreate, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'ru-RU',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'ru-RU',
      prompt: 'A customer calling tech support about a broken printer',
      messageCount: 4,
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.language).toBe('ru-RU');
    expect(createArg.title).toBeDefined();
    expect(typeof createArg.title).toBe('string');
    expect(createArg.title.length).toBeGreaterThan(0);
  });

  it('creates messages in order with correct character and text', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const llmResponse = JSON.stringify([
      { character: 1, text: 'Hello there' },
      { character: 2, text: 'Hi, how are you?' },
      { character: 1, text: 'Fine, thanks' },
    ]);
    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(llmResponse),
    });
    const { repo, mockCreateMessage, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'en-US',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Simple greeting',
      messageCount: 3,
    });

    expect(mockCreateMessage).toHaveBeenCalledTimes(3);

    expect(mockCreateMessage).toHaveBeenNthCalledWith(1, {
      dialog_id: 1, order: 1, character: 1, text: 'Hello there',
    });
    expect(mockCreateMessage).toHaveBeenNthCalledWith(2, {
      dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?',
    });
    expect(mockCreateMessage).toHaveBeenNthCalledWith(3, {
      dialog_id: 1, order: 3, character: 1, text: 'Fine, thanks',
    });
  });

  it('returns DialogWithMessages from getWithMessages', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const expectedResult: DialogWithMessages = {
      id: 1,
      title: 'Generated dialog',
      description: null,
      language: 'en-US',
      created_by: null,
      created_at: '2026-01-01T00:00:00.000Z',
      messages: [
        { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hello' },
        { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi' },
      ],
    };
    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(JSON.stringify([
          { character: 1, text: 'Hello' },
          { character: 2, text: 'Hi' },
        ])),
    });
    const { repo, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue(expectedResult);

    const result = await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Greeting',
      messageCount: 2,
    });

    expect(mockGetWithMessages).toHaveBeenCalledWith(1);
    expect(result).toEqual(expectedResult);
  });

  it('handles LLM response wrapped in markdown code fences', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const fencedResponse = '```json\n[\n  { "character": 1, "text": "Hello" },\n  { "character": 2, "text": "Hi" }\n]\n```';
    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(fencedResponse),
    });
    const { repo, mockCreateMessage, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'en-US',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Greeting',
      messageCount: 2,
    });

    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
    expect(mockCreateMessage).toHaveBeenNthCalledWith(1, {
      dialog_id: 1, order: 1, character: 1, text: 'Hello',
    });
    expect(mockCreateMessage).toHaveBeenNthCalledWith(2, {
      dialog_id: 1, order: 2, character: 2, text: 'Hi',
    });
  });

  it('throws on invalid JSON from LLM', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue('This is not JSON at all'),
    });
    const { repo } = createMockDialogRepo();

    await expect(generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Test',
      messageCount: 4,
    })).rejects.toThrow();
  });

  it('throws when LLM returns items with invalid character values', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const badResponse = JSON.stringify([
      { character: 3, text: 'Hello' },
      { character: 1, text: 'Hi' },
    ]);
    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(badResponse),
    });
    const { repo } = createMockDialogRepo();

    await expect(generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Test',
      messageCount: 2,
    })).rejects.toThrow();
  });

  it('system prompt includes the language', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const mockComplete = vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
      .mockResolvedValue(VALID_LLM_RESPONSE);
    const llm = createMockLLMProvider({ complete: mockComplete });
    const { repo, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'ja-JP',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'ja-JP',
      prompt: 'A sushi restaurant order',
      messageCount: 4,
    });

    const systemPrompt = mockComplete.mock.calls[0][0][0].content;
    expect(systemPrompt).toContain('ja-JP');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/services/dialog-generation.test.ts
```
Expected: all tests FAIL (cannot find module `../../src/services/dialog-generation.js`).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/services/dialog-generation.test.ts
git commit -m "test(services): add failing unit tests for generateDialog service"
```

---

### Task 3: Implement the Service Function (GREEN)

**Files:**
- Create: `backend/src/services/dialog-generation.ts`

- [ ] **Step 1: Create the service file**

```ts
import type { ILLMProvider, ILLMMessage } from '../providers/llm/types.js';
import type { IDialogRepository } from '../db/interfaces.js';
import type { DialogWithMessages } from '../db/types.js';

export interface GenerateDialogParams {
  llmProvider: ILLMProvider;
  dialogRepo: IDialogRepository;
  model: string;
  language: string;
  prompt: string;
  messageCount: number;
}

interface LLMDialogMessage {
  character: number;
  text: string;
}

function buildSystemPrompt(language: string, messageCount: number): string {
  return [
    'You are a dialog script writer.',
    `Generate a dialog with exactly ${messageCount} messages between two characters (character 1 and character 2).`,
    `The dialog must be written in the language specified by BCP 47 tag: ${language}.`,
    'Respond ONLY with a JSON array. No markdown, no explanation, no extra text.',
    'Each element must be an object with exactly two fields:',
    '  - "character": either 1 or 2 (integer)',
    '  - "text": the message text (string)',
    '',
    'Example for 2 messages:',
    '[{"character":1,"text":"Hello"},{"character":2,"text":"Hi there"}]',
  ].join('\n');
}

function extractJSON(raw: string): string {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return raw.trim();
}

function parseAndValidate(raw: string): LLMDialogMessage[] {
  const jsonStr = extractJSON(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${jsonStr.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('LLM response is not a JSON array');
  }

  if (parsed.length === 0) {
    throw new Error('LLM returned an empty message array');
  }

  const messages: LLMDialogMessage[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Message at index ${i} is not an object`);
    }
    const { character, text } = item as Record<string, unknown>;
    if (character !== 1 && character !== 2) {
      throw new Error(`Message at index ${i} has invalid character: ${character} (must be 1 or 2)`);
    }
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error(`Message at index ${i} has invalid or empty text`);
    }
    messages.push({ character: character as 1 | 2, text });
  }

  return messages;
}

export async function generateDialog(params: GenerateDialogParams): Promise<DialogWithMessages> {
  const { llmProvider, dialogRepo, model, language, prompt, messageCount } = params;

  const systemPrompt = buildSystemPrompt(language, messageCount);
  const messages: ILLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  const raw = await llmProvider.complete(messages, model);
  const parsedMessages = parseAndValidate(raw);

  // Create dialog — title derived from prompt (truncate if too long)
  const title = prompt.length > 100 ? prompt.slice(0, 97) + '...' : prompt;
  const dialog = await dialogRepo.create({ title, language });

  // Create messages in order
  for (let i = 0; i < parsedMessages.length; i++) {
    await dialogRepo.createMessage({
      dialog_id: dialog.id,
      order: i + 1,
      character: parsedMessages[i].character as 1 | 2,
      text: parsedMessages[i].text,
    });
  }

  // Return full dialog with messages
  const result = await dialogRepo.getWithMessages(dialog.id);
  if (!result) {
    throw new Error('Failed to retrieve created dialog');
  }
  return result;
}
```

- [ ] **Step 2: Run service tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/services/dialog-generation.test.ts
```
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/dialog-generation.ts
git commit -m "feat(services): implement generateDialog service with LLM prompt + JSON parsing"
```

---

### Task 4: Write Route Integration Tests (RED)

**Files:**
- Create: `backend/tests/routes/services.test.ts`

- [ ] **Step 1: Create the route test file**

```ts
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('Services routes', () => {
  let app: FastifyInstance;
  let mockComplete: ReturnType<typeof vi.fn>;

  const VALID_LLM_RESPONSE = JSON.stringify([
    { character: 1, text: 'Hello, tech support?' },
    { character: 2, text: 'Yes, how can I help you today?' },
    { character: 1, text: 'My printer is not working.' },
    { character: 2, text: 'Have you tried turning it off and on again?' },
  ]);

  beforeEach(async () => {
    mockComplete = vi.fn<() => Promise<string>>().mockResolvedValue(VALID_LLM_RESPONSE);

    app = await buildTestApp();

    (app as Record<string, unknown>).createLLMProvider = vi.fn(() => ({
      id: 'openai',
      name: 'OpenAI',
      getModels: vi.fn().mockResolvedValue(['gpt-4o']),
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

  describe('POST /services/generate-dialog', () => {
    it('generates a dialog and returns DialogWithMessages', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'A customer calling tech support',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.language).toBe('en-US');
      expect(body.messages).toHaveLength(4);
      expect(body.messages[0].character).toBe(1);
      expect(body.messages[0].text).toBe('Hello, tech support?');
      expect(body.messages[0].order).toBe(1);
      expect(body.messages[1].character).toBe(2);
      expect(body.messages[1].order).toBe(2);
    });

    it('calls LLM complete with the provided model', async () => {
      await seedLLMProvider();

      await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          language: 'en-US',
          prompt: 'Two friends chatting',
          messageCount: 4,
        },
      });

      expect(mockComplete).toHaveBeenCalledOnce();
      const [, model] = mockComplete.mock.calls[0];
      expect(model).toBe('gpt-4o-mini');
    });

    it('persists the dialog in the database', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'fr-FR',
          prompt: 'A conversation at a bakery',
          messageCount: 4,
        },
      });

      const body = res.json();
      const persisted = await app.db.dialogs.getWithMessages(body.id);
      expect(persisted).not.toBeNull();
      expect(persisted!.language).toBe('fr-FR');
      expect(persisted!.messages).toHaveLength(4);
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'nonexistent',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not LLM type', async () => {
      await app.db.providers.create({ id: 'elevenlabs', name: 'ElevenLabs', type: 'tts' });
      await app.db.providers.setKey('elevenlabs', 'test-key');

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'elevenlabs',
          model: 'some-model',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      // No setKey call

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when body is missing required fields', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          // missing language, prompt, messageCount
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when messageCount is less than 2', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 1,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when prompt is empty', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: '',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('strips additional properties from body', async () => {
      await seedLLMProvider();

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test prompt',
          messageCount: 4,
          extraField: 'should-be-stripped',
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('returns 500 when LLM returns invalid JSON', async () => {
      await seedLLMProvider();
      mockComplete.mockResolvedValueOnce('This is not valid JSON');

      const res = await app.inject({
        method: 'POST',
        url: '/services/generate-dialog',
        payload: {
          providerId: 'openai',
          model: 'gpt-4o',
          language: 'en-US',
          prompt: 'Test',
          messageCount: 4,
        },
      });

      expect(res.statusCode).toBe(500);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/routes/services.test.ts
```
Expected: all tests FAIL (route `/services/generate-dialog` returns 404 because the route file doesn't exist yet).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/services.test.ts
git commit -m "test(routes): add failing integration tests for POST /services/generate-dialog"
```

---

### Task 5: Implement the Route Handler (GREEN)

**Files:**
- Create: `backend/src/routes/services/index.ts`

- [ ] **Step 1: Create the route file**

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply } from 'fastify';
import { GenerateDialogBody } from '../../schemas/service.js';
import { DialogWithMessages } from '../../schemas/dialog.js';
import { ErrorResponse } from '../../schemas/common.js';
import type { ILLMProvider } from '../../providers/llm/types.js';
import { generateDialog } from '../../services/dialog-generation.js';

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

  // POST /services/generate-dialog
  fastify.post('/generate-dialog', {
    schema: {
      body: GenerateDialogBody,
      response: {
        201: DialogWithMessages,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { providerId, model, language, prompt, messageCount } = request.body;

    const llm = await resolveLLMProvider(providerId, reply);
    if (!llm) return;

    const result = await generateDialog({
      llmProvider: llm,
      dialogRepo: fastify.db.dialogs,
      model,
      language,
      prompt,
      messageCount,
    });

    reply.status(201);
    return result;
  });
};

export default serviceRoutes;
```

- [ ] **Step 2: Run all tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/services/dialog-generation.test.ts tests/routes/services.test.ts
```
Expected: all tests PASS.

- [ ] **Step 3: Run the full test suite**

Run from `backend/`:
```bash
npx vitest run
```
Expected: all tests PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/services/index.ts
git commit -m "feat(routes): add POST /services/generate-dialog route handler"
```

---

### Task 6: Final Verification and Cleanup

**Files:**
- Review: all created files

- [ ] **Step 1: Run the full test suite one final time**

Run from `backend/`:
```bash
npx vitest run
```
Expected: all tests PASS.

- [ ] **Step 2: Verify TypeScript compilation**

Run from `backend/`:
```bash
npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 3: Verify the build succeeds**

Run from project root:
```bash
npm run build
```
Expected: build completes without errors.

- [ ] **Step 4: Final commit (if any cleanup was needed)**

Only if changes were made during cleanup:
```bash
git add -A
git commit -m "refactor: cleanup dialog generation implementation"
```
