# Execution Log — Issue #13: LLM Provider Interface + Registry + OpenAI Adapter

## Research Phase

### Actions Taken

1. **Read TTS provider pattern** — all five files:
   - `backend/src/providers/tts/types.ts` — interfaces: `IVoice`, `ISynthesizeOptions`, `ITTSProvider`
   - `backend/src/providers/tts/registry.ts` — factory pattern with `PROVIDERS` map, `createTTSProvider()`, `getSupportedTTSProviders()`
   - `backend/src/providers/tts/elevenlabs.ts` — adapter class using raw `fetch`, implements `ITTSProvider`
   - `backend/tests/providers/elevenlabs.test.ts` — mocks global `fetch` via `vi.stubGlobal('fetch')`, tests all methods
   - `backend/tests/providers/registry.test.ts` — tests factory returns correct instances, tests error for unknown provider, tests supported list

2. **Checked backend/package.json** — `openai` package is NOT installed. Needs `npm install openai`.

3. **Read backend/CLAUDE.md** — conventions: factory pattern, ESM, strict TS, Vitest with globals.

4. **Read vitest.config.ts** — `globals: true`, `pool: 'forks'` with tsx loader.

5. **Read tsconfig.json** — `strict: true`, `moduleResolution: "bundler"`, target ES2022.

6. **Checked for existing LLM provider files** — none exist in the repo or worktree.

7. **Queried Context7 for OpenAI Node SDK docs**:
   - Constructor: `new OpenAI({ apiKey })` — default import from `'openai'`
   - Models list: `client.models.list()` — returns async iterable, each item has `{ id, object, created, owned_by }`
   - Chat completions: `client.chat.completions.create({ model, messages })` — returns `{ choices: [{ message: { role, content } }] }`
   - Pagination: `models.list()` returns `PagePromise` implementing async iteration via `for await...of`

8. **Read task-context.md** — confirmed scope, steps, dependencies.

### Key Findings

1. **TTS pattern is clean and directly transferable.** The LLM version will have the same 3-file structure: types, adapter, registry.

2. **Mock strategy differs from TTS.** TTS mocks `fetch` because adapters use raw HTTP. LLM adapter uses the `openai` SDK, so we mock the SDK class via `vi.mock('openai')` — cleaner and less brittle.

3. **`models.list()` is paginated (async iterable).** Must use `for await...of` to consume. Mock must return an async iterable, not a plain array.

4. **`completion.choices[0].message.content` can be `null`.** Must handle this edge case — recommend throwing since our interface returns `Promise<string>`.

5. **Registry constructor signature matches.** TTS registry uses `Record<string, new (apiKey: string) => ITTSProvider>`. Same pattern works for LLM since `OpenAILLMProvider` takes a single `apiKey` string.

6. **Issue specifies filtering models to `gpt-*` prefix.** This excludes dall-e, whisper, tts, embedding models.

### Decisions Made

| Decision | Rationale |
|----------|-----------|
| Mock OpenAI SDK class, not fetch | SDK handles HTTP internally; mocking fetch would test SDK internals |
| Include `validateCredentials()` on `ILLMProvider` | Consistent with `ITTSProvider` pattern; use `models.retrieve('gpt-4o')` as lightweight check |
| Use `for await...of` for model listing | Documented approach for OpenAI SDK pagination |
| Throw on null content from `complete()` | Interface returns `Promise<string>`; null means unexpected response |
| Single test file for adapter + registry | Keeps things simple; TTS has separate files but LLM only has one adapter initially |
| Filter models by `gpt-` prefix | Matches issue specification; simple heuristic that works for current model naming |

## Implementation Phase

### Task 1: Install `openai` dependency and create `types.ts`

- Installed `openai` package via `npm install openai --workspace=backend`
- Created `backend/src/providers/llm/types.ts` with `ILLMMessage` and `ILLMProvider` interfaces
- Verified TypeScript compiles clean
- Commit: `f78af64`

### Task 2: OpenAI adapter (TDD)

- **RED:** Wrote test file `backend/tests/providers/openai-llm.test.ts` with 10 tests. Ran tests — failed with "Cannot find module openai.js" (expected).
- **GREEN:** Created `backend/src/providers/llm/openai.ts` implementing `OpenAILLMProvider`. All 10 tests passed.
- **REFACTOR:** ESLint flagged `_model` as unused in `validateCredentials()` — the default `@typescript-eslint/no-unused-vars` config doesn't honor underscore prefix. Replaced `for await (const _model of ...)` with explicit async iterator protocol (`iterator.next()`) to avoid the binding entirely. Tests still pass, lint clean.
- Commit: `cc04f40`

### Task 3: LLM registry (TDD)

- **RED:** Wrote test file `backend/tests/providers/llm-registry.test.ts` with 3 tests. Ran tests — failed with "Cannot find module registry.js" (expected).
- **GREEN:** Created `backend/src/providers/llm/registry.ts` with `createLLMProvider()` factory and `getSupportedLLMProviders()`. All 3 tests passed.
- Full suite: 231/231 tests pass across 18 test files, lint clean, TypeScript compiles clean.
- Commit: `9b2e3de`

### Deviations from Plan

| Deviation | Reason |
|-----------|--------|
| `validateCredentials()` uses async iterator protocol instead of `for await...of` | ESLint `no-unused-vars` flagged `_model`; existing config doesn't have `argsIgnorePattern` for underscore prefix. Using `iterator.next()` avoids binding a variable entirely. |

### Files Created

- `backend/src/providers/llm/types.ts` — `ILLMMessage`, `ILLMProvider` interfaces
- `backend/src/providers/llm/openai.ts` — `OpenAILLMProvider` class
- `backend/src/providers/llm/registry.ts` — `createLLMProvider()`, `getSupportedLLMProviders()`
- `backend/tests/providers/openai-llm.test.ts` — 10 tests for adapter
- `backend/tests/providers/llm-registry.test.ts` — 3 tests for registry

### Final Verification

- **Tests:** 231/231 passed, 0 failures
- **Lint:** 0 errors, 0 warnings
- **TypeScript:** compiles clean (exit 0)
