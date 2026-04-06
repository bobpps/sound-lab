# LLM Provider Interface + Registry + OpenAI Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the LLM provider abstraction (mirroring the existing TTS provider pattern) and implement the first adapter — OpenAI — with a registry factory.

**Architecture:** Three files under `backend/src/providers/llm/`: `types.ts` (interfaces), `openai.ts` (adapter using the `openai` npm SDK), `registry.ts` (factory + listing). Tests mock the OpenAI SDK class — no real API calls. The pattern is a direct mirror of the existing `backend/src/providers/tts/` structure.

**Tech Stack:** TypeScript (ESM), `openai` npm package, Vitest for testing.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/providers/llm/types.ts` | `ILLMMessage` and `ILLMProvider` interfaces |
| Create | `backend/src/providers/llm/openai.ts` | `OpenAILLMProvider` class — wraps `openai` SDK |
| Create | `backend/src/providers/llm/registry.ts` | `createLLMProvider` factory + `getSupportedLLMProviders` |
| Create | `backend/tests/providers/openai-llm.test.ts` | Unit tests for OpenAI adapter (mocked SDK) |
| Create | `backend/tests/providers/llm-registry.test.ts` | Unit tests for LLM registry |
| Modify | `backend/package.json` | Add `openai` dependency |

### Reference files (read these for conventions)

- `backend/src/providers/tts/types.ts` — interface pattern to mirror
- `backend/src/providers/tts/elevenlabs.ts` — adapter pattern to mirror
- `backend/src/providers/tts/registry.ts` — registry pattern to mirror
- `backend/tests/providers/elevenlabs.test.ts` — test pattern to mirror
- `backend/tests/providers/registry.test.ts` — registry test pattern to mirror

---

## Task 1: Install `openai` dependency and create `types.ts`

**Files:**
- Modify: `backend/package.json` (add `openai` dependency)
- Create: `backend/src/providers/llm/types.ts`

- [ ] **Step 1: Install the `openai` npm package**

Run from the repo root:

```bash
npm install openai --workspace=backend
```

- [ ] **Step 2: Verify installation**

Run: `node -e "require.resolve('openai')"` from `backend/`

Expected: prints the resolved path without error.

Also confirm `backend/package.json` now includes `"openai"` in `dependencies`.

- [ ] **Step 3: Create the LLM types file**

Create `backend/src/providers/llm/types.ts`:

```ts
export interface ILLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ILLMProvider {
  readonly id: string;
  readonly name: string;
  getModels(): Promise<string[]>;
  complete(messages: ILLMMessage[], model: string): Promise<string>;
  validateCredentials(): Promise<boolean>;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run from `backend/`:

```bash
npx tsc --noEmit src/providers/llm/types.ts
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json package-lock.json backend/src/providers/llm/types.ts
git commit -m "feat(llm): add openai dependency and ILLMProvider/ILLMMessage interfaces"
```

---

## Task 2: Write OpenAI adapter tests (TDD red) and implement adapter (green)

**Files:**
- Create: `backend/tests/providers/openai-llm.test.ts`
- Create: `backend/src/providers/llm/openai.ts`

### Sub-task 2a: Write the failing tests

- [ ] **Step 1: Write the full test file**

Create `backend/tests/providers/openai-llm.test.ts`:

```ts
import { OpenAILLMProvider } from '../../src/providers/llm/openai.js';

// Mock the openai module — the SDK exports a default class
vi.mock('openai', () => {
  const MockOpenAI = vi.fn();
  return { default: MockOpenAI };
});

import OpenAI from 'openai';

const MockOpenAI = vi.mocked(OpenAI);

describe('OpenAILLMProvider', () => {
  let provider: OpenAILLMProvider;
  let mockModels: { list: ReturnType<typeof vi.fn> };
  let mockCompletions: { create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockModels = { list: vi.fn() };
    mockCompletions = { create: vi.fn() };

    MockOpenAI.mockImplementation(() => ({
      models: mockModels,
      chat: { completions: mockCompletions },
    }) as unknown as OpenAI);

    provider = new OpenAILLMProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "openai"', () => {
      expect(provider.id).toBe('openai');
    });

    it('has name "OpenAI"', () => {
      expect(provider.name).toBe('OpenAI');
    });
  });

  describe('constructor', () => {
    it('creates OpenAI client with provided API key', () => {
      expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });
  });

  describe('getModels', () => {
    it('returns filtered and sorted model IDs starting with "gpt-"', async () => {
      const modelsData = [
        { id: 'gpt-4o', owned_by: 'openai' },
        { id: 'dall-e-3', owned_by: 'openai' },
        { id: 'gpt-4o-mini', owned_by: 'openai' },
        { id: 'whisper-1', owned_by: 'openai' },
        { id: 'gpt-3.5-turbo', owned_by: 'openai' },
      ];

      async function* generateModels() {
        for (const model of modelsData) {
          yield model;
        }
      }

      mockModels.list.mockReturnValue(generateModels());

      const models = await provider.getModels();

      expect(models).toEqual(['gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini']);
    });

    it('returns empty array when no gpt models exist', async () => {
      async function* generateModels() {
        yield { id: 'dall-e-3', owned_by: 'openai' };
        yield { id: 'whisper-1', owned_by: 'openai' };
      }

      mockModels.list.mockReturnValue(generateModels());

      const models = await provider.getModels();

      expect(models).toEqual([]);
    });
  });

  describe('complete', () => {
    it('returns message content from chat completion', async () => {
      mockCompletions.create.mockResolvedValue({
        choices: [{ message: { content: 'Hello! How can I help you?' } }],
      });

      const result = await provider.complete(
        [{ role: 'user', content: 'Hello' }],
        'gpt-4o',
      );

      expect(result).toBe('Hello! How can I help you?');
    });

    it('sends correct parameters to chat.completions.create', async () => {
      mockCompletions.create.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
      });

      await provider.complete(
        [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
        'gpt-4o-mini',
      );

      expect(mockCompletions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
      });
    });

    it('throws when response content is null', async () => {
      mockCompletions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await expect(
        provider.complete([{ role: 'user', content: 'Hi' }], 'gpt-4o'),
      ).rejects.toThrow('OpenAI returned empty response');
    });
  });

  describe('validateCredentials', () => {
    it('returns true when models.list succeeds', async () => {
      async function* generateModels() {
        yield { id: 'gpt-4o', owned_by: 'openai' };
      }

      mockModels.list.mockReturnValue(generateModels());

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
    });

    it('returns false when models.list throws', async () => {
      mockModels.list.mockImplementation(() => {
        throw new Error('Invalid API key');
      });

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (red phase)**

Run from `backend/`:

```bash
npx vitest run tests/providers/openai-llm.test.ts
```

Expected: FAIL — `Cannot find module '../../src/providers/llm/openai.js'`

### Sub-task 2b: Implement the adapter (green phase)

- [ ] **Step 3: Create the OpenAI adapter**

Create `backend/src/providers/llm/openai.ts`:

```ts
import OpenAI from 'openai';
import type { ILLMProvider, ILLMMessage } from './types.js';

export class OpenAILLMProvider implements ILLMProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async getModels(): Promise<string[]> {
    const models: string[] = [];

