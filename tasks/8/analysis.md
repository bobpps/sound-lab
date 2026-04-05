# Task 8: Annotations + Annotated Messages Routes — Analysis

## What the Task Requires

Implement REST API routes for managing annotations (annotated dialogs) and their messages, plus comprehensive tests. Annotations are scoped to dialogs — they represent provider-specific renditions of dialog messages (e.g., SSML markup for a TTS provider).

### Endpoints

| Method | URL | Response | Status |
|--------|-----|----------|--------|
| GET | `/dialogs/:dialogId/annotations` | `AnnotatedDialog[]` | 200 |
| GET | `/annotations/:id` | `AnnotatedDialogWithMessages` | 200 / 404 |
| POST | `/dialogs/:dialogId/annotations` | `AnnotatedDialog` | 201 / 404 |
| DELETE | `/annotations/:id` | (empty) | 204 / 404 |
| POST | `/annotations/:id/messages` | `AnnotatedMessage` | 201 / 404 |
| PUT | `/annotations/:id/messages/:messageId` | `AnnotatedMessage` | 200 / 404 |
| DELETE | `/annotations/:id/messages/:messageId` | (empty) | 204 / 404 |

### Files to Create

- `backend/src/routes/annotations/index.ts` — route handler plugin
- `backend/tests/routes/annotations.test.ts` — integration tests

---

## Constraints from Project Guidance

- **TDD by default** — write tests first, then implement (Red -> Green -> Refactor)
- **ESM everywhere** — `.js` extensions in all imports
- **TypeBox as single source of truth** — schemas simultaneously serve as JSON Schema validation and TypeScript types
- **Always define response schemas** — enables `fast-json-stringify` and prevents data leaks
- **`@fastify/autoload`** — directory names become route prefixes automatically
- **`@fastify/sensible`** — use `fastify.httpErrors.notFound()` for 404s
- **App factory pattern** — `buildApp()` + `app.inject()` for tests, no real ports
- **Repository pattern** — all access via `fastify.db.annotations.*`
- **Not found -> null** — repo returns null, route throws httpErrors.notFound
- **FastifyPluginAsyncTypebox** — typed route plugin signature

---

## Key Files and Systems Involved

### DB Layer (already implemented, read-only reference)
- `backend/src/db/types.ts` — Domain types: `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`, `CreateAnnotatedDialog`, `CreateAnnotatedMessage`, `UpdateAnnotatedMessage`
- `backend/src/db/interfaces.ts` — `IAnnotationRepository` with methods: `listByDialog`, `getWithMessages`, `create`, `delete`, `createMessage`, `updateMessage`, `deleteMessage`
- `backend/src/db/local/annotations.ts` — SQLite implementation (`LocalAnnotationRepository`)
- `backend/src/db/supabase/annotations.ts` — Supabase implementation (`SupabaseAnnotationRepository`)
- `backend/src/db/factory.ts` — wires `annotations` repo into `IDatabase`

### Schema Layer (already implemented, read-only reference)
- `backend/src/schemas/annotation.ts` — TypeBox schemas:
  - `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`
  - `CreateAnnotatedDialog` (body: `dialog_id`, `provider_id`, `title`)
  - `CreateAnnotatedMessage` (body: `dialog_message_id`, `text`)
  - `UpdateAnnotatedMessage` (body: `text`)
  - `AnnotationIdParam` (params: `id`)
  - `AnnotationMessageIdParam` (params: `id`, `messageId`)
  - `DialogAnnotationsParam` (params: `dialogId`)
- `backend/src/schemas/common.ts` — `ErrorResponse`, `IdParam`, `StringIdParam`

### App Infrastructure
- `backend/src/app.ts` — `buildApp()` with autoload from `src/routes/`
- `backend/src/plugins/db.ts` — decorates `fastify.db: IDatabase`
- `backend/tests/helpers.ts` — `buildTestApp()` for test setup

### Reference Patterns (existing routes)
- `backend/src/routes/dialogs/index.ts` — CRUD + nested messages, closest pattern match
- `backend/src/routes/annotation-prompts/index.ts` — simple CRUD with `IdParam`
- `backend/tests/routes/dialogs.test.ts` — test patterns: seed via `app.db`, assert status + body

---

## DB Schema for Annotations

