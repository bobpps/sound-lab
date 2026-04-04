# Code Review: Issue #2 -- buildApp() factory + DB plugin + autoload

**Reviewer:** Claude Opus 4.6 (automated)
**Branch:** `feat/2-buildapp-factory` (9 commits, 14 files, +1131/-30 lines)
**Date:** 2026-04-04
**Review round:** 2 (post-fix)

---

## Diff Summary

Refactors the backend from a monolithic `src/index.ts` into a proper Fastify app factory pattern. The monolith (Fastify instance creation, CORS registration, DB init, health route, listen) is decomposed into:

- An app factory (`buildApp()`) that constructs a fully configured Fastify instance without calling `.listen()`
- A DB decorator plugin using `fastify-plugin` for global access
- An autoloaded health route via `@fastify/autoload` with TypeBox response schema
- A test helper (`buildTestApp()`) for `app.inject()` testing without a network port
- Proper error handling in the entry point

The entry point is now a clean try/catch block: import, build, listen.

## Files Changed

| File | Action | Lines | Purpose |
|---|---|---|---|
| `backend/package.json` | Modified | +8/-3 | 5 new deps: autoload, sensible, typebox, type-provider-typebox, fastify-plugin |
| `backend/src/app.ts` | **New** | +35 | `buildApp(opts?)` factory -- CORS, sensible, DB plugin, autoload |
| `backend/src/index.ts` | Modified | +9/-22 | Thin entry: buildApp, listen, try/catch error handling |
| `backend/src/plugins/db.ts` | **New** | +36 | DB decorator plugin with `fastify-plugin`, declaration merging, onClose hook |
| `backend/src/routes/health/index.ts` | **New** | +14 | `GET /health` autoloaded route with TypeBox response schema |
| `backend/src/db/factory.ts` | Modified | +6/-2 | `:memory:` path routed to `createMemoryDb()` instead of `createLocalDb()` |
| `backend/tests/helpers.ts` | **New** | +7 | `buildTestApp()` -- builds app with in-memory SQLite, calls `.ready()` |
| `backend/tests/routes/health.test.ts` | **New** | +50 | Health route integration test + DB decorator smoke tests |
| `backend/vitest.config.ts` | Modified | +6 | Added `pool: 'forks'` with tsx loader for autoload compatibility |
| `package-lock.json` | Modified | lockfile | Dependency resolution |
| `tasks/2/*.md` | **New** | task artifacts | Context, analysis, plan, execution log |

## Verification Outcomes

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | PASS |
| Build (`tsc` + vite) | PASS |
| Tests (43/43) | PASS |
| Lint | PASS |

## Previous Review Issues -- Resolution Status

### ARCH-1: DB plugin now uses createMemoryDb() via factory -- FIXED

**Before:** `createDatabase()` with `path: ':memory:'` called `createLocalDb(':memory:')`, which unnecessarily ran `mkdirSync(dirname(':memory:'))` (resolved to `mkdirSync('.')` -- harmless no-op) and set `pragma('journal_mode = WAL')` (meaningless for in-memory DB).

**After:** `factory.ts` now checks `cfg.local!.path === ':memory:'` and branches to `createMemoryDb()` which skips both `mkdirSync` and WAL. The conditional is clean:
```typescript
const sqliteDb = cfg.local!.path === ':memory:'
  ? createMemoryDb()
  : createLocalDb(cfg.local!.path);
```

**Verdict:** Properly fixed. The factory correctly dispatches to the purpose-built function.

### ARCH-2: Health route now has TypeBox response schema -- FIXED

**Before:** `fastify.get('/', async () => { return { status: 'ok' }; })` -- no schema.

**After:** Defines `HealthResponse = Type.Object({ status: Type.Literal('ok') })` and passes it as `schema: { response: { 200: HealthResponse } }`. This enables `fast-json-stringify` and prevents accidental data leaks, per `backend/CLAUDE.md` guidelines.

**Verdict:** Properly fixed. The `Type.Literal('ok')` is a precise choice -- it constrains the response to exactly `"ok"`, not any arbitrary string.

### ARCH-3: Route function uses FastifyPluginAsyncTypebox -- FIXED

**Before:** `export default async function healthRoutes(fastify: FastifyInstance)` -- generic Fastify typing, no TypeBox inference.

**After:** `const healthRoutes: FastifyPluginAsyncTypebox = async (fastify) => { ... }` -- typed as TypeBox plugin, enabling automatic type inference from TypeBox schemas in handlers.

**Verdict:** Properly fixed. The `as const` assertion on `'ok'` ensures TypeScript narrows the return type to match the `Type.Literal('ok')` schema.

### PAT-1: index.ts now has try/catch error handling -- FIXED

