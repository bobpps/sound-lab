# Analysis — Issue #16: Dialog Generation Service + Route

## What the Task Requires

Create a dialog generation service that uses an LLM to generate a multi-message dialog from a user prompt. The service is exposed via a new `POST /services/generate-dialog` endpoint.

### Flow

1. **Route handler** receives request with `{ providerId, model, language, prompt, messageCount }`
2. **Route handler** resolves the LLM provider: looks up provider in DB, verifies type=`llm`, fetches decrypted API key, instantiates `ILLMProvider` via `fastify.createLLMProvider(providerId, apiKey)`
3. **Route handler** calls the service function `generateDialog(...)` passing the LLM provider instance, DB repos, and request params
4. **Service** constructs a system prompt instructing the LLM to output a JSON array of `{character, text}` objects
5. **Service** calls `llmProvider.complete(messages, model)` with `[system message, user message]`
6. **Service** parses the JSON response from the LLM
7. **Service** creates a `Dialog` via `db.dialogs.create(...)` (title derived from prompt, language from request)
8. **Service** creates `DialogMessage` records in order via `db.dialogs.createMessage(...)` for each item in the parsed array
9. **Service** returns the full `DialogWithMessages` via `db.dialogs.getWithMessages(dialogId)`
10. **Route handler** returns 201 with the `DialogWithMessages`

### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/services/dialog-generation.ts` | Pure service function — no Fastify dependency |
| `backend/tests/services/dialog-generation.test.ts` | Unit tests with mocked LLM + DB repos |
| `backend/src/routes/services/index.ts` | Route handler for `POST /services/generate-dialog` |
| `backend/tests/routes/services.test.ts` | Integration tests via `app.inject()` |

---

## Key Types and Interfaces

### LLM Provider (`backend/src/providers/llm/types.ts`)

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

### LLM Registry (`backend/src/providers/llm/registry.ts`)

```ts
function createLLMProvider(providerId: string, apiKey: string): ILLMProvider
function getSupportedLLMProviders(): string[]
```

Supported providers: `openai`, `anthropic`.

### LLM Plugin (`backend/src/plugins/llm.ts`)

Registers `fastify.createLLMProvider` as a Fastify decorator:

```ts
export type LLMProviderFactory = (providerId: string, apiKey: string) => ILLMProvider;

declare module 'fastify' {
  interface FastifyInstance {
    createLLMProvider: LLMProviderFactory;
  }
}
```

### DB Types (`backend/src/db/types.ts`)

```ts
interface Dialog {
  id: number;
  title: string;
  description: string | null;
  language: string; // BCP 47
  created_by: string | null;
  created_at: string;
}

interface DialogMessage {
  id: number;
  dialog_id: number;
  order: number;
  character: 1 | 2;
  text: string;
}

interface DialogWithMessages extends Dialog {
  messages: DialogMessage[];
}

interface CreateDialog {
  title: string;
  description?: string;
  language: string;
  created_by?: string;
}

interface CreateDialogMessage {
  dialog_id: number;
  order: number;
  character: 1 | 2;
  text: string;
}
```

### DB Interfaces (`backend/src/db/interfaces.ts`)

```ts
interface IDialogRepository {
  list(): Promise<Dialog[]>;
  getById(id: number): Promise<Dialog | null>;
  getWithMessages(id: number): Promise<DialogWithMessages | null>;
  create(data: CreateDialog): Promise<Dialog>;
  update(id: number, data: UpdateDialog): Promise<Dialog>;
  delete(id: number): Promise<void>;
  createMessage(data: CreateDialogMessage): Promise<DialogMessage>;
  updateMessage(id: number, data: UpdateDialogMessage): Promise<DialogMessage>;
  deleteMessage(id: number): Promise<void>;
}

interface IProviderRepository {
  list(type?: ProviderType): Promise<Provider[]>;
  getById(id: string): Promise<Provider | null>;
  create(data: CreateProvider): Promise<Provider>;
  update(id: string, data: UpdateProvider): Promise<Provider>;
  delete(id: string): Promise<void>;
  getDecryptedKey(id: string): Promise<string | null>;
  setKey(id: string, key: string): Promise<void>;
}

interface IDatabase {
  dialogs: IDialogRepository;
  annotations: IAnnotationRepository;
  annotationPrompts: IAnnotationPromptRepository;
  agentPrompts: IAgentPromptRepository;
  providers: IProviderRepository;
  close(): Promise<void>;
}
```

### TypeBox Schemas (`backend/src/schemas/`)

