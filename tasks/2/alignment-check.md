# Alignment Check: Issue #2 — buildApp() factory + DB plugin + autoload

**Checked by:** Claude Opus 4.6 (alignment agent)
**Date:** 2026-04-04
**Includes fix commit:** `527b20c` (response schema, typed routes, DB memory path, error handling)

---

## Original Analysis Summary

The analysis (`tasks/2/analysis.md`) identified 6 deliverables from the GitHub issue:

1. **App factory (`src/app.ts`)** — `buildApp(opts?)` with TypeBoxTypeProvider, CORS, sensible, DB plugin, autoload. No `.listen()`. Conditional logger (off when `testing: true`).
2. **DB plugin (`src/plugins/db.ts`)** — `fastify-plugin` wrapper around `createDatabase()`, decorates `fastify.db: IDatabase`, `onClose` hook, declaration merging for types.
3. **Health route (`src/routes/health/index.ts`)** — Autoloaded `GET /health` returning `{ status: 'ok' }`.
4. **Test helper (`tests/helpers.ts`)** — `buildTestApp()` calling `buildApp({ testing: true })` + `app.ready()`.
5. **Entry point (`src/index.ts`)** — Slim to `buildApp()` + `listen()`.
6. **Dependencies** — Install 5 packages: `@fastify/autoload`, `@fastify/sensible`, `@sinclair/typebox`, `@fastify/type-provider-typebox`, `fastify-plugin`.

**Constraints identified:** 13 constraints from project CLAUDE.md files (ESM/.js extensions, TDD, app factory pattern, TypeBox provider, response schemas, `fastify-plugin` for infrastructure, registration order, DB as decorator, declaration merging, `app.inject()` testing, in-memory SQLite, etc.).

**Risks identified:** 6 risks (`:memory:` path through `createLocalDb`, autoload `__dirname` resolution, existing DB test compatibility, `fastify-plugin` encapsulation, declaration merging visibility, autoload prefix mapping). All assessed as low severity.

**Acceptance criteria (from issue):**
1. `buildApp({ testing: true })` creates app with in-memory SQLite, no logger
2. `app.db.dialogs.list()` works via decorator
3. `GET /health` returns 200 `{ status: 'ok' }`
4. All existing DB tests still pass

---

## What Was Implemented

### Deliverable 1: App factory (`backend/src/app.ts`)

- Exports `buildApp(opts: AppOptions = {})` with `AppOptions = { testing?: boolean }`
- Uses `.withTypeProvider<TypeBoxTypeProvider>()`
- Registers CORS with `process.env.CORS_ORIGIN || 'http://localhost:5173'`
- Registers `@fastify/sensible`
- Registers DB plugin with `{ testing: opts.testing }`
- Registers `@fastify/autoload` with `dirNameRoutePrefix: true` pointed at `routes/`
- `logger: !opts.testing`
- Does NOT call `.listen()`
- `__dirname` derived from `import.meta.url` (standard ESM pattern)
- Registration order: cors -> sensible -> DB plugin -> autoload (matches analysis requirement)

**Matches plan exactly.** No deviations.

### Deliverable 2: DB plugin (`backend/src/plugins/db.ts`)

- Wrapped in `fp<DbPluginOptions>()` with `{ name: 'db' }`
- `declare module 'fastify' { interface FastifyInstance { db: IDatabase } }` — declaration merging present
- In testing mode: config = `{ provider: 'local', local: { path: ':memory:' }, encryptionKey: 'test-encryption-key' }`
- In production: config = `undefined` (falls back to `loadDbConfig()`)
- Calls `createDatabase(config)`, `fastify.decorate('db', db)`, `fastify.addHook('onClose', ...)`
- All imports use `.js` extensions

**Matches plan exactly.** No deviations.

### Deliverable 3: Health route (`backend/src/routes/health/index.ts`)

