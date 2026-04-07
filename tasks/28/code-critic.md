# Code Review: feat/28-voice-playback

## Architectural violations

### [ARCH-1] Duplicated query hooks across feature boundaries — silent divergence risk | Major
**Files:** `frontend/src/features/tts/api/queries.ts:54-74`, `frontend/src/features/datasets/api/queries.ts:89-102,119-124`
**What's wrong:** `useProviderList()`, `useDialogList()`, and `useDialogDetail()` in the TTS feature are copy-pasted reimplementations of `useTtsProviders()`, `useDialogs()`, and `useDialog()` from the datasets feature. The comment on line 51 says "Re-declared here to avoid cross-feature imports. Uses the same query keys as TanStack Query deduplicates requests."
**Why it's bad:** The query keys are NOT the same. TTS uses `["dialogs", "list"]` while datasets uses `["dialogs", "list"]` (these happen to match), but TTS uses `["dialogs", "detail", dialogId]` while datasets uses `["dialogs", "detail", dialogId]` (also matches). However, the datasets feature wraps the `queryFn` in named functions (`fetchDialogs`, `fetchDialog`) while TTS inlines anonymous lambdas. More critically, any future change to one copy (adding `staleTime`, `select` transforms, error handling) will silently NOT propagate to the other. The "no cross-feature imports" rule exists to prevent tight coupling, but the correct solution is to extract shared hooks into `frontend/src/hooks/` or `frontend/src/lib/` — the shared code layer that exists precisely for this purpose. Duplication is not the answer to the import prohibition; the shared layer is.

### [ARCH-2] synthesize function bypasses api-client error handling contract | Major
**File:** `frontend/src/features/tts/components/TtsPage.tsx:21-46`
**What's wrong:** The `synthesize()` function uses `api.fetchRaw()` and then manually reimplements error parsing (lines 34-43) that already exists in `api-client.ts` as `handleResponse()`. The api-client has `ApiError` class with status codes, structured error parsing. This function rolls its own version, losing the `ApiError` type (throws plain `Error` instead) and the status code.
**Why it's bad:** Two error-handling codepaths for the same backend. If the backend error format changes, `handleResponse` gets updated but `synthesize` doesn't. Consumers of `playback.error` get a plain string instead of an `ApiError` with a status code, making it impossible to distinguish network errors from 4xx from 5xx.

## Code quality

### [QUAL-1] New Set allocation on every render | Minor
**File:** `frontend/src/features/tts/hooks/useAudioPlayback.ts:51-55`
**What's wrong:** `const characters = new Set(messages.map((m) => m.character))` is computed directly in the hook body. On every render, this allocates a new array, a new Set, and then spreads the Set into another array for `.every()`.
**Why it's bad:** React Compiler should handle this, so it is not a functional bug. But the code is written in a way that suggests the author assumed it would be cheap. With hundreds of messages, it's not. The fact that React Compiler exists doesn't mean you should write wasteful code and rely on the compiler to save you — the compiler's memoization only helps if the `messages` reference is stable.

### [QUAL-2] Recursive async function with no stack depth guard | Minor
**File:** `frontend/src/features/tts/hooks/useAudioPlayback.ts:76-142`
**What's wrong:** `playMessage()` recursively calls itself via `audio.onended = () => { playMessage(index + 1); }`. Each call awaits `synthesize()` and `audio.play()`, then the `onended` callback triggers the next call.
**Why it's bad:** This isn't true recursion (the call chain goes through the browser event loop via `onended`), so stack overflow isn't the real risk. The real issue is that `playMessage` is a closure that captures the component scope at render time. If the component re-renders while playback is in progress (e.g., because the user changed a selector), the closure still references stale state. The function reads `providerId` and `voiceMap` from the outer scope — values that can change during a long playback chain.

### [QUAL-3] Stale closure over `providerId` and `voiceMap` during playback | Major
**File:** `frontend/src/features/tts/hooks/useAudioPlayback.ts:36-142`
**What's wrong:** `play()` and `playMessage()` are plain functions declared inside the hook body. They close over `providerId`, `messages`, and `voiceMap` at the time of the render that produced them. If the user changes the provider or voice assignments mid-playback, the in-flight playback chain continues using the old values because `onended` on line 120 calls `playMessage(index + 1)` — which was captured from a previous render.
**Why it's bad:** Bug: User starts playback, changes voice assignment for character 2 mid-playback, and character 2 lines still play with the old voice. The `play` and `stop` functions returned from the hook are fresh on each render, but the `onended` callback chain was set up during a previous render. A ref-based approach for these mutable dependencies would prevent this.

### [QUAL-4] `buildPlaybackMessages` silently defaults to character 1 on missing lookup | Minor
**File:** `frontend/src/features/tts/components/TtsPage.tsx:58`
**What's wrong:** `characterByMessageId.get(am.dialog_message_id) ?? 1` — if the annotated message references a dialog message ID that doesn't exist in the dialog (data integrity issue), the code silently assigns character 1.
**Why it's bad:** Data corruption gets hidden. If annotation and dialog messages are out of sync, the user sees seemingly correct output with wrong character assignments. A warning or explicit handling would surface data issues.