    for await (const model of this.client.models.list()) {
      if (model.id.startsWith('gpt-')) {
        models.push(model.id);
      }
    }

    return models.sort();
  }

  async complete(messages: ILLMMessage[], model: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model,
      messages,
    });

    const content = response.choices[0]?.message?.content;

    if (content === null || content === undefined) {
      throw new Error('OpenAI returned empty response');
    }

    return content;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Consume at least one item from the async iterable to confirm the key works
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _model of this.client.models.list()) {
        break;
      }
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass (green phase)**

Run from `backend/`:

```bash
npx vitest run tests/providers/openai-llm.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run lint to check for issues**

Run from `backend/`:

```bash
npx eslint src/providers/llm/openai.ts
```

Expected: no errors. If the `@typescript-eslint/no-unused-vars` disable comment triggers a lint warning about unused disable directives, remove it. If the `_model` variable triggers a lint error despite the underscore prefix, adjust accordingly.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/providers/openai-llm.test.ts backend/src/providers/llm/openai.ts
git commit -m "feat(llm): add OpenAILLMProvider with tests"
```

---

## Task 3: Create LLM registry and registry tests

**Files:**
- Create: `backend/tests/providers/llm-registry.test.ts`
- Create: `backend/src/providers/llm/registry.ts`

### Sub-task 3a: Write the failing registry tests

- [ ] **Step 1: Write the full registry test file**

Create `backend/tests/providers/llm-registry.test.ts`:

```ts
import { createLLMProvider, getSupportedLLMProviders } from '../../src/providers/llm/registry.js';
import { OpenAILLMProvider } from '../../src/providers/llm/openai.js';

// Mock OpenAI SDK so the constructor doesn't need a real key
vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    models: { list: vi.fn() },
    chat: { completions: { create: vi.fn() } },
  }));
  return { default: MockOpenAI };
});

describe('LLM Provider Registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLLMProvider', () => {
    it('returns OpenAILLMProvider for "openai"', () => {
      const provider = createLLMProvider('openai', 'test-key');

      expect(provider).toBeInstanceOf(OpenAILLMProvider);
      expect(provider.id).toBe('openai');
    });

    it('throws for unsupported provider ID', () => {
      expect(() => createLLMProvider('unknown', 'key')).toThrow(
        'Unsupported LLM provider: unknown',
      );
    });
  });

  describe('getSupportedLLMProviders', () => {
    it('returns array containing all registered providers', () => {
      const providers = getSupportedLLMProviders();

      expect(providers).toContain('openai');
      expect(providers).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (red phase)**

Run from `backend/`:

```bash
npx vitest run tests/providers/llm-registry.test.ts
```

Expected: FAIL — `Cannot find module '../../src/providers/llm/registry.js'`

### Sub-task 3b: Implement the registry (green phase)

- [ ] **Step 3: Create the registry file**

Create `backend/src/providers/llm/registry.ts`:

```ts
import type { ILLMProvider } from './types.js';
import { OpenAILLMProvider } from './openai.js';

const PROVIDERS: Record<string, new (apiKey: string) => ILLMProvider> = {
  openai: OpenAILLMProvider,
};

export function createLLMProvider(providerId: string, apiKey: string): ILLMProvider {
  const Provider = PROVIDERS[providerId];

  if (!Provider) {
    throw new Error(`Unsupported LLM provider: ${providerId}`);
  }

  return new Provider(apiKey);
}

export function getSupportedLLMProviders(): string[] {
  return Object.keys(PROVIDERS);
}
```

- [ ] **Step 4: Run registry tests to verify they pass**

Run from `backend/`:

```bash
npx vitest run tests/providers/llm-registry.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run ALL tests to ensure nothing is broken**

Run from `backend/`:

```bash
npx vitest run
```

Expected: all tests PASS (existing TTS tests + new LLM tests).

- [ ] **Step 6: Run lint on all new files**

Run from `backend/`:

```bash
npx eslint src/providers/llm/types.ts src/providers/llm/openai.ts src/providers/llm/registry.ts
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/providers/llm/registry.ts backend/tests/providers/llm-registry.test.ts
git commit -m "feat(llm): add LLM provider registry with factory and listing"
```
