# Analysis — Issue #18: Auto-annotation service + route

## 1. What the Task Requires

Create a `POST /services/annotate` endpoint that auto-annotates a dialog using an LLM provider. The service:

1. Receives: `dialogId`, `providerId` (LLM), `model`, `annotationPromptId`, `ttsProviderId`, and `title`
2. Fetches the dialog with messages, the annotation prompt, and resolves the LLM provider
3. For each message in the dialog (in order):
   - Builds a conversation consisting of: system prompt (from the annotation prompt), prior conversation history (previous plain messages as user + their SSML annotations as assistant), and the current plain message as user
   - Calls `llm.complete(messages, model)` to get the SSML-annotated version
   - Stores the result as an `AnnotatedMessage`
4. Creates an `AnnotatedDialog` record linked to the dialog and the TTS provider
5. Returns `AnnotatedDialogWithMessages`

**Key insight:** The `ttsProviderId` maps to `AnnotatedDialog.provider_id` (the provider the annotation is *for*, not the LLM that does the annotating). The LLM provider (`providerId`) is used to call the LLM but is not stored on the AnnotatedDialog.

## 2. Key Types and Interfaces

### DB Types (`backend/src/db/types.ts`)

```typescript
interface Dialog {
  id: number; title: string; description: string | null;
  language: string; created_by: string | null; created_at: string;
}

interface DialogMessage {
  id: number; dialog_id: number; order: number;
  character: 1 | 2; text: string;
}

interface DialogWithMessages extends Dialog {
  messages: DialogMessage[];
}

interface AnnotatedDialog {
  id: number; dialog_id: number; provider_id: string;
  title: string; created_by: string | null; created_at: string;
}

interface AnnotatedMessage {
  id: number; annotated_dialog_id: number;
  dialog_message_id: number; text: string;
}

interface AnnotatedDialogWithMessages extends AnnotatedDialog {
  messages: AnnotatedMessage[];
}

interface CreateAnnotatedDialog {
  dialog_id: number; provider_id: string; title: string; created_by?: string;
}

interface CreateAnnotatedMessage {
  annotated_dialog_id: number; dialog_message_id: number; text: string;
}

interface AnnotationPrompt {
  id: number; title: string; provider_id: string; language: string;
  prompt: string; created_by: string | null; created_at: string;
}
```

### LLM Types (`backend/src/providers/llm/types.ts`)

```typescript
interface ILLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ILLMProvider {
  readonly id: string;
  readonly name: string;
  getModels(): Promise<string[]>;
  complete(messages: ILLMMessage[], model: string): Promise<string>;
  validateCredentials(): Promise<boolean>;
}
```

### Repository Interfaces (`backend/src/db/interfaces.ts`)

```typescript
interface IDialogRepository {
  getWithMessages(id: number): Promise<DialogWithMessages | null>;
  // ...other methods
}

interface IAnnotationRepository {
  getWithMessages(id: number): Promise<AnnotatedDialogWithMessages | null>;
  create(data: CreateAnnotatedDialog): Promise<AnnotatedDialog>;
  createMessage(data: CreateAnnotatedMessage): Promise<AnnotatedMessage>;
  // ...other methods
}

interface IAnnotationPromptRepository {
  getById(id: number): Promise<AnnotationPrompt | null>;
  // ...other methods
}

interface IProviderRepository {
  getById(id: string): Promise<Provider | null>;
  getDecryptedKey(id: string): Promise<string | null>;
  // ...other methods
}
```

### Fastify Decorators Available

```typescript
// From plugins/db.ts:
fastify.db: IDatabase  // .dialogs, .annotations, .annotationPrompts, .providers

// From plugins/llm.ts:
fastify.createLLMProvider: (providerId: string, apiKey: string) => ILLMProvider
```

## 3. Existing Patterns to Follow

### Service Structure

No services exist yet. Both `backend/src/services/` and `backend/src/routes/services/` directories need to be created from scratch. The project plan shows the intended structure:

- `backend/src/services/auto-annotation.ts` — pure business logic function
- `backend/src/routes/services/index.ts` — route handler that wires dependencies
- `backend/tests/services/auto-annotation.test.ts` — unit tests with mocked dependencies

The service should be a **pure function** that receives its dependencies as parameters (repository interfaces + LLM provider), not a Fastify-aware module. The route handler resolves dependencies from Fastify decorators and calls the service.

### Route Structure Pattern (from existing routes)

All routes follow this pattern (`FastifyPluginAsyncTypebox`):

