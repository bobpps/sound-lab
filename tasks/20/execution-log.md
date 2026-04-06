# Execution Log -- Issue #20: Frontend API Client + Shared Types

## Phase: Research (complete)

### 2026-04-06 -- Initial research

**Read project guidance:**
- Root `CLAUDE.md` -- ESM everywhere, `.js` extensions, TDD default
- `backend/CLAUDE.md` -- TypeBox schemas, app factory, error handling with `@fastify/sensible`
- `frontend/CLAUDE.md` -- Feature-based structure, no barrel files, typed fetch wrapper in `lib/api-client.ts`, TanStack Query for server state

**Read frontend structure:**
- Fresh Vite scaffold: `App.tsx`, `main.tsx`, CSS files, assets only
- No existing `lib/`, `types/`, or `features/` directories
- `tsconfig.app.json`: target ES2023, bundler moduleResolution, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, strict
- `vite.config.ts`: bare minimum -- no proxy configured yet
- `package.json`: React 19, Vite 8, no additional deps (TanStack Query etc. not installed yet -- likely from #19)

**Read backend types:**
- `backend/src/db/types.ts` -- 10 entity types + 9 Create/Update types
- `backend/src/providers/tts/types.ts` -- `IVoice`, `ISynthesizeOptions`, `ITTSProvider`

**Read backend routes:**
- 6 route modules: providers, dialogs, annotations, annotation-prompts, agent-prompts, health
- All routes registered at root level via `@fastify/autoload` with `dirNameRoutePrefix: true`
- No `/api` prefix on backend -- frontend proxy must strip it
- Error responses use Fastify sensible format: `{ statusCode, error, message }`

**Read backend schemas:**
- `schemas/common.ts` -- `ErrorResponse` type: `{ statusCode: number, error: string, message: string }`
- `schemas/provider.ts` -- TypeBox schemas matching db types

**Key decisions documented in analysis.md:**
- Only read-model types (no Create/Update) per issue scope
- `IVoice` -> `Voice` (drop I-prefix)
- `ProviderType` as string union (no enums due to `erasableSyntaxOnly`)
- Base URL `/api` with Vite proxy rewrite dependency
- ApiError extracts `message` from Fastify error response body

## Phase: Implementation (complete)

### 2026-04-06 -- Task 1: Entity types

Created `frontend/src/types/api.ts` with read-model types:
- `Provider`, `ProviderType` (string union, not enum -- `erasableSyntaxOnly`)
- `Dialog`, `DialogMessage`, `DialogWithMessages`
- `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`
- `AnnotationPrompt`, `AgentPrompt`
- `Voice` (frontend-friendly naming, no I-prefix)
- `ApiErrorResponse` (matches Fastify sensible error format)

**TDD exception:** Types-only file has no runtime behavior to test. TypeScript type-check IS the test.

### 2026-04-06 -- Task 2: API client

Created `frontend/src/lib/api-client.ts` with:
- `ApiError` class (explicit field + constructor body, no parameter properties per `erasableSyntaxOnly`)
- `handleResponse<T>()` -- extracts JSON, handles 204, throws `ApiError` with message from Fastify error body
- `api` object with `get`, `post`, `put`, `delete`, `fetchRaw` methods
- Base URL `/api` -- relies on Vite proxy from Task 3 (already done in #19)
- Import uses `.ts` extension (`../types/api.ts`) per project convention
- Uses `import type` for type-only imports per `verbatimModuleSyntax`

**TDD exception:** No vitest configured in frontend `package.json`. Unit tests would require adding vitest + MSW as dependencies (out of scope for this issue). Type-check is sufficient verification.

### 2026-04-06 -- Task 3: Vite proxy (skipped)

Already done in PR #19. Confirmed `vite.config.ts` has `/api` proxy to `localhost:3000` with path rewrite.

### 2026-04-06 -- Task 4: Verification

All checks passed:
- `npx tsc -b --noEmit` -- exit 0
- `npx eslint .` -- exit 0
- Both files exist: `frontend/src/types/api.ts`, `frontend/src/lib/api-client.ts`