After the fix commit, the health route now:
- Uses `FastifyPluginAsyncTypebox` instead of plain `FastifyInstance`
- Defines a `HealthResponse` TypeBox schema: `Type.Object({ status: Type.Literal('ok') })`
- Includes `schema: { response: { 200: HealthResponse } }` on the route
- Returns `{ status: 'ok' as const }` for correct type narrowing

**Deviates from plan (improvement).** The plan specified a plain handler with no response schema. The fix brought it in line with the `backend/CLAUDE.md` constraint: "Always define response schemas."

### Deliverable 4: Test helper (`backend/tests/helpers.ts`)

- Exports `buildTestApp()` that calls `buildApp({ testing: true })` + `app.ready()`
- Returns the ready Fastify instance

**Matches plan exactly.** No deviations.

### Deliverable 5: Entry point (`backend/src/index.ts`)

After the fix commit:
- Imports `buildApp` from `./app.js`
- Wraps `buildApp()` + `listen()` in a try/catch
- On failure: `console.error('Failed to start server:', err)` + `process.exit(1)`

**Deviates from plan (improvement).** The plan specified a bare 3-line file. The fix added error handling for startup failures, which is standard production hardening.

### Deliverable 6: Dependencies (`backend/package.json`)

All 5 dependencies installed:
- `@fastify/autoload`: ^6.3.1
- `@fastify/sensible`: ^6.0.4
- `@sinclair/typebox`: ^0.34.49
- `@fastify/type-provider-typebox`: ^6.1.0
- `fastify-plugin`: ^5.1.0

Dependencies also alphabetically sorted (net improvement over the original unsorted list).

**Matches plan exactly.** No deviations.

### Unplanned change: `backend/src/db/factory.ts`

The fix commit modified `createDatabase()` to detect `:memory:` path and route to `createMemoryDb()` instead of `createLocalDb(':memory:')`:
```ts
const sqliteDb = cfg.local!.path === ':memory:'
  ? createMemoryDb()
  : createLocalDb(cfg.local!.path);
```

The analysis explicitly marked this file as "read-only, no changes needed" and assessed the `:memory:` through `createLocalDb` path as "low risk." The fix overruled that decision to eliminate the unnecessary `mkdirSync('.')` call and WAL pragma that are meaningless for an in-memory database.

### Unplanned change: `backend/vitest.config.ts`

Added `pool: 'forks'` with `execArgv: ['--import', 'tsx']`. The analysis stated this file needed "no changes." During implementation, `@fastify/autoload`'s dynamic `import()` calls failed in Vitest's default pool because the Vite module transform does not intercept native dynamic imports from CJS packages. The fix registers tsx at the Node level so all dynamic imports resolve `.ts` files correctly.

### Tests (`backend/tests/routes/health.test.ts`)

Three test cases covering the plan's Task 2 and Task 7:
1. `GET /health` returns 200 with `{ status: 'ok' }` — validates autoloaded route
2. `app.db` exposes all 5 repositories — validates DB decorator
3. `app.db.dialogs.list()` callable — validates end-to-end through decorator

Uses proper `beforeEach`/`afterEach` with `buildTestApp()` and `app.close()`.

### TDD commit structure

9 commits following prescribed TDD progression:
1. `chore: add fastify autoload, sensible, typebox, fastify-plugin` (deps)
2. `test: add buildTestApp helper and health route test (RED)` (test first)
3. `feat: DB decorator plugin with fastify-plugin` (implementation)
4. `feat: health route (autoloaded)` (implementation)
5. `feat: buildApp() factory with TypeBox, CORS, sensible, DB, autoload` (tests go GREEN)
6. `refactor: slim index.ts to buildApp() + listen()` (cleanup)
7. `test: add app.db decorator smoke tests` (additional validation)
8. `docs: add task context, analysis, plan, and execution log` (documentation)
9. `fix: address code review — response schema, typed routes, DB memory path, error handling` (corrections)

---

## Mismatches

### 1. Vitest config change not anticipated in analysis or plan
**Severity: Minor**

