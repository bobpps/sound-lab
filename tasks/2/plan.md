# buildApp() Factory + DB Plugin + Autoload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the backend's monolithic `src/index.ts` into an app factory pattern with DB as a Fastify decorator and route autoloading, enabling `app.inject()` testing without a network port.

**Architecture:** `buildApp(opts?)` factory constructs a Fastify instance with TypeBox provider, registers infrastructure plugins (CORS, sensible, DB decorator), and autoloads routes from `src/routes/`. The DB plugin wraps the existing `createDatabase()` factory, decorates `fastify.db`, and cleans up on close. Entry point becomes a 3-line file that calls `buildApp()` + `listen()`.

**Tech Stack:** Fastify 5, `@fastify/autoload`, `@fastify/sensible`, `@sinclair/typebox` + `@fastify/type-provider-typebox`, `fastify-plugin`, Vitest, ESM with `.js` extensions.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/package.json` | Modify | Add 5 new dependencies |
| `backend/tests/helpers.ts` | Create | `buildTestApp()` — creates ready Fastify with in-memory SQLite |
| `backend/tests/routes/health.test.ts` | Create | Integration test for `GET /health` |
| `backend/src/plugins/db.ts` | Create | fastify-plugin: decorates `fastify.db`, onClose hook, declaration merging |
| `backend/src/routes/health/index.ts` | Create | `GET /health` handler (autoloaded) |
| `backend/src/app.ts` | Create | `buildApp(opts?)` factory — CORS, sensible, DB plugin, autoload |
| `backend/src/index.ts` | Modify | Thin entry: import buildApp, listen |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install production dependencies**

Run from **repo root** (npm workspaces):

```bash
npm install --workspace=backend @fastify/autoload @fastify/sensible @sinclair/typebox @fastify/type-provider-typebox fastify-plugin
```

- [ ] **Step 2: Verify installation**

```bash
cd backend && node -e "import('@fastify/autoload').then(() => console.log('ok'))"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add fastify autoload, sensible, typebox, fastify-plugin"
```

---

### Task 2: Write Test Helper and Health Route Test (RED)

**Files:**
- Create: `backend/tests/helpers.ts`
- Create: `backend/tests/routes/health.test.ts`

- [ ] **Step 1: Create `backend/tests/helpers.ts`**

This helper builds a fully configured Fastify app with in-memory SQLite for testing. It imports `buildApp` from the app factory (which does not exist yet — tests will fail).

```ts
import { buildApp } from '../src/app.js';

export async function buildTestApp() {
  const app = await buildApp({ testing: true });
  await app.ready();
  return app;
}
```

- [ ] **Step 2: Create `backend/tests/routes/health.test.ts`**

```ts
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 3: Run tests — verify RED**

```bash
cd backend && npx vitest run tests/routes/health.test.ts
```

Expected: FAIL — cannot resolve `../src/app.js` (module does not exist yet).

- [ ] **Step 4: Commit**

```bash
git add backend/tests/helpers.ts backend/tests/routes/health.test.ts
git commit -m "test: add buildTestApp helper and health route test (RED)"
```

---

### Task 3: Implement DB Plugin

**Files:**
- Create: `backend/src/plugins/db.ts`

- [ ] **Step 1: Create `backend/src/plugins/db.ts`**

This plugin wraps `createDatabase()` in a fastify-plugin so `fastify.db` is available globally. It uses declaration merging to type the decorator. In testing mode, it creates an in-memory SQLite DB.

```ts
import fp from 'fastify-plugin';
import { createDatabase } from '../db/factory.js';
import type { IDatabase } from '../db/interfaces.js';
import type { DbConfig } from '../db/config.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: IDatabase;
  }
}

export interface DbPluginOptions {
  testing?: boolean;
}

export default fp<DbPluginOptions>(
  async (fastify, opts) => {
    let config: DbConfig | undefined;

    if (opts.testing) {
      config = {
        provider: 'local',
        local: { path: ':memory:' },
        encryptionKey: 'test-encryption-key',
      };
    }

    const db = await createDatabase(config);
    fastify.decorate('db', db);

    fastify.addHook('onClose', async () => {
      await db.close();
    });
  },
  { name: 'db' },
);
```

Key details:
- `fp()` breaks encapsulation so `fastify.db` is visible to all routes.
- `{ name: 'db' }` allows other plugins to declare dependency on it via `dependencies: ['db']`.
- Without `opts.testing`, `config` is `undefined` and `createDatabase()` falls back to `loadDbConfig()` (reads env vars).
- `:memory:` path through `createLocalDb` works fine — `mkdirSync('.')` is a harmless no-op, and `better-sqlite3` creates an in-memory DB.

