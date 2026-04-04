# Code Review: feat/5-dialogs-crud

## Potential bugs

### [BUG-1] Blanket catch swallows all errors in updateMessage handler (Major)
**File:** `backend/src/routes/dialogs/index.ts:121-125`
**What's wrong:** The `PUT /dialogs/:dialogId/messages/:messageId` handler wraps `fastify.db.dialogs.updateMessage()` in a bare `try/catch` and converts _any_ exception into a 404. The repository's `updateMessage` throws `Error("Message ${id} not found")` for missing messages, but it could also throw on database connection failures, constraint violations, or Supabase network errors. All of those get silently converted to "Message not found".
**Why it's bad:** Database errors, serialization failures, and constraint violations are indistinguishable from a missing message. A production bug in the Supabase backend that throws a network timeout would return 404 to the client instead of 500 -- making it effectively undebuggable from the client side. The error is also swallowed without logging.

### [BUG-2] DELETE /messages does not verify message belongs to the dialog (Minor)
**File:** `backend/src/routes/dialogs/index.ts:142-143`
**What's wrong:** The delete-message handler fetches the entire dialog with messages via `getWithMessages`, then checks `messages.some(m => m.id === request.params.messageId)`. This verifies that the message exists within that dialog -- good. But the `PUT /messages/:messageId` handler (line 122) does NOT perform this same ownership check. It only verifies the dialog exists, then blindly updates the message by `messageId` regardless of which dialog owns it. You could `PUT /dialogs/1/messages/42` where message 42 belongs to dialog 2, and it would succeed.
**Why it's bad:** The two message mutation handlers have inconsistent ownership semantics. PUT allows cross-dialog message updates via URL manipulation; DELETE does not. This is a data integrity issue.

### [BUG-3] Inconsistent "not found" detection between PUT and DELETE for messages (Major)
**File:** `backend/src/routes/dialogs/index.ts:121-125` vs `backend/src/routes/dialogs/index.ts:142-144`
**What's wrong:** PUT detects a missing message by catching the exception thrown by `updateMessage()`. DELETE detects it by loading all messages and running `.some()`. These are two fundamentally different detection strategies for the same logical operation ("does this message exist in this dialog?"). The PUT approach doesn't even check dialog ownership (see BUG-2). The DELETE approach makes two DB calls (`getById` + `getWithMessages`) when `getWithMessages` alone would suffice.
**Why it's bad:** When two handlers for the same resource use different validation strategies, one of them is wrong. In this case, PUT is wrong -- it doesn't verify ownership. But even if both were correct, having two patterns for the same check is a maintenance hazard: a fix to one won't be applied to the other.

## Architectural violations

### [ARCH-1] Schema types diverge from repository types for CreateDialog (Major)
**File:** `backend/src/schemas/dialog.ts:30-34` vs `backend/src/db/types.ts:48-53`
**What's wrong:** The TypeBox `CreateDialog` schema defines `{ title, description?, language }`. The repository's `CreateDialog` type in `types.ts` defines `{ title, description?, language, created_by? }`. The route handler passes `request.body` (schema-validated) directly to `fastify.db.dialogs.create(request.body)` on line 50. Because the schema lacks `created_by`, it's impossible for the API to accept this field -- it will be silently stripped by Fastify's schema validation. Meanwhile, the local repository on line 31 writes `data.created_by ?? null` to the DB, and the Supabase repository on line 44 uses `data.created_by ?? this.userId ?? null`.
**Why it's bad:** The `created_by` field is present in the DB schema, the type system, and both repository implementations, but the API route makes it unreachable. This is either a missing feature (the schema should include `created_by`) or dead code in the repositories. Either way, the schema and the type are out of sync -- the TypeBox schema is supposed to be the single source of truth (per `backend/CLAUDE.md`), but it doesn't match the TypeScript type it supposedly represents.

### [ARCH-2] No `order` field in UpdateDialogMessage schema (Minor)
**File:** `backend/src/schemas/dialog.ts:51-55`
**What's wrong:** The `UpdateDialogMessage` schema allows updating `character` and `text`, but not `order`. The `CreateDialogMessage` schema includes `order`. There's no way to reorder messages through the API after creation.
**Why it's bad:** If messages need reordering (a likely requirement for a dialog editor), the API doesn't support it. This forces the client to delete and recreate messages to change order, losing IDs and breaking any references.

## Code quality

