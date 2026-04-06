# Task Context — Issue #16

## Issue
- **Number:** 16
- **Title:** Task 15: Dialog generation service + route
- **URL:** https://github.com/bobpps/sound-lab/issues/16
- **State:** OPEN
- **Labels:** backend
- **Dependencies:** #5 (CLOSED), #13 (CLOSED)

## Branch & Worktree
- **Branch:** `feat/16-dialog-generation`
- **Worktree:** `.claude/worktrees/feat/16-dialog-generation`

## Description
Generate a new dialog via LLM. User provides: LLM provider, model, language, prompt describing the dialog.

**Endpoint:** `POST /services/generate-dialog`

**Request body:**
```json
{
  "providerId": "openai",
  "model": "gpt-4o",
  "language": "en-US",
  "prompt": "A customer calling tech support about a broken printer",
  "messageCount": 6
}
```

**Response:** `DialogWithMessages` (created dialog with generated messages)

## Files to Create
- `backend/src/services/dialog-generation.ts`
- `backend/tests/services/dialog-generation.test.ts`
- `backend/src/routes/services/index.ts`
- `backend/tests/routes/services.test.ts`

## Steps from Issue
1. Write service tests — mock LLM + dialog repo, verify LLM called with system prompt + user prompt, dialog created with title from prompt, messages created from LLM JSON output
2. Run tests — fail (RED)
3. Implement `generateDialog()` service: system prompt instructs LLM to output JSON array of `{character, text}`, parse response, create dialog, create messages in order, return DialogWithMessages
4. Write route test + implement route handler: validate body, get provider + API key, create LLM instance, call service
5. Run all tests — pass (GREEN)
6. Commit

## Relevant Repo Areas
- `backend/src/llm/` — LLM provider interface, registry, adapters
- `backend/src/db/interfaces.ts` — IDatabase, repository contracts
- `backend/src/db/types.ts` — TypeScript types (Dialog, Message, DialogWithMessages)
- `backend/src/routes/` — existing route patterns (autoload)
- `backend/tests/` — existing test patterns
- `backend/src/app.ts` — Fastify app factory
- `backend/src/db/local/crypto.ts` — API key encryption
