# Task Context — Issue #9

## Issue
- **Number:** 9
- **Title:** Task 8: TTS provider interface + registry + ElevenLabs adapter
- **URL:** https://github.com/bobpps/sound-lab/issues/9
- **Labels:** backend, providers
- **Assignees:** none
- **Comments:** 0

## Branch & Worktree
- **Branch:** `feat/9-tts-provider`
- **Worktree:** `.claude/worktrees/feat/9-tts-provider`
- **Base:** `origin/main`

## Description
Phase 3: Backend TTS Providers (1/4). Define TTS provider abstraction and implement first adapter (ElevenLabs).

### Files to Create
- `backend/src/providers/tts/types.ts` — IVoice, ISynthesizeOptions, ITTSProvider interfaces
- `backend/src/providers/tts/registry.ts` — createTTSProvider(), getSupportedTTSProviders()
- `backend/src/providers/tts/elevenlabs.ts` — ElevenLabsTTSProvider implementation
- `backend/tests/providers/elevenlabs.test.ts` — tests with mocked fetch

### Interfaces Required
- `IVoice` — id, name, language, gender?, description?, previewUrl?, providerMeta?
- `ISynthesizeOptions` — voiceId, text, speed?, temperature?, format?, sampleRate?
- `ITTSProvider` — id, name, getVoices(), synthesize(opts) -> Buffer, validateCredentials() -> boolean

### Steps from Issue
1. Create types.ts with IVoice, ISynthesizeOptions, ITTSProvider
2. Write ElevenLabs tests (mock fetch): getVoices, synthesize, validateCredentials
3. Run tests — fail
4. Implement ElevenLabsTTSProvider
5. Create registry with createTTSProvider and getSupportedTTSProviders
6. Run tests — pass
7. Commit

### Dependencies
- Depends on #2 (providers CRUD — already merged)

## Relevant Repo Context
- Provider IDs are natural string keys (`"elevenlabs"`, `"google"`)
- Providers CRUD already exists: `IProviderRepository` in `backend/src/db/interfaces.ts`
- Provider data stored in DB includes encrypted API keys
- `backend/src/db/local/crypto.ts` handles key encryption
- ESM everywhere — `.js` extensions required
- Vitest for testing, `createTestDb()` for in-memory SQLite
- This task is purely backend, no frontend changes needed
- This does NOT touch the DB layer — it's a new `providers/tts/` module
