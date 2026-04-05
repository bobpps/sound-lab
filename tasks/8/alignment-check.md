# Task 8: Annotations + Annotated Messages Routes -- Alignment Check

## Original Analysis Summary

The analysis identified 7 REST endpoints spanning two URL prefixes:

| Method | URL | Status Codes |
|--------|-----|--------------|
| GET | `/dialogs/:dialogId/annotations` | 200 / 404 |
| POST | `/dialogs/:dialogId/annotations` | 201 / 404 |
| GET | `/annotations/:id` | 200 / 404 |
| DELETE | `/annotations/:id` | 204 / 404 |
| POST | `/annotations/:id/messages` | 201 / 404 |
| PUT | `/annotations/:id/messages/:messageId` | 200 / 404 |
| DELETE | `/annotations/:id/messages/:messageId` | 204 / 404 |

Key architectural decisions from the analysis:

1. **Two-file route registration**: Dialog-scoped routes (list/create) in `dialogs/index.ts`, annotation-specific routes in `annotations/index.ts`. Required by `@fastify/autoload` with `dirNameRoutePrefix: true`.
2. **Body-only schema**: `CreateAnnotatedDialogBody` (without `dialog_id`) to mirror how `CreateDialogMessage` excludes `dialog_id` -- the route handler merges `dialog_id` from the URL param.
3. **Message ownership checks**: Via `getWithMessages(annotationId)` + `messages.some(m => m.id === messageId)`, mirroring the dialog messages pattern.
4. **404 handling**: Dialog existence checked on dialog-scoped routes; annotation existence checked on all annotation-specific routes; message existence and ownership checked on PUT/DELETE message routes.
5. **No provider validation**: `provider_id` is just a TEXT column with no FK constraint, so any string is accepted.

---

## What Was Implemented

### Files Changed (4 files, as planned)

| File | Action | Matches Plan |
|------|--------|-------------|
| `backend/src/schemas/annotation.ts` | Modified -- added `CreateAnnotatedDialogBody` | Yes |
| `backend/src/routes/dialogs/index.ts` | Modified -- added 2 dialog-scoped annotation routes | Yes |
| `backend/src/routes/annotations/index.ts` | Created -- 5 annotation-specific routes | Yes |
| `backend/tests/routes/annotations.test.ts` | Created -- 23 integration tests | Yes (plan estimated 22) |

### Endpoints Implemented (all 7)

1. **GET /dialogs/:dialogId/annotations** -- in `dialogs/index.ts`, checks dialog exists via `getById`, returns 404 if not, otherwise returns `listByDialog(dialogId)`. Uses `DialogAnnotationsParam` for params, `Type.Array(AnnotatedDialog)` for response.
2. **POST /dialogs/:dialogId/annotations** -- in `dialogs/index.ts`, checks dialog exists, uses `CreateAnnotatedDialogBody` (body-only, no `dialog_id`), merges `dialog_id` from URL param via `{ dialog_id: request.params.dialogId, ...request.body }`. Returns 201.
3. **GET /annotations/:id** -- in `annotations/index.ts`, calls `getWithMessages(id)`, returns 404 if null, otherwise returns `AnnotatedDialogWithMessages`.
4. **DELETE /annotations/:id** -- in `annotations/index.ts`, checks existence via `getWithMessages(id)` before deleting. Returns 204.
5. **POST /annotations/:id/messages** -- checks annotation exists, then creates message with `{ annotated_dialog_id: request.params.id, ...request.body }`. Returns 201.
6. **PUT /annotations/:id/messages/:messageId** -- checks annotation exists, then checks `annotation.messages.some(m => m.id === request.params.messageId)` for ownership. Returns 200.
7. **DELETE /annotations/:id/messages/:messageId** -- same ownership check pattern as PUT. Returns 204.

### Schema Addition

