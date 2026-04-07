# Analysis — Issue #26: TTS Testing — Provider/Dialog/Annotation Selection

## What the Task Requires

Build the first part of the TTS testing page with a sequential selection flow:
1. Select a TTS provider
2. Select a dialog
3. Select an annotation variant (or "Clean" for no annotation)

This is frontend-only work. Backend endpoints already exist.

## Backend API Endpoints

| Method | Endpoint | Response | Notes |
|--------|----------|----------|-------|
| `GET /api/providers?type=tts` | `Provider[]` | Filters by `type` query param |
| `GET /api/tts/:providerId/voices` | `Voice[]` | Returns 400 if no API key configured |
| `GET /api/dialogs` | `Dialog[]` | All dialogs |
| `GET /api/dialogs/:dialogId/annotations` | `AnnotatedDialog[]` | Annotations for a dialog |

## Response Types (from `frontend/src/types/api.ts`)

- `Provider`: `{ id, name, type, enabled, created_at }`
- `Voice`: `{ id, name, language, gender?, description?, previewUrl?, providerMeta? }`
- `Dialog`: `{ id, title, description, language, created_by, created_at }`
- `AnnotatedDialog`: `{ id, dialog_id, provider_id, title, created_by, created_at }`

## Frontend Patterns to Follow

### Query Hooks
- Key factory pattern from `features/datasets/api/queries.ts` for complex queries
- Simpler inline pattern from `features/providers/api/queries.ts` for straightforward queries
- Import `apiClient` from `../../../lib/api-client.ts`, types from `../../../types/api.ts`
- Conditional queries use `enabled` flag

### Page Components
- `ProvidersPage.tsx` (latest pattern): uses shared `Tabs` component
- `pages/TtsPage.tsx` is a placeholder that needs to re-export from feature (like `pages/ProvidersPage.tsx`)

### Loading/Error/Empty States (from `ProviderList.tsx`)
- `isPending` → loading placeholder
- `error instanceof ApiError` → specific error message
- `error` (other) → generic error message
- Empty array → dashed-border empty state

### Styling
- Tailwind throughout
- Cards: `rounded-2xl border border-gray-200 bg-white p-5 shadow-sm`
- Errors: `border-red-200 bg-red-50 text-red-700`

## Test Patterns

- `vi.stubGlobal("fetch", vi.fn(...))` — no MSW
- `renderHook()` with `createTestWrapper({ queryClient })`
- `renderWithProviders(<Page />)` for component tests
- `userEvent.setup()` for interactions
- Test helpers in `frontend/src/test-utils.tsx`

## Constraints from Project Guidance

- No cross-feature imports — must create own hooks even if datasets/providers have similar ones
- No barrel files
- React Compiler active — no manual memoization
- `forwardRef` deprecated — ref is a regular prop
- ESM imports with `.js` extensions (backend only; frontend uses Vite)

## Risks

1. **No shared dropdown/select component** — must build selectors from scratch (native `<select>` or custom)
2. **Voice endpoint requires API key** — `GET /tts/:providerId/voices` returns 400 if no key configured; UI must handle gracefully
3. **Hook duplication** — `useDialogs()` and providers query already exist in other features but cannot be imported

## Assumptions

1. Sequential selection flow: provider → dialog → annotation, each step enables the next
2. "Clean (no annotation)" is a null/default option in annotation selector
3. `useTtsVoices(providerId)` is created but not wired to UI until Tasks 26-27
4. Local `useState` in TtsPage for selection state (no Zustand needed)
5. Show only enabled TTS providers in the selector

## Key Files for Implementation

**Patterns:**
- `frontend/src/features/providers/api/queries.ts` — query hooks
- `frontend/src/features/providers/components/ProvidersPage.tsx` — page layout
- `frontend/src/features/providers/components/ProviderList.tsx` — loading/error/empty
- `frontend/src/features/datasets/api/queries.ts` — conditional queries

**Types:** `frontend/src/types/api.ts`
**API Client:** `frontend/src/lib/api-client.ts`
**Test Utils:** `frontend/src/test-utils.tsx`

## Files to Create/Modify

- Create: `frontend/src/features/tts/api/queries.ts`
- Create: `frontend/src/features/tts/components/TtsPage.tsx`
- Create: `frontend/src/features/tts/components/ProviderSelector.tsx`
- Create: `frontend/src/features/tts/components/DialogSelector.tsx`
- Create: `frontend/src/features/tts/components/AnnotationSelector.tsx`
- Modify: `frontend/src/pages/TtsPage.tsx` (re-export from feature)
- No change to `router.tsx` (already imports from pages/TtsPage.tsx)
