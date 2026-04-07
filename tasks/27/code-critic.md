# Code Review: feat/27-annotation-editor

## Potential bugs

### [BUG-1] Debounce reads stale `pairs` state (Major)
**File:** `frontend/src/features/tts/components/AnnotationEditor.tsx:106`
**What's wrong:** `handleTextChange` closes over `pairs` via the line `const pair = pairs.find(...)`. But `pairs` is captured at the time the handler is created. When a user types rapidly, the debounce timeout fires with the correct `newText` (captured in the `setTimeout` closure), but `pair` lookup happens against the `pairs` snapshot from the render when the handler was defined. If pairs changed between handler creation and execution (e.g., a different annotation was loaded, or another message update arrived), the lookup finds the wrong `pair` or no `pair`, and either silently skips the save or sends the update for the wrong `annotatedMessageId`.

React Compiler can't fix this because it's not a memoization issue -- it's a closure over component state consumed asynchronously outside the render cycle.

**Why it's bad:** Lost edits. User types, debounce fires, save silently does nothing because `pair?.annotated` is null on the stale snapshot. No error shown.

### [BUG-2] Two useEffects for hydration create a race on annotationId change (Major)
**File:** `frontend/src/features/tts/components/AnnotationEditor.tsx:52-82`
**What's wrong:** There are two separate `useEffect` hooks that both depend on `annotationId`:
1. Lines 52-77: Builds pairs, sets `hydratedAnnotationId.current = annotationId`
2. Lines 80-82: Resets `hydratedAnnotationId.current = null`

The intent is that effect #2 resets the ref, then effect #1 re-hydrates. But React does not guarantee a useful ordering between two independent effects during the same render cycle. Both fire in declaration order within a single render, so during the first render the sequence is: effect #1 sets ref to `annotationId`, then effect #2 immediately nulls it. On the next render (when data arrives), effect #1 sees ref as null and re-hydrates correctly. This happens to work, but only by accident -- the guard `hydratedAnnotationId.current === annotationId` in effect #1 is immediately undone by effect #2 in the same commit. The two effects should be a single effect. Two separate effects that mutate the same ref with contradictory logic and depend on execution order are a correctness liability.

**Why it's bad:** Fragile correctness. Any refactor that reorders these effects or changes their dependency arrays will introduce double-hydration or skipped-hydration bugs that are extremely hard to diagnose.

### [BUG-3] Sequential message creation without transaction semantics (Minor)
**File:** `frontend/src/features/tts/components/AnnotationEditor.tsx:155-161`
**What's wrong:** `handleSaveAsNewVariant` creates an annotation shell (step 1), then creates messages one-by-one in a `for...of` loop (step 2). If any `createAnnotationMessage.mutateAsync` call fails mid-way, the user ends up with a partial annotation -- some messages created, some not. There is no rollback logic. The annotation list has already been invalidated by step 1's `onSuccess`.

**Why it's bad:** Orphaned partial annotations in the database. The user sees a new annotation variant that is incomplete, with no way to know which messages were saved and which weren't.

## Abstraction problems

### [ABSTR-1] AnnotationEditor manages too many concerns (Major)
**File:** `frontend/src/features/tts/components/AnnotationEditor.tsx`
**What's wrong:** This single component handles:
1. Data fetching (two queries)
2. State hydration from server data into local pairs
3. Debounced auto-save with manual timer management
4. "Save as New Variant" multi-step mutation workflow
5. Modal open/close state for AutoAnnotateModal
6. Error state management
7. Loading/error rendering
8. Paired message rendering with highlight logic

That is 8 distinct responsibilities in 282 lines. The debounce logic alone (timer refs, cleanup, stale closure handling) deserves its own hook. The hydration logic (building pairs from two data sources) is a derived computation that should not live in `useEffect` + `useState` -- it's a classic case for `useMemo` (or letting the React Compiler handle it, which it can't because the hydration is gated by a mutable ref).

**Why it's bad:** Every new feature requirement (undo, batch save, optimistic updates, keyboard navigation) will pile more state into this already-overloaded component.

### [ABSTR-2] Pairs hydration uses useEffect + useState for derived state (Major)
**File:** `frontend/src/features/tts/components/AnnotationEditor.tsx:52-77`
**What's wrong:** The `pairs` array is derived from `annotationQuery.data` and `dialogQuery.data`. Instead of computing it directly (e.g., with `useMemo` or inline), it's computed inside a `useEffect` and stored in `useState`. This creates a "derived state in useEffect" anti-pattern: the component renders once with stale/empty pairs, then the effect fires and re-renders with correct pairs. This is one render cycle wasted on every data change, and the mutable ref guard (`hydratedAnnotationId`) adds complexity to prevent infinite loops.

