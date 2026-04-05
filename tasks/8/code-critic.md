# Code Review: feat/8-annotations-routes

## Inconsistency

### [INCON-1] Duplicate param schema instead of reusing `IdParam` from common.ts
**Severity:** Minor
**File:** `backend/src/schemas/annotation.ts:53-56`
**What's wrong:** `AnnotationIdParam` is defined as `Type.Object({ id: Type.Integer() })` -- this is byte-for-byte identical to `IdParam` from `schemas/common.ts`. A second schema was created for no reason.
**Why it's bad:** Schema proliferation. `IdParam` already exists for exactly this purpose and is used by annotation-prompts and agent-prompts routes. Now there are two identical schemas with different names. The next developer will have to guess which one to use.

### [INCON-2] `DialogAnnotationsParam` duplicates `DialogIdParam` from dialog.ts
**Severity:** Minor
**File:** `backend/src/schemas/annotation.ts:64-67`
**What's wrong:** `DialogAnnotationsParam` is `Type.Object({ dialogId: Type.Integer() })` -- structurally identical to `DialogIdParam` from `schemas/dialog.ts`, which is already used by every other route in `dialogs/index.ts`.
**Why it's bad:** Same issue as INCON-1. The dialog routes now import two different schemas (`DialogIdParam` and `DialogAnnotationsParam`) that parse the exact same `{ dialogId: integer }` param. Confusing and unnecessary.

### [INCON-3] Two error-handling styles in one file
**Severity:** Minor
**File:** `backend/src/routes/dialogs/index.ts` (entire file) and `backend/src/routes/annotations/index.ts` (entire file)
**What's wrong:** The new annotation routes use `throw fastify.httpErrors.notFound()`, matching the dialog routes pattern. However, three other route files in the same codebase (`providers`, `annotation-prompts`, `agent-prompts`) use `return reply.notFound()`. The new code is consistent with `dialogs/` but inconsistent with the other three route files. This is a pre-existing problem in the codebase, not introduced by this branch, but the branch had a chance to align and didn't.
**Why it's bad:** Two conventions for the same operation. `throw` interrupts control flow (good), `return reply.notFound()` requires the developer to remember to return (footgun). A codebase should pick one.

## Code quality

### [QUAL-1] `getWithMessages` called for existence check where a cheaper call would suffice
**Severity:** Minor
**File:** `backend/src/routes/annotations/index.ts:39`, `:56`, `:94`
**What's wrong:** The DELETE `/annotations/:id` route (line 39) calls `getWithMessages()` -- which JOINs and fetches all child messages -- just to check if the annotation exists before deleting it. Same for POST `/annotations/:id/messages` (line 56) where only the existence of the annotation matters, not its messages.
**Why it's bad:** Wasted work. For a DELETE that immediately discards the result, a lightweight `getById`-style check would be enough. The `IAnnotationRepository` interface does not expose a standalone `getById` method though, so this is partly an interface design gap. Still, the route is doing more DB work than necessary per request.

### [QUAL-2] `getWithMessages` called on every message mutation for ownership check
**Severity:** Minor
**File:** `backend/src/routes/annotations/index.ts:77`, `:94`
**What's wrong:** PUT and DELETE for `/annotations/:id/messages/:messageId` both call `getWithMessages()` to load the entire annotation with all messages, then do `.some(m => m.id === ...)` to verify the message belongs to this annotation. This is an O(N) in-memory scan after an O(N) DB fetch.
**Why it's bad:** For an annotation with 100 messages, this fetches all 100 rows and scans through them just to validate one message ID. A single `SELECT ... WHERE id = ? AND annotated_dialog_id = ?` at the repository level would be constant-cost and remove the need for the route handler to own this logic. This also puts ownership validation logic in the route handler (business logic in routes territory) rather than in the repository.

