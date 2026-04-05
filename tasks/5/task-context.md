# Task Context — Issue #5

- **Issue:** #5 — Task 4: Dialogs + Messages CRUD routes
- **URL:** https://github.com/bobpps/sound-lab/issues/5
- **Branch:** `feat/5-dialogs-crud`
- **Worktree:** `.claude/worktrees/feat/5-dialogs-crud`
- **Labels:** backend
- **Depends on:** #3 (TypeBox schemas — CLOSED, merged to main)

## Description

REST API for dialog management including nested messages. Implements 8 endpoints:

- `GET /dialogs` → Dialog[]
- `GET /dialogs/:dialogId` → DialogWithMessages
- `POST /dialogs` → Dialog (201)
- `PUT /dialogs/:dialogId` → Dialog
- `DELETE /dialogs/:dialogId` → 204
- `POST /dialogs/:dialogId/messages` → DialogMessage (201)
- `PUT /dialogs/:dialogId/messages/:messageId` → DialogMessage
- `DELETE /dialogs/:dialogId/messages/:messageId` → 204

## TDD Steps from Issue

1. Write tests — each endpoint (list, get with messages, create, update, delete, nested message CRUD, character 1|2 validation)
2. Run tests — fail
3. Implement routes with TypeBox schemas
4. Run tests — pass
5. All tests, commit

## Key Files & Systems

- **Schemas:** `backend/src/schemas/dialog.ts` (Dialog, DialogMessage, DialogWithMessages, CreateDialog, UpdateDialog, CreateDialogMessage, UpdateDialogMessage, DialogIdParam, MessageIdParam)
- **Common schemas:** `backend/src/schemas/common.ts` (ErrorResponse)
- **DB interfaces:** `backend/src/db/interfaces.ts` (IDialogRepository)
- **DB types:** `backend/src/db/types.ts`
- **Local DB implementation:** `backend/src/db/local/dialogs.ts` (LocalDialogRepository)
- **App factory:** `backend/src/app.ts` (buildApp with autoload + TypeBox)
- **DB plugin:** `backend/src/plugins/db.ts` (fastify.db decorator)
- **Test helpers:** `backend/tests/helpers.ts` (buildTestApp)
- **Route pattern:** `backend/src/routes/health/index.ts` (FastifyPluginAsyncTypebox)
- **Route test pattern:** `backend/tests/routes/health.test.ts` (app.inject)

## Related Issues

- #3 (TypeBox schemas) — provides all schema types used by this task
- #4 (Providers CRUD) — parallel task, same route pattern (in-progress in separate worktree)

## Architecture Notes

- Fastify autoload: directory name = route prefix → `routes/dialogs/index.ts` → `/dialogs`
- TypeBox type provider for automatic type inference
- @fastify/sensible for httpErrors (notFound, badRequest)
- Response schemas required for fast-json-stringify
- DB accessed via `fastify.db.dialogs.*` decorator
- Tests use `buildTestApp()` → in-memory SQLite, `app.inject()` for HTTP simulation
