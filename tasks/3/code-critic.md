# Code Review: feat/3-typebox-schemas

## Schema drift

### [DRIFT-1] `CreateAnnotatedMessage` missing `annotated_dialog_id`
**Severity: Major**
**File:** `backend/src/schemas/annotation.ts:36-39`
**What's wrong:** The TypeBox schema `CreateAnnotatedMessage` has only `dialog_message_id` and `text`. The canonical type in `db/types.ts:102-106` requires three fields: `annotated_dialog_id`, `dialog_message_id`, `text`. The schema is missing `annotated_dialog_id`.
**Why it's bad:** This schema will be used for request body validation. If a route handler passes validated input directly to the repository's `createMessage()`, the `annotated_dialog_id` will be `undefined`, causing either a DB constraint error or silent data corruption. Even if the intent is to inject `annotated_dialog_id` from the URL path param, the schema type `CreateAnnotatedMessage` no longer matches `db/types.ts`'s `CreateAnnotatedMessage`, so passing one where the other is expected will fail type-checking -- or worse, force a type assertion to bridge the gap.

### [DRIFT-2] `CreateDialogMessage` missing `dialog_id`
**Severity: Minor**
**File:** `backend/src/schemas/dialog.ts:44-48`
**What's wrong:** The TypeBox schema `CreateDialogMessage` omits `dialog_id`, which is a required field in `db/types.ts:61-66`. Same pattern as DRIFT-1.
**Why it's bad:** Same consequences as DRIFT-1. The route handler will need to manually add `dialog_id` from the URL param, and the schema type won't be assignable to the DB type without explicit spreading or assertion. Less severe than DRIFT-1 because this pattern (parent ID from URL) is more universally expected for nested resources.

### [DRIFT-3] All `Create*` schemas missing `created_by`
**Severity: Minor**
**File:** `backend/src/schemas/dialog.ts:30-34`, `backend/src/schemas/annotation.ts:29-33`, `backend/src/schemas/prompt.ts:14-19`, `backend/src/schemas/prompt.ts:41-46`
**What's wrong:** `CreateDialog`, `CreateAnnotatedDialog`, `CreateAnnotationPrompt`, and `CreateAgentPrompt` all omit the optional `created_by` field present in their `db/types.ts` counterparts.
**Why it's bad:** Presumably intentional (server injects `created_by` from auth context), but it means the schema types diverge from the DB types. Every handler will need to merge `{ ...body, created_by: user.id }` before passing to the repository, and TypeScript won't help catch mistakes because the types are different. There's no documented convention for which fields are "server-injected" vs "client-provided".

## Potential bugs

### [BUG-1] `Type.Number()` used everywhere instead of `Type.Integer()`
**Severity: Major**
**File:** All five schema files -- every `id`, `dialog_id`, `annotated_dialog_id`, `dialog_message_id`, `order`, `character`, `dialogId`, `messageId`, `statusCode` field.
**What's wrong:** `Type.Number()` generates JSON Schema `{ "type": "number" }`, which accepts `3.14`, `NaN` representations, and other non-integer values. Every single integer field in the schemas uses `Type.Number()`. The database columns are all `INTEGER` / `SERIAL`.
**Why it's bad:** Fastify uses these schemas for request validation. A client sending `{ "id": 3.14 }` or `{ "order": 0.5 }` will pass validation, reach the handler, and either: (a) silently truncate when inserted into SQLite, (b) fail with a Postgres type error, or (c) produce wrong query results. TypeBox has `Type.Integer()` which generates `{ "type": "integer" }` and rejects floats at validation time. This affects every single schema file.

### [BUG-2] No `minLength` constraint on required string fields
**Severity: Minor**
**File:** All `Create*` and `Update*` schemas across all five files.
**What's wrong:** `Type.String()` with no options accepts empty strings. Fields like `title`, `name`, `id` (provider), `prompt`, `text`, `language` -- all accept `""`.
**Why it's bad:** A client can create a provider with `{ id: "", name: "", type: "tts" }` and it'll pass validation. The DB has `NOT NULL` constraints but not `CHECK(length > 0)` constraints, so empty strings go through. You end up with invisible records that have blank titles, empty prompt texts, zero-length provider IDs (which is a PRIMARY KEY). At minimum, `{ minLength: 1 }` on required string fields would prevent this.

### [BUG-3] `SetKeyBody.key` accepts empty strings
**Severity: Minor**
**File:** `backend/src/schemas/provider.ts:33-35`
**What's wrong:** `key: Type.String()` with no constraints. An empty API key passes validation.
**Why it's bad:** Setting an empty encrypted key on a provider is semantically invalid and will break any downstream call that decrypts and uses the key. The encryption module will happily encrypt an empty string.

## Abstraction problems

