# Task 23 Plan

**Issue:** `#23`  
**Branch:** `feat/23-datasets-dialog-editor`  
**Worktree:** `.claude/worktrees/feat/23-datasets-dialog-editor`

## Goal

Build the frontend datasets flow for dialogs:

- `/datasets` shows tabs `Dialogs | Prompts`
- `Dialogs` renders a list of dialogs from the backend
- `New Dialog` creates a blank dialog and opens the editor
- `/datasets/dialogs/:dialogId` opens a full dialog editor
- Editor supports metadata changes plus create/update/delete for messages

## Existing Constraints

- Backend API is already present:
  - `GET /dialogs`
  - `GET /dialogs/:dialogId`
  - `POST /dialogs`
  - `PUT /dialogs/:dialogId`
  - `DELETE /dialogs/:dialogId`
  - `POST /dialogs/:dialogId/messages`
  - `PUT /dialogs/:dialogId/messages/:messageId`
  - `DELETE /dialogs/:dialogId/messages/:messageId`
- Frontend already has:
  - shared `api-client`
  - React Query provider in `App.tsx`
  - sidebar/app shell/router tests
- Main branch does not yet contain dataset-specific frontend feature modules.

## Implementation Plan

1. Create `frontend/src/features/datasets/api/queries.ts`
   - Add `useDialogs()` and `useDialog(id)` queries
   - Add dialog/message CRUD mutations with cache invalidation

2. Create dataset UI components
   - `DatasetsPage.tsx` with local tabs and prompts placeholder
   - `DialogList.tsx` with loading/empty/error states and `New Dialog`
   - `DialogEditor.tsx` with local draft state for metadata and messages
   - `MessageEditor.tsx` for a single editable message row

3. Update routing
   - `/datasets` -> `DatasetsPage`
   - `/datasets/dialogs/:dialogId` -> `DialogEditor`

4. Update frontend tests
   - Wrap router tests in `QueryClientProvider`
   - Stub `fetch` for dialogs list/detail
   - Verify both `/datasets` and `/datasets/dialogs/:dialogId`

5. Verification
   - Run `npm run test --workspace=frontend`
   - Run `npm run build --workspace=frontend`
   - If local servers cooperate, do a basic Playwright smoke test for list -> editor flow

## Design Notes

- `Save Dialog` persists metadata and message diffs in one action.
- New messages stay local until save, which avoids creating incomplete backend rows.
- Message order is append-only using `max(order) + 1`, because the backend does not expose reorder operations.
- The `Prompts` tab remains a placeholder in this task to preserve the route surface planned for the next issue.
