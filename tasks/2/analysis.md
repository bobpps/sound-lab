# Analysis: Issue #2 — buildApp() factory + DB plugin + autoload

## What the Task Requires (Detailed)

Refactor the backend's monolithic `src/index.ts` into a proper Fastify app factory pattern. This involves:

1. **App factory (`src/app.ts`)** — Export a `buildApp(opts)` function that constructs and returns a fully configured Fastify instance *without* calling `.listen()`. The factory must:
   - Accept an `AppOptions` object with at least `{ testing?: boolean }`
   - Use `TypeBoxTypeProvider` for automatic TypeScript type inference from schemas
   - Register `@fastify/cors` (origin from env or default `http://localhost:5173`)
   - Register `@fastify/sensible` (provides `httpErrors.*` helpers)
   - Register the DB plugin (see below), passing `testing` flag
   - Register `@fastify/autoload` pointed at `src/routes/` with directory-name-based prefixes
   - When `testing: true`: disable logger, use in-memory SQLite

2. **DB plugin (`src/plugins/db.ts`)** — A `fastify-plugin`-wrapped plugin that:
   - Calls `createDatabase()` from the existing factory
   - Decorates the Fastify instance with `fastify.db` (type: `IDatabase`)
   - Registers an `onClose` hook that calls `db.close()`
   - Includes TypeScript declaration merging so `fastify.db` is typed everywhere
   - In testing mode, passes a config that creates an in-memory SQLite DB

3. **Health route (`src/routes/health/index.ts`)** — A simple autoloaded route:
   - `GET /health` returns `{ status: 'ok' }` with 200
   - Autoload maps directory `health/` to prefix `/health`, so the handler registers on `/`

4. **Test helper (`tests/helpers.ts`)** — Export `buildTestApp()`:
   - Calls `buildApp({ testing: true })`
   - Calls `app.ready()` to complete initialization
   - Returns the ready Fastify instance for `app.inject()` testing

5. **Entry point (`src/index.ts`)** — Slim down to:
   - Import `buildApp` from `./app.js`
   - Call `buildApp()` + `app.listen({ port: 3000, host: '0.0.0.0' })`

6. **Dependencies** — Install: `@fastify/autoload`, `@fastify/sensible`, `@sinclair/typebox`, `@fastify/type-provider-typebox`, `fastify-plugin`

## Constraints from Project Guidance

| Source | Constraint |
|---|---|
| Root `CLAUDE.md` | ESM everywhere; `.js` extensions in all import paths |
| Root `CLAUDE.md` | TDD by default: write tests first, then implement (Red -> Green -> Refactor) |
| `backend/CLAUDE.md` | App factory pattern: separate construction from `.listen()` |
| `backend/CLAUDE.md` | TypeBox as single source of truth for schemas |
| `backend/CLAUDE.md` | Always define response schemas (enables `fast-json-stringify`) |
| `backend/CLAUDE.md` | Use `fastify-plugin` (fp) only for global infrastructure (DB, auth, config) |
| `backend/CLAUDE.md` | Registration order: schemas -> infrastructure plugins (DB) -> routes |
| `backend/CLAUDE.md` | DB as decorator: `fastify.decorate('db', db)`, `onClose` hook |
| `backend/CLAUDE.md` | Declaration merging for decorator types |
| `backend/CLAUDE.md` | Route tests: `app.inject()` — no network. `app.ready()` before, `app.close()` after |
| `backend/CLAUDE.md` | Integration tests use in-memory SQLite |
| `backend/tsconfig.json` | `moduleResolution: "bundler"`, `target: ES2022`, `module: ESNext` |

## Key Files and Their Current State

### `backend/src/index.ts` (to modify)
Currently a monolithic entry point that:
- Creates Fastify instance with logger
- Registers CORS
- Calls `createDatabase()` directly (no plugin)
- Adds `onClose` hook for DB cleanup inline
- Defines `GET /health` route inline
- Calls `app.listen()` directly

This will be stripped to just `buildApp()` + `listen()`.

