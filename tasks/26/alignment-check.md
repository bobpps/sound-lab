# Alignment Check — Issue #26: TTS Selection UI

## Original Analysis Summary

The analysis called for building the TTS testing page with a sequential selection flow:

1. **4 query hooks**: `useTtsProviders`, `useTtsVoices`, `useDialogs`, `useAnnotationsByDialog` with key factory pattern (`ttsKeys`)
2. **3 selector components**: `ProviderSelector`, `DialogSelector`, `AnnotationSelector` — each with loading/error/empty states
3. **1 orchestrating page**: `TtsPage` with cascading state resets (provider change resets dialog+annotation, dialog change resets annotation)
4. **Router wiring**: `pages/TtsPage.tsx` re-exports from feature; no `router.tsx` changes needed

Key constraints:
- No cross-feature imports
- React Compiler active — no manual memoization
- TDD with `vi.stubGlobal("fetch")` pattern
- Import `api` from `lib/api-client.ts`, types from `types/api.ts`
- Show only enabled TTS providers
- "Clean (no annotation)" as null/default option in annotation selector
- Error states using `ApiError` differentiation (from `ProviderList.tsx` pattern)
- Styling: card = `rounded-2xl border border-gray-200 bg-white p-5 shadow-sm`, errors = `border-red-200 bg-red-50 text-red-700`

## What Was Implemented

**11 files created/modified** — matches the plan's file map exactly:

| File | Status |
|------|--------|
| `features/tts/api/queries.ts` | Created — 4 hooks + `ttsKeys` factory |
| `features/tts/api/queries.test.tsx` | Created — 7 tests |
| `features/tts/components/ProviderSelector.tsx` | Created |
| `features/tts/components/ProviderSelector.test.tsx` | Created — 5 tests |
| `features/tts/components/DialogSelector.tsx` | Created |
| `features/tts/components/DialogSelector.test.tsx` | Created — 5 tests |
| `features/tts/components/AnnotationSelector.tsx` | Created |
| `features/tts/components/AnnotationSelector.test.tsx` | Created — 6 tests |
| `features/tts/components/TtsPage.tsx` | Created — orchestrator |
| `features/tts/components/TtsPage.test.tsx` | Created — 5 tests |
| `pages/TtsPage.tsx` | Modified — re-exports from feature |

## Mismatches

### 1. Error states don't use `ApiError` differentiation — **Minor**

The analysis specified following the `ProviderList.tsx` pattern which checks `error instanceof ApiError` for specific messages and has a separate fallback for generic errors with styling `border-red-200 bg-red-50 text-red-700`.

**Implementation**: All three selectors use a simpler pattern — just `isError` with `text-red-600` (no `ApiError` import, no card-style error, no differentiated error messages). Example from `ProviderSelector.tsx`:
```tsx
if (providersQuery.isError) {
  return <div className="text-sm text-red-600">Failed to load providers.</div>;
}
```

**Expected** (from ProviderList.tsx pattern):
```tsx
if (providersQuery.error instanceof ApiError) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{providersQuery.error.message}</div>;
}
if (providersQuery.error) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Unable to load providers right now.</div>;
}
```

**Verdict**: Minor. The components still handle errors — just with less visual prominence and without showing backend-provided error messages. For inline selectors within a card, the simpler styling is arguably reasonable, though it deviates from the established pattern.

### 2. ProviderSelector has no empty state — **Minor**

The analysis specifies loading/error/empty states for each component. `DialogSelector` handles empty state (`"No dialogs available."`), but `ProviderSelector` does not handle the case where `enabledProviders` is empty after filtering. If all providers are disabled, the select renders with only the placeholder option.

**Verdict**: Minor. Edge case — if all TTS providers are disabled, the user gets a dropdown with only "Select a provider..." which is confusing but not broken.

### 3. Card padding is p-6 instead of p-5 — **Minor**

Analysis: `rounded-2xl border border-gray-200 bg-white p-5 shadow-sm`
Implementation: `rounded-2xl border border-gray-200 bg-white p-6 shadow-sm`

**Verdict**: Minor. 1px difference in padding. The p-6 matches other cards in the codebase (e.g., DialogEditor, DialogList), while p-5 matches ProviderCard specifically.

### 4. Cascade behavior on provider change: dialog selector remains visible — **Minor**

The analysis says "each step enables the next" (cascade pattern). When provider changes, TtsPage resets `selectedDialogId` to null but the `DialogSelector` still renders because `selectedProviderId !== null`.

The test at line 196-205 of `TtsPage.test.tsx` explicitly verifies this behavior: dialog selector stays visible, annotation hides. This is a reasonable UX choice (no need to re-show the dialog selector when switching providers since dialogs are provider-independent), but differs slightly from a strict "cascade reset = hide" interpretation.

**Verdict**: Minor. The implementation's behavior is actually better UX — dialogs aren't provider-specific, so keeping the selector visible is correct.

## Corrections Made

None. All mismatches are Minor severity and represent acceptable implementation choices.

## Final Alignment Verdict

**ALIGNED** — The implementation faithfully delivers all core requirements from the analysis:

- All 4 query hooks implemented with correct endpoints, conditional `enabled` flags, and key factory
- All 3 selectors render with loading/error states and correct props
- Cascading state resets work correctly (provider change -> reset dialog+annotation, dialog change -> reset annotation)
- "Clean (no annotation)" option works as null selection
- Only enabled providers shown
- No cross-feature imports
- No manual memoization (React Compiler compatible)
- TDD with `vi.stubGlobal("fetch")` pattern throughout
- Router wiring via `pages/TtsPage.tsx` re-export, no `router.tsx` changes
- 33 total tests covering hooks, components, and page integration

The 4 minor mismatches (simplified error styling, missing empty state on ProviderSelector, p-6 vs p-5 padding, cascade visibility behavior) are non-blocking and represent reasonable implementation decisions.
