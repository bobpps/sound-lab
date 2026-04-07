# Task Context — Issue #28

## Issue
- **Number:** 28
- **Title:** Task 27: TTS Testing — Voice assignment + audio playback
- **URL:** https://github.com/bobpps/sound-lab/issues/28
- **Labels:** frontend
- **State:** OPEN

## Branch & Worktree
- **Branch:** `feat/28-voice-playback`
- **Worktree:** `.claude/worktrees/feat+28-voice-playback`

## Description
Assign voices to characters and play dialog line by line with highlighting.

### Files to Create
- `frontend/src/features/tts/components/VoiceAssignment.tsx`
- `frontend/src/features/tts/components/PlaybackControls.tsx`
- `frontend/src/features/tts/hooks/useAudioPlayback.ts`

### Files to Modify
- `frontend/src/features/tts/components/TtsPage.tsx`

### Steps
1. `VoiceAssignment` — two dropdowns (per character), populated from `useTtsVoices(providerId)`
2. `useAudioPlayback` hook — state: currentMessageIndex, isPlaying; play() synthesizes via API + plays audio, advance index; stop() aborts and resets
3. `PlaybackControls` — "Run" button, "Stop" button, progress indicator
4. Wire into TtsPage — VoiceAssignment after annotation editor, PlaybackControls at bottom; pass currentMessageIndex to AnnotationEditor for highlighting
5. Verify via Playwright — UI renders, buttons clickable, no JS errors

## Dependencies
- **#27** (OPEN) — Annotation editor + auto-annotation (TTS page component)
- **#12** (CLOSED) — TTS API routes (voices + synthesize) — backend is ready

## Related Context
- Backend TTS routes: `GET /tts/:providerId/voices` → IVoice[], `POST /tts/:providerId/synthesize` → audio binary
- Frontend feature structure: `features/tts/` with `api/`, `components/`, `hooks/`, `types/`
- TanStack Query for server state, Tailwind for styling
- Existing hook likely: `useTtsVoices(providerId)` already referenced in issue

## Likely Relevant Files/Dirs
- `frontend/src/features/tts/` — entire TTS feature directory
- `frontend/src/features/tts/components/TtsPage.tsx` — main page to modify
- `frontend/src/features/tts/api/queries.ts` — existing query hooks
- `frontend/src/lib/api-client.ts` — fetch wrapper
- `backend/src/routes/tts/` — backend TTS routes (reference)
