# Task Context — Issue #20

- **Issue:** #20 — Task 19: Frontend API client + shared types
- **URL:** https://github.com/bobpps/sound-lab/issues/20
- **Branch:** `feat/20-frontend-api-client`
- **Worktree:** `.claude/worktrees/feat/20-frontend-api-client`
- **Labels:** frontend, infrastructure
- **Phase:** 6 — Frontend Infrastructure (2/3)
- **Depends on:** #19 (frontend deps + Tailwind) — not yet merged but not blocking for this task

## Issue Description

Create typed fetch wrapper and shared API response types for the frontend.

### Files to create:
1. `frontend/src/types/api.ts` — mirror backend types
2. `frontend/src/lib/api-client.ts` — typed fetch wrapper

### Types to mirror (from `backend/src/db/types.ts`):
- `Provider`, `ProviderType`
- `Dialog`, `DialogMessage`, `DialogWithMessages`
- `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`
- `AnnotationPrompt`
- `AgentPrompt`

### Additional type (from `backend/src/providers/tts/types.ts`):
- `Voice` (backend name: `IVoice`) — id, name, language, gender?, description?, previewUrl?, providerMeta?

### API Client requirements:
- `ApiError` class with status code
- `api.get<T>(path)`, `api.post<T>(path, body)`, `api.put<T>(path, body)`, `api.delete(path)`
- `api.fetchRaw(path, opts)` for binary data (audio)
- Base URL: `/api`
- Auto Content-Type: application/json
- 204 → return undefined
- Non-ok → throw ApiError with message from body

### Verification:
- `npx tsc --noEmit` must pass

## Relevant project guidance:
- ESM everywhere, `.js` extensions in imports
- Frontend: feature-based structure, shared code in top-level `lib/`, `types/`
- HTTP: typed `fetch` wrapper in `lib/api-client.ts`
- No barrel files
- Vite proxy: `/api` → `http://localhost:3000`

## Key backend source files:
- `backend/src/db/types.ts` — entity types
- `backend/src/db/interfaces.ts` — repository interfaces
- `backend/src/providers/tts/types.ts` — IVoice, ISynthesizeOptions, ITTSProvider
