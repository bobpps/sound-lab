# Task Context: Issue #17

## Issue
- **Number:** 17
- **Title:** Task 16: Dialog editing service + route
- **URL:** https://github.com/bobpps/sound-lab/issues/17
- **State:** OPEN
- **Labels:** backend
- **Branch:** `feat/17-dialog-editing-service`
- **Worktree:** `.claude/worktrees/feat/17-dialog-editing-service`

## Description

Phase 5: Backend Services (2/3). Edit existing dialog via LLM. User provides: dialog ID, LLM provider, model, edit instructions.

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

**Response:** `DialogWithMessages` (updated dialog)

## Files
- Create: `backend/src/services/dialog-editing.ts`
- Create: `backend/tests/services/dialog-editing.test.ts`
- Modify: `backend/src/routes/services/index.ts`

## Steps from Issue
1. Write service tests — mock LLM returns edited messages array, verify existing messages are updated
2. Run tests — fail
3. Implement `editDialog()` service — fetch existing dialog with messages, send to LLM with edit instructions, update each message with new text
4. Write route test + implement route
5. Run all tests — pass
6. Commit

## Dependency
- Depends on #16 (dialog generation service + route)
- #16 is still OPEN but the dependency is mainly structural: both share `backend/src/routes/services/index.ts`
- The core functionality of #17 (editing dialogs) is independent and can be built standalone
- LLM providers (#13 OpenAI, #14 Anthropic) are already implemented
- Dialog CRUD (#5, #8) is already implemented

## Related Issues Read
- #16: Dialog generation service — shares the services route file, same Phase 5

## Key Repo Areas
- `backend/src/llm/` — LLM provider interfaces and implementations
- `backend/src/db/` — dialog repository interfaces and implementations
- `backend/src/routes/` — existing route structure
- `backend/src/db/interfaces.ts` — repository contracts
- `backend/src/db/types.ts` — TypeScript types (DialogWithMessages, etc.)
