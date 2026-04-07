# Task 28 Execution Log

## 2026-04-07 -- Research Phase

### Research Findings

1. **TTS feature directory does not exist.** The entire `frontend/src/features/tts/` directory needs to be created from scratch. Currently, TtsPage is a stub at `frontend/src/pages/TtsPage.tsx` with just a title and description.

2. **`useTtsVoices` hook does not exist.** Despite being referenced in the issue, this hook needs to be created. There is a `useTtsProviders` hook in `features/datasets/api/queries.ts` (which fetches providers of type "tts"), but no voice-fetching hook anywhere.

3. **Binary audio response requires `fetchRaw`.** The standard `api.post()` method in `lib/api-client.ts` always parses JSON. The synthesize endpoint returns raw audio binary. Must use `api.fetchRaw()` which returns the raw `Response` object, then use `.blob()` to get the audio data.

4. **Vite proxy rewrites `/api` prefix.** The frontend calls `/api/tts/:providerId/synthesize` but Vite strips `/api`, so the backend receives `/tts/:providerId/synthesize`. This means the `api-client.ts` path prefix `/api` works correctly.

5. **Characters are numbered 1 and 2.** The `DialogMessage.character` field is `1 | 2`. No character names exist. VoiceAssignment maps character numbers to voice IDs.