`CreateAnnotatedDialogBody` added at lines 36-40 of `annotation.ts`:
```typescript
export const CreateAnnotatedDialogBody = Type.Object({
  provider_id: Type.String(),
  title: Type.String(),
});
```
This correctly excludes `dialog_id` from the body, matching the analyzed pattern.

### Test Coverage (23 tests)

- GET /dialogs/:dialogId/annotations: 4 tests (empty array, list, isolation, 404)
- POST /dialogs/:dialogId/annotations: 3 tests (success 201, 404, 400 validation)
- GET /annotations/:id: 3 tests (with messages, empty messages, 404)
- DELETE /annotations/:id: 2 tests (success 204, 404)
- POST /annotations/:id/messages: 3 tests (success 201, 404, 400 validation)
- PUT /annotations/:id/messages/:messageId: 4 tests (success, 404 annotation, 404 message, 404 wrong parent)
- DELETE /annotations/:id/messages/:messageId: 4 tests (success 204, 404 annotation, 404 message, 404 wrong parent)

---

## Mismatches

### 1. `body: undefined` removed from DELETE message route
**Severity: Minor**

The plan specified `body: undefined` in the DELETE `/:id/messages/:messageId` schema definition. The implementation omitted it because it caused Fastify warning FSTWRN001. This is a correct deviation -- the existing DELETE routes in `dialogs/index.ts` do not specify `body: undefined` either. No behavioral change.

### 2. Test count: 23 vs planned 22
**Severity: Minor**

The plan estimated 22 tests but the implementation has 23. Looking at the plan's test code blocks, they actually contain 22 individual `it()` blocks. The implementation added one additional test: "does not return annotations from other dialogs" under GET `/dialogs/:dialogId/annotations`, which tests cross-dialog isolation. This is a net positive -- it validates that annotations are properly scoped to their parent dialog, an important correctness property that the analysis identified but the plan's test count didn't account for. (Note: counting the plan's embedded test code carefully, it actually does include this test -- the plan's "22" estimate was simply an undercount of its own test code.)

### 3. No deviations from the commit strategy
**Severity: N/A (no mismatch)**

The plan called for commits at Tasks 1 (schema), 3 (dialog routes), 5 (annotation routes GET/DELETE), and 7 (message routes). The execution log shows 3 commits that bundled Tasks 1-3, 4-5, and 6-7 together. This is a reasonable consolidation that still maintains logical commit boundaries. The TDD flow (tests first, then implementation) was preserved within each commit since the plan's tasks were designed in pairs (write tests -> implement).

---

## Corrections Made

1. **`body: undefined` removed from DELETE message schema** -- The plan included `body: undefined` in the DELETE `/:id/messages/:messageId` route schema, which produced Fastify warning FSTWRN001. The implementation correctly omitted this property, aligning with the existing pattern in `dialogs/index.ts` DELETE routes. This was documented in the execution log as a deviation.

No other corrections were needed. The implementation matches the plan's code nearly character-for-character.

---

## Final Alignment Verdict

**FULLY ALIGNED** -- The implementation faithfully executes the analysis and plan with only trivial deviations:

- All 7 endpoints implemented with correct HTTP methods, URL patterns, status codes, and response schemas.
- Two-file route registration done exactly as analyzed: dialog-scoped routes in `dialogs/index.ts`, annotation-specific routes in `annotations/index.ts`.
- Body-only schema (`CreateAnnotatedDialogBody`) created as analyzed, excluding `dialog_id` and merging from URL param.
- All 404 cases handled as specified: dialog existence on dialog-scoped routes, annotation existence on all annotation routes, message ownership via `getWithMessages()` + `messages.some()` on PUT/DELETE message routes.
- Message ownership checks implemented identically to the dialog messages pattern (lines 79, 80, 96, 97 of `annotations/index.ts`).
- The two documented deviations (`body: undefined` removal and test count) are both Minor severity and represent improvements over the plan rather than regressions.
- All 23 tests pass, all 20 existing dialog tests pass (no regressions), full suite of 127 tests passes, build succeeds.
