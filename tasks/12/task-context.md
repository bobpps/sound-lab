# Task Context — Issue #12

- **Issue:** #12 — Task 11: TTS API routes (voices + synthesize)
- **URL:** https://github.com/bobpps/sound-lab/issues/12
- **Branch:** `feat/12-tts-routes`
- **Worktree:** `.claude/worktrees/feat/12-tts-routes`
- **Labels:** backend, providers
- **Dependencies:** #4 (Providers CRUD — closed), #9 (TTS provider interface + registry — closed)

## Description

Create HTTP endpoints for fetching voices and synthesizing speech via TTS providers.

**Endpoints:**
- `GET /tts/:providerId/voices` → `IVoice[]`
- `POST /tts/:providerId/synthesize` → audio binary (`Content-Type: audio/mpeg`)

**Route handler pattern:**
1. Look up provider in DB → 404 if not found or not type `tts`
2. Get decrypted API key → 400 if no key set
3. Create provider instance via `createTTSProvider(id, apiKey)`
4. Call provider method
5. For synthesize: return Buffer with `Content-Type: audio/mpeg`

**Files to create:**
- `backend/src/routes/tts/index.ts`
- `backend/tests/routes/tts.test.ts`

## Steps from Issue

1. Write tests — mock TTS registry, seed provider with key, test: GET voices returns array, POST synthesize returns audio, 404 for unknown provider, 400 if no API key set
2. Run tests — fail
3. Implement routes
4. Run tests — pass
5. Commit

## Relevant Repo Areas

- `backend/src/routes/` — existing route patterns
- `backend/src/providers/tts/` — TTS provider registry and types
- `backend/src/db/` — database interfaces, provider repository
- `backend/src/crypto.ts` — API key encryption/decryption
- `backend/tests/` — test patterns
