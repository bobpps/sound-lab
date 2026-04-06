# Anthropic Claude LLM Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Anthropic Claude as an LLM provider with types, registry, and adapter -- mirroring the existing TTS provider pattern.

**Architecture:** New `backend/src/providers/llm/` directory with three files: `types.ts` (interfaces), `anthropic.ts` (adapter class wrapping `@anthropic-ai/sdk`), `registry.ts` (factory + listing). The Anthropic adapter extracts system messages into the SDK's dedicated `system` parameter and returns a curated model list (no API call). Tests mock the SDK constructor, not fetch.

**Tech Stack:** TypeScript (ESM), Vitest, `@anthropic-ai/sdk`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/src/providers/llm/types.ts` | Create | `ILLMMessage` and `ILLMProvider` interfaces |
| `backend/src/providers/llm/anthropic.ts` | Create | `AnthropicLLMProvider` class implementing `ILLMProvider` |
| `backend/src/providers/llm/registry.ts` | Create | `createLLMProvider()` factory, `getSupportedLLMProviders()` |
| `backend/tests/providers/anthropic-llm.test.ts` | Create | Unit tests for the Anthropic adapter |
| `backend/tests/providers/llm-registry.test.ts` | Create | Unit tests for the LLM registry |
| `backend/package.json` | Modify | Add `@anthropic-ai/sdk` dependency |

---

### Task 1: Create LLM type interfaces

**Files:**
- Create: `backend/src/providers/llm/types.ts`

Pure type definitions -- no logic, no tests needed.

- [ ] **Step 1: Create types.ts**

```typescript
// backend/src/providers/llm/types.ts

export interface ILLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ILLMProvider {
  readonly id: string;
  readonly name: string;
  getModels(): Promise<string[]>;
  complete(messages: ILLMMessage[], model: string): Promise<string>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend/`:
```bash
npx tsc --noEmit src/providers/llm/types.ts
```
Expected: no errors, exit 0.

- [ ] **Step 3: Commit**

```bash
git add backend/src/providers/llm/types.ts
git commit -m "feat(llm): add ILLMMessage and ILLMProvider type interfaces"
```

---

### Task 2: Anthropic adapter (TDD)

**Files:**
- Create: `backend/tests/providers/anthropic-llm.test.ts`
- Modify: `backend/package.json` (add `@anthropic-ai/sdk`)
- Create: `backend/src/providers/llm/anthropic.ts`

#### RED phase

- [ ] **Step 1: Install Anthropic SDK**

Run from project root:
```bash
npm install @anthropic-ai/sdk --workspace=backend
```
Expected: `@anthropic-ai/sdk` appears in `backend/package.json` dependencies.

- [ ] **Step 2: Write all adapter tests (RED)**

Create `backend/tests/providers/anthropic-llm.test.ts`:

```typescript
import { AnthropicLLMProvider } from '../../src/providers/llm/anthropic.js';

// Mock the Anthropic SDK -- vi.mock is hoisted before imports
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

describe('AnthropicLLMProvider', () => {
  let provider: AnthropicLLMProvider;

  beforeEach(() => {
    provider = new AnthropicLLMProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "anthropic"', () => {
      expect(provider.id).toBe('anthropic');
    });

    it('has name "Anthropic"', () => {
      expect(provider.name).toBe('Anthropic');
    });
  });

  describe('getModels', () => {
    it('returns an array of model ID strings', async () => {
      const models = await provider.getModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      models.forEach((m) => expect(typeof m).toBe('string'));
    });

    it('includes claude-sonnet-4-5-20250929', async () => {
      const models = await provider.getModels();

      expect(models).toContain('claude-sonnet-4-5-20250929');
    });

    it('does not call any SDK method', async () => {
      await provider.getModels();

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('passes non-system messages to messages.create', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello back' }],
      });

      await provider.complete(
        [{ role: 'user', content: 'Hi' }],
        'claude-sonnet-4-5-20250929',
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      );
    });

    it('extracts system messages into the system parameter', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'I am helpful' }],
      });

      await provider.complete(
        [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        'claude-sonnet-4-5-20250929',
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });

    it('concatenates multiple system messages with double newline', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Sure' }],
      });

      await provider.complete(
        [
          { role: 'system', content: 'You are helpful.' },
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Hello' },
        ],
        'claude-sonnet-4-5-20250929',
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful.\n\nBe concise.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });

    it('omits system parameter when no system messages exist', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hi' }],
      });

      await provider.complete(
        [{ role: 'user', content: 'Hello' }],
        'claude-sonnet-4-5-20250929',
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('system');
    });

    it('returns text content from the response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'The answer is 42' }],
      });

      const result = await provider.complete(
        [{ role: 'user', content: 'What is the answer?' }],
        'claude-sonnet-4-5-20250929',
      );

      expect(result).toBe('The answer is 42');
    });

    it('returns empty string when response has no text blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      const result = await provider.complete(
        [{ role: 'user', content: 'Hello' }],
        'claude-sonnet-4-5-20250929',
      );

      expect(result).toBe('');
    });
  });
});
```

- [ ] **Step 3: Run tests to confirm RED**

Run from `backend/`:
```bash
npx vitest run tests/providers/anthropic-llm.test.ts
```
Expected: all tests FAIL (module `../../src/providers/llm/anthropic.js` not found or `AnthropicLLMProvider` not defined).

#### GREEN phase

- [ ] **Step 4: Implement the Anthropic adapter**

Create `backend/src/providers/llm/anthropic.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { ILLMMessage, ILLMProvider } from './types.js';