### [QUAL-1] DELETE /messages makes two redundant DB calls (Minor)
**File:** `backend/src/routes/dialogs/index.ts:139-146`
**What's wrong:** The handler first calls `getById(dialogId)` to verify the dialog exists (line 139), then calls `getWithMessages(dialogId)` on line 142. But `getWithMessages` internally already calls `getById` -- so the dialog is fetched twice. The first `getById` call is wasted.
**Why it's bad:** Two DB round-trips where one suffices. For SQLite it's negligible; for Supabase it's two network calls. More importantly, it's a code smell that suggests the handler was assembled without reading what `getWithMessages` does internally.

### [QUAL-2] DELETE body schema is `Type.Optional(Type.Null())` (Minor)
**File:** `backend/src/routes/dialogs/index.ts:132`
**What's wrong:** The `DELETE /dialogs/:dialogId/messages/:messageId` route defines `body: Type.Optional(Type.Null())`. DELETE requests should not have a body. No other route in this file declares a body schema for DELETE (the dialog DELETE on line 72 does not).
**Why it's bad:** It's noise. It inconsistently applies to only one of the two DELETE handlers. If a client sends `{"foo":"bar"}` in the body of a DELETE to this endpoint, it will be validated (and fail? pass? -- unclear with `Optional(Null())`). The dialog DELETE doesn't do this, so it's an inconsistency within the same file.

### [QUAL-3] PUT used for partial updates instead of PATCH (Minor)
**File:** `backend/src/routes/dialogs/index.ts:55-69` and `backend/src/routes/dialogs/index.ts:108-126`
**What's wrong:** Both `PUT /dialogs/:dialogId` and `PUT /dialogs/:dialogId/messages/:messageId` accept partial payloads (all body fields are optional in `UpdateDialog` and `UpdateDialogMessage`). This is PATCH semantics, not PUT. PUT implies a full replacement of the resource.
**Why it's bad:** It violates standard REST conventions. A consumer reading the API would expect PUT to require all fields. Using PUT for partial updates is a common mistake, but it's still wrong. If full replacement is added later under the same verb, it's a breaking change.

## Testing violations

### [TEST-1] No test for cross-dialog message ownership (Major)
**File:** `backend/tests/routes/dialogs.test.ts`
**What's wrong:** No test creates two dialogs and then attempts to update/delete a message from dialog A using dialog B's URL. Given BUG-2 above, this would expose the ownership bypass. The test suite trusts the happy path and only checks for "dialog doesn't exist" or "message doesn't exist" -- never "message exists but belongs to a different dialog."
**Why it's bad:** The ownership bug (BUG-2) is silently passing because no test exercises cross-dialog message access. This is the most important negative test for a nested resource.

### [TEST-2] No test for response body schema compliance (Minor)
**File:** `backend/tests/routes/dialogs.test.ts`
**What's wrong:** Tests check individual fields (`body.id`, `body.title`, `body.messages`), but never assert the exact shape of the response. For example, the GET /dialogs test on line 30-34 checks that `body[0]` has `id`, `title`, and `language` -- but doesn't check that it ALSO has `description`, `created_by`, and `created_at`, and doesn't check that it DOES NOT have extra fields. There's no snapshot or schema validation of the full response shape.
**Why it's bad:** If a new field leaks into the response (e.g., an internal `_version` field), no test catches it. The response schemas in the route definition are supposed to prevent this, but if the schema is misconfigured, the tests won't catch the leak either.

### [TEST-3] Tests only cover SQLite backend (Minor)
**File:** `backend/tests/routes/dialogs.test.ts:6-8`
**What's wrong:** `buildTestApp()` always creates an in-memory SQLite database (via `testing: true` in the db plugin). There are no route-level tests against the Supabase implementation. The Supabase `updateMessage` method doesn't throw on missing rows -- it returns an error from `.single()` with code `PGRST116`. The blanket catch in the PUT handler (BUG-1) would behave differently against Supabase than SQLite.
**Why it's bad:** Per project conventions, dual-DB coverage is expected. The route handler's error handling is coupled to SQLite's behavior (throwing exceptions). Against Supabase, the same handler might produce different HTTP status codes for the same logical scenario.

## Summary
- Fundamental issues: 0
- Major issues: 4 (BUG-1, BUG-2/BUG-3 as related pair, ARCH-1, TEST-1)
- Minor issues: 5 (ARCH-2, QUAL-1, QUAL-2, QUAL-3, TEST-2, TEST-3)
- Overall assessment: The routes are structurally sound and follow the project's patterns (autoload, TypeBox schemas, `fastify.db` decorator, `@fastify/sensible` errors, response schemas). The main problems are in the message mutation handlers: inconsistent ownership validation between PUT and DELETE, a blanket catch that swallows non-404 errors, and a schema/type drift for `created_by`. The test suite is thorough for happy paths but misses the critical cross-dialog ownership negative test.
