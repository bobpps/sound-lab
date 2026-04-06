# Analysis: Issue #14 — Anthropic Claude LLM Adapter

## What the Task Requires

This task implements the Anthropic Claude LLM adapter for the Sound Lab backend. Because the prerequisite LLM infrastructure (Issue #13 / originally Task 12 in the project plan) does not exist yet, this PR must also create:

1. **LLM type interfaces** (`backend/src/providers/llm/types.ts`) — `ILLMMessage` and `ILLMProvider`
2. **LLM provider registry** (`backend/src/providers/llm/registry.ts`) — `createLLMProvider(id, apiKey)` factory
3. **Anthropic adapter** (`backend/src/providers/llm/anthropic.ts`) — `AnthropicLLMProvider` class
4. **Tests** (`backend/tests/providers/anthropic-llm.test.ts`) — full coverage of the adapter
5. **Dependency** — add `@anthropic-ai/sdk` to `backend/package.json`

The OpenAI adapter from #13 is explicitly out of scope.

## Constraints from Project Guidance

From `CLAUDE.md` (root):
- TDD by default (Red -> Green -> Refactor)
- ESM everywhere, `.js` extensions in imports
- Fix causes, not symptoms

From `backend/CLAUDE.md`:
- Provider IDs are natural string keys (`"anthropic"`)
- `vi.restoreAllMocks()` in `afterEach`
- Vitest with `globals: true`

From task context:
- `getModels()` returns a curated/hardcoded list (no API call)
- `complete()` must extract system messages from the `ILLMMessage[]` array and pass them via the dedicated `system` parameter in the Anthropic API
- Mock the SDK constructor and methods, not `fetch`

## Key Files and Systems Involved

### Existing patterns to follow:
| File | Purpose |
|---|---|
| `backend/src/providers/tts/types.ts` | Interface pattern: `ITTSProvider` with `readonly id`, `readonly name`, async methods |
| `backend/src/providers/tts/registry.ts` | Registry pattern: `Record<string, Constructor>`, factory function, `getSupportedProviders()` |
| `backend/src/providers/tts/elevenlabs.ts` | Adapter pattern: class implements interface, takes `apiKey` in constructor |
| `backend/tests/providers/elevenlabs.test.ts` | Test pattern: `beforeEach`/`afterEach`, mock externals, test id/name, test each method |
| `backend/tests/providers/registry.test.ts` | Registry test pattern: test each provider ID, test unknown throws, test listing |

### Files to create:
| File | Purpose |
|---|---|
| `backend/src/providers/llm/types.ts` | `ILLMMessage`, `ILLMProvider` interfaces |
| `backend/src/providers/llm/registry.ts` | `createLLMProvider()`, `getSupportedLLMProviders()` |
| `backend/src/providers/llm/anthropic.ts` | `AnthropicLLMProvider` class |
| `backend/tests/providers/anthropic-llm.test.ts` | Adapter tests |

### Files to modify:
| File | Change |
|---|---|
| `backend/package.json` | Add `@anthropic-ai/sdk` dependency |

## LLM Types Interface Design

Following the TTS `types.ts` pattern exactly — minimal interfaces, `readonly` on identity fields:

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

**Design notes:**
- `ILLMMessage` includes `'system'` role even though the Anthropic API doesn't put it in the messages array — this is the *universal* interface. Each adapter is responsible for translating to its provider's format.
- `complete()` returns `Promise<string>` (just the text content), matching the simplicity of `synthesize()` returning `Promise<Buffer>`. Richer response types can be added later.
- No `validateCredentials()` method — not specified in the plan. Can be added per-provider later if needed.

## Registry Design

Mirrors `backend/src/providers/tts/registry.ts` exactly:

```typescript
// backend/src/providers/llm/registry.ts

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

**Design notes:**
- Only `anthropic` registered initially. OpenAI will be added by Issue #13 when implemented.
- Same constructor signature `new (apiKey: string)` as TTS registry.

## Anthropic Adapter Design

### Constructor

```typescript
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicLLMProvider implements ILLMProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }
```

### `getModels()` — Curated List

Per the task context, `getModels()` returns a hardcoded/curated list rather than calling the API. This avoids an API round-trip and ensures the list contains only models we've tested with.

Current Claude model IDs (as of April 2026, based on SDK docs):

```typescript
private static readonly MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-haiku-3-5-20241022',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
];

