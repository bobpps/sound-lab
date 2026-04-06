# Alignment Check -- Issue #20: Frontend API Client + Shared Types

## Original Analysis Summary

The analysis (`analysis.md`) specified building two new files:

1. **`frontend/src/types/api.ts`** -- 12 read-model types mirroring the backend: `ProviderType`, `Provider`, `Dialog`, `DialogMessage`, `DialogWithMessages`, `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`, `AnnotationPrompt`, `AgentPrompt`, `Voice` (renamed from `IVoice`), and `ApiErrorResponse`.

2. **`frontend/src/lib/api-client.ts`** -- Typed `fetch` wrapper with:
   - `ApiError` class (no parameter properties due to `erasableSyntaxOnly`)
   - Methods: `api.get<T>`, `api.post<T>`, `api.put<T>`, `api.delete` (returns `Promise<void>`), `api.fetchRaw`
   - 204 handling (return `undefined as T`)
   - Error parsing from Fastify's `{ statusCode, error, message }` shape
   - `BASE_URL = '/api'`

Key constraints from analysis:
- `import type` required (`verbatimModuleSyntax`)
- `.ts` import extensions (frontend convention, per `allowImportingTsExtensions`)
- No enums (`erasableSyntaxOnly`) -- use string unions
- No Create/Update types (YAGNI)
- No barrel files
- Vite proxy for `/api` -> backend (identified as separate concern, later confirmed done by #19)

## What Was Implemented

### `frontend/src/types/api.ts` (103 lines)

All 12 types present:

| # | Type | Form | Present |
|---|------|------|---------|
| 1 | `ProviderType` | `type` (string union) | YES |
| 2 | `Provider` | `interface` | YES |
| 3 | `Dialog` | `interface` | YES |
| 4 | `DialogMessage` | `interface` | YES |
| 5 | `DialogWithMessages` | `interface` (extends Dialog) | YES |
| 6 | `AnnotatedDialog` | `interface` | YES |
| 7 | `AnnotatedMessage` | `interface` | YES |
| 8 | `AnnotatedDialogWithMessages` | `interface` (extends AnnotatedDialog) | YES |
| 9 | `AnnotationPrompt` | `interface` | YES |
| 10 | `AgentPrompt` | `interface` | YES |
| 11 | `Voice` | `interface` | YES |
| 12 | `ApiErrorResponse` | `interface` | YES |

Every field in every type matches the backend source (`backend/src/db/types.ts` and `backend/src/providers/tts/types.ts`) exactly.

### `frontend/src/lib/api-client.ts` (90 lines)

- `ApiError` class with explicit `readonly status: number` field and constructor body assignment (not parameter property)
- `override readonly name = 'ApiError'` on the class
- `handleResponse<T>()` handles 204 (`return undefined as T`), error parsing from Fastify shape, and JSON return
- `buildUrl()` helper prepends `BASE_URL = '/api'`
- `api` object with 5 methods: `get<T>`, `post<T>`, `put<T>`, `delete`, `fetchRaw`
- `import type { ApiErrorResponse }` used (verbatimModuleSyntax compliant)
- Import path: `'../types/api.ts'` (`.ts` extension, matching frontend convention)

## Mismatches

### Checked: All 12 types present?
**Result:** YES -- all 12 types are present with correct shapes. No mismatches.

### Checked: Voice renamed from IVoice correctly?
**Result:** YES -- named `Voice` on frontend, fields identical to backend `IVoice`. Name-only change as specified.

### Checked: ApiError uses explicit field (not parameter property) due to erasableSyntaxOnly?
**Result:** YES -- `status` is declared as `readonly status: number` class field, then assigned in the constructor body via `this.status = status`. No parameter property syntax used. The analysis initially showed a constructor with `public readonly status: number` as a parameter property, but the plan corrected this. The implementation follows the plan's corrected version.

### Checked: import type used (verbatimModuleSyntax)?
**Result:** YES -- line 1 of `api-client.ts`: `import type { ApiErrorResponse } from '../types/api.ts';`

### Checked: .ts import extensions (not .js) per frontend convention?
**Result:** YES -- uses `../types/api.ts`. This matches the existing frontend convention visible in `main.tsx` (`import App from './App.tsx'`). The analysis initially mentioned `.js` extensions per root CLAUDE.md (backend convention), but the plan corrected this after discovering `allowImportingTsExtensions: true` and observing the existing `.tsx` import pattern.

### Checked: api methods match spec?
**Result:** YES -- all 5 methods present with correct signatures:
- `get<T>(path: string): Promise<T>`
- `post<T>(path: string, body?: unknown): Promise<T>`
- `put<T>(path: string, body?: unknown): Promise<T>`
- `delete(path: string): Promise<void>`
- `fetchRaw(path: string, opts?: RequestInit): Promise<Response>`

### Checked: 204 handling?
**Result:** YES -- `handleResponse<T>()` checks `response.status === 204` and returns `undefined as T`. The `delete` method also accepts 204 as success (`!response.ok && response.status !== 204`).

### Checked: Error parsing from Fastify shape?
**Result:** YES -- parses `{ statusCode, error, message }` via `ApiErrorResponse` type. Falls back to `response.statusText` if body is not JSON.

### Checked: No Create/Update types (per YAGNI decision)?
**Result:** YES -- only read-model entity types are included. No `CreateProvider`, `UpdateDialog`, etc.

### Checked: No barrel files?
**Result:** YES -- no `index.ts` files created in `types/` or `lib/`.

### Minor Observations

1. **Analysis vs Plan: import extension convention** -- The analysis (section "Unknowns resolved", item 1) stated `.js` extensions per root CLAUDE.md. The plan corrected this to `.ts` after discovering `allowImportingTsExtensions: true` and the existing `main.tsx` import pattern. The implementation correctly follows the plan's correction. **Classification: N/A (corrected during planning, not a mismatch)**

2. **Analysis vs Plan: ApiError constructor** -- The analysis showed `public readonly status: number` as a parameter property. The plan corrected this to an explicit field due to `erasableSyntaxOnly`. The implementation follows the plan. **Classification: N/A (corrected during planning)**

3. **Plan counted "11 types/interfaces" in the summary table** -- The summary says "11 types/interfaces" but lists 12 items (including `ApiErrorResponse`). The count should be 12 (11 interfaces + 1 type alias). The implementation has all 12. **Classification: Minor (plan wording only, no code impact)**

## Corrections Made

Per the execution log, two corrections were applied during implementation:

1. **Import extensions:** Changed from `.js` (analysis) to `.ts` (plan/implementation) after discovering the actual frontend convention (`main.tsx` uses `./App.tsx`).

2. **ApiError class design:** Changed from parameter property `public readonly status` (analysis) to explicit field + body assignment (plan/implementation) to comply with `erasableSyntaxOnly: true`.

3. **Vite proxy (Task 3):** Skipped entirely because PR #19 had already merged with the identical proxy configuration. Documented in both the plan and execution log.

## Final Alignment Verdict

**Aligned.**

The implementation matches the analysis and plan in every material aspect. All 12 types are present and field-accurate against backend sources. The API client has all 5 specified methods with correct signatures, proper 204 handling, Fastify error parsing, and `erasableSyntaxOnly`/`verbatimModuleSyntax` compliance. The two corrections (import extensions, ApiError field pattern) were identified during planning and applied consistently -- they represent refinements from deeper investigation, not deviations from intent. No mismatches found.