**Before:** Bare top-level `await` with no error handling. An unhandled rejection during startup would produce an opaque crash.

**After:** Wrapped in `try/catch` with `console.error('Failed to start server:', err)` and `process.exit(1)`.

**Verdict:** Properly fixed. Uses `console.error` rather than Pino because the logger is attached to the Fastify instance which may not yet exist when the error occurs. `process.exit(1)` signals failure to process managers.

## Detailed Review of Current State

### `backend/src/app.ts` -- buildApp() factory

**Correctness: GOOD.** Follows the prescribed pattern from `backend/CLAUDE.md`: separate construction from `.listen()`, register infrastructure plugins first (CORS, sensible, DB), then routes (autoload). Registration order is correct.

- TypeBox provider correctly applied via `.withTypeProvider<TypeBoxTypeProvider>()`
- ESM compliance: all imports use `.js` extensions, `__dirname` derived from `import.meta.url`
- CORS defaults to `http://localhost:5173` with `CORS_ORIGIN` env override (improvement over original hardcoded origin)
- Logger: `!opts.testing` -- silent in tests, Pino in production

### `backend/src/plugins/db.ts` -- DB decorator plugin

**Correctness: GOOD.** Uses `fastify-plugin` to break encapsulation, making `fastify.db` globally available. Declaration merging properly extends `FastifyInstance`. `onClose` hook handles cleanup.

Testing mode constructs a `DbConfig` with `path: ':memory:'` and a hardcoded test encryption key, which now correctly routes through `createMemoryDb()` in the factory.

### `backend/src/routes/health/index.ts` -- Health route

**Correctness: GOOD.** Clean autoloaded route with proper TypeBox typing. `dirNameRoutePrefix: true` maps `routes/health/index.ts` to `GET /health`. Response schema enables serialization optimization.

### `backend/tests/routes/health.test.ts` -- Tests

**Correctness: GOOD.** Three test cases:
1. `GET /health` returns 200 with `{ status: 'ok' }` -- validates autoloaded route
2. DB decorator exposes all 5 repositories -- validates plugin registration
3. DB methods callable through decorator -- validates end-to-end with `dialogs.list()`

Proper `beforeEach`/`afterEach` with `buildTestApp()` and `app.close()`. Each test gets its own in-memory SQLite instance.

### `backend/vitest.config.ts` -- Vitest configuration

**Correctness: GOOD.** `pool: 'forks'` with `execArgv: ['--import', 'tsx']` is necessary for `@fastify/autoload`'s dynamic `import()` to resolve `.ts` route files in test mode.

## Issues Found

### Fundamental

None.

### Major

None.

### Minor

1. **Hardcoded port in entry point** (`index.ts:5`)

   The port `3000` is hardcoded. Consider `parseInt(process.env.PORT || '3000', 10)` for consistency with how CORS origin reads from env. Low priority for an internal tool at this stage.

2. **Single test file for two concerns** (`tests/routes/health.test.ts`)

   The health route response test and the DB decorator smoke tests share a file. This is acceptable now, but should be split if decorator tests grow beyond the current 2 cases.

3. **`IDatabase` type import in db.ts** (`plugins/db.ts:3`)

   `import type { IDatabase }` is used only in the `declare module` block. This is correct TypeScript (`import type` has zero runtime cost), and purely a style note -- no action needed.

## Known Limitations

1. **Autoload with TypeScript in production** -- When running compiled output (`dist/`), autoload looks for `.js` files in `dist/routes/`. This works because `tsc` compiles `.ts` to `.js` preserving directory structure. Verified by build passing.

2. **No graceful shutdown handling** -- No `SIGTERM`/`SIGINT` signal handler calling `app.close()`. The `onClose` hook handles DB cleanup when `app.close()` is called, but nothing triggers it on process signals. Pre-existing gap, out of scope for this task.

3. **No request schema on health route** -- Only response schema is defined. For a GET endpoint with no parameters this is correct; noted only for completeness when establishing patterns for future routes.

## PR Readiness

**READY TO MERGE.**

All 4 Major issues from the previous review round have been properly resolved:
- Factory correctly dispatches `:memory:` to `createMemoryDb()`
- Health route has TypeBox response schema with `Type.Literal('ok')`
- Route plugin is typed as `FastifyPluginAsyncTypebox`
- Entry point has structured error handling

No new Major or Fundamental issues introduced by the fixes. The 3 remaining Minor items are non-blocking style/future-proofing notes. The implementation is clean, follows all `CLAUDE.md` conventions (both root and backend), has proper test coverage (43/43 passing), and builds successfully.

The commit history shows a clear TDD progression with a well-documented fix commit addressing all review feedback.