async getModels(): Promise<string[]> {
  return AnthropicLLMProvider.MODELS;
}
```

**Design decision:** Use a static readonly array. The method is async to satisfy the interface (other providers like OpenAI may need to fetch from API). The list should include the most commonly used production models. It can be updated easily when new models ship.

**Note:** The Anthropic SDK *does* have a `client.models.list()` API available, but the task context explicitly says to use a curated list. This is the safer approach for a testing tool — we only list models we know work.

### `complete()` — Message Mapping

The critical design challenge: `ILLMMessage` supports `role: 'system'`, but the Anthropic `messages.create` API takes system messages as a separate top-level `system` parameter, not in the messages array (which only accepts `'user'` | `'assistant'` roles).

```typescript
async complete(messages: ILLMMessage[], model: string): Promise<string> {
  // Extract system messages and join them
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

  // Only include system param if there are system messages
  if (systemMessages.length > 0) {
    params.system = systemMessages.map((m) => m.content).join('\n\n');
  }

  const response = await this.client.messages.create(params);

  // Extract text from content blocks
  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.text ?? '';
}
```

**Design decisions:**
- `max_tokens: 4096` — sensible default for a testing tool. Could be made configurable later via an options parameter.
- Multiple system messages are concatenated with `\n\n` — the Anthropic API accepts a single system string.
- Response extraction: find the first `text` block in `response.content` array. The API returns `ContentBlock[]` where each block has a `type` field. We handle the common case (text) and return empty string if somehow no text block is found.
- The `as 'user' | 'assistant'` cast is safe because we've already filtered out system messages.

## Testing Strategy

### SDK Mocking Approach

Follow the pattern from the project plan's OpenAI test — mock the entire `@anthropic-ai/sdk` module using `vi.mock()`:

```typescript
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate, // export for test access
  };
});
```

This approach:
- Mocks the SDK constructor so no real HTTP calls are made
- Exposes the inner `messages.create` mock for assertion and configuration per-test
- Uses `vi.mock()` which is hoisted by Vitest (placed before imports)

### Test Cases

**Identity tests:**
- `provider.id` equals `'anthropic'`
- `provider.name` equals `'Anthropic'`

**`getModels()` tests:**
- Returns an array of strings
- Contains expected model IDs (e.g. `claude-sonnet-4-5-20250929`)
- Does NOT call any API method (verifies it's a curated list)

**`complete()` tests:**
- Passes messages to `client.messages.create` correctly
- Extracts system messages into the `system` parameter
- Non-system messages are passed as `messages` array with correct roles
- Returns the text content from the response
- Handles response with no text blocks (returns empty string)
- Handles multiple system messages (concatenated)
- Handles messages with no system messages (no `system` param sent)

**Registry tests (in existing `registry.test.ts` or new file):**
- `createLLMProvider('anthropic', key)` returns `AnthropicLLMProvider` instance
- Unknown provider ID throws
- `getSupportedLLMProviders()` returns `['anthropic']`

**Decision:** Create a separate `backend/tests/providers/llm-registry.test.ts` for LLM registry tests, mirroring how `registry.test.ts` tests the TTS registry. This keeps TTS and LLM tests cleanly separated.

## Risks and Assumptions

### Risks
1. **SDK version compatibility** — The `@anthropic-ai/sdk` package may have breaking changes between versions. Pin to a specific major version (e.g. `^0.39.0` or whatever is current). The SDK docs show `default` export for the constructor, which we rely on.
2. **Model ID staleness** — The hardcoded model list will become outdated as Anthropic releases new models. Mitigation: easy to update, and the curated approach is explicitly chosen over dynamic listing.
3. **`max_tokens` hardcoding** — 4096 may not be appropriate for all use cases. For a testing tool this is acceptable. Future enhancement: make configurable via an optional parameter on `complete()`.

### Assumptions
1. The `@anthropic-ai/sdk` package exports `Anthropic` as the default export and the constructor accepts `{ apiKey: string }`.
2. `messages.create()` returns `{ content: Array<{ type: string, text?: string }> }` — confirmed by SDK documentation.
3. The `system` parameter in `messages.create` accepts a plain string — confirmed by the `countTokens` example in SDK docs.
4. No other LLM adapters need to be registered in this PR (only Anthropic).
5. The `ILLMProvider` interface does not need a `validateCredentials()` method (not in the spec).

## Unknowns Resolved

| Unknown | Resolution | Source |
|---|---|---|
| How does the Anthropic SDK handle system messages? | Separate `system` parameter at top level of `messages.create()`, not in the messages array | Anthropic SDK docs — `countTokens` example shows `system: 'You are a helpful assistant.'` |
| What are current Claude model IDs? | `claude-sonnet-4-5-20250929`, `claude-haiku-3-5-20241022`, `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229` | SDK docs examples and Anthropic model naming conventions |
| How to mock the Anthropic SDK in tests? | `vi.mock('@anthropic-ai/sdk')` mocking the default export constructor and `messages.create` method | Following the OpenAI test pattern from the project plan |
| Does Anthropic SDK have a `models.list()` API? | Yes, `client.models.list()` exists, but we use a curated list per task requirements | SDK docs — "List and Retrieve Available Models" snippet |
| What is the response format of `messages.create`? | `{ content: [{ type: 'text', text: '...' }], usage: {...}, stop_reason: '...' }` | SDK docs — POST /messages response example |
| Constructor signature for Anthropic client? | `new Anthropic({ apiKey })` — apiKey is optional (defaults to env var), we pass it explicitly | SDK docs — TypeScript type definitions example |
| How to extract text from response? | `response.content` is an array of content blocks; filter for `type === 'text'` and read `.text` | SDK docs — response format |
| Should the LLM registry be in the same file as TTS? | No — separate `providers/llm/` directory, mirroring the `providers/tts/` structure | Project plan Task 12 file list, TTS pattern |

## Implementation Order (TDD)

1. Create `types.ts` — pure types, no tests needed
2. Write `anthropic-llm.test.ts` — all tests, RED
3. Install `@anthropic-ai/sdk` dependency
4. Implement `anthropic.ts` — GREEN
5. Write `llm-registry.test.ts` — registry tests, RED
6. Implement `registry.ts` — GREEN
7. Run full test suite — verify no regressions
8. Commit
