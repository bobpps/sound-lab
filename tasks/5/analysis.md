# Analysis: Issue #5 -- Dialogs + Messages CRUD Routes

## What the Task Requires

Implement 8 REST endpoints for dialog and message management as a Fastify route plugin, plus comprehensive tests.

### Endpoints

| Method | Path | Response Schema | Status |
|--------|------|----------------|--------|
| `GET /dialogs` | List all dialogs | `Dialog[]` | 200 |
| `GET /dialogs/:dialogId` | Get dialog with messages | `DialogWithMessages` | 200 / 404 |
| `POST /dialogs` | Create dialog | `Dialog` | 201 |
| `PUT /dialogs/:dialogId` | Update dialog | `Dialog` | 200 / 404 |
| `DELETE /dialogs/:dialogId` | Delete dialog + cascade | (empty) | 204 / 404 |
| `POST /dialogs/:dialogId/messages` | Create message | `DialogMessage` | 201 / 404 |
| `PUT /dialogs/:dialogId/messages/:messageId` | Update message | `DialogMessage` | 200 / 404 |
| `DELETE /dialogs/:dialogId/messages/:messageId` | Delete message | (empty) | 204 / 404 |

### Files to Create

1. `backend/src/routes/dialogs/index.ts` -- route plugin
2. `backend/tests/routes/dialogs.test.ts` -- route tests

## Constraints

### ESM
- All local imports must use `.js` extension
- `"type": "module"` in package.json

### Fastify Patterns (from codebase)
- Route plugin: `const dialogRoutes: FastifyPluginAsyncTypebox = async (fastify) => { ... }; export default dialogRoutes;`
- Autoload: file at `routes/dialogs/index.ts` -> prefix `/dialogs` automatically
- TypeBox type provider: `FastifyPluginAsyncTypebox` from `@fastify/type-provider-typebox`
- Response schemas required on every route for `fast-json-stringify`
- Errors via `@fastify/sensible`: `fastify.httpErrors.notFound()`, `fastify.httpErrors.badRequest()`
- DB access: `fastify.db.dialogs.*`

### Schema Details
- `schema: { params, body, response }` in route options
- Params are validated as `Type.Integer()` (Fastify coerces string params to integers via TypeBox)
- `DialogIdParam` uses `dialogId` (not `id`)
- `MessageIdParam` uses `{ dialogId, messageId }`

### Testing Patterns (from health.test.ts)
- `buildTestApp()` from `../helpers.js` -> in-memory SQLite with migrations
- `app.inject({ method, url, payload })` for HTTP simulation
- `beforeEach` creates app, `afterEach` closes it
- Vitest with `globals: true` (describe, it, expect are global)
- Import style: `import { buildTestApp } from '../helpers.js';`

## Key Files and Systems

### TypeBox Schemas (input -- already created in issue #3)
- `backend/src/schemas/dialog.ts`:
  - **Response types**: `Dialog`, `DialogMessage`, `DialogWithMessages`
  - **Request body types**: `CreateDialog`, `UpdateDialog`, `CreateDialogMessage`, `UpdateDialogMessage`
  - **Param types**: `DialogIdParam`, `MessageIdParam`
- `backend/src/schemas/common.ts`: `ErrorResponse`

### DB Layer (input -- already created in issue #2)
- `backend/src/db/interfaces.ts`: `IDialogRepository` with all 9 methods
- `backend/src/db/local/dialogs.ts`: SQLite implementation
- `backend/src/db/types.ts`: DB-level type definitions

### App Infrastructure (existing)
- `backend/src/app.ts`: `buildApp()` with autoload, sensible, TypeBox type provider
- `backend/src/plugins/db.ts`: `fastify.db` decorator with `IDatabase`
- `backend/tests/helpers.ts`: `buildTestApp()` -> in-memory SQLite

### Pattern Reference (existing)
- `backend/src/routes/health/index.ts`: minimal route plugin example
- `backend/tests/routes/health.test.ts`: minimal route test example

## Critical Type Mismatch: CreateDialogMessage

**This is the most important design detail.**

The TypeBox schema `CreateDialogMessage` (from `schemas/dialog.ts`) has:
```
{ order: Integer, character: Union(1|2), text: String }
```

The DB type `CreateDialogMessage` (from `db/types.ts`) has:
```
{ dialog_id: number, order: number, character: 1|2, text: string }
```

The schema intentionally omits `dialog_id` because it comes from the URL param (`POST /dialogs/:dialogId/messages`). The route handler must merge them:

```typescript
const msg = await fastify.db.dialogs.createMessage({
  dialog_id: request.params.dialogId,
  ...request.body,
});
```

This means the route handler passes `{ dialog_id, ...body }` to the repo, which satisfies the DB type `CreateDialogMessage`. TypeScript will enforce this if the import is from `db/types.ts`. However, since `request.body` is typed by the schema's `CreateDialogMessage`, we need to construct a compatible object manually.

## Error Handling Strategy

### Repository Behavior
- `getById(id)` -> returns `null` for non-existent
- `getWithMessages(id)` -> returns `null` for non-existent
- `update(id, data)` -> **throws `Error`** for non-existent
- `updateMessage(id, data)` -> **throws `Error`** for non-existent
- `delete(id)` -> **silent** (runs DELETE, no check if existed)
- `deleteMessage(id)` -> **silent** (runs DELETE, no check if existed)
- `createMessage(data)` -> SQLite foreign key constraint will throw if `dialog_id` doesn't exist

### Route Error Mapping