### `backend/src/db/factory.ts` (read-only, no changes needed)
The `createDatabase(config?: DbConfig)` function:
- Accepts optional `DbConfig` (provider, local/supabase options, encryptionKey)
- Without config, calls `loadDbConfig()` which reads env vars
- For `local` provider: uses `createLocalDb(path)` which calls `mkdirSync` + opens DB + runs migrations
- For `supabase` provider: creates Supabase client with dynamic imports
- Returns `IDatabase` with all repository instances + `close()`

### `backend/src/db/local/client.ts` (read-only)
- `createLocalDb(dbPath)`: file-based SQLite, creates directories, sets WAL mode, runs migrations
- `createMemoryDb()`: in-memory SQLite, sets foreign_keys, runs migrations
- Migrations loaded from `migrations/001_initial.sql` relative to module

### `backend/src/db/interfaces.ts` (read-only)
Defines `IDatabase` with sub-repositories: `dialogs`, `annotations`, `annotationPrompts`, `agentPrompts`, `providers`, and `close()`.

### `backend/src/db/config.ts` (read-only)
`DbConfig` type and `loadDbConfig()` which reads env vars.

### `backend/tests/db/test-helpers.ts` (read-only)
Exports `createTestDb()` which calls `createMemoryDb()` and returns a raw `better-sqlite3` `Database.Database` instance. Used by all 5+ existing test files. These tests work at the repository level (not through Fastify) and will be unaffected.

### `backend/package.json` (to modify)
Currently has: `fastify ^5.0.0`, `@fastify/cors ^10.0.0`, `better-sqlite3 ^11.0.0`, `@supabase/supabase-js ^2.0.0`. Missing: `@fastify/autoload`, `@fastify/sensible`, `@sinclair/typebox`, `@fastify/type-provider-typebox`, `fastify-plugin`.

### `backend/vitest.config.ts` (no changes needed)
Simple config with `globals: true`.

### `backend/tsconfig.json` (no changes needed)
Uses `moduleResolution: "bundler"`, `rootDir: "src"`, `include: ["src"]`. Note: test files are NOT in `include`, which is typical since vitest uses its own compilation.

## Risks and Mitigation

### Risk 1: `:memory:` path through `createLocalDb`
**Issue:** The DB plugin passes `{ provider: 'local', local: { path: ':memory:' }, encryptionKey: 'test-key' }` to `createDatabase()`. This routes to `createLocalDb(':memory:')` which calls `mkdirSync(dirname(':memory:'))`. On most systems, `dirname(':memory:')` returns `.` (current directory), which exists, so `mkdirSync` with `{ recursive: true }` is a no-op.
**Mitigation:** This works because `better-sqlite3` accepts `:memory:` as a valid path. The `mkdirSync('.')` call is harmless. However, the dedicated `createMemoryDb()` exists and skips the unnecessary `mkdirSync` and WAL pragma. If issues arise, the plugin could be modified to call `createMemoryDb()` directly, but the factory approach keeps things cleaner and more consistent.
**Verdict:** Low risk, proceed with factory approach as specified in the plan.

### Risk 2: Autoload `__dirname` resolution
**Issue:** The autoload plugin needs `dir: join(__dirname, 'routes')` which requires computing `__dirname` from `import.meta.url` since this is ESM.
**Mitigation:** Standard ESM pattern: `const __dirname = dirname(fileURLToPath(import.meta.url))`. This is well-established and used in the existing `db/local/client.ts`.

### Risk 3: Existing DB tests compatibility
**Issue:** The existing tests in `backend/tests/db/*.test.ts` import directly from `../../src/db/local/*.js` and use `createTestDb()` from `./test-helpers.js`. None of them use Fastify at all.
**Mitigation:** These tests are completely independent of the app factory. No changes needed. They will continue to pass as-is. This is verified by examining the test files: they create their own DB instances directly.
**Verdict:** No risk.

