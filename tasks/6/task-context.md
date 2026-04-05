# Task Context — Issue #6

- **Issue:** #6 — Task 5: Annotation Prompts CRUD routes
- **URL:** https://github.com/bobpps/sound-lab/issues/6
- **Labels:** backend
- **Branch:** `feat/6-annotation-prompts-crud`
- **Worktree:** `.claude/worktrees/feat+6-annotation-prompts-crud`
- **Depends on:** #3 (TypeBox schemas — already merged)

## Description

REST API for annotation prompt management. Standard CRUD with numeric IDs.

**Endpoints:**
- `GET /annotation-prompts` → `AnnotationPrompt[]`
- `GET /annotation-prompts/:id` → `AnnotationPrompt`
- `POST /annotation-prompts` → `AnnotationPrompt` (201)
- `PUT /annotation-prompts/:id` → `AnnotationPrompt`
- `DELETE /annotation-prompts/:id` → 204

## Key Files

- **Create:** `backend/src/routes/annotation-prompts/index.ts`
- **Create:** `backend/tests/routes/annotation-prompts.test.ts`
- **Reference schemas:** `backend/src/schemas/prompt.ts` (AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt)
- **Reference schemas:** `backend/src/schemas/common.ts` (IdParam, ErrorResponse)
- **DB interface:** `backend/src/db/interfaces.ts` — `IAnnotationPromptRepository`
- **DB types:** `backend/src/db/types.ts` — AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt
- **App factory:** `backend/src/app.ts` — uses `@fastify/autoload` (dir-based routing)
- **Test helper:** `backend/tests/helpers.ts` — `buildTestApp()`
- **Existing route pattern:** `backend/src/routes/health/index.ts`
- **Existing test pattern:** `backend/tests/routes/health.test.ts`

## Architecture Notes

- `@fastify/autoload` maps directory name → route prefix, so `routes/annotation-prompts/index.ts` → `/annotation-prompts`
- Routes use `FastifyPluginAsyncTypebox` pattern with `.withTypeProvider<TypeBoxTypeProvider>()`
- DB accessed via `fastify.db.annotationPrompts` decorator
- `@fastify/sensible` for HTTP errors: `fastify.httpErrors.notFound()`
- Tests use `app.inject()` with `buildTestApp()` (in-memory SQLite)
- All response schemas must be defined (fast-json-stringify)
- ESM: `.js` extensions on all imports
- No provider routes exist yet — this is the first CRUD route after health

## Comments

No comments on the issue.
