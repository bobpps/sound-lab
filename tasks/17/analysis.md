# Issue #17 — Dialog Editing Service + Route: Research Analysis

## What the Task Requires

Create a dialog editing service that takes an existing dialog, sends it to an LLM with user-provided edit instructions, and updates all messages in-place with the LLM's revised text.

**Endpoint:** `POST /services/edit-dialog`

**Request body:**
```json
{
  "dialogId": 1,
  "providerId": "openai",
  "model": "gpt-4o",
  "instructions": "Make character 2 more polite and formal"
}
```

**Response:** `DialogWithMessages` (the updated dialog with modified messages)

**Deliverables:**
1. `backend/src/services/dialog-editing.ts` — service function
2. `backend/tests/services/dialog-editing.test.ts` — unit tests for the service
3. Modify `backend/src/routes/services/index.ts` — add the route handler
4. Route tests (in existing `backend/tests/routes/services.test.ts` if it exists from #16, otherwise create)

## Constraints from Project Guidance

- **ESM everywhere:** `.js` extensions in all imports, `"type": "module"`
- **Dual-DB contract:** Service must use `IDialogRepository` and `IDatabase` interfaces, never direct DB access
- **TDD by default:** Write tests first (RED), then implement (GREEN), then refactor
- **TypeBox schemas:** All request/response schemas use `@sinclair/typebox` with `additionalProperties: false` on body schemas
- **`@fastify/sensible` errors:** Use `fastify.httpErrors.notFound()`, `fastify.httpErrors.badRequest()` etc.
- **`@fastify/autoload`:** Route files in `routes/<dir>/index.ts` auto-register with directory name as prefix
- **Response schemas required:** For `fast-json-stringify` and preventing data leaks
- **URL-scoped IDs after spread:** `{ ...request.body, dialog_id: request.params.dialogId }` pattern
- **Provider IDs are natural string keys** (e.g., `"openai"`, `"anthropic"`)
- **"Not found" returns null** from repos; routes throw httpErrors

## Key Files and Systems

### Types (from `backend/src/db/types.ts`)

```typescript
interface DialogWithMessages extends Dialog {
  messages: DialogMessage[];
}

interface DialogMessage {
  id: number;
  dialog_id: number;
  order: number;
  character: 1 | 2;
  text: string;
}

interface UpdateDialogMessage {
  character?: 1 | 2;
  text?: string;
}
```

### Repository Contracts (from `backend/src/db/interfaces.ts`)

```typescript
interface IDialogRepository {
  getWithMessages(id: number): Promise<DialogWithMessages | null>;
  updateMessage(id: number, data: UpdateDialogMessage): Promise<DialogMessage>;
  // ... other methods
}

interface IDatabase {
  dialogs: IDialogRepository;
  providers: IProviderRepository;
  // ...
}
```

Key methods for this task:
- `dialogs.getWithMessages(id)` — fetch dialog + all messages ordered by `order`
- `dialogs.updateMessage(id, { text })` — update a single message's text
- `providers.getById(id)` — check provider exists and type is 'llm'
- `providers.getDecryptedKey(id)` — get API key for LLM provider

### LLM Provider (from `backend/src/providers/llm/types.ts`)

```typescript
interface ILLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ILLMProvider {
  readonly id: string;
  readonly name: string;
  complete(messages: ILLMMessage[], model: string): Promise<string>;
}
```

### LLM Registry (from `backend/src/providers/llm/registry.ts`)

```typescript
function createLLMProvider(providerId: string, apiKey: string): ILLMProvider;
```

Also available via the Fastify decorator `fastify.createLLMProvider()` (registered by `plugins/llm.ts`).

### LLM Schemas (from `backend/src/schemas/llm.ts`, on feat/16 branch)

Already defined: `LLMProviderIdParam`, `LLMMessage`, `CompleteBody`, `CompleteResponse`, `ModelsResponse`

### Existing Route Patterns

The LLM route (`routes/llm/index.ts`) has a `resolveLLMProvider()` helper that:
1. Checks provider exists in DB with type `'llm'`
2. Gets decrypted API key
3. Creates LLM provider instance via decorator
4. Returns `ILLMProvider | null` (sends error reply if null)

This exact same pattern will be needed in the services route.

### Test Patterns

Route tests use:
- `buildTestApp()` from `tests/helpers.ts` — builds app with in-memory SQLite
- Override decorators: `(app as Record<string, unknown>).createLLMProvider = vi.fn(() => (...))`
- Seed data: `app.db.providers.create(...)` + `app.db.providers.setKey(...)`
- `app.inject({ method, url, payload })` for HTTP simulation
- `vi.restoreAllMocks()` in `afterEach`

## Data Flow

1. **Request arrives** at `POST /services/edit-dialog` with `{ dialogId, providerId, model, instructions }`
2. **Validate request** via TypeBox schema
3. **Resolve LLM provider** (same pattern as `resolveLLMProvider` in LLM routes)
4. **Fetch dialog with messages** via `fastify.db.dialogs.getWithMessages(dialogId)` — 404 if null
5. **Build LLM prompt:**
   - System message: instructions on how to edit a dialog, expected JSON output format
   - User message: the current dialog (as JSON array of `{character, text}`) + the edit instructions
6. **Call LLM** via `llmProvider.complete(messages, model)` — returns a string
7. **Parse LLM response** as JSON array of `{ character: 1|2, text: string }`
8. **Validate response** — must have same number of messages as original, same order, same characters
9. **Update each message** via `fastify.db.dialogs.updateMessage(message.id, { text: newText })` for each changed message
10. **Re-fetch and return** the updated dialog via `fastify.db.dialogs.getWithMessages(dialogId)`

## Service Function Signature

```typescript
interface EditDialogParams {
  dialogId: number;
  llmProvider: ILLMProvider;
  instructions: string;
  model: string;
  db: IDatabase;
}

async function editDialog(params: EditDialogParams): Promise<DialogWithMessages>
```

The service should be a pure function that receives its dependencies, making it easy to test with mocks.

## How Messages Should Be Updated

Use `dialogs.updateMessage(id, { text })` for each message that changed. The method signature:

```typescript
updateMessage(id: number, data: UpdateDialogMessage): Promise<DialogMessage>
```

Where `UpdateDialogMessage = { character?: 1|2, text?: string }`.

Strategy: iterate over original messages and LLM output in parallel. For each message where the text changed, call `updateMessage`. Skip messages where text is identical (optimization).

## LLM Prompt Structure

### System message:
```
You are a dialog editor. You will receive a dialog between two characters and instructions for how to edit it.

Edit the dialog according to the instructions. Preserve the number of messages and the character assignments (character 1 or 2). Only modify the text content.

Return your response as a JSON array of objects, where each object has:
- "character": the character number (1 or 2) — must match the original
- "text": the edited text for that message

Return ONLY the JSON array, no additional text or markdown formatting.
```

### User message:
```
Current dialog:
[
  {"character": 1, "text": "Hello, how can I help?"},
  {"character": 2, "text": "I need help with my order"},
  ...
]

Instructions: Make character 2 more polite and formal
```

## Route File Location

The issue says to modify `backend/src/routes/services/index.ts`. Since `@fastify/autoload` uses directory names as route prefixes, this will register as `POST /services/edit-dialog`.

**Important:** Issue #16 (dialog generation) was supposed to CREATE this file. Since #16 hasn't been implemented yet, we need to CREATE `backend/src/routes/services/index.ts` ourselves. If #16 is implemented first, we would modify it. The plan should account for both scenarios.

## Risks and Assumptions

### Risks
1. **LLM response parsing** — The LLM might not return valid JSON, might include markdown code fences, or might return a different number of messages. Need robust parsing with error handling.
2. **Message count mismatch** — LLM might add/remove messages. We must validate the response has exactly the same number of messages.
3. **Character assignment changes** — LLM might swap characters. We should validate character assignments match originals.
4. **Concurrent edits** — No transaction support mentioned for SQLite message updates. If updating fails partway through, some messages will be updated and others won't. This is acceptable for now (single-user internal tool).
5. **Empty dialog** — Dialog with 0 messages is a valid edge case that should be handled (nothing to edit, return as-is).

### Assumptions
1. The service edits messages **in-place** (updates existing message rows) rather than creating new ones
2. The LLM response must preserve the exact number and order of messages
3. Character assignments should remain the same (the LLM edits text only)
4. The `model` parameter is passed directly to the LLM provider (no validation against available models)
5. The worktree branch already has the LLM plugin and `createLLMProvider` decorator available

## Unknowns Resolved

| Unknown | Resolution |
|---------|-----------|
| Does `updateMessage()` exist? | Yes — `IDialogRepository.updateMessage(id, UpdateDialogMessage)` exists in both local and Supabase implementations |
| How to get an LLM provider instance? | Via `fastify.createLLMProvider(providerId, apiKey)` decorator (from `plugins/llm.ts`) or by importing `createLLMProvider` from registry directly |
| Does the `services/` route directory exist? | No — must be created. #16 was supposed to create it but hasn't been implemented yet |
| What base does the worktree branch use? | Same as `feat/16-dialog-generation` (commit `19fab66`), which includes LLM plugin, LLM routes, and schemas |
| Is there an existing `resolveLLMProvider` pattern? | Yes — both `routes/tts/index.ts` and `routes/llm/index.ts` have identical resolver patterns. The services route should follow the same approach |
| How are provider API keys accessed? | Via `providers.getDecryptedKey(providerId)` which returns `string | null` |
| What TypeBox schemas exist for dialogs? | `Dialog`, `DialogWithMessages`, `DialogMessage`, `CreateDialog`, etc. in `schemas/dialog.ts` |
| How does autoload work for nested routes? | Directory name becomes prefix: `routes/services/index.ts` -> `/services/*` |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/services/dialog-editing.ts` | Create | Service function `editDialog()` |
| `backend/tests/services/dialog-editing.test.ts` | Create | Unit tests for service (mocked deps) |
| `backend/src/routes/services/index.ts` | Create | Route handler `POST /services/edit-dialog` |
| `backend/tests/routes/services.test.ts` | Create | Route integration tests |
| `backend/src/schemas/services.ts` | Create (optional) | TypeBox schemas for service endpoints |
