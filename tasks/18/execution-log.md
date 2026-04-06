# Execution Log — Issue #18: Auto-annotation service + route

## 2026-04-06 — Research Phase

### Files Read and Key Findings

#### DB Layer
- **`backend/src/db/types.ts`** — All types confirmed: `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`, `CreateAnnotatedDialog`, `CreateAnnotatedMessage`, `DialogWithMessages`, `DialogMessage`, `AnnotationPrompt`. The `AnnotatedDialog.provider_id` is a string (natural key for TTS provider). `DialogMessage.order` field exists for ordering.
- **`backend/src/db/interfaces.ts`** — Repository contracts confirmed: `IDialogRepository.getWithMessages()`, `IAnnotationRepository.create()`, `IAnnotationRepository.createMessage()`, `IAnnotationRepository.getWithMessages()`, `IAnnotationPromptRepository.getById()`, `IProviderRepository.getById()`, `IProviderRepository.getDecryptedKey()`.

#### LLM Provider System
- **`backend/src/providers/llm/types.ts`** — `ILLMProvider` with `complete(messages: ILLMMessage[], model: string): Promise<string>`. `ILLMMessage` has `role: 'system' | 'user' | 'assistant'` and `content: string`.
- **`backend/src/providers/llm/registry.ts`** — `createLLMProvider(providerId, apiKey)` factory. Supports `openai` and `anthropic`.
- **`backend/src/plugins/llm.ts`** — Decorates Fastify with `createLLMProvider`. Type exported as `LLMProviderFactory`.
- **`backend/src/providers/llm/openai.ts`** and **`anthropic.ts`** — Both implement `ILLMProvider`. Anthropic concatenates all text blocks. Both have `validateCredentials()`.

#### Route Patterns
- **`backend/src/routes/llm/index.ts`** — Has `resolveLLMProvider()` helper pattern: check provider exists + type, get API key, create provider. Returns null on error (uses `reply.notFound()`/`reply.badRequest()`). This pattern should be replicated or extracted.
- **`backend/src/routes/annotations/index.ts`** — CRUD pattern for annotations. Uses `fastify.db.annotations.*` methods.
- **`backend/src/routes/dialogs/index.ts`** — Contains nested annotation routes (`POST /dialogs/:dialogId/annotations`). Uses TypeBox schemas from separate schema files.
- **`backend/src/routes/tts/index.ts`** — Same `resolveTTSProvider()` helper pattern.
- **`backend/src/app.ts`** — Uses `@fastify/autoload` with `dirNameRoutePrefix: true`. Route directory names become URL prefixes automatically.

#### Schemas
- **`backend/src/schemas/annotation.ts`** — `AnnotatedDialogWithMessages` (Intersect of `AnnotatedDialog` + messages array) already exists for the response. `CreateAnnotatedDialogBody` exists but is for the manual creation endpoint (doesn't include all fields needed for auto-annotation).
- **`backend/src/schemas/llm.ts`** — `LLMMessage`, `CompleteBody`, `CompleteResponse` schemas.
- **`backend/src/schemas/common.ts`** — `ErrorResponse`, `IdParam`, `StringIdParam`.
- **`backend/src/schemas/prompt.ts`** — `AnnotationPrompt` schema.

#### Test Infrastructure
- **`backend/tests/helpers.ts`** — Simple `buildTestApp()` that calls `buildApp({ testing: true })` + `app.ready()`. Testing mode uses in-memory SQLite.
- **`backend/tests/db/test-helpers.ts`** — `createTestDb()` for raw DB tests.
- **`backend/tests/routes/llm.test.ts`** — Key pattern for mocking LLM: overwrite `createLLMProvider` decorator directly on app instance. Seeds providers via `app.db.providers.create()` + `app.db.providers.setKey()`.
- **`backend/tests/routes/annotations.test.ts`** — Seeds dialogs, messages, annotations via repo methods. Good pattern for setting up test fixtures.
- **`backend/vitest.config.ts`** — Uses `globals: true`, `pool: 'forks'`, tsx loader.

#### Directory Status
- `backend/src/services/` — DOES NOT EXIST (must create)
- `backend/src/routes/services/` — DOES NOT EXIST (must create)
- `backend/tests/services/` — DOES NOT EXIST (must create)

### Dependency Check
- Issue #8 (Annotations routes): CLOSED, merged as PR #41
- Issue #16 (Dialog generation): OPEN, not implemented. Would also create `routes/services/index.ts` but hasn't yet.
- All LLM infrastructure merged: PRs #48 (OpenAI), #49 (Anthropic), #51 (LLM routes)
- All CRUD infrastructure merged: PRs #37 (dialogs), #38 (providers), #39 (annotation prompts), #41 (annotations)

### Key Decisions Needed
1. **Service function signature** — Dependency injection via parameters vs. passing whole `IDatabase`. Recommend granular: pass individual repos + LLM provider.
2. **Error strategy** — Collect all LLM results first then write to DB (atomic), or write as you go (partial state possible on failure)?
3. **Whether to validate `annotationPrompt.provider_id === ttsProviderId`** — Not in the spec, but logically sensible.
4. **Schema file location** — New `schemas/service.ts` or add to existing file?

---

## 2026-04-06 — Implementation Phase

### Task 1: Request Body Schema
- Created `backend/src/schemas/service.ts` with TypeBox schema
- Verified TypeScript compiles
- Commit: `7b38c71`

### Task 2+3: Service Tests (RED) + Implementation (GREEN)
- Dispatched subagent for TDD cycle
- Subagent completed but had 3 spec deviations that I fixed:
  1. **provider_id bug**: Service used `params.providerId` (LLM provider) instead of `params.ttsProviderId` (TTS provider) for the annotated dialog's `provider_id`
  2. **Error messages**: Service used generic "Dialog not found" instead of "Dialog 1 not found" with entity IDs as specified in plan
  3. **Collect-then-write pattern**: Service wrote to DB inside the LLM loop instead of collecting all responses first, then writing — fixed to match plan's architecture
- All 7 unit tests pass after fixes
- Commits: `376a77b` (tests), `f8e83ab` (implementation), `33f27fb` (spec fixes)

### Task 4+5: Route Tests (RED) + Handler (GREEN)
- Dispatched subagent for TDD cycle
- Subagent completed successfully, 9 integration tests
- Added missing try/catch around `createLLMProvider` for unsupported provider error handling (matching LLM route pattern)
- All 9 route tests pass
- Commits: `a14efe4` (tests), `9d6513a` (handler), `c674177` (try/catch fix)

### Final Verification
- **Full test suite: 281/281 tests pass (22 files)**
- **TypeScript: compiles cleanly with no errors**

### Files Created (5 files)
| File | Purpose |
|------|---------|
| `backend/src/schemas/service.ts` | TypeBox schema for auto-annotate request body |
| `backend/tests/services/auto-annotation.test.ts` | 7 unit tests for autoAnnotate service |
| `backend/src/services/auto-annotation.ts` | Pure autoAnnotate service function |
| `backend/tests/routes/services.test.ts` | 9 integration tests for POST /services/annotate |
| `backend/src/routes/services/index.ts` | Fastify route handler |

### Deviations from Plan
- Route handler uses `reply.notFound()` / `reply.badRequest()` pattern (return-based) instead of `throw fastify.httpErrors.*` pattern. Both work in Fastify, but the existing `routes/llm/index.ts` uses `reply.notFound()` pattern, so this is consistent with codebase conventions.
- Tests use a `makePayload()` helper to reduce fixture boilerplate — not in plan but improves readability.
