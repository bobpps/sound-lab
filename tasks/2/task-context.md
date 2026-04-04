# Task Context: Issue #2

## Issue

- **Number:** 2
- **Title:** Task 1: buildApp() factory + DB plugin + autoload
- **URL:** https://github.com/bobpps/sound-lab/issues/2
- **Labels:** backend, infrastructure
- **Assignees:** none
- **Comments:** 0

## Branch & Worktree

- **Branch:** `feat/2-buildapp-factory`
- **Worktree:** `.claude/worktrees/feat+2-buildapp-factory`

## Description

Refactor `src/index.ts` into app factory pattern. DB as Fastify decorator. Route autoloading.

### Files to Create

- `backend/src/app.ts` — buildApp() factory with TypeBox provider, CORS, sensible, DB plugin, autoload
- `backend/src/plugins/db.ts` — fastify-plugin, decorates `fastify.db`, `onClose` hook, declaration merging
- `backend/src/routes/health/index.ts` — GET /health returns `{ status: 'ok' }`
- `backend/tests/helpers.ts` — `buildTestApp()` with in-memory SQLite

### Files to Modify

- `backend/src/index.ts` — thin entry: `buildApp()` + `listen()`
- `backend/package.json` — add dependencies

### Dependencies to Install

- `@fastify/autoload`
- `@fastify/sensible`
- `@sinclair/typebox`
- `@fastify/type-provider-typebox`
- `fastify-plugin`

### Steps (from issue)

1. Install dependencies
2. Write route test helper `tests/helpers.ts` with `buildTestApp()`
3. Write health route test (`tests/routes/health.test.ts`)
4. Run test — verify it fails (RED)
5. Create DB decorator plugin `src/plugins/db.ts`
6. Create health route `src/routes/health/index.ts`
7. Create app factory `src/app.ts`
8. Rewrite `src/index.ts` as thin entry
9. Run all tests — verify pass (GREEN)
10. Commit

### Acceptance Criteria

- `buildApp({ testing: true })` creates app with in-memory SQLite, no logger
- `app.db.dialogs.list()` works via decorator
- `GET /health` returns 200 `{ status: 'ok' }`
- All existing DB tests still pass

## Relevant Project Context

- DB layer is fully implemented and tested (44+ tests)
- Key files: `backend/src/db/interfaces.ts`, `backend/src/db/factory.ts`, `backend/src/db/types.ts`
- `createDatabase()` in `db/factory.ts` auto-selects backend from env vars
- `createTestDb()` from `tests/db/test-helpers.ts` creates fresh in-memory SQLite
- ESM everywhere — `.js` extensions required in imports
- Fastify 5, TypeBox for schemas, Vitest for testing
- Patterns documented in `backend/CLAUDE.md`: app factory, DB as decorator, autoload, declaration merging

## Reference

- `docs/plans/2026-04-04-full-project-plan.md` — Task 1
