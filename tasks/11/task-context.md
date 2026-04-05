# Task Context: Issue #11

## Issue
- **Number:** 11
- **Title:** Task 10: Inworld TTS adapter
- **URL:** https://github.com/bobpps/sound-lab/issues/11
- **Labels:** backend, providers
- **Assignees:** none

## Branch & Worktree
- **Branch:** `feat/11-inworld-tts`
- **Worktree:** `.claude/worktrees/feat/11-inworld-tts`

## Description
Phase 3: Backend TTS Providers (3/4). Goal: Inworld TTS adapter.

**Files:**
- Create: `backend/src/providers/tts/inworld.ts`
- Create: `backend/tests/providers/inworld-tts.test.ts`
- Modify: `backend/src/providers/tts/registry.ts` (add inworld entry)

**Steps:**
1. Research Inworld TTS API — auth, voice listing, synthesis endpoints
2. Write tests — mock HTTP, test getVoices/synthesize/validateCredentials
3. Run tests — fail
4. Implement `InworldTTSProvider`
5. Add to registry
6. Run tests — pass
7. Commit

## Dependencies
- **#9** (Task 8: TTS provider interface + registry + ElevenLabs adapter) — **CLOSED** (merged)

## Relevant Files/Directories
- `backend/src/providers/tts/` — existing TTS providers and registry
- `backend/tests/providers/` — existing provider tests
- `backend/src/providers/tts/registry.ts` — provider registry to modify
- `backend/src/providers/tts/interface.ts` — TTS provider interface
- `backend/CLAUDE.md` — backend guidance
- `CLAUDE.md` — project guidance
- `docs/plans/2026-04-04-full-project-plan.md` — full project plan reference
