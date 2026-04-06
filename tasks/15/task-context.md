# Task Context: Issue #15

- **Issue:** #15 — Task 14: LLM API routes (models + complete)
- **URL:** https://github.com/bobpps/sound-lab/issues/15
- **Branch:** `feat/15-llm-api-routes`
- **Worktree:** `.claude/worktrees/feat+15-llm-api-routes`
- **Labels:** backend, providers
- **Dependencies:** #4 (Providers CRUD routes — CLOSED), #13 (LLM provider interface + registry + OpenAI adapter — CLOSED)

## Description

Create HTTP endpoints for LLM operations:

- `GET /llm/:providerId/models` → `string[]`
- `POST /llm/:providerId/complete` → `{ text: string }`

Request body for complete:
```json
{
  "messages": [{ "role": "user", "content": "Hello" }],
  "model": "gpt-4o"
}
```

## Steps from Issue

1. Write tests — mock LLM registry, seed provider with key, test endpoints
2. Run tests — fail (RED)
3. Implement routes — same lookup pattern as TTS: get provider from DB → get API key → create instance → call method
4. Run tests — pass (GREEN)
5. Commit

## Relevant Files/Directories

- `backend/src/routes/` — existing route patterns (especially TTS routes)
- `backend/src/llm/` — LLM registry, interfaces, adapters
- `backend/src/db/interfaces.ts` — database interfaces
- `backend/src/db/local/crypto.ts` — API key encryption
- `backend/tests/routes/` — existing route tests
- `backend/CLAUDE.md` — backend conventions
- `docs/plans/2026-04-04-full-project-plan.md` — overall project plan