The reason for using state (to allow local edits to `localText`) is valid, but the hydration mechanism conflates "initialize from server" with "keep local edits" in a way that makes it impossible for the React Compiler to optimize.

**Why it's bad:** Extra render on every data load. The ref-based guard is a manual React lifecycle hack that the React Compiler explicitly cannot reason about.

## Code quality

### [QUAL-1] Copy-paste: jsonResponse / extractUrl / extractMethod duplicated across 4+ test files (Minor)
**Files:** `queries.test.tsx:131`, `AnnotationEditor.test.tsx:47`, `AutoAnnotateModal.test.tsx:57`, `TtsPage.test.tsx:39`
**What's wrong:** `jsonResponse()`, `extractUrl()`, and `extractMethod()` are copy-pasted identically in every test file in this feature. Four files share the same utility functions verbatim.

**Why it's bad:** When the test utility pattern needs to change (e.g., adding default headers, changing error format), every copy must be updated independently.

### [QUAL-2] Annotation data duplicated across test fixtures (Minor)
**Files:** `queries.test.tsx:72-87`, `AnnotationEditor.test.tsx:12-45`, `AutoAnnotateModal.test.tsx:7-55`, `TtsPage.test.tsx:7-37`
**What's wrong:** Every test file independently defines the same provider, dialog, and annotation fixture data with slight variations. There is no shared fixture module.

**Why it's bad:** When the API shape changes (e.g., a new required field is added to `AnnotatedDialog`), every test file must be updated separately. This is exactly the kind of shotgun surgery that leads to forgotten updates and false-passing tests.

### [QUAL-3] Dead prop: `currentMessageIndex` is accepted but never tested and its source is unclear (Minor)
**File:** `frontend/src/features/tts/components/AnnotationEditor.tsx:17`
**What's wrong:** The `AnnotationEditor` accepts `currentMessageIndex?: number` which highlights a message row. But `TtsPage.tsx` never passes it. No test covers the highlight behavior. This looks like speculative generality -- a prop added for a future feature that doesn't exist yet.

**Why it's bad:** Dead code in the interface. Future developers will wonder whether this prop is load-bearing or safe to remove.

## State management

### [STATE-1] Local error state duplicates mutation error (Minor)
**File:** `frontend/src/features/tts/components/AnnotationEditor.tsx:43`, `AutoAnnotateModal.tsx:28`
**What's wrong:** Both `AnnotationEditor` and `AutoAnnotateModal` maintain a local `error` state (`useState<string | null>(null)`) that manually captures mutation errors via `onError` callbacks or `try/catch`. Meanwhile, `useMutation` already provides `error` and `isError` on the mutation result object. The local state duplicates what TanStack Query already tracks.

**Why it's bad:** Two sources of truth for error state. The local `error` must be manually cleared (`setError(null)`) before every operation, and stale errors can persist if the clearing logic is incomplete. The mutation's built-in `error` state is automatically managed by the query library.

### [STATE-2] AutoAnnotateModal local form state should use React Hook Form (Minor)
**File:** `frontend/src/features/tts/components/AutoAnnotateModal.tsx:22-28`
**What's wrong:** The modal manages 5 pieces of form state via individual `useState` calls (`selectedLlmProviderId`, `selectedModel`, `selectedPromptId`, `title`, `error`). The project's `frontend/CLAUDE.md` specifies "React Hook Form + Zod" for forms. This is a form with validation logic (`canSubmit` at line 40-45 duplicates what a Zod schema would declare).

**Why it's bad:** Diverges from the project's stated convention. The `canSubmit` guard is a hand-rolled validation that will drift as new fields are added.

## Cache invalidation

### [CACHE-1] handleSaveAsNewVariant fires N+1 cache invalidations (Minor)
**File:** `frontend/src/features/tts/components/AnnotationEditor.tsx:155-161`
**What's wrong:** The `for...of` loop calls `createAnnotationMessage.mutateAsync` for each message. Each call's `onSuccess` in `useCreateAnnotationMessage` (queries.ts:174-178) invalidates `ttsKeys.annotation(variables.annotationId)`. Combined with `useCreateAnnotation`'s invalidation of the annotations list, a dialog with 10 messages triggers 11 separate cache invalidations and potential refetches.