- [ ] **Step 2: Commit**

```bash
git add backend/src/plugins/db.ts
git commit -m "feat: DB decorator plugin with fastify-plugin"
```

---

### Task 4: Implement Health Route

**Files:**
- Create: `backend/src/routes/health/index.ts`

- [ ] **Step 1: Create `backend/src/routes/health/index.ts`**

Autoload maps the `health/` directory to route prefix `/health`. The handler registers on `/`, so the full path is `GET /health`.

```ts
import type { FastifyInstance } from 'fastify';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return { status: 'ok' };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/health/index.ts
git commit -m "feat: health route (autoloaded)"
```

---

### Task 5: Implement App Factory

**Files:**
- Create: `backend/src/app.ts`

- [ ] **Step 1: Create `backend/src/app.ts`**

The factory constructs a Fastify instance with all plugins registered but does NOT call `.listen()`. Registration order follows `backend/CLAUDE.md`: infrastructure plugins first (CORS, sensible, DB), then routes (autoload).

```ts
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import autoload from '@fastify/autoload';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import dbPlugin from './plugins/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  testing?: boolean;
}

export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: !opts.testing,
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  });

  await app.register(sensible);

  await app.register(dbPlugin, { testing: opts.testing });

  await app.register(autoload, {
    dir: join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
  });

  return app;
}
```

Key details:
- `.withTypeProvider<TypeBoxTypeProvider>()` enables type inference from TypeBox schemas in route handlers.
- `logger: !opts.testing` — silent in tests, pino in production.
- `CORS_ORIGIN` env var overrides the default `http://localhost:5173`.
- `autoload` with `dirNameRoutePrefix: true` maps `routes/health/index.ts` to `GET /health`.

- [ ] **Step 2: Run health route test — verify GREEN**

```bash
cd backend && npx vitest run tests/routes/health.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat: buildApp() factory with TypeBox, CORS, sensible, DB, autoload"
```

---

### Task 6: Slim Down Entry Point

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Rewrite `backend/src/index.ts`**

Replace the entire file with:

```ts
import { buildApp } from './app.js';

const app = await buildApp();

await app.listen({ port: 3000, host: '0.0.0.0' });
```

This is the complete file. Everything else (CORS, DB, health route, onClose hook) is now handled by `buildApp()` and its plugins.

- [ ] **Step 2: Verify the server starts**

```bash
cd backend && npx tsx src/index.ts &
sleep 2
curl http://localhost:3000/health
kill %1
```

Expected: `{"status":"ok"}` and no errors in logs.

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.ts
git commit -m "refactor: slim index.ts to buildApp() + listen()"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run ALL tests**

```bash
cd backend && npx vitest run
```

Expected: ALL tests pass — both the new health route test and all existing DB tests (44+ tests). The DB tests are unaffected because they never touch Fastify.

- [ ] **Step 2: Verify `app.db` decorator works in test context**

Add a quick smoke test to confirm the decorator is accessible. Append to `backend/tests/routes/health.test.ts`:

```ts
describe('app.db decorator', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes db with all repositories', () => {
    expect(app.db).toBeDefined();
    expect(app.db.dialogs).toBeDefined();
    expect(app.db.annotations).toBeDefined();
    expect(app.db.annotationPrompts).toBeDefined();
    expect(app.db.agentPrompts).toBeDefined();
    expect(app.db.providers).toBeDefined();
  });

  it('can call db methods through decorator', async () => {
    const dialogs = await app.db.dialogs.list();
    expect(dialogs).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the updated test file**

```bash
cd backend && npx vitest run tests/routes/health.test.ts
```

Expected: All 3 tests PASS (`returns 200 with status ok`, `exposes db with all repositories`, `can call db methods through decorator`).

- [ ] **Step 4: Run full test suite one final time**

```bash
cd backend && npx vitest run
```

Expected: ALL tests pass.

- [ ] **Step 5: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/routes/health.test.ts
git commit -m "test: add app.db decorator smoke tests"
```

---

## Acceptance Criteria Checklist

| Criterion | Verified In |
|---|---|
| `buildApp({ testing: true })` creates app with in-memory SQLite, no logger | Task 2 (buildTestApp), Task 5 (AppOptions) |
| `app.db.dialogs.list()` works via decorator | Task 7, Step 2 |
| `GET /health` returns 200 `{ status: 'ok' }` | Task 2 (test), Task 5 (green), Task 6 (curl) |
| All existing DB tests still pass | Task 7, Step 1 + Step 4 |