| Operation | Check | HTTP Response |
|-----------|-------|---------------|
| GET /:dialogId | `getWithMessages` returns null | 404 via `httpErrors.notFound()` |
| PUT /:dialogId | `getById` returns null (pre-check) OR catch update throw | 404 |
| DELETE /:dialogId | `getById` returns null (pre-check) | 404 |
| POST /:dialogId/messages | `getById` returns null (validate dialog exists) | 404 |
| PUT /:dialogId/messages/:messageId | catch updateMessage throw | 404 |
| DELETE /:dialogId/messages/:messageId | pre-check message exists? | 204 (idempotent) or 404 |

**Recommended approach**: For UPDATE operations, pre-check existence with `getById` before calling `update`, and return 404 from the route handler using `httpErrors.notFound()`. This is cleaner than catching repo errors, which throw generic `Error` objects.

For DELETE operations, two valid approaches:
1. **Idempotent**: Just call delete, return 204 regardless (simpler, RESTful)
2. **Strict**: Pre-check existence, return 404 if not found (more explicit)

The task description says DELETE -> 204, suggesting the stricter approach (return 404 for non-existent). We should pre-check with `getById` for dialogs, and query the message for messages.

## Risks

### 1. Partial Update Semantics (Medium)
`UpdateDialog` has all fields optional. The local repo does: `data.title ?? current.title` (keeps old value if undefined). This works correctly -- no special handling needed in the route.

### 2. Dialog Existence for Message Creation (Medium)
`POST /dialogs/:dialogId/messages` -- if `dialogId` doesn't exist, the SQLite FK constraint will throw. Route should pre-check dialog existence with `getById` and return a clean 404 instead of letting the FK error bubble up as 500.

### 3. Cascade Delete (Low)
SQL schema has `ON DELETE CASCADE` on `dialog_messages.dialog_id`. Deleting a dialog automatically deletes its messages. No special handling needed in the route -- just call `fastify.db.dialogs.delete(id)`.

### 4. Message Ownership Validation (Medium)
For `PUT/DELETE /dialogs/:dialogId/messages/:messageId`, should the route verify that the message belongs to the specified dialog? The URL has both `dialogId` and `messageId`, but the repo's `updateMessage(id, data)` and `deleteMessage(id)` only use `messageId`.

**Decision**: Yes, validate ownership. After fetching the message, check `message.dialog_id === dialogId`. Return 404 if mismatch. This prevents cross-dialog message mutation via URL manipulation.

However, `IDialogRepository` has no `getMessageById` method. Options:
- a) Query via `getWithMessages(dialogId)` and find the message in the array (inefficient but works)
- b) Skip ownership check (simpler, but less secure)
- c) Add a `getMessageById` method to the repo interface (scope creep)

**Recommendation**: Use approach (a) for now. The getWithMessages call also validates dialog existence. For message delete, we can check dialog exists first, then just call deleteMessage (trusting the messageId).

Actually, looking more carefully: for update, we need the current message to know it exists. The repo's `updateMessage` already throws if not found. So we can: check dialog exists (404 if not), then call updateMessage wrapped in try/catch (404 if message not found). The ownership check adds safety but requires extra work. Let's skip ownership validation for now (internal tool, not public API) and just validate dialog existence.

### 5. Empty Body on Update (Low)
`UpdateDialog` and `UpdateDialogMessage` allow all fields optional. An empty `{}` body is technically valid and would result in a no-op update. This is fine -- the repo just writes back current values.

### 6. Character Validation (None)
TypeBox schema handles `character: Union(Literal(1), Literal(2))`. Fastify validates request body against the schema before the handler runs. Invalid values (0, 3, "a") return 400 automatically. No manual validation needed.

### 7. Vitest Configuration (Low)
`vitest.config.ts` uses `pool: 'forks'` with `tsx` loader. Tests import `.js` extensions. The test helper `buildTestApp()` returns a ready app. Pattern is established and working (health.test.ts passes).

## Assumptions

1. No authentication/authorization needed yet (`created_by` is not set via API)
2. Delete returns 404 for non-existent resources (not idempotent 204)
3. Message ownership validation (message belongs to dialog) is deferred
4. No pagination on `GET /dialogs` (returns all)
5. `GET /dialogs/:dialogId` returns `DialogWithMessages` (dialog + messages array), not just `Dialog`
6. Test file uses Vitest globals (no explicit import of describe/it/expect)
7. Route plugin export default pattern matches health route

## Unknowns Resolved

- **TypeBox param coercion**: Fastify with TypeBox type provider coerces string URL params to `Type.Integer()` automatically. Confirmed by TypeBox docs and existing health route pattern.
- **Autoload prefix**: Directory name `dialogs` becomes route prefix `/dialogs`. Confirmed in `app.ts` with `dirNameRoutePrefix: true`.
- **Error response format**: `@fastify/sensible` httpErrors produce `{ statusCode, error, message }` matching `ErrorResponse` schema. The `ErrorResponse` schema should be used in response schemas for error status codes.
- **DB decorator availability**: `fastify.db.dialogs` is available in route handlers. Confirmed by `plugins/db.ts` using `fp()` for global scope + health test asserting `app.db.dialogs`.
- **SQLite cascade**: `ON DELETE CASCADE` on `dialog_messages` FK. Confirmed in `001_initial.sql`.
- **Repo update throws on missing**: Both `update()` and `updateMessage()` throw `Error` on non-existent records. Route must handle this.
- **Repo delete is silent**: Both `delete()` and `deleteMessage()` run SQL DELETE without checking existence. Route should pre-check if we want 404 behavior.
