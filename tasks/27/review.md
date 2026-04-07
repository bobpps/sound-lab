# Code Review: Issue #27 -- TTS Annotation Editor

## Diff Summary

| File | Action | Lines |
|------|--------|-------|
| `frontend/src/features/tts/api/queries.ts` | Modified | +148 (5 query hooks, 4 mutation hooks, input types, ttsKeys entries) |
| `frontend/src/features/tts/api/queries.test.tsx` | Modified | +333 (19 hook tests covering all queries and mutations) |
| `frontend/src/features/tts/components/AnnotationEditor.tsx` | Created | +273 (paired message editor with debounced auto-save, Save as New Variant) |
| `frontend/src/features/tts/components/AnnotationEditor.test.tsx` | Created | +217 (4 component tests) |
| `frontend/src/features/tts/components/AutoAnnotateModal.tsx` | Created | +231 (LLM provider/model/prompt selection modal) |
| `frontend/src/features/tts/components/AutoAnnotateModal.test.tsx` | Created | +246 (5 component tests) |
| `frontend/src/features/tts/components/TtsPage.tsx` | Modified | +14 (wire AnnotationEditor below selectors) |
| `frontend/src/features/tts/components/TtsPage.test.tsx` | Modified | +65 (2 new integration tests: show/hide editor) |
| `frontend/src/features/tts/components/AnnotationSelector.tsx` | Modified | ~0 (no functional change visible) |
| `frontend/src/features/tts/components/AnnotationSelector.test.tsx` | Modified | tests restructured |

**Total: ~+1614 / -51 lines across 10 files**

## Verification Outcomes

- **Build:** PASS (reported by implementer)
- **Tests:** 411/411 PASS (reported by implementer)
- **Lint:** PASS (reported by implementer)

---

## Re-Review After Fix (commit 97cb047)

### Fix Summary

Commit `97cb047` refactored `AnnotationEditor.tsx` (-51/+41 lines):
- Replaced `pairs` state + two hydration `useEffect` hooks with a **derived computation** from `annotationQuery.data` + `localTexts` map
- `handleTextChange` now reads annotated message from `annotationQuery.data` directly (avoids stale closure on `pairs`)
- Single `useEffect` for cleanup on `annotationId` change (clears `localTexts` + debounce timers)
- Disabled textareas for messages without annotated counterpart (prevents silent data loss)
- Changed `<input>` to `<textarea>` for long message support

### Previous Major Issues -- Resolution Status

#### M1: Stale closure / silent data loss -- RESOLVED

Previously, `handleTextChange` read from stale `pairs` state, and inputs for messages without an annotated counterpart accepted edits that silently never persisted.

**Fix applied:**
- `handleTextChange` (line 91) now reads `annotationQuery.data?.messages` directly, avoiding the stale `pairs` closure entirely.
- Textarea is `disabled={pair.annotated === null}` (line 253) with visual distinction (`bg-gray-50 text-gray-400`) for disabled state.
- Users can no longer type into fields that cannot persist. No data loss possible.

**Status: RESOLVED**

#### M2: Racing useEffects for hydration -- RESOLVED

Previously, two competing `useEffect` hooks caused double hydration when `annotationId` changed.

**Fix applied:**
- `pairs` is now a **derived value** computed during render (lines 51-65) from `annotationQuery.data` + `dialogQuery.data` + `localTexts` map. No `useState`/`useEffect` hydration at all.
- Single `useEffect` (lines 68-79) only handles clearing `localTexts` and debounce timers on `annotationId` change.
- The architecturally fragile two-effect pattern is completely eliminated.

**Status: RESOLVED**

#### M3: Sequential message creation / no rollback -- STILL PRESENT (known/accepted)

The "Save as New Variant" flow (lines 125-158) still creates the annotation shell then loops through pairs sequentially. Partial failure still leaves an orphaned annotation.

**Status: STILL PRESENT** -- known limitation, acknowledged in plan. No change in this fix commit.

### Previous Minor Issues -- Resolution Status

| Issue | Status | Notes |
|-------|--------|-------|
| m1: `<input>` for long text | **RESOLVED** | Now `<textarea rows={2}>` (line 242) |
| m2: Timer cleanup only on unmount | **RESOLVED** | Effect depends on `[annotationId]` (line 79); cleanup clears all timers on annotation switch |
| m3: No focus trap in AutoAnnotateModal | Unchanged | Not in scope of this fix |
| m4: Empty prompts state in modal | Unchanged | Not in scope of this fix |
| m5: ttsKeys naming inconsistency | Unchanged | Not in scope of this fix |
| m6: Missing "Save as New Variant" test | Unchanged | Not in scope of this fix |
| m7: Duplicate test utilities | Unchanged | Not in scope of this fix |

### New Issues Introduced by Fix

**None found.** The refactored code is cleaner and introduces no new problems:

- **Derived computation is correct:** The `annotatedMap` + `pairs` derivation (lines 51-65) rebuilds on every render but React Compiler will memoize it automatically. The fallback chain `localTexts.get(id) ?? annotated?.text ?? original.text` correctly prioritizes local edits over server data over original text.
- **Cleanup effect is sound:** The single `useEffect` on `[annotationId]` (lines 68-79) correctly captures `debounceTimers.current` (stable ref to same Map object) and clears all timers in the cleanup function. React guarantees cleanup of the old effect runs before the new effect setup.
- **No stale closure in debounce:** The `setTimeout` callback (lines 104-120) captures `annotationId` from props and `newText` from the function argument -- both are correct at call time. Even if `annotationId` changes before the timer fires, the cleanup effect cancels all pending timers first.
- **handleTextChange early return is correct:** When `annotatedMsg` is not found (line 94), the function returns after updating `localTexts` but before scheduling a save. Since the textarea is disabled for null annotated messages, this code path is unreachable in practice, making it a safe defensive guard.

### Verified Correct (unchanged from initial review)

- **API URLs match backend routes:** All query hooks hit correct endpoints.
- **AutoAnnotateInput fields match backend schema.**
- **Cache invalidation is correct.**
- **Message matching uses `dialog_message_id`.**
- **No cross-feature imports, no manual memo, ESM imports, no barrel files.**
- **TanStack Query patterns, Tailwind CSS, loading/error states all correct.**

## Known Limitations (updated)

1. **Partial failure in Save as New Variant** -- acknowledged in plan. No rollback mechanism. (M3, known)
2. ~~No textarea for long messages~~ -- **Fixed** (now `<textarea>`)
3. **No focus trap in AutoAnnotateModal** -- accessibility gap for keyboard users. (m3)
4. ~~Pending debounce timers survive annotation switching~~ -- **Fixed** (timers cleared on `annotationId` change)
5. ~~Silent non-save for messages without annotated counterpart~~ -- **Fixed** (inputs disabled)

## PR Readiness

**Status: APPROVED**

All Major issues (M1, M2) and the two actionable Minor issues (m1, m2) from the initial review have been resolved in commit `97cb047`. The remaining items are:
- **M3** (partial failure in Save as New Variant) -- known/accepted limitation, documented in plan
- **m3-m7** -- minor cosmetic/accessibility/test items, none blocking

The AnnotationEditor component is now architecturally sound: derived state instead of effect-based hydration, proper cleanup on annotation switching, disabled inputs for non-persistable fields, and textarea for long text. Ready to merge.
