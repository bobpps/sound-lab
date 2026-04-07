# Issue #24 Plan

**GitHub issue:** `#24`  
**Title:** `Task 23: Datasets — LLM dialog generation/editing UI`  
**Branch:** `feat/24-datasets-llm-dialog-ui`  
**Worktree:** `.claude/worktrees/feat/24-datasets-llm-dialog-ui`

## Goal

Add LLM-driven dialog actions to the datasets UI:

- `Generate New` from the dialogs list
- `Generate` from the dialog editor
- `Edit with LLM` from the dialog editor

All LLM actions should open a modal that lets the user select:

- LLM provider
- model
- prompt / edit instructions

## Confirmed Existing Backend Contracts

### `GET /llm/:providerId/models`

- Returns `string[]`
- Requires a configured LLM provider with an API key

### `POST /services/generate-dialog`

Request body:

```json
{
  "providerId": "openai",
  "model": "gpt-4o",
  "language": "en-US",
  "prompt": "Create a short support call",
  "messageCount": 6
}
```

Response:

- `201 DialogWithMessages`

### `POST /services/edit-dialog`

Request body:

```json
{
  "dialogId": 1,
  "providerId": "openai",
  "model": "gpt-4o",
  "instructions": "Make character 2 more formal"
}
```

Response:

- `200 DialogWithMessages`

## Important UI Decision

The GitHub issue text only mentions provider, model, and prompt. That is not sufficient for `generate-dialog`, because the backend also requires:

- `language`
- `messageCount`

Therefore the modal will behave as follows:

### Generate mode

- show provider selector
- show model selector
- show language input
- show message count input
- show prompt textarea

### Edit mode

- show provider selector
- show model selector
- show instructions textarea
- no language input
- no message count input

## Existing Frontend Pieces To Reuse

- `useProviders('llm')` in `frontend/src/features/providers/api/queries.ts`
- current datasets list/editor in `frontend/src/features/datasets/components/`
- shared `api-client`
- current React Query setup in `App.tsx`

## Files To Add / Change

### New files

- `frontend/src/components/ui/Modal.tsx`
- `frontend/src/components/ui/Modal.test.tsx`
- `frontend/src/features/datasets/components/LlmActionDialog.tsx`
- `frontend/src/features/datasets/components/LlmActionDialog.test.tsx`

### Modified files

- `frontend/src/features/datasets/api/queries.ts`
- `frontend/src/features/datasets/api/queries.test.tsx`
- `frontend/src/features/datasets/components/DialogList.tsx`
- `frontend/src/features/datasets/components/DialogList.test.tsx`
- `frontend/src/features/datasets/components/DialogEditor.tsx`
- `frontend/src/features/datasets/components/DialogEditor.test.tsx`

## Implementation Plan

### Step 1: Extend datasets query hooks

Add:

- `useLlmModels(providerId)`
- `useGenerateDialog()`
- `useEditDialog()`

Behavior:

- `useLlmModels(providerId)` only runs when a provider id is selected
- generate success invalidates dialog list and seeds the detail cache for the new dialog
- edit success refreshes the detail cache for the edited dialog

### Step 2: Create shared `Modal`

Requirements:

- overlay
- centered panel
- title
- optional description
- close button
- content slot
- accessible dialog semantics

### Step 3: Implement `LlmActionDialog`

Responsibilities:

- load LLM providers via `useProviders('llm')`
- load models for the selected provider via `useLlmModels(providerId)`
- manage form state and inline error states
- call:
  - `useGenerateDialog()` in generate mode
  - `useEditDialog()` in edit mode
- call `onSuccess(dialog)` with returned `DialogWithMessages`

### Step 4: Wire into `DialogList`

- add `Generate New` button next to `New Dialog`
- open modal in generate mode
- on success:
  - close modal
  - navigate to `/datasets/dialogs/:dialogId`

### Step 5: Wire into `DialogEditor`

- add `Generate` button
- add `Edit with LLM` button

Generate behavior:

- opens modal in generate mode
- prefill language from the current editor language when possible
- on success navigate to the new dialog

Edit behavior:

- opens modal in edit mode
- on success refetch current dialog and rehydrate local draft state from the returned server dialog

### Step 6: Add tests before final verification

Cover:

- model loading hook
- generate mutation hook
- edit mutation hook
- modal open/close behavior
- generate from list navigates to new dialog
- edit from dialog editor refreshes visible content
- form validation / disabled submit states for missing required fields

### Step 7: Verification

- `npm run test --workspace=frontend`
- `npm run build --workspace=frontend`
- `npm run lint --workspace=frontend`
- browser smoke check if Playwright cooperates in this environment

## Success Criteria

- user can generate a new dialog through the datasets UI
- user can trigger LLM-based editing from an existing dialog
- provider and model are selectable in the modal
- generated dialogs open immediately in the editor
- edited dialogs visibly refresh after the LLM action completes
