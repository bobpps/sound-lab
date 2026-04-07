# Code Review: #26 TTS Selection Page

## Diff Summary

Adds the TTS testing page with three cascading selectors (Provider -> Dialog -> Annotation) and the supporting TanStack Query hooks. 11 files changed: 4 production components, 4 test files, 1 query module with tests, 1 page re-export. +1156 / -6 lines.

## Files Changed

| File | Purpose |
|---|---|
| `frontend/src/features/tts/api/queries.ts` | 4 TanStack Query hooks: `useTtsProviders`, `useTtsVoices`, `useDialogs`, `useAnnotationsByDialog` + `ttsKeys` factory |
| `frontend/src/features/tts/api/queries.test.tsx` | 7 tests covering all hooks including disabled-query states |
| `frontend/src/features/tts/components/ProviderSelector.tsx` | Provider dropdown, filters to enabled-only |
| `frontend/src/features/tts/components/ProviderSelector.test.tsx` | 5 tests: render, filtering, loading, error, controlled value |
| `frontend/src/features/tts/components/DialogSelector.tsx` | Dialog dropdown with empty-state handling |
| `frontend/src/features/tts/components/DialogSelector.test.tsx` | 5 tests: render, loading, error, controlled value, empty |
| `frontend/src/features/tts/components/AnnotationSelector.tsx` | Annotation dropdown with "Clean (no annotation)" option |
| `frontend/src/features/tts/components/AnnotationSelector.test.tsx` | 6 tests: render, clean selection, loading, error, controlled, null->clean |
| `frontend/src/features/tts/components/TtsPage.tsx` | Orchestrating page with cascading state management |
| `frontend/src/features/tts/components/TtsPage.test.tsx` | 6 integration tests: progressive disclosure, reset behavior |
| `frontend/src/pages/TtsPage.tsx` | Re-export following existing pattern (matches `ProvidersPage.tsx`) |

## Verification Outcomes

- Build: PASS
- All tests: 388/388 PASS (336 backend + 52 frontend)
- Lint: PASS

## Architecture Compliance

- Feature-based structure: follows `features/tts/api/` + `features/tts/components/` pattern
- No cross-feature imports: each selector imports only from its own feature's `api/queries.ts`
- No barrel files: direct file imports throughout
- TanStack Query for server state: all 4 hooks follow the established pattern
- Tailwind CSS: consistent styling matching existing pages (ProvidersPage, DatasetsPage)
- React Compiler: no manual memoization anywhere
- ESM: `.ts` extensions in all imports
- Test selectors: `getByRole` and `findByRole` used exclusively -- no `getByTestId`
- Page re-export pattern: matches existing `pages/ProvidersPage.tsx`

## Issues Found

### Minor

1. **Duplicate `useDialogs` hook across features** (queries.ts:32-36)
   - `features/tts/api/queries.ts` defines `useDialogs()` hitting `GET /dialogs` with key `["tts", "dialogs"]`
   - `features/datasets/api/queries.ts` defines `useDialogs()` hitting `GET /dialogs` with key `["dialogs", "list"]`
   - Same endpoint, different cache entries. This is technically correct per the "no cross-feature imports" rule, and both caches stay fresh independently. However, it means dialog mutations in the datasets feature won't automatically invalidate the TTS cache and vice versa.
   - **Verdict**: Acceptable trade-off given the architecture rules. Worth noting that a shared `lib/` hook could serve both, but the project explicitly forbids cross-feature imports. The duplication is small (4 lines) and the caches being separate is actually safer for independent feature development.

2. **`handleProviderSelect` resets dialog/annotation but dialog selection is independent of provider** (TtsPage.tsx:16-18)
   - When a user changes provider, `selectedDialogId` and `selectedAnnotationId` are reset to `null`. Since dialogs are not provider-scoped (the `useDialogs()` call has no provider filter), the dialog list doesn't actually change when the provider changes. The reset is arguably unnecessary UX friction.
   - **Verdict**: This is a defensible UX choice -- the provider change could imply a new TTS synthesis context. No bug here, just a design decision worth confirming with the product owner.

3. **`ProviderSelector` emits empty string on initial render if user doesn't interact** (ProviderSelector.tsx:40-42)
   - The `onChange` handler passes `e.target.value` directly. If the browser auto-selects the disabled placeholder, no `onChange` fires. But if the `selectedId` is `null` and the select is rendered with `value=""`, the disabled placeholder is selected. This is correct behavior -- just noting the empty string never reaches `onSelect` because the placeholder is `disabled`.
   - **Verdict**: No bug. Working as intended.

4. **No `aria-describedby` or field-level error messages** (all selectors)
   - Error states render plain text divs instead of associating errors with the select via `aria-describedby`. For an internal tool this is acceptable, but it's below WCAG best practices.
   - **Verdict**: Fine for internal tool. Could be enhanced later.

### No Major or Fundamental Issues Found

## Positive Observations

1. **Cascading state management is clean**: The progressive disclosure (provider -> dialog -> annotation) with proper reset semantics in `TtsPage.tsx` is well-implemented and thoroughly tested.

2. **Test quality is high**: 29 frontend tests covering loading, error, empty, controlled value, and reset states. Tests use `userEvent` over `fireEvent`, query by role/label (not `testId`), and the mock setup with `vi.stubGlobal("fetch")` is consistent with the codebase.

3. **Query key factory (`ttsKeys`)**: Follows the same pattern as `dialogKeys` in datasets, with proper `as const` for type safety.

4. **Conditional query enabling**: Both `useTtsVoices` and `useAnnotationsByDialog` correctly use `enabled` to prevent firing when their dependency is `null`, and tests verify the `fetchStatus: "idle"` state.

5. **AnnotationSelector's "Clean" option**: Elegant handling of the `null` annotation case using a special `"clean"` string value that maps to `null` in the callback.

## Known Limitations

- `useTtsVoices` hook is defined but not yet used in any component (it will be needed in a future voice-selection step).
- No Suspense/ErrorBoundary wrapping -- each selector handles its own loading/error states inline. This is consistent with the existing codebase (ProvidersPage, DatasetsPage don't use Suspense either).
- Dialog list is unfiltered (all dialogs shown regardless of language). This may need filtering once voice/language selection is added.

## PR Readiness

**READY TO MERGE**

The implementation is correct, well-tested, follows all project patterns, and introduces no regressions. The minor issues identified are design decisions rather than defects. The unused `useTtsVoices` hook is intentional forward preparation for the next implementation step.