```typescript
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const serviceRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // POST /services/annotate
  fastify.post('/annotate', {
    schema: {
      body: AnnotateBody,
      response: {
        200: AnnotatedDialogWithMessages,
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    // 1. Validate inputs exist (dialog, prompt, providers)
    // 2. Resolve LLM provider (same pattern as llm/index.ts resolveLLMProvider)
    // 3. Call service function
    // 4. Return result
  });
};

export default serviceRoutes;
```

Key patterns from existing routes:
- `@fastify/autoload` auto-discovers route files — directory name = prefix (`routes/services/index.ts` -> `/services/*`)
- TypeBox schemas with `{ additionalProperties: false }` on all request bodies
- Response schemas always defined (for `fast-json-stringify`)
- `@fastify/sensible` for `fastify.httpErrors.notFound()`, `fastify.httpErrors.badRequest()`
- LLM provider resolution pattern (from `routes/llm/index.ts`): check provider exists + is right type, get API key, create provider instance

### Test Patterns

**Route tests** (e.g., `tests/routes/llm.test.ts`):
- Use `buildTestApp()` from `tests/helpers.ts` (creates in-memory SQLite)
- `app.inject()` for HTTP simulation
- Mock `createLLMProvider` by overwriting the decorator: `(app as Record<string, unknown>).createLLMProvider = vi.fn(...)`
- Seed DB data via `app.db.*` repo methods
- `vi.restoreAllMocks()` in `afterEach`

**Unit test pattern** (for the service):
- Should mock repository interfaces and LLM provider
- Verify: LLM called N times with correct messages, AnnotatedDialog created, AnnotatedMessages created with SSML text
- Use `vi.fn()` for all dependencies

## 4. How LLM Providers Work

1. **Registry** (`providers/llm/registry.ts`): `createLLMProvider(providerId, apiKey)` maps string ID to provider class
2. **Plugin** (`plugins/llm.ts`): Decorates Fastify with `createLLMProvider` factory
3. **Usage in routes**: Resolve provider from DB, get API key, instantiate via factory
4. **Calling LLM**: `provider.complete(messages: ILLMMessage[], model: string): Promise<string>`

The `complete()` method takes an array of `{role, content}` messages and returns the response text as a string.

## 5. How the Annotation Prompt Should Be Used

Based on the plan and the data model:

1. Fetch `AnnotationPrompt` by `annotationPromptId` from `annotationPrompts.getById()`
2. The `prompt` field contains the system prompt instructing the LLM how to annotate
3. For each dialog message, build the LLM message array:
   ```
   [
     { role: 'system', content: annotationPrompt.prompt },
     // Previous conversation history (growing with each message):
     { role: 'user', content: previousMessage1.text },        // plain text
     { role: 'assistant', content: previousAnnotation1.text }, // SSML from LLM
     { role: 'user', content: previousMessage2.text },
     { role: 'assistant', content: previousAnnotation2.text },
     // Current message to annotate:
     { role: 'user', content: currentMessage.text },
   ]
   ```
4. LLM responds with SSML (the annotated version)
5. Store response as `AnnotatedMessage.text`

The history grows with each iteration: message 1 has just the system prompt + message, message 2 has system + msg1 + annotation1 + msg2, etc.

## 6. Repository Methods Needed

### Reading:
- `db.dialogs.getWithMessages(dialogId)` -> `DialogWithMessages | null` (dialog + ordered messages)
- `db.annotationPrompts.getById(annotationPromptId)` -> `AnnotationPrompt | null`
- `db.providers.getById(providerId)` -> `Provider | null` (to validate LLM provider exists)
- `db.providers.getById(ttsProviderId)` -> `Provider | null` (to validate TTS provider exists)
- `db.providers.getDecryptedKey(providerId)` -> `string | null` (API key for LLM)

### Writing:
- `db.annotations.create({ dialog_id, provider_id: ttsProviderId, title })` -> `AnnotatedDialog`
- `db.annotations.createMessage({ annotated_dialog_id, dialog_message_id, text })` -> `AnnotatedMessage`
- `db.annotations.getWithMessages(annotatedDialogId)` -> `AnnotatedDialogWithMessages` (for the return value)

## 7. Service Function Signature

```typescript
interface AutoAnnotateParams {
  dialogId: number;
  providerId: string;      // LLM provider ID
  model: string;           // LLM model name
  annotationPromptId: number;
  ttsProviderId: string;   // stored as AnnotatedDialog.provider_id
  title: string;           // stored as AnnotatedDialog.title
}

interface AutoAnnotateDeps {
  db: IDatabase;
  llmProvider: ILLMProvider;
}

async function autoAnnotate(
  params: AutoAnnotateParams,
  deps: AutoAnnotateDeps,
): Promise<AnnotatedDialogWithMessages>;
```