export class AnthropicLLMProvider implements ILLMProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  private readonly client: Anthropic;

  private static readonly MODELS = [
    'claude-sonnet-4-5-20250929',
    'claude-haiku-3-5-20241022',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ];

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async getModels(): Promise<string[]> {
    return AnthropicLLMProvider.MODELS;
  }

  async complete(messages: ILLMMessage[], model: string): Promise<string> {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const params: Anthropic.MessageCreateParams = {
      model,
      max_tokens: 4096,
      messages: nonSystemMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    };

    if (systemMessages.length > 0) {
      params.system = systemMessages.map((m) => m.content).join('\n\n');
    }

    const response = await this.client.messages.create(params);

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : '';
  }
}
```

- [ ] **Step 5: Run tests to confirm GREEN**

Run from `backend/`:
```bash
npx vitest run tests/providers/anthropic-llm.test.ts
```
Expected: all 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/providers/llm/anthropic.ts backend/tests/providers/anthropic-llm.test.ts
git commit -m "feat(llm): add Anthropic Claude adapter with tests"
```

---

### Task 3: LLM provider registry (TDD)

**Files:**
- Create: `backend/tests/providers/llm-registry.test.ts`
- Create: `backend/src/providers/llm/registry.ts`

#### RED phase

- [ ] **Step 1: Write all registry tests (RED)**

Create `backend/tests/providers/llm-registry.test.ts`:

```typescript
import { createLLMProvider, getSupportedLLMProviders } from '../../src/providers/llm/registry.js';
import { AnthropicLLMProvider } from '../../src/providers/llm/anthropic.js';

// Mock Anthropic SDK so the constructor doesn't need real credentials
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

describe('LLM Provider Registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLLMProvider', () => {
    it('returns AnthropicLLMProvider for "anthropic"', () => {
      const provider = createLLMProvider('anthropic', 'test-key');

      expect(provider).toBeInstanceOf(AnthropicLLMProvider);
      expect(provider.id).toBe('anthropic');
    });

    it('throws for unsupported provider ID', () => {
      expect(() => createLLMProvider('unknown', 'key')).toThrow(
        'Unsupported LLM provider: unknown',
      );
    });
  });

  describe('getSupportedLLMProviders', () => {
    it('returns array containing "anthropic"', () => {
      const providers = getSupportedLLMProviders();

      expect(providers).toContain('anthropic');
      expect(providers).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm RED**

Run from `backend/`:
```bash
npx vitest run tests/providers/llm-registry.test.ts
```
Expected: all tests FAIL (module `../../src/providers/llm/registry.js` not found or functions not defined).

#### GREEN phase

- [ ] **Step 3: Implement the registry**

Create `backend/src/providers/llm/registry.ts`:

```typescript
import type { ILLMProvider } from './types.js';
import { AnthropicLLMProvider } from './anthropic.js';

const PROVIDERS: Record<string, new (apiKey: string) => ILLMProvider> = {
  anthropic: AnthropicLLMProvider,
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

- [ ] **Step 4: Run tests to confirm GREEN**

Run from `backend/`:
```bash
npx vitest run tests/providers/llm-registry.test.ts
```
Expected: all 3 tests PASS.

- [ ] **Step 5: Run full test suite to verify no regressions**

Run from project root:
```bash
npm test
```
Expected: all existing tests PASS alongside the new LLM tests (12 new tests total: 9 adapter + 3 registry).

- [ ] **Step 6: Commit**

```bash
git add backend/src/providers/llm/registry.ts backend/tests/providers/llm-registry.test.ts
git commit -m "feat(llm): add LLM provider registry with Anthropic support"
```