Dialog schemas live in `backend/src/schemas/dialog.ts`:
- `Dialog`, `DialogWithMessages`, `DialogMessage`, `CreateDialog`, `CreateDialogMessage`
- `DialogIdParam`, `MessageIdParam`

LLM schemas in `backend/src/schemas/llm.ts`:
- `LLMProviderIdParam`, `LLMMessage`, `CompleteBody`, `CompleteResponse`, `ModelsResponse`

Common schemas in `backend/src/schemas/common.ts`:
- `ErrorResponse`, `IdParam`, `StringIdParam`

---

## Patterns to Follow

### Route Pattern (from `routes/llm/index.ts`, `routes/dialogs/index.ts`)

1. Default export an `async` function typed as `FastifyPluginAsyncTypebox`
2. Use `fastify.get/post/put/delete` with inline `schema` object containing `params`, `body`, `response` TypeBox schemas
3. Use `{ additionalProperties: false }` on all `Type.Object()` body schemas
4. Always define response schemas for all status codes
5. Directory name becomes route prefix (autoloaded by `@fastify/autoload`)
6. Access DB via `fastify.db.dialogs`, `fastify.db.providers`, etc.
7. Access LLM factory via `fastify.createLLMProvider(providerId, apiKey)`
8. Error responses via `@fastify/sensible`: `reply.notFound()`, `reply.badRequest()`, `throw fastify.httpErrors.notFound()`

### Provider Resolution Pattern (from `routes/llm/index.ts`)

The LLM routes use a `resolveLLMProvider` helper:
1. Look up provider in DB: `fastify.db.providers.getById(providerId)`
2. Check provider exists AND `provider.type === 'llm'`; if not, reply 404
3. Get decrypted API key: `fastify.db.providers.getDecryptedKey(providerId)`; if null, reply 400
4. Create provider instance: `fastify.createLLMProvider(providerId, apiKey)`; catch errors, reply 400

**The new route should reuse this exact pattern** (or import/extract a shared helper).

### Test Pattern — Route Tests (from `tests/routes/llm.test.ts`)

1. Import `buildTestApp` from `../helpers.js` (which calls `buildApp({ testing: true })` + `app.ready()`)
2. `beforeEach`: create app, override decorator mocks
3. `afterEach`: `vi.restoreAllMocks()` + `app.close()`
4. Seed data via `app.db.providers.create(...)` + `app.db.providers.setKey(...)`
5. Override `createLLMProvider` decorator: `(app as Record<string, unknown>).createLLMProvider = vi.fn(() => ({ ... }))`
6. Test via `app.inject({ method, url, payload })`
7. Assert `res.statusCode` and `res.json()`
8. `globals: true` in vitest — `describe`, `it`, `expect`, `vi` available without import

### Test Pattern — Service Unit Tests

No existing service tests in the codebase. For `dialog-generation.test.ts`:
- Mock `ILLMProvider` (already done in route tests)
- Mock `IDialogRepository` (use `vi.fn()` for each method)
- Call the service function directly
- Verify LLM called with correct system prompt and user message
- Verify dialog created with correct title/language
- Verify messages created in correct order with correct character assignments
- Verify `getWithMessages` called and returned

### Schema Pattern

New schemas for the generate-dialog endpoint will likely need a new file or can be added to existing schemas. Based on the pattern, create a schema for the request body:

```ts
const GenerateDialogBody = Type.Object({
  providerId: Type.String(),
  model: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
  messageCount: Type.Integer({ minimum: 2 }),
}, { additionalProperties: false });
```

---

## Constraints from Project Guidance

1. **TDD by default** — write tests first, then implement (Red -> Green -> Refactor)
2. **ESM everywhere** — `.js` extensions in imports
3. **`additionalProperties: false`** on all body schemas
4. **Always define response schemas** — for serialization performance and security
5. **TypeBox as single source of truth** — use `Type.*` for request/response schemas
6. **`@fastify/sensible`** for error responses (`reply.notFound()`, `reply.badRequest()`)
7. **`fastify-plugin` (fp) only for global infrastructure** — routes are encapsulated by default
8. **Autoload** — directory name = route prefix, so `routes/services/index.ts` will mount at `/services`
9. **Service layer should be pure** — accept dependencies (LLM provider, dialog repo) as parameters, not access Fastify directly
10. **`character` field is `1 | 2`** — only two characters supported per dialog

---

## Key Files/Systems Involved