### `annotated_dialogs` table
```sql
CREATE TABLE annotated_dialogs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dialog_id   INTEGER NOT NULL REFERENCES dialogs(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  title       TEXT NOT NULL,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `annotated_messages` table
```sql
CREATE TABLE annotated_messages (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  annotated_dialog_id   INTEGER NOT NULL REFERENCES annotated_dialogs(id) ON DELETE CASCADE,
  dialog_message_id     INTEGER NOT NULL REFERENCES dialog_messages(id),
  text                  TEXT NOT NULL
);
```

### Cascade behavior
- Deleting a `dialog` cascades to `annotated_dialogs` (and then to `annotated_messages`)
- Deleting an `annotated_dialog` cascades to its `annotated_messages`
- `dialog_message_id` references `dialog_messages(id)` but does NOT cascade delete (no ON DELETE CASCADE) — this means deleting a dialog_message with an existing annotated_message referencing it will fail with FK constraint error

---

## Route Registration Approach

### The challenge: two URL prefixes

The endpoints span two URL patterns:
1. `/dialogs/:dialogId/annotations` — list and create (scoped to dialog)
2. `/annotations/:id` — get, delete, and message sub-routes (direct access by annotation ID)

### How `@fastify/autoload` works in this project

From `app.ts`:
```typescript
await app.register(autoload, {
  dir: join(__dirname, 'routes'),
  dirNameRoutePrefix: true,
});
```

This means `routes/annotations/index.ts` automatically gets prefix `/annotations`. The `/dialogs/:dialogId/annotations` routes would NOT be autoloaded under the `/annotations` prefix.

### Recommended approach: single file with explicit prefix registration

Create `backend/src/routes/annotations/index.ts` with:
1. Routes at `/annotations` prefix (handled by autoload):
   - `GET /:id` -> `GET /annotations/:id`
   - `DELETE /:id` -> `DELETE /annotations/:id`
   - `POST /:id/messages` -> `POST /annotations/:id/messages`
   - `PUT /:id/messages/:messageId` -> `PUT /annotations/:id/messages/:messageId`
   - `DELETE /:id/messages/:messageId` -> `DELETE /annotations/:id/messages/:messageId`

2. For `/dialogs/:dialogId/annotations` routes, register them via `fastify.register()` with an explicit prefix override, OR register them as a separate plugin on the parent Fastify instance.

**Best option:** Use a single plugin file. The autoloaded plugin gets the `/annotations` prefix. For the dialog-scoped routes, the plugin registers a sub-plugin on the **root** Fastify instance using `fastify.after()` / encapsulation-breaking, OR more simply:

**Simplest correct approach:** Register the dialog-scoped annotation routes inside the **dialogs** route plugin by adding them there. BUT this violates separation of concerns.

**Pragmatic approach (recommended):** In `backend/src/routes/annotations/index.ts`, register the `/annotations/:id` routes normally (autoloaded prefix), and ALSO register a separate sub-plugin at prefix `/dialogs` for the dialog-scoped routes. Since autoload uses Fastify's encapsulation, we need to handle prefix carefully.

Actually, looking at how Fastify autoload works: each route file is its own encapsulated plugin. The `annotations/index.ts` plugin receives a `fastify` instance already prefixed at `/annotations`. We can:

1. Register the `/annotations/:id` routes directly on the provided instance.
2. For `/dialogs/:dialogId/annotations`, use the **root** Fastify instance. But we don't have direct access to it from within the encapsulated plugin.

**Resolution:** The most practical pattern used in Fastify projects:
- The annotation routes plugin registers both sets of routes
- The `/:id` and `/:id/messages/*` routes work with the `/annotations` autoload prefix
- For the dialog-scoped routes, since the plugin is encapsulated under `/annotations`, we need to either:
  - (a) Add the dialog-scoped routes to the dialogs plugin (violates SoC but simplest)
  - (b) Use `fastify-plugin` (fp) to break encapsulation and register at root level
  - (c) Create a separate non-autoloaded plugin

**Recommended:** Use approach (a) with a twist — register the dialog-scoped annotation routes (`GET /dialogs/:dialogId/annotations` and `POST /dialogs/:dialogId/annotations`) by defining them in `annotations/index.ts` with full paths using the `prefix` option when registering within the autoloaded plugin, but this is blocked by autoload's prefix.

**Final answer:** Register the dialog-scoped routes directly in the annotations plugin using absolute paths from root. Looking at Fastify's behavior: the autoload prefix means routes in `annotations/index.ts` are prefixed with `/annotations`. To register routes at `/dialogs/:dialogId/annotations`, the plugin should use `fastify.register()` to register a sub-plugin with `{ prefix: '/dialogs' }` — but this would nest as `/annotations/dialogs/...` which is wrong.

**Correct final approach:** Export the plugin wrapped with `fastify-plugin` (fp) to break encapsulation, then register BOTH:
- Routes at `/:id`, `/:id/messages`, etc. (with autoload prefix -> `/annotations/:id`)
- Routes using the root instance to register at `/dialogs/:dialogId/annotations`

BUT `fastify-plugin` breaks encapsulation of the whole plugin, which means routes would be registered at root WITHOUT the `/annotations` prefix.

**Actual correct approach for this codebase:**

Looking at the code pattern more carefully — the autoloaded plugin function receives a scoped Fastify instance. We simply register all routes with their FULL relative paths:
- `GET /:id` -> `/annotations/:id` (with autoload prefix)
- `DELETE /:id` -> `/annotations/:id`
- etc.

For the dialog-scoped routes, we have two options:
1. **Modify the dialogs plugin** to add `GET /:dialogId/annotations` and `POST /:dialogId/annotations` there (since the dialogs plugin is already prefixed at `/dialogs`)
2. **Two-file approach:** Create `annotations/index.ts` for the `/annotations/` routes AND add dialog-scoped annotation routes to `dialogs/index.ts`

Option 2 is the clearest but splits annotation logic across files. Given the project plan says "Use `annotations` repo. For `/dialogs/:dialogId/annotations`, register routes inside the `dialogs` route plugin or create a separate annotations plugin that handles both URL patterns," **option 2 is explicitly endorsed**.

**However**, the cleanest pattern used in real Fastify projects for cross-cutting URL patterns: keep all annotation logic in ONE file (`annotations/index.ts`), wrap the default export with `fastify-plugin` so it breaks out of autoload's encapsulation, and manually register routes with full prefixes. This way all annotation code lives together.

Let me re-examine: if we use `fp()`, the routes would be registered at root level (no prefix). Then we define:
- `GET /dialogs/:dialogId/annotations`
- `POST /dialogs/:dialogId/annotations`
- `GET /annotations/:id`
- `DELETE /annotations/:id`
- `POST /annotations/:id/messages`
- `PUT /annotations/:id/messages/:messageId`
- `DELETE /annotations/:id/messages/:messageId`

All with absolute paths. This is the cleanest approach for this particular task.

**WAIT** — `@fastify/autoload` with `dirNameRoutePrefix: true` adds the prefix REGARDLESS of whether the plugin uses `fastify-plugin`. The prefix comes from the directory name, not from encapsulation. Using `fp()` here would break encapsulation of decorators/hooks but the prefix would still be `/annotations`.

**Final verified approach:** We cannot use autoload to mount the same plugin at two prefixes. The recommended approach:

1. `backend/src/routes/annotations/index.ts` — handles all `/annotations/*` routes (autoload gives prefix `/annotations`)
2. Add 2 routes to `backend/src/routes/dialogs/index.ts` for the dialog-scoped listing/creation of annotations:
   - `GET /:dialogId/annotations` -> `GET /dialogs/:dialogId/annotations`
   - `POST /:dialogId/annotations` -> `POST /dialogs/:dialogId/annotations`

These two dialog-scoped routes simply delegate to `fastify.db.annotations.listByDialog()` and `fastify.db.annotations.create()`.

This matches the plan's suggestion and keeps routing clean. The dialog route file already handles nested resources (messages), so adding annotations follows the same pattern.

---

## Risks and Assumptions

### Risks
1. **Split registration across two files** — annotation logic in both `dialogs/index.ts` and `annotations/index.ts`. Mitigated by keeping dialog-scoped routes thin (just delegates to the annotations repo).
2. **FK constraint on annotated_messages.dialog_message_id** — no CASCADE, so deleting a dialog_message that has annotated_messages will fail. This is by design (you shouldn't delete a base message that has annotations), but routes should handle this gracefully.
3. **Existence checks** — for POST/PUT/DELETE on annotation messages, we need to verify the parent annotation exists AND that the message belongs to the annotation. The current `IAnnotationRepository` doesn't expose a `getMessageById` — we use `getWithMessages` and scan.
4. **No UPDATE on AnnotatedDialog** — the interface has no `update` method. Only create and delete. This is by design per the schema.

### Assumptions
1. The `CreateAnnotatedDialog` body schema includes `dialog_id` (TypeBox schema line 29-33). Since the dialogId also comes from the URL param, the route should either:
   - Use `dialog_id` from URL param only and exclude it from body, OR
   - Accept it in the body (as the schema currently defines) but also validate against the URL param
   - **Decision:** The existing schema includes `dialog_id` in the body. The plan's test example also puts `dialog_id` in the payload. We follow the existing schema as-is. The route will use the URL param for the dialog existence check and pass `dialog_id` from the body (or merge from URL param) to the repo.
   - **Better decision:** Since `dialog_id` comes from the URL, we should NOT require it in the body. The body schema `CreateAnnotatedDialog` has it, but we can create a separate body-only schema (without `dialog_id`) for the route and merge URL param's `dialogId`. This matches the pattern in dialog messages where `CreateDialogMessage` body schema excludes `dialog_id`.
   - **Actually:** Looking at `schemas/annotation.ts`, the `CreateAnnotatedDialog` TypeBox schema includes `dialog_id: Type.Integer()`. But looking at `schemas/dialog.ts`, the `CreateDialogMessage` body schema does NOT include `dialog_id`. The dialogs route merges it: `{ dialog_id: request.params.dialogId, ...request.body }`. We should follow the same pattern for annotations: the POST body should only have `provider_id` and `title`, and `dialog_id` comes from the URL param.
   - **This means we need to create a route-specific body schema** that excludes `dialog_id`, or use `Type.Pick`/`Type.Omit` on the existing schema. The current `CreateAnnotatedDialog` in `schemas/annotation.ts` includes `dialog_id` — this is the DB-layer input type. We need a route-level body schema.

2. Provider existence is NOT validated when creating an annotation (no FK constraint on `provider_id` in the annotated_dialogs table). The repo just stores whatever string is provided. We follow the same pattern.
3. `created_by` is optional and not required in the body (matches the DB type which defaults to null).

---

## Unknowns Resolved

### Q: How to handle two URL prefixes in one logical resource?
**A:** Split across two files. Dialog-scoped routes (list/create) go in `dialogs/index.ts`; annotation-specific routes (get/delete + messages) go in `annotations/index.ts`. This follows autoload conventions and the plan's guidance.

### Q: Does the body schema for POST annotation need `dialog_id`?
**A:** No. Following the pattern from dialog messages (`CreateDialogMessage` excludes `dialog_id`), the annotation creation body should only have `provider_id` and `title`. The `dialog_id` comes from the URL param and is merged in the handler. We may need to create a separate body-only TypeBox schema in `schemas/annotation.ts` (e.g., `CreateAnnotatedDialogBody` without `dialog_id`) or adjust the existing one.

### Q: How to verify annotated message belongs to annotation for PUT/DELETE?
**A:** Use `getWithMessages(annotationId)` and check `messages.some(m => m.id === messageId)`. This mirrors the dialog messages pattern in `dialogs/index.ts` (lines 119-123).

### Q: What 404 cases need handling?
- `GET /dialogs/:dialogId/annotations` — verify dialog exists (404 if not) or just return empty array? Looking at the DB repo: `listByDialog` just queries by dialog_id, returns empty array if no results. No dialog existence check. For consistency with the dialogs list (which returns [] for empty), we can return [] without verifying dialog exists. But for correctness, checking dialog exists is better. **Decision:** Check dialog exists, return 404 if not.
- `GET /annotations/:id` — 404 if annotation not found
- `POST /dialogs/:dialogId/annotations` — 404 if dialog not found
- `DELETE /annotations/:id` — 404 if annotation not found
- `POST /annotations/:id/messages` — 404 if annotation not found
- `PUT /annotations/:id/messages/:messageId` — 404 if annotation not found, 404 if message not found (or not belonging to this annotation)
- `DELETE /annotations/:id/messages/:messageId` — same as PUT

### Q: Need a provider to seed tests?
**A:** No. The `provider_id` in `annotated_dialogs` is just a TEXT column with no FK constraint. Tests can use any string like `'elevenlabs'`.

---

## Implementation Order (TDD)

1. Write test file `backend/tests/routes/annotations.test.ts` with all test cases
2. Run tests — all fail (Red)
3. Create body-only schema if needed in `backend/src/schemas/annotation.ts`
4. Add dialog-scoped routes to `backend/src/routes/dialogs/index.ts` (GET + POST for `/dialogs/:dialogId/annotations`)
5. Create `backend/src/routes/annotations/index.ts` with annotation-specific routes
6. Run tests — all pass (Green)
7. Refactor if needed
8. Run full test suite to verify no regressions
