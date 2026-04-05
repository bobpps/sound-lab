# Analysis: Issue #7 — Agent Prompts CRUD Routes

## What the Task Requires

Create a complete REST API for agent prompt management. This is a standard CRUD (Create, Read, Update, Delete) route module for the `AgentPrompt` entity. The task produces two files:

1. **`backend/src/routes/agent-prompts/index.ts`** — Fastify route plugin with 5 endpoints
2. **`backend/tests/routes/agent-prompts.test.ts`** — Integration tests using `app.inject()`

### Endpoints

| Method | URL | Response | Status |
|--------|-----|----------|--------|
| GET | `/agent-prompts` | `AgentPrompt[]` | 200 |
| GET | `/agent-prompts/:id` | `AgentPrompt` | 200 / 404 |
| POST | `/agent-prompts` | `AgentPrompt` | 201 |
| PUT | `/agent-prompts/:id` | `AgentPrompt` | 200 / 404 |
| DELETE | `/agent-prompts/:id` | (empty) | 204 / 404 |

---

## Constraints from Project Guidance

1. **ESM everywhere** — `"type": "module"` in package.json, all imports must use `.js` extensions (e.g., `'../../schemas/prompt.js'`)
2. **Dual-DB contract** — Routes interact only with `IDatabase` interface via `fastify.db.agentPrompts.*`. Never import DB implementations directly.
3. **TypeBox as single source of truth** — Schemas from `backend/src/schemas/prompt.ts` provide both JSON Schema (validation/serialization) and TypeScript types. Response schemas must be defined for `fast-json-stringify` optimization.
4. **`@fastify/autoload`** — Directory name `agent-prompts` becomes the route prefix automatically. No manual registration needed.
5. **`@fastify/sensible`** — Use `reply.notFound()` for 404 errors (provided by the sensible plugin).
6. **TDD workflow** — Write tests first (RED), then implement (GREEN).
7. **Vitest with `globals: true`** — Test globals (`describe`, `it`, `expect`, `beforeEach`, `afterEach`) are available without import.
8. **Testing via `app.inject()`** — No real HTTP server needed. Use `buildTestApp()` from `backend/tests/helpers.ts`.
9. **No `console.log`** — ESLint rule `no-console: warn`.
10. **`created_by` is server-assigned** — Not in request body schemas; set to `null` when not provided from auth context (auth not yet implemented).

---

## Key Files and Systems

### Existing Files (in worktree)

| File | Role | Key Content |
|------|------|-------------|
| `backend/src/schemas/prompt.ts` | TypeBox schemas for prompts | `AgentPrompt`, `CreateAgentPrompt`, `UpdateAgentPrompt` (lines 30-55) |
| `backend/src/schemas/common.ts` | Shared schemas | `IdParam` (integer ID param), `ErrorResponse` |
| `backend/src/db/interfaces.ts` | Repository interfaces | `IAgentPromptRepository` (lines 41-47), `IDatabase.agentPrompts` (line 63) |
| `backend/src/db/types.ts` | Domain types | `AgentPrompt`, `CreateAgentPrompt`, `UpdateAgentPrompt` (lines 139-164) |
| `backend/src/db/local/prompts.ts` | SQLite implementation | `LocalAgentPromptRepository` (lines 44-78) |
| `backend/src/db/factory.ts` | DB factory | Wires `agentPrompts` repo in both SQLite and Supabase paths |
| `backend/src/app.ts` | App factory | `buildApp()` with autoload from `src/routes/` |
| `backend/src/plugins/db.ts` | DB decorator plugin | Exposes `fastify.db` with all repos |
| `backend/src/routes/health/index.ts` | Reference route | Shows plugin export pattern (`FastifyPluginAsyncTypebox`) |
| `backend/tests/helpers.ts` | Test helper | `buildTestApp()` — builds app with in-memory SQLite |
| `backend/tests/routes/health.test.ts` | Reference test | Shows `app.inject()` + `beforeEach`/`afterEach` pattern |
| `backend/tests/db/prompts.test.ts` | DB-level tests | Shows `AgentPrompt` test data patterns (lines 55-94) |

### Files to Create

