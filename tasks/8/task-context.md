# Task Context — Issue #8

## Issue

- **Number:** 8
- **Title:** Task 7: Annotations + Annotated Messages routes
- **URL:** https://github.com/bobpps/sound-lab/issues/8
- **State:** OPEN
- **Labels:** backend
- **Depends on:** #5 (CLOSED — Dialogs + Messages CRUD routes)

## Branch

- **Name:** `feat/8-annotations-routes`
- **Worktree:** `.claude/worktrees/feat/8-annotations-routes`

## Description

REST API for annotation management. Annotations are scoped to dialogs.

### Endpoints

| Method | Path | Response |
|--------|------|----------|
| GET | `/dialogs/:dialogId/annotations` | AnnotatedDialog[] |
| GET | `/annotations/:id` | AnnotatedDialogWithMessages |
| POST | `/dialogs/:dialogId/annotations` | AnnotatedDialog (201) |
| DELETE | `/annotations/:id` | 204 |
| POST | `/annotations/:id/messages` | AnnotatedMessage (201) |
| PUT | `/annotations/:id/messages/:messageId` | AnnotatedMessage |
| DELETE | `/annotations/:id/messages/:messageId` | 204 |

### Key Notes

- Listing is nested under dialogs (`/dialogs/:dialogId/annotations`), but single annotation access and messages are at `/annotations/:id`.
- Tests should seed dialog + messages first (annotations reference dialog_messages).
- SSML text for annotated messages.
- May need two route files or prefix registration for both URL patterns.

### Files to Create

- `backend/src/routes/annotations/index.ts`
- `backend/tests/routes/annotations.test.ts`

## Relevant Repo Areas

- `backend/src/db/interfaces.ts` — repository contracts
- `backend/src/db/local/` — SQLite implementation
- `backend/src/db/supabase/` — Supabase implementation
- `backend/src/db/types.ts` — TypeScript types
- `backend/src/routes/dialogs/` — existing dialog routes (reference pattern)
- `backend/tests/routes/dialogs.test.ts` — existing route tests (reference)
- `CLAUDE.md`, `backend/CLAUDE.md` — project guidance
- `docs/plans/2026-04-04-full-project-plan.md` — full project plan