The analysis concluded autoload+ESM would "just work" via tsx. In practice, Vitest's default thread pool does not propagate the tsx loader to workers, causing `@fastify/autoload` dynamic imports to fail on `.ts` files. The fix (`pool: 'forks'` with `--import tsx`) is correct and minimal. Documented in execution log. No negative impact on existing tests (43 pass).

**Root cause:** Analysis gap — did not test the specific interaction between Vitest's worker pool and @fastify/autoload's native `import()`.

### 2. Health route initially lacked response schema
**Severity: Minor (corrected in fix commit)**

The plan's health route used plain `FastifyInstance` with no response schema, violating the `backend/CLAUDE.md` constraint "Always define response schemas." The fix commit corrected this by adding a TypeBox `HealthResponse` schema and using `FastifyPluginAsyncTypebox`.

**Root cause:** Plan oversight — the constraint was listed in the analysis but not followed through in the plan's code.

### 3. `factory.ts` modified despite analysis saying "read-only"
**Severity: Minor (corrected in fix commit)**

The analysis assessed routing `:memory:` through `createLocalDb` as acceptable (Risk 1, "low risk"). The fix commit changed `factory.ts` to use `createMemoryDb()` for `:memory:` paths, eliminating unnecessary filesystem and WAL operations.

**Root cause:** The analysis identified the issue but made a conservative call to leave it. The fix commit made the better engineering choice.

### 4. `index.ts` has error handling not in plan
**Severity: Negligible (improvement)**

Plan specified bare 3-line entry point. Fix commit added try/catch with `console.error` + `process.exit(1)`. Standard practice for top-level async entry points. No downside.

### 5. DB provider log line removed without note
**Severity: Negligible**

The original `src/index.ts` logged `Database provider: ${process.env.DB_PROVIDER || 'local (auto)'}`. This was silently dropped. The analysis mentioned the original code "Calls `createDatabase()` directly" but neither analysis nor plan addressed preserving the diagnostic log. Minimal impact for an internal tool — Fastify's Pino logger covers startup information.

---

## Corrections Made

Fix commit `527b20c` applied three corrections after the initial implementation:

| Correction | File | What changed | Why |
|---|---|---|---|
| TypeBox response schema | `routes/health/index.ts` | Plain `FastifyInstance` handler -> `FastifyPluginAsyncTypebox` with `HealthResponse` schema | Satisfies "always define response schemas" constraint; enables `fast-json-stringify` |
| Memory DB path detection | `db/factory.ts` | Added `:memory:` check routing to `createMemoryDb()` | Eliminates unnecessary `mkdirSync('.')` and WAL pragma for in-memory DBs |
| Startup error handling | `src/index.ts` | Bare await -> try/catch with `console.error` + `process.exit(1)` | Graceful startup failure reporting instead of cryptic unhandled rejection |

All three corrections are improvements. None introduce regressions (43 tests still pass, `tsc --noEmit` clean).

---

## Final Alignment Verdict

**ALIGNED.** The implementation faithfully delivers all 6 deliverables from the analysis and plan. All 4 acceptance criteria are verified and passing. All 13 constraints from project CLAUDE.md files were honored (ESM/.js extensions, TDD workflow, app factory pattern, TypeBox provider, response schemas, fastify-plugin for infrastructure, correct registration order, DB as decorator, declaration merging, `app.inject()` testing, in-memory SQLite).

The 5 mismatches found are all Minor or Negligible severity:
- 1 legitimate analysis gap (vitest config) — caught and resolved during implementation
- 2 plan shortcomings (missing response schema, `:memory:` routing) — corrected in fix commit
- 2 negligible deviations (error handling addition, removed log line) — net positive

No Major or Critical mismatches. The fix commit brought the implementation closer to project conventions than the original plan specified. The codebase is in good shape: proper plugin architecture, testable factory, typed routes, 43 passing tests, clean TypeScript compilation.