### Existing files to read/import from:
- `backend/src/providers/llm/types.ts` — `ILLMProvider`, `ILLMMessage`
- `backend/src/db/types.ts` — `Dialog`, `DialogMessage`, `DialogWithMessages`, `CreateDialog`, `CreateDialogMessage`
- `backend/src/db/interfaces.ts` — `IDialogRepository`, `IDatabase`
- `backend/src/schemas/dialog.ts` — `DialogWithMessages` TypeBox schema (for response)
- `backend/src/schemas/common.ts` — `ErrorResponse`
- `backend/src/plugins/llm.ts` — `LLMProviderFactory` type, `createLLMProvider` decorator

### New files to create:
- `backend/src/services/dialog-generation.ts` — service function
- `backend/tests/services/dialog-generation.test.ts` — service unit tests
- `backend/src/routes/services/index.ts` — route handler
- `backend/tests/routes/services.test.ts` — route integration tests

### Files that do NOT need modification:
- `backend/src/app.ts` — autoload will pick up the new `routes/services/` dir automatically
- `backend/src/plugins/llm.ts` — already provides `createLLMProvider`
- `backend/src/db/*` — no schema/repo changes needed

---

## Risks and Assumptions

### Risks

1. **LLM JSON parsing** — The LLM may not always return valid JSON. The service must handle:
   - JSON wrapped in markdown code fences (` ```json ... ``` `)
   - Extra text before/after the JSON array
   - Malformed JSON (should throw a clear error)
2. **Character assignment** — The LLM needs to output `character: 1` or `character: 2`. The system prompt must be very explicit about the output format. Alternatively, the service could auto-assign alternating characters.
3. **Message count** — The LLM may return more or fewer messages than `messageCount`. Service should validate or truncate.
4. **Transaction safety** — If message creation fails mid-way, the dialog is left in an inconsistent state. SQLite has no multi-statement transactions exposed via the repo interface. This is acceptable for now since it's an internal tool.
5. **Route prefix** — `routes/services/index.ts` will autoload at `/services`. The endpoint `POST /services/generate-dialog` requires registering as `fastify.post('/generate-dialog', ...)`.

### Assumptions

1. The service function signature will be something like:
   ```ts
   async function generateDialog(params: {
     llmProvider: ILLMProvider;
     dialogRepo: IDialogRepository;
     model: string;
     language: string;
     prompt: string;
     messageCount: number;
   }): Promise<DialogWithMessages>
   ```
2. The system prompt will instruct the LLM to return a JSON array like:
   ```json
   [
     { "character": 1, "text": "Hello, tech support?" },
     { "character": 2, "text": "Yes, how can I help?" }
   ]
   ```
3. Dialog title will be derived from the user's prompt (possibly truncated or cleaned).
4. The `created_by` field on the dialog will be `null` for now (no auth system).
5. No existing `services/` directory exists — this is a new pattern being introduced.

---

## Unknowns Resolved During Research

1. **LLM layer location:** Not at `backend/src/llm/` as the task context suggested, but at `backend/src/providers/llm/`. Types are in `providers/llm/types.ts`, registry in `providers/llm/registry.ts`.

2. **No existing services directory:** `backend/src/services/` does not exist. This is a new pattern. The service file introduces a "service layer" separate from routes, which is a good architectural decision for testability.

3. **Provider resolution pattern:** Already implemented as a local helper `resolveLLMProvider()` in `routes/llm/index.ts`. The new route will need its own copy or the logic could be extracted, but following existing patterns, a local copy is simplest.

4. **`complete()` returns `string`:** The LLM provider's `complete()` method returns a raw string, not parsed JSON. The service must parse the JSON from this string.

5. **`character` is `1 | 2`:** Only two characters per dialog. The system prompt must constrain the LLM to use only characters 1 and 2.

6. **Autoload confirms `/services` prefix:** Since `@fastify/autoload` uses `dirNameRoutePrefix: true` and scans `routes/`, placing the file at `routes/services/index.ts` will automatically mount it at `/services`.

7. **Test app setup:** `buildTestApp()` in `tests/helpers.ts` calls `buildApp({ testing: true })` then `app.ready()`. Testing mode uses in-memory SQLite with a hardcoded encryption key `'test-encryption-key'`. No additional setup needed.

8. **Mock pattern for LLM in route tests:** Override the decorator directly: `(app as Record<string, unknown>).createLLMProvider = vi.fn(() => mockProvider)`. This is the established pattern from `tests/routes/llm.test.ts`.

9. **No existing schema file for services:** Will need to either create `backend/src/schemas/service.ts` or add schemas inline in the route file. Given other routes import from dedicated schema files, a new schema file is the right approach.

10. **`max_tokens` in Anthropic provider is 4096:** This is enough for dialog generation (typically 6-10 short messages), but could be insufficient for very long dialogs. Not a concern for MVP.
