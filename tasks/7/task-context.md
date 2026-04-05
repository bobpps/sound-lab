# Task Context — Issue #7

## Issue
- **Number:** 7
- **Title:** Task 6: Agent Prompts CRUD routes
- **URL:** https://github.com/bobpps/sound-lab/issues/7
- **State:** OPEN
- **Labels:** backend
- **Author:** bobpps
- **Comments:** 0
- **Depends on:** #3 (TypeBox schemas — merged)

## Branch
- **Name:** `feat/7-agent-prompts-crud`
- **Worktree:** `.claude/worktrees/feat/7-agent-prompts-crud`

## Description
REST API for agent prompt management. Identical CRUD pattern to annotation prompts.

### Files to create
- `backend/src/routes/agent-prompts/index.ts`
- `backend/tests/routes/agent-prompts.test.ts`

### Endpoints
- `GET /agent-prompts` → AgentPrompt[]
- `GET /agent-prompts/:id` → AgentPrompt
- `POST /agent-prompts` → AgentPrompt (201)
- `PUT /agent-prompts/:id` → AgentPrompt
- `DELETE /agent-prompts/:id` → 204

### Steps from issue
1. Write tests — same CRUD pattern as annotation prompts
2. Run tests — fail (RED)
3. Implement routes using `agentPrompts` repo
4. Run tests — pass (GREEN)
5. All tests, commit

## Likely Relevant Files/Directories
- `backend/src/routes/annotation-prompts/` — reference CRUD pattern
- `backend/tests/routes/annotation-prompts.test.ts` — reference test pattern
- `backend/src/db/interfaces.ts` — repository interfaces
- `backend/src/db/types.ts` — TypeScript types
- `backend/src/db/local/` — SQLite repository implementations
- `backend/src/schemas/` — TypeBox schemas (from #3)
- `backend/src/app.ts` — route registration
- `backend/CLAUDE.md` — backend guidance
- `docs/plans/2026-04-04-full-project-plan.md` — full project plan (Task 6)

## Reference
`docs/plans/2026-04-04-full-project-plan.md` — Task 6
