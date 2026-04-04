# Code Review: feat/2-buildapp-factory (post-fix)

## Previously reported Major issues — status

### [ARCH-1] DB factory `:memory:` path — RESOLVED
**File:** `backend/src/db/factory.ts:32-34`
**What was wrong:** `createDatabase()` always called `createLocalDb()` even for `:memory:` path, bypassing the dedicated `createMemoryDb()`.
**Current state:** Fixed. The factory now checks `cfg.local!.path === ':memory:'` and branches to `createMemoryDb()` vs `createLocalDb()`. The `:memory:` path no longer goes through `mkdirSync('.')` or sets `WAL` journal mode. Clean fix, no complaints.

### [ARCH-2] Health route missing response schema — RESOLVED
**File:** `backend/src/routes/health/index.ts:4-6`
**What was wrong:** No TypeBox response schema on the health route, violating `backend/CLAUDE.md` rule "Always define response schemas".
**Current state:** Fixed. `HealthResponse = Type.Object({ status: Type.Literal('ok') })` is defined and wired into `schema: { response: { 200: HealthResponse } }`. `fast-json-stringify` will kick in. `Type.Literal('ok')` is the right choice — tighter than `Type.String()`.

### [ARCH-3] Route typed as plain `FastifyInstance` — TypeBox provider lost — RESOLVED
**File:** `backend/src/routes/health/index.ts:2,8`
**What was wrong:** Route function typed as `FastifyInstance`, losing TypeBox type inference.
**Current state:** Fixed. The route is now typed as `FastifyPluginAsyncTypebox`, which carries the TypeBox type provider through to the handler. The `fastify` parameter inside the arrow function will have full TypeBox inference. Correct pattern.

### [PAT-1] `index.ts` top-level await without error handling — RESOLVED
**File:** `backend/src/index.ts:3-8`
**What was wrong:** Bare `await` calls with no `try/catch`, meaning startup failures would produce unhandled rejections.
**Current state:** Fixed. Wrapped in `try/catch` with `console.error` and `process.exit(1)`. This is the minimal correct pattern for a top-level entry point.

---

## Remaining issues from previous review (not part of the 4 Major fixes)

These were classified as Minor in the first review and remain unfixed. Re-listing for completeness with updated assessment.

### [ABS-1] `AppOptions` is anemic — only carries `testing?: boolean`
**Severity: Minor**
**File:** `backend/src/app.ts:12-14`
**What's wrong:** A single boolean controls both logging suppression and DB mode switching. Two unrelated concerns tied to one flag.
**Why it's bad:** Cannot enable logging in tests without modifying `buildApp` internals. Acceptable for now — there is only one consumer (`buildTestApp`) — but this will need splitting the moment a second configuration axis appears.

### [ABS-2] `DbPluginOptions` duplicates the concept in `DbConfig`
**Severity: Minor**
**File:** `backend/src/plugins/db.ts:12-14`
**What's wrong:** The plugin accepts `testing?: boolean` and internally constructs a `DbConfig`. It could accept an optional `DbConfig` directly, eliminating the translation layer.
**Why it's bad:** Two indirection layers for the same decision. Not urgent — the internal `DbConfig` construction is correct and legible — but it becomes a problem when someone needs a non-standard test configuration (e.g., file-backed SQLite for debugging).

### [PAT-2] Port and host are hardcoded
**Severity: Minor**
**File:** `backend/src/index.ts:5`
**What's wrong:** `port: 3000, host: '0.0.0.0'` are literals with no `process.env` fallback.
**Why it's bad:** Not a regression (old code did the same), but the refactoring was the opportunity to fix it. Will bite on deployment.

### [PAT-3] CORS origin fallback
**Severity: Minor**
**File:** `backend/src/app.ts:22`
**What's wrong:** `process.env.CORS_ORIGIN || 'http://localhost:5173'` — if unset in production, only localhost:5173 is allowed.
**Why it's bad:** Latent production bug. Technically an improvement over old code (which had no env var at all). Acceptable for local-first tool.

### [QUAL-1] `vitest.config.ts` — `pool: 'forks'` workaround undocumented
**Severity: Minor**
**File:** `backend/vitest.config.ts:5-10`
**What's wrong:** `pool: 'forks'` with `--import tsx` in `execArgv` is a workaround for native ESM + TypeScript interop. No inline comment explaining why.
**Why it's bad:** Next developer will waste time figuring out if it can be removed. A one-line comment would suffice.

### [QUAL-2] Test file mixes route and plugin tests
**Severity: Minor**
**File:** `backend/tests/routes/health.test.ts:26-50`
**What's wrong:** `app.db decorator` describe block lives in a route test file. Testing infrastructure plugin in a route file.
**Why it's bad:** Wrong locality — DB plugin changes should not require touching health route tests. When more route tests are added, the DB assertions will be noise. Should live in `tests/plugins/db.test.ts`.

### [TEST-1] No isolated unit test for the DB plugin
**Severity: Minor**
**File:** `backend/tests/routes/health.test.ts:26-50`
**What's wrong:** DB decorator tests are smoke-level checks (is it defined? does list return []?). No test for `onClose` hook cleanup, no test for `createDatabase` failure handling, no test for production config resolution path.
**Why it's bad:** The DB plugin is a critical infrastructure component with exactly two smoke assertions and zero edge case coverage. Acceptable as initial scaffolding, but should not stay this way once real routes depend on the decorator.

---

## New issues found in this review

### [PAT-4] `index.ts` error handler uses `console.error` instead of Pino logger
**Severity: Minor**
**File:** `backend/src/index.ts:7`
**What's wrong:** The `catch` block does `console.error('Failed to start server:', err)`. At this point `app` may or may not exist (if `buildApp()` itself threw, `app` is undefined). But when `app.listen()` fails, `app` exists with a configured Pino logger. The error is written to stderr via `console.error` instead of the structured Pino logger.
**Why it's bad:** In a setup where logs are collected as JSON (production with Pino), this startup failure will appear as unstructured text in stderr, invisible to log aggregation. The previous review mentioned "A `try/catch` with `app.log.error(err)` and `process.exit(1)` is the Fastify convention." The fix addresses the `try/catch` part but uses `console.error` instead of `app.log.error`. This is a defensible tradeoff (since `app` may not exist in the error path), but worth noting.

---

## Summary

- **Fundamental issues:** 0
- **Major issues:** 0 (all 4 previously-Major issues are resolved)
- **Minor issues:** 8 (7 carried from previous review, 1 new)

**Overall assessment:** All four Major issues from the previous review are cleanly fixed. The factory correctly routes `:memory:` to `createMemoryDb()`, the health route has a TypeBox response schema with `FastifyPluginAsyncTypebox` typing, and the entry point has error handling. The remaining 8 Minor issues are real but none of them are blockers — they are debt to address in subsequent PRs. The code is in a mergeable state.
