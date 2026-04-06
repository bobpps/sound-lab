# Analysis — Issue #13: LLM Provider Interface + Registry + OpenAI Adapter

## What the Task Requires

Create an LLM provider abstraction layer mirroring the existing TTS provider pattern, with an OpenAI adapter as the first implementation. Four files to create:

1. `backend/src/providers/llm/types.ts` — `ILLMMessage` and `ILLMProvider` interfaces
2. `backend/src/providers/llm/openai.ts` — `OpenAILLMProvider` class using the `openai` npm package
3. `backend/src/providers/llm/registry.ts` — `createLLMProvider` factory + `getSupportedLLMProviders`
4. `backend/tests/providers/openai-llm.test.ts` — unit tests for the adapter and registry

## Constraints from Project Guidance

- **ESM imports:** All imports must use `.js` extensions (`import { ... } from './types.js'`)
- **`"type": "module"`** in package.json — already set
- **TDD:** Write tests first, then implement (Red -> Green -> Refactor)
- **Vitest** with `globals: true` — no need to import `describe`, `it`, `expect`, `vi`
- **TypeScript strict mode** — `strict: true` in tsconfig
- **Provider IDs are natural string keys** — `"openai"`, not auto-increment
- **Provider pattern:** interface -> adapter class -> registry factory (matches TTS exactly)
- **`validateCredentials()`** should be included on the provider interface (established convention)
- **Tests use `vi.restoreAllMocks()` in `afterEach`**

## Key Files and Systems Involved

### TTS Provider Pattern (to mirror)

| File | Role | LLM Equivalent |
|------|------|----------------|
| `backend/src/providers/tts/types.ts` | Interfaces (`ITTSProvider`, `IVoice`, `ISynthesizeOptions`) | `ILLMProvider`, `ILLMMessage` |
| `backend/src/providers/tts/registry.ts` | Factory `createTTSProvider(id, apiKey)` + `getSupportedTTSProviders()` | `createLLMProvider(id, apiKey)` + `getSupportedLLMProviders()` |
| `backend/src/providers/tts/elevenlabs.ts` | Adapter class implementing `ITTSProvider` | `OpenAILLMProvider` implementing `ILLMProvider` |
| `backend/tests/providers/elevenlabs.test.ts` | Mocks `fetch` via `vi.stubGlobal` | Mock OpenAI SDK class via `vi.mock('openai')` |
| `backend/tests/providers/registry.test.ts` | Tests factory + supported list | Same pattern for LLM registry |

### Dependencies

- `openai` npm package — **NOT currently installed** (not in backend/package.json). Must `npm install openai` before implementation.

## How to Mirror the TTS Pattern for LLM

### types.ts

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

Key differences from TTS:
- `getModels()` returns `string[]` instead of `IVoice[]` — model IDs are simple strings
- `complete()` replaces `synthesize()` — returns `string` (text) instead of `Buffer` (audio)
- `ILLMMessage` is simpler than `ISynthesizeOptions` — just role + content
- `validateCredentials()` carries over from TTS pattern for consistency

### registry.ts

Mirror the TTS registry exactly:

```ts
const PROVIDERS: Record<string, new (apiKey: string) => ILLMProvider> = {
  openai: OpenAILLMProvider,
};

export function createLLMProvider(providerId: string, apiKey: string): ILLMProvider { ... }
export function getSupportedLLMProviders(): string[] { ... }
```

### openai.ts — Adapter Implementation

```ts
export class OpenAILLMProvider implements ILLMProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }
  // ...
}
```

## OpenAI SDK Usage Details

### Package

```bash
npm install openai
```

Default import: `import OpenAI from 'openai';`

### Constructor

```ts
const client = new OpenAI({ apiKey: 'sk-...' });
```

The `apiKey` parameter is the only one needed. The SDK reads `OPENAI_API_KEY` env var by default, but we always pass it explicitly (from our provider key storage).

### models.list()

```ts
const models = await client.models.list();
```

Returns a paginated list. Each item has `{ id: string, object: 'model', created: number, owned_by: string }`. The result is an async iterable (auto-paginated).

For `getModels()`, we need to:
1. Call `client.models.list()`
2. Iterate through the paginated results
3. Filter to only `gpt-*` models (as specified in the issue)
4. Return an array of model ID strings

Implementation approach for pagination:
```ts
const models: string[] = [];
for await (const model of client.models.list()) {
  if (model.id.startsWith('gpt-')) {
    models.push(model.id);
  }
}
return models;
```

### chat.completions.create()

```ts
const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello' },
  ],
});

const text = completion.choices[0].message.content; // string | null
```

