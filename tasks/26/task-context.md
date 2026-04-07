# Task Context — Issue #26

- **Issue:** #26 — Task 25: TTS Testing — Provider/dialog/annotation selection
- **URL:** https://github.com/bobpps/sound-lab/issues/26
- **Branch:** `feat/26-tts-selection`
- **Worktree:** `.claude/worktrees/feat+26-tts-selection`
- **Labels:** frontend
- **Priority:** Phase 7 (Frontend Pages, 5/7)
- **Depends on:** #21 (datasets), #12 (backend TTS routes)

## Description

Build the first part of the TTS testing page: step-by-step selection of TTS provider, dialog, and annotation variant.

## Required Files

- Create: `frontend/src/features/tts/api/queries.ts`
- Create: `frontend/src/features/tts/components/TtsPage.tsx`
- Create: `frontend/src/features/tts/components/ProviderSelector.tsx`
- Create: `frontend/src/features/tts/components/DialogSelector.tsx`
- Create: `frontend/src/features/tts/components/AnnotationSelector.tsx`
- Modify: `frontend/src/router.tsx`

## Steps from Issue

1. Create query hooks: `useTtsProviders()`, `useTtsVoices(providerId)`, `useDialogs()`, `useAnnotationsByDialog(dialogId)`
2. Implement `ProviderSelector` — dropdown of TTS providers
3. Implement `DialogSelector` — dropdown/list of dialogs
4. Implement `AnnotationSelector` — dropdown of annotation variants + "Clean (no annotation)" option
5. Implement `TtsPage` — orchestrates sequential flow: ProviderSelector → DialogSelector → AnnotationSelector. State tracks selections. Remaining areas (editor, voices, playback) will be added in Tasks 26-27.
6. Update router: `/tts` → TtsPage (already exists as placeholder, needs to point to feature)
7. Verify via Playwright
8. Commit

## Relevant Repo Context

- Existing feature structure: `features/datasets/` and `features/providers/` — follow same pattern
- Router already has `/tts` route pointing to `pages/TtsPage.tsx` placeholder
- Backend API routes needed: providers list, voices by provider, dialogs list, annotations by dialog
- Frontend uses TanStack Query for server state, Tailwind for styling
- `lib/api-client.ts` for HTTP, feature query hooks in `features/*/api/`
- No cross-feature imports — compose at route level only
- React Compiler active — no manual memoization
- Testing: Vitest + React Testing Library + MSW