Or alternatively, the deps could be more granular (individual repo interfaces). The route handler would resolve the LLM provider and pass it in.

## 8. Schema Needs

New TypeBox schema needed for the request body:

```typescript
const AnnotateBody = Type.Object({
  dialogId: Type.Integer(),
  providerId: Type.String(),
  model: Type.String(),
  annotationPromptId: Type.Integer(),
  ttsProviderId: Type.String(),
  title: Type.String(),
}, { additionalProperties: false });
```

Response schema: Already exists as `AnnotatedDialogWithMessages` in `schemas/annotation.ts`.

## 9. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/services/auto-annotation.ts` | CREATE | Service function (`autoAnnotate`) |
| `backend/tests/services/auto-annotation.test.ts` | CREATE | Unit tests for service |
| `backend/src/routes/services/index.ts` | CREATE | Route handler for `POST /services/annotate` |
| `backend/tests/routes/services.test.ts` | CREATE | Route integration tests |
| `backend/src/schemas/service.ts` | CREATE | TypeBox schema for `AnnotateBody` |

Note: The `routes/services/` directory is auto-discovered by `@fastify/autoload`, so no registration code needed in `app.ts`.

## 10. Risks and Assumptions

### Risks
1. **No existing service pattern** — This is the first service in the codebase. Need to establish the pattern. Issue #16 (dialog-generation) is also OPEN and would also create services, but isn't implemented yet. We're setting the precedent.
2. **LLM call failures mid-processing** — If the LLM fails on message 3 of 5, the AnnotatedDialog and messages 1-2 are already created. No transaction rollback mechanism is mentioned. Options: (a) create AnnotatedDialog first and let partial results persist, (b) collect all results first then write to DB, (c) implement cleanup on failure.
3. **Large dialogs** — Sequential LLM calls with growing history could be slow and expensive. No timeout/cancellation mentioned.
4. **Annotation prompt `provider_id`** — The AnnotationPrompt has a `provider_id` field (TTS provider it's designed for). Should we validate that `annotationPrompt.provider_id === ttsProviderId`? The issue doesn't mention this, but it seems like a logical consistency check.

### Assumptions
1. Messages are processed in `order` field sequence (DialogMessage has `order` field)
2. The system prompt is the entire `annotationPrompt.prompt` string
3. The LLM response is used as-is for `AnnotatedMessage.text` (no post-processing/validation of SSML)
4. All messages in the dialog are annotated (no filtering by character or other criteria)
5. The `ttsProviderId` is stored as `AnnotatedDialog.provider_id` (the annotation is "for" that TTS provider)
6. **Collect-then-write strategy**: Safer to collect all LLM responses first, then write to DB. If any LLM call fails, no partial DB state is created. This is the cleaner approach.

## 11. Dependencies Status

| Dependency | Issue | Status | Notes |
|-----------|-------|--------|-------|
| Annotations + Annotated Messages routes | #8 | CLOSED/MERGED (PR #41) | All CRUD routes available |
| Dialog generation service | #16 | OPEN (not implemented) | `services/` dir doesn't exist yet; we create it |
| LLM provider system | #13/#14/#15 | MERGED (PRs #48, #49, #51) | `ILLMProvider`, registry, OpenAI + Anthropic adapters, LLM routes all available |
| Annotation prompts CRUD | #6 | MERGED (PR #39) | Full CRUD available |
| Dialogs CRUD | #5 | MERGED (PR #37) | Full CRUD available |
| Providers CRUD | #4 | MERGED (PR #38) | Full CRUD + key management available |

All hard dependencies are satisfied. The only "soft" dependency is #16 (dialog-generation), which would also create `backend/src/routes/services/index.ts`. Since #16 is not implemented, we'll create this file ourselves. If #16 lands later, it will add its endpoint to the same file.

## 12. Conversation History Building Detail

For a dialog with messages [M1, M2, M3], the LLM calls would be:

**Call 1 (for M1):**
```
system: annotationPrompt.prompt
user: M1.text
```

**Call 2 (for M2):**
```
system: annotationPrompt.prompt
user: M1.text
assistant: <SSML from call 1>
user: M2.text
```

**Call 3 (for M3):**
```
system: annotationPrompt.prompt
user: M1.text
assistant: <SSML from call 1>
user: M2.text
assistant: <SSML from call 2>
user: M3.text
```

This "growing history" pattern ensures the LLM has context of previous messages and their annotations for consistency.
