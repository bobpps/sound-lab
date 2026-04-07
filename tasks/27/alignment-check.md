# Alignment Check -- Issue #27: TTS Annotation Editor

## Original Analysis Summary

The analysis specified building an inline annotation editor for the TTS page with these core requirements:

1. **5 query hooks:** useAnnotation, useDialogWithMessages, useLlmProviders, useLlmModels, useAnnotationPrompts
2. **4 mutation hooks:** useAutoAnnotate, useCreateAnnotation, useCreateAnnotationMessage, useUpdateAnnotatedMessage
3. **AnnotationEditor component:** Message pairing by `dialog_message_id`, debounced auto-save (~500ms), "Save as New Variant" (2-step: create annotation shell, then create messages)
4. **AutoAnnotateModal:** LLM provider/model/annotation prompt selection, prompt filtering by TTS `provider_id`, calls `POST /services/annotate`
5. **TtsPage integration:** Show AnnotationEditor below selectors when an annotation is selected, hide on "Clean"
6. **9 API endpoints** detailed with URLs, request bodies, and response types
7. **Risks identified:** Message ordering mismatch, debounce race conditions, multi-step partial failure, LLM loading state, cache invalidation, no cross-feature imports, prompt filtering

## What Was Implemented

All 8 specified files were created/modified:

| File | Status |
|------|--------|
| `frontend/src/features/tts/api/queries.ts` | Modified -- 5 query hooks + 4 mutation hooks + ttsKeys entries + input types |
| `frontend/src/features/tts/api/queries.test.tsx` | Modified -- 19 tests (15 query + 4 mutation) |
| `frontend/src/features/tts/components/AnnotationEditor.tsx` | Created -- paired message list, debounced auto-save, Save as New Variant |
| `frontend/src/features/tts/components/AnnotationEditor.test.tsx` | Created -- 4 tests |
| `frontend/src/features/tts/components/AutoAnnotateModal.tsx` | Created -- full modal with LLM provider/model/prompt selection |
| `frontend/src/features/tts/components/AutoAnnotateModal.test.tsx` | Created -- 5 tests |
| `frontend/src/features/tts/components/TtsPage.tsx` | Modified -- wires in AnnotationEditor |
| `frontend/src/features/tts/components/TtsPage.test.tsx` | Modified -- 2 new tests (8 total) |

### Hook Coverage

**Query hooks (all 5 implemented):**
- `useAnnotation(annotationId)` -- GET `/annotations/:id`, returns `AnnotatedDialogWithMessages`
- `useDialogWithMessages(dialogId)` -- GET `/dialogs/:dialogId`, returns `DialogWithMessages`
- `useLlmProviders()` -- GET `/providers?type=llm`, returns `Provider[]`
- `useLlmModels(providerId)` -- GET `/llm/:providerId/models`, returns `string[]`
- `useAnnotationPrompts()` -- GET `/annotation-prompts`, returns `AnnotationPrompt[]`

**Mutation hooks (all 4 implemented):**
- `useAutoAnnotate()` -- POST `/services/annotate`, invalidates annotations list
- `useCreateAnnotation()` -- POST `/dialogs/:dialogId/annotations`, invalidates annotations list
- `useCreateAnnotationMessage()` -- POST `/annotations/:id/messages`, invalidates annotation detail
- `useUpdateAnnotatedMessage()` -- PUT `/annotations/:id/messages/:messageId`, invalidates annotation detail

### Risk Mitigations

| Risk | Analysis Specified | Implementation |
|------|-------------------|----------------|
| Message ordering mismatch | Map by `dialog_message_id`, not array index | Map-based pairing via `annotatedByDialogMsgId` Map |
| Debounce race conditions | Per-message debounce strategy | Per-message `debounceTimers` ref with Map<dialogMessageId, timer> |
| Multi-step partial failure | Error handling on Save as New Variant | try/catch around the 2-step flow, error displayed in UI |
| Auto-annotate slow | Loading state needed | `autoAnnotate.isPending` disables button, shows "Running..." |
| Cache invalidation | Multiple caches to invalidate | Each mutation hook invalidates appropriate query keys |
| No cross-feature imports | Must create own `useDialogWithMessages` | Created in TTS feature's `queries.ts` |
| Prompt filtering | Filter by TTS `provider_id` client-side | `filteredPrompts = annotationPromptsQuery.data?.filter(p => p.provider_id === ttsProviderId)` |

## Mismatches

### 1. ttsKeys naming differs from analysis -- Minor

**Analysis specified:**
```
annotationDetail: (id) => ["tts", "annotation-detail", id]
dialogDetail: (id) => ["tts", "dialog-detail", id]
llmProviders: () => ["tts", "llm-providers"]
llmModels: (providerId) => ["tts", "llm-models", providerId]
annotationPrompts: () => ["tts", "annotation-prompts"]
```

**Implementation uses:**
```
annotation: (annotationId) => ["tts", "annotation", annotationId]
dialogWithMessages: (dialogId) => ["tts", "dialogWithMessages", dialogId]
llmProviders: () => ["tts", "llmProviders"]
llmModels: (providerId) => ["tts", "llmModels", providerId]
annotationPrompts: () => ["tts", "annotationPrompts"]
```

**Severity: Minor.** The plan refined the naming to use camelCase (matching the existing `ttsKeys` pattern) instead of the analysis's kebab-case. Key factory names are internal and the plan was the authoritative source for implementation. The plan and implementation match perfectly.

### 2. Missing eslint-disable comments from plan -- Minor

**Plan specified** two `eslint-disable-next-line react-hooks/set-state-in-effect` comments in the AnnotationEditor's hydration useEffect.