### Risk 4: `fastify-plugin` (fp) and encapsulation
**Issue:** The DB plugin must be visible to all routes (not encapsulated). Without `fastify-plugin`, decorators are scoped to the plugin's encapsulation context.
**Mitigation:** Wrapping in `fp()` breaks encapsulation by design, making `fastify.db` available globally. This is exactly what `backend/CLAUDE.md` prescribes for infrastructure plugins.

### Risk 5: Declaration merging and TypeScript compilation
**Issue:** The `declare module 'fastify'` block in `src/plugins/db.ts` must be visible to route files for `fastify.db` to be typed. Since `tsconfig.json` has `include: ["src"]` and the plugin is under `src/plugins/`, this works.
**Mitigation:** Standard Fastify pattern. The declaration merging in `plugins/db.ts` is automatically picked up since it's within the `src/` include path.

### Risk 6: Autoload route prefix mapping
**Issue:** `@fastify/autoload` with `dirNameRoutePrefix: true` maps `routes/health/index.ts` to prefix `/health`. The route inside registers on `/`, so the full path becomes `GET /health`.
**Mitigation:** This is the standard autoload pattern. Verified against Fastify documentation conventions.

## Assumptions

1. **Fastify 5 compatibility:** All new dependencies (`@fastify/autoload`, `@fastify/sensible`, `@fastify/type-provider-typebox`, `fastify-plugin`) have Fastify 5-compatible versions available on npm. The existing `@fastify/cors ^10.0.0` confirms Fastify 5 ecosystem usage.

2. **TypeBox standalone:** `@sinclair/typebox` is installed separately from `@fastify/type-provider-typebox`. The type provider is the bridge between Fastify's schema system and TypeBox.

3. **No breaking changes to DB layer:** The factory approach simply wraps the existing `createDatabase()` call in a plugin. The DB interface (`IDatabase`) and all implementations remain unchanged.

4. **Test isolation:** Each test calling `buildTestApp()` gets its own in-memory SQLite DB. Since `createDatabase()` creates a new DB instance each time, there's no shared state between tests.

5. **CORS origin default:** `http://localhost:5173` is the Vite dev server default. The plan uses `process.env.CORS_ORIGIN` as an override, falling back to this default.

6. **`autoload` handles ESM route imports:** `@fastify/autoload` can load `.ts` files via `tsx` in dev mode and `.js` files from `dist/` in production. The `tsx` runtime handles the `.js` extension mapping to `.ts` files.

## Unknowns Resolved

| Unknown | Resolution |
|---|---|
| Does `createLocalDb(':memory:')` work? | Yes. `better-sqlite3` accepts `:memory:` as path. `mkdirSync('.')` is harmless. |
| Are existing DB tests affected? | No. They operate at repository level, never touch Fastify. |
| Does autoload work with `tsx` (dev)? | Yes. `tsx` patches Node's module loader; autoload uses dynamic `import()` which goes through the same loader. |
| Is `@fastify/autoload` compatible with Fastify 5? | Yes. The `@fastify/autoload` package follows Fastify major versions. Current versions support v5. |
| Where does `__dirname` come from in ESM? | Computed from `import.meta.url` using `fileURLToPath` + `dirname`. Already used in `db/local/client.ts`. |
| Does declaration merging work across files? | Yes, as long as the file with `declare module 'fastify'` is within `tsconfig.json` `include` paths. `src/plugins/db.ts` qualifies. |
| What registration order is needed? | Schemas first (none yet), then infrastructure plugins (DB), then routes (autoload). The plan's order in `buildApp()` is correct: cors -> sensible -> db plugin -> autoload. |

## Implementation Sequence (TDD)

Per project rules (TDD by default), the implementation order is:

1. Install dependencies (modify `package.json`)
2. Write `tests/helpers.ts` with `buildTestApp()`
3. Write `tests/routes/health.test.ts` (RED)
4. Run tests -- confirm failure
5. Create `src/plugins/db.ts` (DB decorator plugin)
6. Create `src/routes/health/index.ts` (health route)
7. Create `src/app.ts` (app factory)
8. Rewrite `src/index.ts` (thin entry)
9. Run all tests -- confirm GREEN
10. Commit