### [QUAL-5] Query key divergence between TTS and datasets for the same entity | Minor
**File:** `frontend/src/features/tts/api/queries.ts:17-23` vs `frontend/src/features/datasets/api/queries.ts:52-56`
**What's wrong:** TTS defines `annotationKeys` with shape `["annotations", "dialog", dialogId]` and `["annotations", "detail", annotationId]`. The datasets feature has no annotation query keys at all. Meanwhile, TTS defines dialog keys as bare `["dialogs", "list"]` and `["dialogs", "detail", id]` while datasets uses the exact same keys via `dialogKeys`. This means both features share a TanStack Query cache for dialogs (intentional per comment) but there's no single source of truth for what those keys are — they're hardcoded strings in both files.
**Why it's bad:** If someone renames the dialog key in one feature, the cache stops deduplicating silently. No type safety, no shared constant.

## Potential bugs

### [BUG-1] `useEffect` cleanup has stale closure reference | Major
**File:** `frontend/src/features/tts/hooks/useAudioPlayback.ts:161-163`
**What's wrong:** The cleanup effect captures the `cleanup` function at initial mount (empty dependency array `[]`). But `cleanup` is a function declared in the hook body that reads from `abortRef`, `audioRef`, and `blobUrlRef`. Since these are refs, the stale closure doesn't matter for them — refs are mutable. However, the empty dependency array means React will warn (or React Compiler will flag) that `cleanup` is a dependency that's not listed.
**Why it's bad:** This is actually fine in practice because `cleanup` only reads refs, and refs are stable. But it's sloppy — it relies on an implementation detail (refs are stable) rather than expressing intent clearly. If `cleanup` ever starts reading state instead of refs, this becomes a real bug.

### [BUG-2] Double URL revocation on stop during playback | Minor
**File:** `frontend/src/features/tts/hooks/useAudioPlayback.ts:57-74,109-112`
**What's wrong:** When `stop()` is called, `cleanup()` revokes `blobUrlRef.current`. But if `onended` fires before the abort fully cancels, the `onended` handler also revokes the URL on line 121. Since `cleanup()` already set `audioRef.current = null` and `blobUrlRef.current = null`, the `onended` handler's `URL.revokeObjectURL(url)` call uses the captured `url` variable from the closure — which is a different reference. So the same blob URL could get revoked twice.
**Why it's bad:** `URL.revokeObjectURL` on an already-revoked URL is a no-op per spec, so this won't crash. But it indicates the cleanup flow has overlapping responsibilities, which is a maintenance trap.

### [BUG-3] PlaybackControls shows Run button in error state but error persists visually | Minor
**File:** `frontend/src/features/tts/components/PlaybackControls.tsx:22-53`
**What's wrong:** When `status === "error"`, `isPlaying` is false, so the Run button renders. The error message also renders (line 50-52). If the user clicks Run again, `play()` sets `error` to null (TtsPage line 148). But there's no visual feedback that the error has been acknowledged — the error message disappears, and the Run button looks the same. There's no disabled state for the error condition.
**Why it's bad:** Minor UX issue. The user might click Run repeatedly without understanding why it fails, since there's no transition feedback between error and playing states.

## Abstraction problems

### [ABS-1] `VoiceMap` hardcoded to exactly 2 characters | Minor
**File:** `frontend/src/features/tts/hooks/useAudioPlayback.ts:9`
**What's wrong:** `type VoiceMap = Partial<Record<1 | 2, string>>` hardcodes support for exactly characters 1 and 2. The `CHARACTERS` constant in `VoiceAssignment.tsx:13` also hardcodes `[1, 2] as const`.
**Why it's bad:** If dialog messages ever support 3+ characters (the `DialogMessage` type already uses `character: 1 | 2` so this is a shared constraint), the TTS feature will need changes in multiple places. This isn't necessarily wrong — the domain currently supports only 2 characters — but it's a fragile assumption baked into a type rather than derived from the data.

### [ABS-2] `synthesize` function is a prop but has only one implementation | Minor
**File:** `frontend/src/features/tts/hooks/useAudioPlayback.ts:12-16`
**What's wrong:** `SynthesizeFn` is defined as a type, and `useAudioPlayback` accepts it as a parameter. But there's only one implementation — the `synthesize` function in `TtsPage.tsx:21-46`. The hook is testable (good), but the abstraction exists solely for testing.
**Why it's bad:** This is borderline — dependency injection for testability is legitimate. But the `SynthesizeFn` type is exported and used in test files, which creates a contract that must be maintained. As long as this stays simple, it's fine. Noting it because if a second implementation never materializes, it's premature abstraction.

## Summary
- Critical issues: 0
- Major: 3 (ARCH-1, ARCH-2, QUAL-3)
- Minor: 7 (QUAL-1, QUAL-2, QUAL-4, QUAL-5, BUG-1, BUG-2, BUG-3, ABS-1, ABS-2)
- Overall assessment: Structurally competent implementation with good test coverage and correct adherence to feature boundaries. The main concern is the duplicated query hooks (ARCH-1) which chose duplication over using the shared code layer, the stale closure bug during mid-playback state changes (QUAL-3), and the bypassed error handling contract in the synthesize function (ARCH-2). None of these are showstoppers, but QUAL-3 is a real user-facing bug waiting to happen.
