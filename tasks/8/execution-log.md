# Task 8: Annotations + Annotated Messages Routes — Execution Log

## Phase: Research & Analysis

### 2026-04-05 — Research complete

**Files read and analyzed:**
- `CLAUDE.md` (root) — project rules (TDD, ESM, subagents)
- `backend/CLAUDE.md` — backend conventions (repo pattern, TypeBox, autoload, testing)
- `backend/src/db/types.ts` — all domain types including `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`, `CreateAnnotatedDialog`, `CreateAnnotatedMessage`, `UpdateAnnotatedMessage`
- `backend/src/db/interfaces.ts` — `IAnnotationRepository` with 7 methods
- `backend/src/db/local/annotations.ts` — SQLite implementation
- `backend/src/db/supabase/annotations.ts` — Supabase implementation
- `backend/src/db/factory.ts` — wires `annotations` repo into `IDatabase`
- `backend/src/db/local/migrations/001_initial.sql` — DDL for `annotated_dialogs` and `annotated_messages`
- `backend/src/schemas/annotation.ts` — TypeBox schemas (all exist, including param schemas)
- `backend/src/schemas/common.ts` — `ErrorResponse`, `IdParam`
- `backend/src/schemas/dialog.ts` — reference for body vs param separation pattern
- `backend/src/app.ts` — autoload config (`dirNameRoutePrefix: true`)
- `backend/src/plugins/db.ts` — DB decorator plugin
- `backend/src/routes/dialogs/index.ts` — primary reference pattern (CRUD + nested messages)
- `backend/src/routes/annotation-prompts/index.ts` — simple CRUD reference
- `backend/src/routes/agent-prompts/index.ts` — simple CRUD reference
- `backend/tests/routes/dialogs.test.ts` — test pattern reference
- `backend/tests/helpers.ts` — `buildTestApp()` helper
- `backend/tests/db/annotations.test.ts` — DB-layer test reference (seed patterns)
- `backend/tests/db/test-helpers.ts` — `createTestDb()` helper
- `docs/plans/2026-04-04-full-project-plan.md` — Task 7 section (annotations routes spec)

**Key decisions documented in analysis.md:**
1. Two-file route registration: dialog-scoped routes in `dialogs/index.ts`, annotation-specific in `annotations/index.ts`
2. Body schema needs `dialog_id` excluded (merged from URL param, matching dialog messages pattern)
3. Message ownership verified via `getWithMessages()` + `messages.some()` pattern
4. All 404 cases identified and resolution approach defined

**Status:** Analysis complete. Ready for implementation phase.

---

## Phase: Implementation

### 2026-04-05 — Implementation complete

**Commits:**
1. `8fa7541` — feat(api): add GET/POST /dialogs/:dialogId/annotations with tests (Tasks 1-3)
2. `e61a992` — feat(api): add GET/DELETE /annotations/:id with tests (Tasks 4-5)
3. `7526e52` — feat(api): add annotation message routes (POST/PUT/DELETE) with tests (Tasks 6-7)

**Deviations from plan:**
1. **`body: undefined` removed from DELETE message route** — The plan specified `body: undefined` in the DELETE /:id/messages/:messageId schema, which caused Fastify warnings (FSTWRN001). Removed it to match the pattern used by existing DELETE routes in dialogs/index.ts. No behavioral change.
2. **Test count is 23, not 22** — The plan estimated 22 tests but the actual count is 23.

**Files changed:**
| File | Action |
|------|--------|
| `backend/src/schemas/annotation.ts` | Modified — added `CreateAnnotatedDialogBody` |
| `backend/src/routes/dialogs/index.ts` | Modified — added 2 dialog-scoped annotation routes |
| `backend/src/routes/annotations/index.ts` | Created — 5 annotation-specific routes |
| `backend/tests/routes/annotations.test.ts` | Created — 23 integration tests |

**Verification:**
- All 23 annotation tests pass
- All 20 dialog tests pass (no regressions)
- Full backend suite: 127 tests, 11 files, all pass
- TypeScript compilation: clean
- Full build (backend + frontend): succeeds

**Status:** Implementation complete. Ready for review.

---

## Phase: Code Review Fixes

### 2026-04-05 — Cross-dialog validation fix

**Issues fixed:**
1. **BUG-1: Cross-dialog `dialog_message_id` validation missing** — POST `/:id/messages` accepted any `dialog_message_id` without verifying it belongs to the annotation's parent dialog. Added validation: fetch dialog messages via `fastify.db.dialogs.getWithMessages(annotation.dialog_id)` and verify the submitted `dialog_message_id` is among them. Returns 400 if not.
2. **BUG-2: Missing test for cross-dialog `dialog_message_id`** — Added test that creates two dialogs with messages, creates an annotation for dialog 1, then attempts to POST an annotated message using a `dialog_message_id` from dialog 2. Asserts 400 response with appropriate error message.

**Files changed:**
| File | Action |
|------|--------|
| `backend/src/routes/annotations/index.ts` | Modified — added cross-dialog validation + 400 response schema |
| `backend/tests/routes/annotations.test.ts` | Modified — added cross-dialog rejection test |

**Verification:**
- All 24 annotation tests pass (23 original + 1 new)
- Full backend suite: 128 tests, 11 files, all pass