**Implementation omits** these comments.

**Severity: Minor.** If the React Compiler lint rule flags `setState` inside `useEffect`, these may be needed. However, the lint check passed cleanly per execution log, so the rule either doesn't exist in this project's config or doesn't trigger here. No functional impact.

### 3. No explicit `useAutoAnnotate` cache seeding with `setQueryData` -- Minor

**Analysis specified:** `useAutoAnnotate` should `invalidate annotations list + set detail cache` on success.

**Implementation:** Only invalidates `ttsKeys.annotations(data.dialog_id)` on success. Does NOT call `setQueryData` to seed the annotation detail cache with the returned `AnnotatedDialogWithMessages`.

**Severity: Minor.** The returned data could be used to optimistically seed `ttsKeys.annotation(data.id)` to avoid an extra fetch when the user selects the new annotation. However, invalidation alone is correct behavior -- the detail will be fetched on-demand when selected. This is a missed optimization, not a bug.

## Corrections Made

No corrections were needed during implementation. The execution log reports "No deviations from plan" for all 6 tasks. The implementation followed the plan line-for-line with only the eslint-disable comment omission noted above.

## Final Alignment Verdict

**ALIGNED.** The implementation faithfully follows both the analysis and the plan. All 5 query hooks, 4 mutation hooks, 2 new components, and TtsPage integration match the specifications. API endpoint URLs, request bodies, and response types are correct. All identified risks have appropriate mitigations. The 3 mismatches are all Minor severity -- 2 are intentional plan refinements over analysis naming, and 1 is a missed cache optimization that has no functional impact. Test coverage is solid with 28+ new TTS feature tests, and all builds, lints, and Playwright verification passed.

## Post-Fix Re-Check (Commit 97cb047)

### Changes Reviewed

The refactor replaced the original `useEffect`-based hydration pattern with a derived computation approach:

| Before (Pre-Fix) | After (Post-Fix) |
|---|---|
| `pairs` stored in `useState`, hydrated via `useEffect` syncing query data | `pairs` derived inline from query data + `localTexts` Map -- no hydration effect |
| `useState<MessagePair[]>` for pairs | `useState<Map<number, string>>` for `localTexts` only; `pairs` is a computed `const` |
| Debounce timers not cleared on annotation switch | `useEffect([annotationId])` clears all timers + resets `localTexts` on annotation change |
| `<input>` for annotated text | `<textarea rows={2}>` for multi-line annotated text |
| Inputs always enabled | `disabled={pair.annotated === null}` prevents editing messages without annotated counterpart |

### Alignment Assessment

**1. Derived pairs computation** -- IMPROVES alignment.

The analysis specified "Map by `dialog_message_id`, not array index" (Risk #1). The new code builds an `annotatedMap` (Map keyed by `dialog_message_id`) and derives pairs on every render. This is more robust than the previous useEffect hydration, which could suffer from stale state if query data updated between effect runs. The React Compiler can optimize the derived computation automatically, which aligns with the "no manual useMemo" constraint.

**2. localTexts Map instead of pairs state** -- IMPROVES alignment.

Separating local edit state (`localTexts`) from server-derived data (`pairs`) is cleaner. The local override is applied during pair derivation: `localTexts.get(original.id) ?? annotated?.text ?? original.text`. This eliminates the setState-in-useEffect pattern that the original alignment check noted might trigger lint warnings (Mismatch #2 about `eslint-disable` comments). That mismatch is now fully resolved since there is no more `setState` inside an effect for hydration.

**3. Debounce timer cleanup on annotation change** -- IMPROVES alignment.

The analysis identified "Debounced auto-save race conditions" as Risk #2. The new `useEffect([annotationId])` cleanup function clears all pending timers when the user switches annotations. This prevents a timer from firing and saving text against the wrong annotation -- a race condition the previous implementation did not guard against.

**4. Disabled inputs for messages without annotated counterpart** -- IMPROVES alignment.

The analysis said "If no match, show original text as fallback in the editable field." The new code shows original text in a disabled textarea. This is functionally correct: `handleTextChange` already returned early when no `annotatedMsg` was found, so the user could type but nothing would save. Disabling the field prevents this confusing UX. Slight deviation from the literal wording "editable field" in analysis line 115, but the behavior is strictly better.

**5. textarea instead of input** -- NEUTRAL, minor UX improvement.

Using `<textarea rows={2}>` instead of `<input>` better accommodates multi-line annotation text. No alignment impact -- the analysis didn't specify the HTML element type.

### New Mismatches Introduced

**None.** The refactor does not change the component's public API (`AnnotationEditorProps`), the hooks consumed, the mutation calls, or the overall rendering structure. The existing tests (which use `getByRole("textbox")`) remain valid since both `<input>` and `<textarea>` resolve to the "textbox" role.

### Impact on Previous Mismatches

| Previous Mismatch | Status After Fix |
|---|---|
| #1 ttsKeys naming (Minor) | Unchanged -- not affected by this refactor |
| #2 Missing eslint-disable comments (Minor) | **Resolved** -- hydration useEffect removed entirely; no more setState-in-effect |
| #3 No setQueryData cache seeding (Minor) | Unchanged -- not affected by this refactor |

### Updated Final Alignment Verdict

**ALIGNED -- IMPROVED.** The refactor strictly improves alignment with the original analysis requirements. Derived state computation eliminates the hydration effect footgun, debounce timer cleanup closes the annotation-switch race condition (Risk #2), and disabled inputs prevent silent save failures. No new mismatches introduced. Previous Mismatch #2 is fully resolved. The component is now more robust and idiomatic React 19 (derived computation over effect-based sync).