| File | Role |
|------|------|
| `backend/src/routes/agent-prompts/index.ts` | Route plugin |
| `backend/tests/routes/agent-prompts.test.ts` | Integration tests |

---

## The Exact Pattern to Follow

There is NO existing annotation-prompts route to copy from (Task 5 from the project plan has not been implemented yet). However, the pattern is clearly defined by:

1. The **providers route** code in the project plan (lines 789-887)
2. The **health route** already in the codebase
3. The project plan's description of Tasks 5 and 6

The agent-prompts route is structurally simpler than providers (no query filter, no key management, numeric IDs instead of string IDs).

### Route Plugin Pattern

```typescript
// backend/src/routes/agent-prompts/index.ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import * as S from '../../schemas/prompt.js';
import { IdParam, ErrorResponse } from '../../schemas/common.js';

const agentPromptRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // GET /agent-prompts — list all
  // GET /agent-prompts/:id — get by ID, 404 if not found
  // POST /agent-prompts — create, return 201
  // PUT /agent-prompts/:id — update, 404 if not found
  // DELETE /agent-prompts/:id — delete, 404 if not found, 204 on success
};

export default agentPromptRoutes;
```

Key implementation details per endpoint:

- **GET /**: `fastify.db.agentPrompts.list()`, response schema `Type.Array(S.AgentPrompt)`
- **GET /:id**: `fastify.db.agentPrompts.getById(id)`, check null -> `reply.notFound()`, response schema `S.AgentPrompt` + 404 `ErrorResponse`
- **POST /**: `fastify.db.agentPrompts.create(req.body)`, body schema `S.CreateAgentPrompt`, response 201 `S.AgentPrompt`
- **PUT /:id**: Check exists first -> `reply.notFound()`, then `fastify.db.agentPrompts.update(id, req.body)`, body schema `S.UpdateAgentPrompt`, response `S.AgentPrompt` + 404 `ErrorResponse`
- **DELETE /:id**: Check exists first -> `reply.notFound()`, then `fastify.db.agentPrompts.delete(id)`, response 204 `Type.Null()` + 404 `ErrorResponse`

### Test Pattern

```typescript
// backend/tests/routes/agent-prompts.test.ts
import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

describe('Agent prompt routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // describe blocks for each endpoint...
});
```

Test cases to cover:
- **GET /agent-prompts**: empty list, list with data
- **GET /agent-prompts/:id**: found, not found (404)
- **POST /agent-prompts**: valid creation (201), missing required fields (400)
- **PUT /agent-prompts/:id**: valid update (partial fields), not found (404)
- **DELETE /agent-prompts/:id**: successful delete (204), not found (404)

Seed data pattern (from DB tests): `{ title: 'Support Agent', provider_id: 'openai', language: 'en-US', prompt: 'You are a helpful support agent...' }`

---

## AgentPrompt Type Definition

### Domain Type (`db/types.ts` lines 139-164)

```typescript
interface AgentPrompt {
  id: number;
  title: string;
  provider_id: string;
  language: string;       // BCP 47 language code
  prompt: string;
  created_by: string | null;
  created_at: string;     // ISO timestamp
}

interface CreateAgentPrompt {
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by?: string;    // optional, server-assigned
}

interface UpdateAgentPrompt {
  title?: string;
  provider_id?: string;
  language?: string;
  prompt?: string;
}
```

### TypeBox Schema (`schemas/prompt.ts` lines 30-55)

```typescript
// Response schema — all fields
const AgentPrompt = Type.Object({
  id: Type.Integer(),
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});

// Create body — no id, created_by, created_at
const CreateAgentPrompt = Type.Object({
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
});

// Update body — all fields optional
const UpdateAgentPrompt = Type.Object({
  title: Type.Optional(Type.String()),
  provider_id: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
});
```

The AgentPrompt type is structurally identical to AnnotationPrompt — same fields, same create/update shapes.

---

## Repository Interface Methods

From `backend/src/db/interfaces.ts` lines 41-47:

```typescript
interface IAgentPromptRepository {
  list(): Promise<AgentPrompt[]>;
  getById(id: number): Promise<AgentPrompt | null>;
  create(data: CreateAgentPrompt): Promise<AgentPrompt>;
  update(id: number, data: UpdateAgentPrompt): Promise<AgentPrompt>;
  delete(id: number): Promise<void>;
}
```

Accessed via `fastify.db.agentPrompts` (decorator on FastifyInstance).

Behavior notes from `backend/CLAUDE.md`:
- `getById` returns `null` when not found (not an error)
- `update` throws `Error('AgentPrompt ${id} not found')` when not found (confirmed in `db/local/prompts.ts` line 65)
- `delete` is silent when ID doesn't exist (no error thrown — confirmed in `db/local/prompts.ts` line 75)

**Important for route implementation:** For PUT and DELETE, the route should check existence with `getById` first, and return 404 via `reply.notFound()` if not found. This avoids relying on the DB throwing (which is inconsistent between `update` throwing and `delete` being silent).

---

## How Route Registration Works

From `backend/src/app.ts`:

```typescript
await app.register(autoload, {
  dir: join(__dirname, 'routes'),
  dirNameRoutePrefix: true,
});
```

`@fastify/autoload` scans `src/routes/` recursively. Each subdirectory name becomes the URL prefix:
- `routes/health/index.ts` -> `GET /health`
- `routes/agent-prompts/index.ts` -> `GET /agent-prompts`, `POST /agent-prompts`, etc.

The route file must `export default` a Fastify plugin function. No manual registration in `app.ts` needed.

---

## Risks and Assumptions

### Risks

1. **No annotation-prompts reference implementation exists** — Task 5 (annotation prompts CRUD) has NOT been implemented yet. The agent-prompts route will be the first prompt CRUD route. This means we cannot copy from an existing route file; we must derive the pattern from the providers route in the plan + the health route + the project conventions.

2. **`as any` casts in the plan's provider route** — The plan's provider route code uses `req.body as any` and `req.params as { id: string }`. With `FastifyPluginAsyncTypebox` and proper schema definitions, TypeBox should provide type inference, potentially making these casts unnecessary. However, following the established pattern (plan code) is safer than deviating.

3. **Empty body on PUT** — The `UpdateAgentPrompt` schema has all fields optional. An empty `{}` body is technically valid and would result in a no-op update. This is acceptable behavior (matches the provider pattern).

### Assumptions

1. **No authentication yet** — `created_by` will be `null` for all created prompts. No auth middleware exists.
2. **No provider_id validation** — The route does not validate that `provider_id` references an existing provider. This matches the DB layer behavior (no FK enforcement in the prompts table based on the SQL schema).
3. **The test DB is fresh per test** — `buildTestApp()` creates an in-memory SQLite DB with migrations run, so each test starts with empty tables.
4. **Integer IDs** — Agent prompts use auto-increment integer IDs (unlike providers which use string natural keys). Use `IdParam` from `common.ts`.

### Unknowns Resolved

1. **Q: Is there a reference annotation-prompts route to copy?** A: No. The annotation-prompts route (Task 5) has not been implemented. We derive the pattern from the providers route example in the plan, the health route, and project conventions.

2. **Q: What type to use for the plugin export?** A: `FastifyPluginAsyncTypebox` (imported from `@fastify/type-provider-typebox`), as used in the health route. This provides TypeBox type inference in handlers.

3. **Q: Does DELETE need to check existence first?** A: Yes. The DB `delete` method is silent on missing IDs, but the API should return 404. Check with `getById` first, consistent with the providers route pattern in the plan.

4. **Q: Schema naming — are AgentPrompt schemas in prompt.ts or a separate file?** A: They are in `backend/src/schemas/prompt.ts` alongside AnnotationPrompt schemas. Import as `import * as S from '../../schemas/prompt.js'` and use `S.AgentPrompt`, `S.CreateAgentPrompt`, `S.UpdateAgentPrompt`.

5. **Q: Does the plan use `Type.Integer()` or `Type.Number()` for IDs?** A: The actual implemented schemas in `prompt.ts` use `Type.Integer()`. The `common.ts` `IdParam` also uses `Type.Integer()`. The plan's earlier draft used `Type.Number()` but the actual implementation corrected this.