**Why it's bad:** Unnecessary network chatter. The annotation query is refetched after every single message creation, even though only the final state matters.

### [CACHE-2] useAutoAnnotate only invalidates annotations list, not the specific annotation (Minor)
**File:** `frontend/src/features/tts/api/queries.ts:132-135`
**What's wrong:** `useAutoAnnotate`'s `onSuccess` invalidates `ttsKeys.annotations(data.dialog_id)` (the list), but if the newly created annotation has the same ID as a previously viewed annotation (unlikely but possible with ID reuse), the stale detail cache for that annotation would persist.

More practically: after auto-annotate creates a new annotation and `onAnnotationCreated` is called, the parent sets `selectedAnnotationId` to the new ID. The `useAnnotation` hook then fetches the new annotation. But if the annotations list refetch hasn't completed yet, the `AnnotationSelector` still shows the old list. This is a timing issue, not a data corruption issue, but the user may briefly see an inconsistent state.

**Why it's bad:** Brief UI inconsistency between the annotation list and the selected annotation.

## Testing

### [TEST-1] No test for debounce cancellation on unmount (Minor)
**File:** `frontend/src/features/tts/components/AnnotationEditor.test.tsx`
**What's wrong:** The cleanup effect (lines 85-92 of AnnotationEditor.tsx) clears all pending debounce timers on unmount. No test verifies this. If the cleanup is accidentally removed, pending saves would fire after the component unmounts, potentially updating state on an unmounted component.

**Why it's bad:** Untested cleanup logic. The very purpose of the cleanup effect is to prevent post-unmount side effects, and it has no coverage.

### [TEST-2] No test for save-as-new-variant actually creating messages (Minor)
**File:** `frontend/src/features/tts/components/AnnotationEditor.test.tsx:189`
**What's wrong:** There is a test that verifies the "Save as New Variant" button exists, but no test that clicks it and verifies the POST requests are sent. The entire multi-step workflow (create annotation, create N messages, call onAnnotationCreated) has zero test coverage at the component level.

**Why it's bad:** The most complex user workflow in the component is completely untested. The sequential mutation chain, error handling, and callback invocation have no coverage.

### [TEST-3] No test for error states in AnnotationEditor (Minor)
**File:** `frontend/src/features/tts/components/AnnotationEditor.test.tsx`
**What's wrong:** No test covers the error UI. The component has explicit error rendering (lines 183-191) for query failures and an inline error banner (lines 218-222) for mutation failures. Neither path is tested.

**Why it's bad:** The error rendering code could be completely broken and tests would still pass.

### [TEST-4] No test for AutoAnnotateModal error state (Minor)
**File:** `frontend/src/features/tts/components/AutoAnnotateModal.test.tsx`
**What's wrong:** No test covers the error path when `autoAnnotate.mutateAsync` throws. The modal has explicit error rendering (lines 95-99), but it is never exercised in tests.

**Why it's bad:** Same as TEST-3. Error UI is dead code from a testing perspective.

## Summary
- Major issues: 4 (BUG-1, BUG-2, ABSTR-1, ABSTR-2)
- Minor issues: 9 (BUG-3, QUAL-1, QUAL-2, QUAL-3, STATE-1, STATE-2, CACHE-1, CACHE-2, TEST-1 through TEST-4)
- Overall assessment: The core debounce mechanism has a stale closure bug that will cause silent data loss, and the dual-effect hydration pattern is a ticking time bomb. The component's 8 responsibilities need to be decomposed before the next feature lands on top of this.

---

## Post-Fix Re-Review (commit 97cb047)

### Status of Previous Major Issues

**[BUG-1] Debounce reads stale `pairs` state — RESOLVED**
The handler no longer reads from a `pairs` state variable. `handleTextChange` now reads `annotationQuery.data?.messages` synchronously at call time (line 91) and resolves `annotatedMsg` before the `setTimeout` closure is created. The `setTimeout` then captures only the already-resolved `annotatedMsg` object and the `newText` parameter. The `annotationId` inside the timeout is captured from the outer closure, but the cleanup effect (line 68-79) clears all pending timers when `annotationId` changes, preventing stale timers from firing. This is correct.

