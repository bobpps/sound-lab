# Code Review: Issue #28 -- TTS Voice Assignment & Audio Playback

## Diff Summary

**7 commits** on `feat/28-voice-playback` vs `main` (excluding merge commits from main).

### Files Created (TTS feature)
| File | Lines | Tests |
|------|-------|-------|
| `frontend/src/features/tts/api/queries.ts` | 74 | 10 |
| `frontend/src/features/tts/api/queries.test.tsx` | 240 | -- |
| `frontend/src/features/tts/hooks/useAudioPlayback.ts` | 173 | 9 |
| `frontend/src/features/tts/hooks/useAudioPlayback.test.ts` | 247 | -- |
| `frontend/src/features/tts/components/VoiceAssignment.tsx` | 66 | 6 |
| `frontend/src/features/tts/components/VoiceAssignment.test.tsx` | 107 | -- |
| `frontend/src/features/tts/components/PlaybackControls.tsx` | 56 | 7 |
| `frontend/src/features/tts/components/PlaybackControls.test.tsx` | 130 | -- |
| `frontend/src/features/tts/components/TtsPage.tsx` | 243 | 6 |
| `frontend/src/features/tts/components/TtsPage.test.tsx` | 191 | -- |

### Files Modified
- `frontend/src/router.tsx` -- import path updated from `pages/TtsPage` to `features/tts/components/TtsPage`

### Files Deleted
- `frontend/src/pages/TtsPage.tsx` -- stub replaced by full feature component

## Verification Outcomes

- **Build**: clean (backend + frontend, zero TS errors)
- **Tests**: 336 backend + 70 frontend = 406 total, all passing
- **Lint**: clean
- **38 tests** specific to TTS feature across 5 test files

## Architecture Assessment

### Positives

1. **Feature-based structure followed correctly.** All TTS code lives under `features/tts/` with proper `api/`, `components/`, `hooks/` subdirectories.

2. **No cross-feature imports.** Provider and dialog query hooks are re-declared in `features/tts/api/queries.ts` rather than imported from `features/datasets/`. Query keys match the datasets versions so TanStack Query deduplicates network requests. This is a well-reasoned trade-off documented with a comment.

3. **Dependency injection for testability.** `useAudioPlayback` accepts a `SynthesizeFn` parameter instead of importing the API client directly, making it fully unit-testable without module mocks.

4. **Proper resource cleanup.** Blob URLs are revoked on audio end, on stop, and on unmount. AbortController cancels in-flight synthesis requests. Audio element event handlers are nulled out on cleanup.

5. **Correct use of `api.fetchRaw`** for the binary audio synthesis endpoint, keeping JSON parsing where it belongs (in the error path only).

6. **No useMemo/useCallback/React.memo** -- correctly follows the React Compiler rule.

7. **ESM `.ts` extensions** used consistently in all imports.

8. **Test quality is high.** Tests use `userEvent` over `fireEvent`, `getByRole`/`getByLabelText` over `getByTestId`, and cover happy paths, disabled states, error states, and edge cases.

### Query Key Analysis

| Hook (TTS) | Query Key | Matches (Datasets) |
|---|---|---|
| `useProviderList()` | `["providers", "tts"]` | `ttsProviderKeys.list()` = `["providers", "tts"]` -- match |
| `useDialogList()` | `["dialogs", "list"]` | `dialogKeys.list()` = `["dialogs", "list"]` -- match |
| `useDialogDetail(id)` | `["dialogs", "detail", id]` | `dialogKeys.detail(id)` = `["dialogs", "detail", id]` -- match |

All shared query keys align correctly, so TanStack Query will deduplicate requests across features.

## Issues Found

### Minor Issues

**M1. `canPlay` recomputes `characters` Set on every render.**
In `useAudioPlayback.ts` (line 51), `new Set(messages.map((m) => m.character))` is called unconditionally on every render. With React Compiler active this is automatically optimized, so it is a non-issue in practice. Noting for awareness only.

**M2. `playMessage` captures stale closure over `messages` and `voiceMap`.**
The `playMessage` function (line 76) is defined inside the component but references `messages` and `voiceMap` from the closure. When `playMessage` recursively calls itself via `audio.onended`, it captures the values from the render when `play()` was called. If the user changes voice assignments or the annotation while playback is in progress, the old values are used. This is mitigated because voice dropdowns are disabled during playback and annotation/dialog changes call `playback.stop()`, so in practice stale closures cannot occur. Acceptable for v1.

**M3. No loading indicator for annotation/dialog detail queries.**
When a user selects an annotation, there's no visual feedback while `useAnnotation` and `useDialogDetail` are fetching. The message list simply doesn't appear until both resolve. A loading spinner or skeleton would improve UX. Not a blocker.

**M4. Hardcoded character count of 2.**
`VoiceAssignment` uses `const CHARACTERS = [1, 2] as const` and `PlaybackMessage.character` is typed as `1 | 2`. This matches the current backend schema (`DialogMessage.character: 1 | 2`) but will need updating if multi-character dialogs are ever supported. Acceptable given the current domain model.

**M5. `annotationKeys` export is unused by external consumers.**
`annotationKeys` is exported from `queries.ts` but is only used internally. Not harmful, and it follows the pattern from datasets where key factories are exported for cache invalidation by mutations. Will become useful when annotation mutations are added.

### No Major or Fundamental Issues Found

The implementation is clean, well-structured, and follows all project conventions. No architectural violations, no security concerns, no performance problems, no broken patterns.

## Known Limitations

1. **No audio caching.** Each playback re-synthesizes all lines from scratch. Documented as intentional for v1.
2. **No pause/resume.** Only play (from start) and stop are supported.
3. **No per-line playback.** Cannot click a specific message to play just that one line.
4. **Voice assignments are not persisted.** Changing provider or navigating away loses the selections.
5. **Upstream dependency stubs.** Since Issues #25-27 are still open, TtsPage includes inline provider/dialog/annotation selectors. These will be replaced when dedicated selector components land.

## PR Readiness

**READY TO MERGE.**

The implementation is complete, well-tested (38 TTS-specific tests), follows all project conventions (feature structure, no cross-feature imports, ESM extensions, React Compiler compliance, TanStack Query patterns), and has no blocking issues. Build and lint are clean.