6. **All upstream dependencies (Issues #25, #26, #27) are OPEN.** The TTS page selectors (ProviderSelector, DialogSelector, AnnotationSelector) and AnnotationEditor all need to be built before or alongside this task.

7. **Voice type already defined in `frontend/src/types/api.ts`.** The `Voice` interface matches the backend schema exactly. No new types needed for the voice model.

8. **Existing patterns are clear.** TanStack Query hooks use query key factories. Components use Tailwind with consistent styling (rounded-2xl borders, gray-900 primary buttons, specific color palette for errors/loading/empty states).

9. **No shared UI components for selects/buttons.** The `frontend/src/components/ui/` directory only has `Tabs.tsx`. All other components use raw HTML elements styled with Tailwind inline classes.

10. **The `api-client.ts` does have `fetchRaw`.** This is the key method for binary audio: `async fetchRaw(path: string, opts?: RequestInit): Promise<Response>`. It calls `fetch(buildUrl(path), opts)` without JSON parsing.

### Key Decisions

1. **Create full `features/tts/` directory structure.** Following the convention from `features/datasets/` and `features/providers/`: create `api/queries.ts`, `components/*.tsx`, `hooks/*.ts`.

2. **Build components independently of AnnotationEditor.** Since Issue #27 (AnnotationEditor) is OPEN, build VoiceAssignment, PlaybackControls, and useAudioPlayback as standalone pieces. The TtsPage wiring with `currentMessageIndex` highlighting can be stubbed with a comment or minimal integration.

3. **Use `HTMLAudioElement` for playback, not Web Audio API.** HTMLAudioElement is simpler, supports mp3 natively, and is sufficient for sequential line-by-line playback. Web Audio API would be overkill.

4. **Use `URL.createObjectURL` for blob URLs and clean up after.** Each synthesized audio chunk creates a blob URL. Must revoke them after playback to prevent memory leaks.

5. **AbortController for cancellation.** The `useAudioPlayback` hook creates an AbortController. `stop()` aborts it, canceling any in-flight synthesize requests.

6. **Voice assignment is local state.** Voice selections (character -> voiceId mapping) are managed as component state in TtsPage, not persisted to the backend.

7. **Query hook location.** Create `features/tts/api/queries.ts` for `useTtsVoices(providerId)`. The existing `useTtsProviders` in datasets queries is a cross-feature concern that will eventually need to move, but for now task 28 only needs voice-fetching.

### Deviations from Issue Description

1. **TtsPage location change.** The issue says to modify `frontend/src/features/tts/components/TtsPage.tsx`, but this file does not exist. The current stub is at `frontend/src/pages/TtsPage.tsx`. Implementation will need to either:
   - Create the new file at the features path and update the router import, OR
   - Build in place and move later when Tasks 25-27 are done.
   
   **Decision:** Create at `features/tts/components/TtsPage.tsx` and update the router. This matches the project plan's file structure.

2. **Scope may expand.** The issue assumes ProviderSelector, DialogSelector, and AnnotationSelector already exist (from Tasks 25-26). Since they don't, Task 28 might need minimal selector implementations or accept that the full flow isn't testable end-to-end until those tasks land.

3. **`useTtsVoices` needs to be in tts feature, not datasets.** The existing datasets queries file has `useTtsProviders()` but voices should be in `features/tts/api/queries.ts` per no-cross-feature-imports rule.

### Open Questions for Implementation

1. Should Task 28 include minimal ProviderSelector/DialogSelector stubs so the page is functional, or should it only build the voice + playback components and wire them in with hardcoded/mocked data?

2. Should the playback hook pre-fetch all audio before playing, or stream sequentially (fetch-play-fetch-play)?
   - **Recommendation:** Sequential fetch-play. Simpler, lower memory, and natural sequential flow.

3. Should there be an audio cache (so replaying the same dialog doesn't re-synthesize)?
   - **Recommendation:** Not in v1. Keep it simple. Cache can be added later.

---

## 2026-04-07 -- Implementation Phase

### Execution Summary

All 6 implementation tasks completed successfully. Task 7 (Playwright verification) skipped -- parent session handles it.

### Commits

1. `75edc13` -- feat(tts): add TanStack Query hooks for voices and annotations (#28)
2. `c9b8e8a` -- feat(tts): add useAudioPlayback hook with sequential synthesis and blob cleanup (#28)
3. `7a76bbe` -- feat(tts): add VoiceAssignment component with character-to-voice mapping (#28)
4. `d89001f` -- feat(tts): add PlaybackControls component with run/stop and progress (#28)
5. `15ad4a8` -- feat(tts): add TtsPage with selectors, voice assignment, and playback (#28)
6. `5fc3f51` -- feat(tts): wire TtsPage into router and remove stub (#28)

### Test Results

- 70 frontend tests passing (15 test files)
- 38 tests specific to TTS feature (5 test files)
- TypeScript build clean (zero errors)

### Deviations from Plan

#### 1. Audio mock constructor fix (Task 2)
The plan's test used `vi.fn(() => mockAudio.instance)` for the `Audio` global mock. Arrow functions cannot be called with `new`, causing `new Audio(url)` to throw. Fixed by using `vi.fn(function () { return mockAudio.instance; })` instead. This is a vitest/JS constraint the plan didn't account for.

#### 2. TtsPage test waitFor strategy (Task 5)
The plan's tests waited for `screen.getByLabelText(/provider/i)` before selecting options. But the select element exists immediately (just with no options loaded yet). The tests needed to wait for actual option elements like `screen.getByRole("option", { name: "Google" })` to ensure the async data had loaded before attempting `selectOptions`. Applied the same pattern for dialog and annotation selectors.

#### 3. Unused import cleanup (Task 6)
The `annotationKeys` import in `queries.test.tsx` was unused (it was imported in Task 1 but never used in any test). TypeScript strict mode flagged it. Removed during Task 6's build verification step.

### Decisions Made During Implementation

- **No cross-feature imports**: Followed the project rule strictly. Provider and dialog query hooks were duplicated in `features/tts/api/queries.ts` with the same query keys so TanStack Query deduplicates network requests.
- **SynthesizeFn as dependency injection**: The `useAudioPlayback` hook takes a `synthesize` function as a prop rather than importing the API client directly. This makes the hook fully testable without mocking the API client module.
- **Blob URL cleanup**: URLs are revoked both on audio end and on stop/cleanup to prevent memory leaks.
- **Included selectors in TtsPage**: Built provider/dialog/annotation selector dropdowns directly in TtsPage since upstream tasks (#25/#26) don't exist yet.

### Files Created

| File | Tests |
|------|-------|
| `frontend/src/features/tts/api/queries.ts` | 10 tests |
| `frontend/src/features/tts/hooks/useAudioPlayback.ts` | 9 tests |
| `frontend/src/features/tts/components/VoiceAssignment.tsx` | 6 tests |
| `frontend/src/features/tts/components/PlaybackControls.tsx` | 7 tests |
| `frontend/src/features/tts/components/TtsPage.tsx` | 6 tests |

### Files Modified

- `frontend/src/router.tsx` -- import path updated from pages/TtsPage to features/tts/components/TtsPage

### Files Deleted

- `frontend/src/pages/TtsPage.tsx` -- stub replaced by feature component
