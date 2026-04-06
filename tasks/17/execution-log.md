# Issue #17 — Dialog Editing Service: Execution Log

## 2026-04-06 — Research Phase

### Completed
- Read all project guidance files (root CLAUDE.md, backend/CLAUDE.md, frontend/CLAUDE.md)
- Mapped codebase structure: providers/llm/, db/, routes/, schemas/, plugins/
- Analyzed `IDialogRepository` interface — confirmed `getWithMessages()` and `updateMessage()` exist
- Analyzed `ILLMProvider` interface — confirmed `complete(messages, model)` signature
- Analyzed LLM registry — `createLLMProvider(providerId, apiKey)` factory function
- Read LLM plugin (feat/16 branch) — `fastify.createLLMProvider` decorator available
- Read existing route patterns (tts, llm, dialogs) — understood `resolveLLMProvider` pattern
- Read test patterns (route tests, provider tests) — understood mocking via decorator override
- Confirmed worktree branch is based on feat/16 (commit 19fab66) with LLM infrastructure
- Confirmed `backend/src/routes/services/` does NOT exist — must be created
- Confirmed `backend/src/services/` does NOT exist — must be created
- Verified both local SQLite and Supabase dialog repos implement `updateMessage()`
- Wrote `tasks/17/analysis.md` with full research findings

### Key Findings
1. The service needs dependency injection (IDatabase + ILLMProvider) for testability
2. LLM prompt must instruct JSON array output of `{character, text}` objects
3. Response parsing needs robust error handling (invalid JSON, wrong message count)
4. `resolveLLMProvider` pattern from LLM/TTS routes should be reused in services route
5. Issue #16 (dialog generation) was supposed to create the services route file first, but hasn't been done. We create it ourselves.

### Decisions Made
- Service function will be a pure function with injected dependencies (not tied to Fastify)
- Route handler will handle provider resolution and call the service
- TypeBox schemas will be created in a new `schemas/services.ts` file (or inline)
- Messages updated individually via `updateMessage()` — no bulk update available

### Ready for Next Phase
Analysis complete. Ready for plan writing.

## 2026-04-06 — Implementation Phase

### Task 1: LLM Plugin
- SKIPPED — `backend/src/plugins/llm.ts` already exists (from feat/16 merge)

### Task 2: Service Unit Tests (Red Phase)
- Created `backend/tests/services/dialog-editing.test.ts` — 7 test cases
- Tests: happy path, not found, wrong message count, character mismatch, invalid JSON, no-op, code fence stripping
- Spec review: PASSED
- Code quality review: improved mock extraction (complete handle) and added specific error matchers
- Commits: 27024e6, c4d20b4

### Task 3: Service Implementation (Green Phase)
- Created `backend/src/services/dialog-editing.ts` — pure function `editDialog()`
- All 7 tests pass
- Spec review: PASSED
- Code quality review: added shape validation for LLM response messages to prevent `undefined` DB writes
- Commits: 6c12fd5, a28ce6a

### Task 4: Route Schema + Route Tests (Red Phase)
- Created `backend/src/schemas/service.ts` — EditDialogBody TypeBox schema
- Created `backend/tests/routes/services.test.ts` — 8 integration tests
- 3 pass (expect 404), 5 fail (expect other codes, get 404) — correct Red phase
- Spec review: PASSED
- Commit: 7a913f5

### Task 5: Route Implementation (Green Phase)
- Created `backend/src/routes/services/index.ts` — POST /edit-dialog handler
- All 8 route tests pass, full suite 280/280 pass
- Spec review: PASSED
- Commit: 84be292

### Task 6: Final Verification
- Full test suite: 280/280 pass (22 test files)
- Backend build: clean (tsc)
- Full build (backend + frontend): clean

### Files Created
1. `backend/src/services/dialog-editing.ts` — editDialog service function
2. `backend/src/schemas/service.ts` — EditDialogBody TypeBox schema
3. `backend/src/routes/services/index.ts` — POST /services/edit-dialog route
4. `backend/tests/services/dialog-editing.test.ts` — 7 service unit tests
5. `backend/tests/routes/services.test.ts` — 8 route integration tests

### Decisions Made During Implementation
- Used `complete` mock handle extracted from `createMocks()` instead of casting `llmProvider.complete` each time
- Added specific regex matchers for error tests instead of bare `.rejects.toThrow()`
- Added shape validation in `parseLLMResponse()` to prevent `undefined` values reaching DB
- Tightened `LLMResponseMessage.character` type from `number` to `1 | 2`
- Error classification in route uses string matching on error messages (not found->404, parse/json/shape->502)
