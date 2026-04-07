# Task Context — Issue #27

## Issue
- **Number:** 27
- **Title:** Task 26: TTS Testing — Annotation editor + auto-annotation
- **URL:** https://github.com/bobpps/sound-lab/issues/27
- **Labels:** frontend
- **State:** OPEN

## Branch & Worktree
- **Branch:** `feat/27-annotation-editor`
- **Base:** `feat/26-tts-selection` (PR #59, OPEN — adds TTS selection page)
- **Worktree:** `.claude/worktrees/feat/27-annotation-editor`

## Dependencies
- **#26 (PR #59):** TTS selection page with provider/dialog/annotation selectors — OPEN, implementation complete
- **#18:** Backend auto-annotation service + POST /services/annotate — CLOSED, merged to main

## Issue Description
Add inline annotation editor to the TTS page. Edit text directly, save as new variant, or run auto-annotation via LLM.

### Files Specified
- **Create:** `frontend/src/features/tts/components/AnnotationEditor.tsx`
- **Modify:** `frontend/src/features/tts/components/TtsPage.tsx`
- **Modify:** `frontend/src/features/tts/api/queries.ts`

### Required Steps
1. Add query hooks: `useAutoAnnotate()` (POST /services/annotate), `useCreateAnnotation()`, `useUpdateAnnotatedMessage()`
2. Implement `AnnotationEditor`:
   - Message list: original text (readonly, gray) + annotated text (editable)
   - "Save as New Variant" — creates new annotation with current texts
   - "Auto-Annotate" — popover/modal to select LLM provider + model + annotation prompt, calls auto-annotate endpoint
   - Individual message edits debounced auto-save
3. Wire into TtsPage — show after annotation selected/created
4. Verify via Playwright
5. Commit

## Relevant Repo Areas
- `frontend/src/features/tts/` — TTS feature (from #26 branch)
- `frontend/src/features/tts/api/queries.ts` — existing query hooks
- `frontend/src/features/tts/components/TtsPage.tsx` — orchestrating page
- `backend/src/routes/services/` — auto-annotate endpoint
- `backend/src/routes/annotated-dialogs/` — CRUD for annotated dialogs/messages
- `backend/src/db/interfaces.ts` — repository contracts
- `frontend/src/lib/api-client.ts` — fetch wrapper
- `frontend/src/types/api.ts` — API types

## Comments
No comments on the issue.