**[BUG-2] Two useEffects for hydration create a race — RESOLVED**
The dual-effect hydration pattern has been completely eliminated. Pairs are now derived inline (lines 51-65) by computing `annotatedMap` from `annotationQuery.data` and mapping over `dialogQuery.data.messages`, overlaying `localTexts` for local edits. Only a single `useEffect` remains (lines 68-79) with the narrow responsibility of resetting `localTexts` and clearing timers on `annotationId` change. The mutable ref guard (`hydratedAnnotationId`) is gone entirely.

**[ABSTR-1] AnnotationEditor manages too many concerns — PARTIALLY RESOLVED**
The component dropped from ~282 lines to ~272 lines and from 8 responsibilities to ~6. The derived-state-in-useEffect + mutable ref hydration machinery (the most complex piece) is gone, which meaningfully reduces cognitive load. The debounce logic is still inline rather than extracted to a hook, and the component still owns data fetching, local state, mutation orchestration, and rendering. That said, the remaining code is straightforward enough that this is no longer a blocking concern for a first PR — it's a follow-up refactor candidate.

**[ABSTR-2] Pairs hydration uses useEffect + useState for derived state — RESOLVED**
The `useEffect + useState` anti-pattern is completely gone. Pairs are now computed inline as a derived value from query data + `localTexts` Map. The `localTexts` useState is appropriate — it represents genuinely local state (user edits not yet confirmed by server), not derived state. The React Compiler can now reason about the pairs derivation. No extra render cycle on data load.

### New Issues Introduced by the Fix

**[NEW-1] localTexts entries are never cleaned up after successful save (Trivial)**
**File:** `AnnotationEditor.tsx:62`
When the user edits a message and the debounced save succeeds, the server refetch updates `annotationQuery.data`, but the entry in `localTexts` persists indefinitely (until `annotationId` changes). Because the precedence at line 62 is `localTexts.get(original.id) ?? annotated?.text ?? original.text`, the local override always wins. This means: (a) if the server modifies the text on save (e.g., trims whitespace, normalizes unicode), the user never sees the canonical server value; (b) stale map entries accumulate over a session, though the memory cost is negligible. Not blocking — this is a polish item.

**[NEW-2] annotationQuery.data could be undefined during handleTextChange (Trivial)**
**File:** `AnnotationEditor.tsx:91`
If for some reason `handleTextChange` fires while `annotationQuery.data` is `undefined` (e.g., during a background refetch where the query transitions to loading state with `keepPreviousData` not set), `annotatedMsg` will be `undefined` and the function returns early at line 94. The text will still be stored in `localTexts` (line 84-88), so the user sees their edit but it never saves. This is defensive and correct — it fails safe by not saving rather than saving to the wrong target. Not a bug, just noting the behavior.

### Unchanged Issues (Still Present from Original Review)

All Minor issues from the original review remain unchanged, as expected — the fix was scoped to the hydration and stale closure bugs:
- **BUG-3** (sequential message creation without transactions) — still present, unchanged code
- **QUAL-1** (copy-paste test utilities) — still present
- **QUAL-2** (duplicated test fixtures) — still present
- **QUAL-3** (dead `currentMessageIndex` prop) — still present, prop still accepted but never passed by parent
- **STATE-1** (local error state duplicates mutation error) — still present
- **STATE-2** (AutoAnnotateModal form state) — still present, out of scope
- **CACHE-1** (N+1 cache invalidations in save-as-new-variant) — still present
- **CACHE-2** (useAutoAnnotate partial invalidation) — still present
- **TEST-1** (no test for debounce cancellation on unmount) — still present
- **TEST-2** (no test for save-as-new-variant workflow) — still present
- **TEST-3** (no test for error states) — still present
- **TEST-4** (no test for AutoAnnotateModal error) — still present

### Updated Severity Assessment

| Severity | Count | Issues |
|----------|-------|--------|
| Major | 0 | All resolved |
| Minor | 12 | BUG-3, QUAL-1-3, STATE-1-2, CACHE-1-2, TEST-1-4 |
| Trivial | 2 | NEW-1, NEW-2 |

### Blocking Assessment

**No remaining issues are blocking for PR merge.** The two Major bugs (stale closure, dual-effect hydration) were the only blocking issues, and both are fully resolved. The refactored code is cleaner, more idiomatic, and the React Compiler can now optimize the pairs derivation. The remaining Minor issues are all pre-existing technical debt or missing test coverage that can be addressed in follow-up work.