### [QUAL-3] `CreateAnnotatedDialogBody` is a subset copy of `CreateAnnotatedDialog`
**Severity:** Minor
**File:** `backend/src/schemas/annotation.ts:36-40`
**What's wrong:** `CreateAnnotatedDialogBody` is `{ provider_id, title }` -- it's `CreateAnnotatedDialog` minus `dialog_id`. Rather than deriving it (e.g., `Type.Omit(CreateAnnotatedDialog, ['dialog_id'])`), a completely new object was hand-written.
**Why it's bad:** If `CreateAnnotatedDialog` gains a new field (e.g., `created_by`), `CreateAnnotatedDialogBody` will silently fall out of sync. Manual duplication of schemas is how drift starts.

## Potential bugs

### [BUG-1] POST `/annotations/:id/messages` does not validate `dialog_message_id` FK
**Severity:** Major
**File:** `backend/src/routes/annotations/index.ts:55-63`
**What's wrong:** The route accepts a `dialog_message_id` in the body and passes it straight to `createMessage`. There is no validation that this `dialog_message_id` actually belongs to the same dialog that the annotation is associated with. A client could create an annotated message pointing to a message from a completely unrelated dialog.
**Why it's bad:** Data integrity violation at the API level. The FK constraint in the DB will prevent referencing a non-existent message, but it won't prevent cross-dialog references. An annotation for Dialog A could end up with a message annotation pointing to a message from Dialog B. This is a semantic integrity hole.

### [BUG-2] No test for cross-dialog `dialog_message_id` in POST `/annotations/:id/messages`
**Severity:** Major
**File:** `backend/tests/routes/annotations.test.ts`
**What's wrong:** There is no test case that creates an annotation for Dialog A, then tries to POST a message with `dialog_message_id` from Dialog B. The cross-annotation ownership tests exist (PUT/DELETE correctly test "message belongs to a different annotation"), but the analogous cross-dialog test for message creation is missing.
**Why it's bad:** The gap described in BUG-1 is not caught by tests. If someone adds the validation later, there's no test to prove it works.

## Architectural violations

### [ARCH-1] Ownership validation logic lives in route handlers, not the data layer
**Severity:** Minor
**File:** `backend/src/routes/annotations/index.ts:79`, `:96`
**What's wrong:** The route handlers manually fetch all messages and do `.some(m => m.id === ...)` to check if a message belongs to an annotation. This is business logic -- specifically, an ownership/authorization check -- implemented in the route handler.
**Why it's bad:** Per project conventions, routes should be thin dispatchers. The check "does this message belong to this annotation?" is a data-layer concern. If another consumer of the repository (e.g., a future service layer or a different route) needs the same check, they'll have to re-implement it. The dialog message routes (`dialogs/index.ts:124-128`) have the exact same pattern, so this is a pre-existing issue that this branch perpetuates.

## Testing violations

### [TEST-1] No test for cascade delete behavior
**Severity:** Minor
**File:** `backend/tests/routes/annotations.test.ts`
**What's wrong:** The `DELETE /annotations/:id` test (line 178-187) creates an annotation without messages and deletes it. There is no test that creates an annotation WITH messages, deletes it, and verifies the messages are also gone (CASCADE DELETE). The `backend/CLAUDE.md` explicitly calls out cascade awareness: "Dialogs are hierarchical: dialog -> messages -> annotated_dialogs -> annotated_messages. CASCADE DELETE."
**Why it's bad:** CASCADE DELETE is a critical correctness property of the hierarchical data model. The test suite doesn't verify it for annotation -> annotated_messages. If someone accidentally removes the CASCADE from the migration, these tests won't catch it.

## Summary
- Fundamental issues: 0
- Major issues: 2 (BUG-1, BUG-2 -- cross-dialog message reference not validated or tested)
- Minor issues: 7 (INCON-1, INCON-2, INCON-3, QUAL-1, QUAL-2, QUAL-3, ARCH-1, TEST-1)
- Overall assessment: Solid, consistent route implementation that follows the established patterns from `dialogs/`. The two major issues both revolve around the same gap -- cross-dialog `dialog_message_id` validation is absent at the API level and untested. Everything else is minor friction: schema duplication and an expensive existence check where a cheaper one would do.