For `complete()`, we need to:
1. Map `ILLMMessage[]` to the SDK's message format (identical structure)
2. Call `client.chat.completions.create({ model, messages })`
3. Extract `completion.choices[0].message.content`
4. Handle the `null` case (content can be null)

### validateCredentials()

Not a direct SDK method. Use a lightweight API call and check for errors:
```ts
async validateCredentials(): Promise<boolean> {
  try {
    await this.client.models.list();
    return true;
  } catch {
    return false;
  }
}
```

Alternatively, use `client.models.retrieve('gpt-4o')` for a single non-paginated call that's cheaper.

## Testing Approach

### Why mock the SDK class, not fetch

The TTS tests mock `fetch` directly because the TTS adapters use raw `fetch`. The OpenAI adapter uses the `openai` npm SDK which handles HTTP internally (with retries, error mapping, etc.). Mocking `fetch` would be brittle and test SDK internals. Instead, mock the `OpenAI` class itself via `vi.mock('openai')`.

### Mock strategy

```ts
vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    models: {
      list: vi.fn(),
    },
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  }));
  return { default: MockOpenAI };
});
```

Then in tests, get a reference to the mock instance and configure return values:

```ts
import OpenAI from 'openai';
import { OpenAILLMProvider } from '../../src/providers/llm/openai.js';

// After vi.mock hoisting, OpenAI is the mock constructor
const provider = new OpenAILLMProvider('test-api-key');
const mockClient = (OpenAI as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
```

### Test cases needed

**OpenAI adapter tests (`openai-llm.test.ts`):**

1. `id` and `name` — static properties
2. `getModels()`:
   - Returns filtered gpt-* model IDs
   - Filters out non-gpt models (dall-e, whisper, tts, etc.)
   - Returns empty array when no gpt models
   - Throws/propagates on API error
3. `complete()`:
   - Returns completion text for valid request
   - Sends correct model and messages to SDK
   - Handles null content in response (throws or returns empty string)
   - Throws on API error
4. `validateCredentials()`:
   - Returns true when API call succeeds
   - Returns false when API call fails (auth error)
   - Returns false on network error

**Registry tests (can be in same file or separate):**

5. `createLLMProvider('openai', key)` — returns `OpenAILLMProvider` instance
6. `createLLMProvider('unknown', key)` — throws
7. `getSupportedLLMProviders()` — returns `['openai']`

### Pagination mock for models.list()

The `models.list()` returns an async iterable. The mock needs to simulate this:

```ts
// Helper to create an async iterable from an array
async function* asyncIterableFrom<T>(items: T[]): AsyncIterableIterator<T> {
  for (const item of items) yield item;
}

mockClient.models.list.mockReturnValue(asyncIterableFrom([
  { id: 'gpt-4o', object: 'model', created: 1234, owned_by: 'openai' },
  { id: 'dall-e-3', object: 'model', created: 1234, owned_by: 'openai' },
  { id: 'gpt-3.5-turbo', object: 'model', created: 1234, owned_by: 'openai' },
]));
```

## Risks and Assumptions

### Risks

1. **OpenAI SDK pagination interface** — The `models.list()` return type is `PagePromise` which implements both async iteration and `.data` array access. Need to verify which approach works cleanly with mocks. Using `for await...of` is the documented approach.

2. **`openai` package version** — Installing latest will get v5.x+ which has had some breaking changes from v4.x. The default import `import OpenAI from 'openai'` is stable across both. Need to verify the exact installed version after `npm install`.

3. **ESM compatibility** — The `openai` package supports ESM. No issues expected, but worth verifying the import works with the project's `moduleResolution: "bundler"` setting.

4. **Null content** — `completion.choices[0].message.content` can be `null` (e.g., when the model returns a tool call instead of text). Our `complete()` returns `Promise<string>`, so we need to handle this. Options:
   - Throw an error if content is null
   - Return empty string
   - **Recommendation:** Throw — null content means the API didn't return text, which is unexpected for a simple completion call.

5. **Empty choices array** — Edge case where `choices` is empty. Should throw.

### Assumptions

1. Only `openai` provider for now (issue says "OpenAI adapter"). Other LLM providers (Anthropic, etc.) will be added later.
2. The `ILLMMessage` role union includes only `'system' | 'user' | 'assistant'`. The OpenAI API also supports `'developer'` and `'tool'` roles, but those are out of scope for the basic interface.
3. `getModels()` filters to `gpt-*` prefix as stated in the issue. This is a reasonable heuristic to exclude non-chat models (dall-e, whisper, tts, embeddings).
4. `complete()` is non-streaming only. Streaming can be added later.
5. Constructor takes a single `apiKey: string` parameter, matching the TTS pattern's `new (apiKey: string) => ILLMProvider` registry signature.
