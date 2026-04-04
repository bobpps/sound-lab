# Task Context — Issue #3

## Issue
- **Number:** 3
- **Title:** Task 2: TypeBox request/response schemas
- **URL:** https://github.com/bobpps/sound-lab/issues/3
- **Labels:** backend, infrastructure
- **Assignees:** none
- **Depends on:** #2 (completed, merged to main)

## Branch
- **Name:** `feat/3-typebox-schemas`
- **Worktree:** `.claude/worktrees/feat+3-typebox-schemas`
- **Base:** `origin/main` (755f204)

## Description

Define TypeBox schemas for all entities — JSON Schema validation + TypeScript types for Fastify route handlers.

### Files to Create
- `backend/src/schemas/common.ts` — IdParam, StringIdParam, ErrorResponse
- `backend/src/schemas/provider.ts` — Provider, CreateProvider, UpdateProvider, SetKeyBody, ProviderTypeQuery
- `backend/src/schemas/dialog.ts` — Dialog, DialogMessage, DialogWithMessages, CreateDialog, UpdateDialog, CreateDialogMessage, UpdateDialogMessage, DialogIdParam, MessageIdParam
- `backend/src/schemas/annotation.ts` — AnnotatedDialog, AnnotatedMessage, AnnotatedDialogWithMessages, CreateAnnotatedDialog, CreateAnnotatedMessage, UpdateAnnotatedMessage, params
- `backend/src/schemas/prompt.ts` — AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt, AgentPrompt, CreateAgentPrompt, UpdateAgentPrompt

### Acceptance Criteria
- All schemas mirror domain types from `backend/src/db/types.ts`
- `tsc --noEmit` passes
- Each schema usable as both TypeBox schema and TypeScript type via `Static<typeof Schema>`

## Relevant Files/Directories
- `backend/src/db/types.ts` — domain types to mirror
- `backend/src/db/interfaces.ts` — repository contracts
- `CLAUDE.md`, `backend/CLAUDE.md` — project guidance
- `docs/plans/2026-04-04-full-project-plan.md` — full project plan reference