### [ABS-1] Duplicate type universe -- `schemas/` vs `db/types.ts`
**Severity: Major**
**File:** All five schema files vs `backend/src/db/types.ts`
**What's wrong:** The schemas export type aliases (`export type Dialog = Static<typeof Dialog>`) that are structurally identical (or nearly identical, per DRIFT-1/2/3) to the interfaces in `db/types.ts`. Now there are two parallel type hierarchies for the same domain concepts: `schemas/dialog.ts::Dialog` and `db/types.ts::Dialog`, `schemas/provider.ts::CreateProvider` and `db/types.ts::CreateProvider`, etc. There is no import relationship or explicit compatibility assertion between them.
**Why it's bad:** These will drift. They already have (DRIFT-1/2/3). When someone adds a field to the DB migration, they'll update `db/types.ts` and forget `schemas/`. Or vice versa. There's no compile-time check that `Static<typeof Dialog>` is assignable to `db/types.Dialog`. The "single source of truth" promise of TypeBox (per `backend/CLAUDE.md`: "TypeBox as single source of truth") is not fulfilled -- the schemas are a second source of truth that doesn't replace the first.

### [ABS-2] `AnnotationPrompt` and `AgentPrompt` are identical structures
**Severity: Minor**
**File:** `backend/src/schemas/prompt.ts:3-12` and `backend/src/schemas/prompt.ts:30-39`
**What's wrong:** `AnnotationPrompt` and `AgentPrompt` have the exact same fields: `id`, `title`, `provider_id`, `language`, `prompt`, `created_by`, `created_at`. Same goes for their `Create*` and `Update*` variants. All six schemas in `prompt.ts` are pairwise clones.
**Why it's bad:** Pure copy-paste. If someone adds a field to one and not the other (which the DB schema suggests they could diverge eventually), there's no structural sharing to catch it. More immediately, this is 55 lines where ~20 would suffice with a shared base schema and two aliases.

## Code quality

### [QUAL-1] `AnnotationIdParam` duplicates `IdParam`
**Severity: Minor**
**File:** `backend/src/schemas/annotation.ts:47-50` vs `backend/src/schemas/common.ts:3-6`
**What's wrong:** `AnnotationIdParam` is `{ id: Type.Number() }`. `IdParam` in `common.ts` is `{ id: Type.Number() }`. They're the same schema. `common.ts` exists precisely to provide shared param schemas, but `annotation.ts` doesn't use it.
**Why it's bad:** Defeats the purpose of `common.ts`. If `IdParam` is updated (e.g., to `Type.Integer()`), `AnnotationIdParam` won't be.

### [QUAL-2] `DialogAnnotationsParam` duplicates `DialogIdParam`
**Severity: Minor**
**File:** `backend/src/schemas/annotation.ts:58-61` vs `backend/src/schemas/dialog.ts:57-60`
**What's wrong:** Both are `{ dialogId: Type.Number() }`. Different names, same schema, in different files.
**Why it's bad:** When two schemas in two files describe the same URL param shape, one should import from the other or both should share a common definition.

### [QUAL-3] No param schemas for prompt routes
**Severity: Minor**
**File:** `backend/src/schemas/prompt.ts`
**What's wrong:** `annotation.ts` has `AnnotationIdParam`, `AnnotationMessageIdParam`, `DialogAnnotationsParam`. `dialog.ts` has `DialogIdParam`, `MessageIdParam`. `provider.ts` has param coverage via `common.ts`'s `StringIdParam`. But `prompt.ts` has zero param schemas.
**Why it's bad:** Prompt routes will need `{ id: number }` params for CRUD. Either they'll use `IdParam` from `common.ts` (fine, but inconsistent with how `annotation.ts` and `dialog.ts` define their own), or the route files will have to define param schemas inline. Inconsistency across neighboring files.

## Testing violations

### [TEST-1] No tests for schema files
**Severity: Minor**
**File:** `backend/tests/schemas/` -- does not exist.
**What's wrong:** Five new schema files, zero tests. No compile-time check that schema types match `db/types.ts`. No runtime check that schemas validate expected payloads or reject invalid ones.
**Why it's bad:** `backend/CLAUDE.md` says "TDD by default." These schemas were committed without any test coverage. Given that the schemas already have drift issues (DRIFT-1/2/3) and a validation bug (BUG-1), tests would have caught these immediately. A simple assignability test (`const _check: DbDialog = {} as SchemaDialog`) would enforce type alignment at compile time.

## Summary

| Severity    | Count |
|-------------|-------|
| Major       | 3     |
| Minor       | 8     |

**Overall assessment:** The schemas are a mechanical transcription of `db/types.ts` into TypeBox, done without attention to JSON Schema semantics (`Number` vs `Integer`), without ensuring type compatibility with the existing type system, and without tests. The result is a parallel type universe that already has drift on day one. The structural patterns are fine -- file organization, naming conventions, TypeBox idioms are all correct. But the substance has real bugs (`Type.Number()` for integers) and a fundamental unanswered question: how do these schemas relate to `db/types.ts` at compile time?
