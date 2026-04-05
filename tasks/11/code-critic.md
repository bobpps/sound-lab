# Code Critic: Inworld TTS Adapter

**Branch:** `feat/11-inworld-tts` vs `origin/main`
**Date:** 2026-04-05
**Reviewer:** code-critic (architectural analysis agent)

---

## Summary

The Inworld TTS adapter is a clean, well-structured implementation that closely follows the established ElevenLabs adapter pattern. It correctly implements the `ITTSProvider` interface, registers itself in the provider registry, and comes with comprehensive tests. The code is concise at 104 lines and avoids unnecessary abstraction.

**Verdict: Solid implementation with a few issues worth addressing.**

---

## Issues

### 1. Duplicated `clamp` utility function — **Minor**

**File:** `backend/src/providers/tts/inworld.ts:40-42`

The `clamp` function is copy-pasted verbatim from `elevenlabs.ts:41-43`:

```ts
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

This is the second provider; by the third, this will be in three files. While it's only 3 lines, duplicated utility functions across providers is a maintenance smell.

**Recommendation:** Extract to a shared `utils.ts` inside `providers/tts/` or a general `utils/` directory. Not urgent with two providers, but should be done before adding a third.

---

### 2. `validateCredentials` duplicates `getVoices` HTTP call logic — **Minor**

**File:** `backend/src/providers/tts/inworld.ts:94-103`

`validateCredentials` manually constructs the same fetch call as `getVoices` (same URL, same headers) instead of delegating:

```ts
async validateCredentials(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/tts/v1/voices`, {
      headers: { Authorization: `Basic ${this.apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

The ElevenLabs adapter uses a *different* endpoint (`/v1/user`) for validation, which is semantically cleaner — it validates the credential itself rather than side-effecting a resource listing. But Inworld may not have a lightweight auth-check endpoint.

**Recommendation:** If Inworld has a dedicated auth/user endpoint, use that. If not, this approach is acceptable but consider reusing `getVoices` internally:
```ts
async validateCredentials(): Promise<boolean> {
  try { await this.getVoices(); return true; } catch { return false; }
}
```
This eliminates the URL/header duplication. The tradeoff is that `getVoices` throws on non-OK and parses the full response body, so the current approach is slightly more efficient. Acceptable as-is, but note the DRY violation.

---

### 3. No validation of `text` or `voiceId` inputs in `synthesize` — **Minor**

**File:** `backend/src/providers/tts/inworld.ts:71-92`

`synthesize` passes `opts.text` and `opts.voiceId` directly to the API without any validation. Empty string or undefined-ish values would produce a 400 from the Inworld API, but the error message would be the raw API response rather than a clear client-side error.

The ElevenLabs adapter has the same gap, so this is consistent — but both adapters could benefit from early validation. This is a pattern-level issue, not specific to this PR.

**Recommendation:** Consider adding a shared pre-flight validation step (e.g., in the registry's `createSynthesize` or as a base class method) rather than duplicating checks in every provider. Not a blocker for this PR.

---

### 4. `response.text()` call in error path could itself throw — **Minor**

**File:** `backend/src/providers/tts/inworld.ts:64-65, 87-88`

```ts
if (!response.ok) {
  const body = await response.text();
  throw new Error(`Inworld API error: ${response.status} ${body}`);
}
```

If `response.text()` throws (e.g., network interruption mid-stream, unusual encoding), the original HTTP error status is lost and replaced by an unrelated error. The ElevenLabs adapter has the same pattern, so this is consistent — but both are technically fragile.

**Recommendation:** Wrap the body read in a try-catch:
```ts
if (!response.ok) {
  const body = await response.text().catch(() => '<unreadable body>');
  throw new Error(`Inworld API error: ${response.status} ${body}`);
}
```
Low priority since this is an existing pattern.

---

### 5. No timeout on fetch calls — **Minor**

**File:** `backend/src/providers/tts/inworld.ts:60, 81, 96`

All three `fetch` calls have no `AbortSignal` timeout. A hung Inworld API would hang the request indefinitely. ElevenLabs has the same gap.

**Recommendation:** Add `signal: AbortSignal.timeout(30_000)` or similar. This is a cross-provider concern that should be addressed uniformly, possibly in a shared fetch wrapper.

---

### 6. Test file naming inconsistency — **Minor**

**Files:** `backend/tests/providers/inworld-tts.test.ts` vs `backend/tests/providers/elevenlabs.test.ts`

The ElevenLabs test is named `elevenlabs.test.ts` (matches the source file `elevenlabs.ts`). The Inworld test is named `inworld-tts.test.ts` while its source file is `inworld.ts`. The `-tts` suffix is inconsistent with the established naming convention.

**Recommendation:** Rename to `inworld.test.ts` to match the pattern: source file name = test file name.

---

### 7. No test for network fetch failure in `getVoices` and `synthesize` — **Minor**

**File:** `backend/tests/providers/inworld-tts.test.ts`

The tests cover HTTP error responses (non-200 status codes) for `getVoices` and `synthesize`, and network errors for `validateCredentials`. But there are no tests for `fetch` throwing a network error in `getVoices` or `synthesize`. The ElevenLabs tests have the same gap, so this is consistent.

**Recommendation:** Add network error tests for `getVoices` and `synthesize` to ensure unhandled rejections propagate correctly. These are the methods callers will catch errors from.

---

### 8. Hardcoded default model string — **Minor**

**File:** `backend/src/providers/tts/inworld.ts:4`

```ts
const DEFAULT_MODEL = 'inworld-tts-1.5-max';
```

The model is hardcoded with no way to override it. This is fine for now, but if Inworld releases new models, every synthesis call is locked to this version. The ElevenLabs adapter has the same pattern (`'eleven_multilingual_v2'`), so this is consistent.

**Recommendation:** Consider making this configurable via `ISynthesizeOptions` (add an optional `model` field) in a future PR when a second model becomes available. Not a blocker.

---

## Non-Issues (Things Done Well)

- **Interface contract compliance:** All three methods of `ITTSProvider` are correctly implemented with proper return types.
- **Registry integration:** Clean two-line addition to `registry.ts`. The `PROVIDERS` record pattern is maintained exactly.
- **Voice mapping:** `mapVoice` correctly normalizes Inworld's response shape to `IVoice`, including proper null-to-undefined coercion for `description` and defensive fallbacks for empty `languages` arrays.
- **Audio config builder:** `buildAudioConfig` cleanly separates audio config construction from the main synthesize flow. Returns `undefined` when empty (not `{}`), which correctly omits it from the request body.
- **Module-level functions over class methods:** Helper functions (`mapVoice`, `clamp`, `buildAudioConfig`) are module-scoped rather than class methods, matching the ElevenLabs pattern. This keeps the class focused on the interface contract.
- **Test coverage:** 376 lines of tests covering all three interface methods, edge cases (empty arrays, null descriptions, missing tags), clamping behavior, combined options, auth headers, and error responses. Thorough.
- **Test pattern adherence:** Uses the same `vi.stubGlobal('fetch', mockFetch)` pattern, same `describe` nesting structure, same assertion style as the ElevenLabs tests.
- **Registry tests updated:** The existing registry test assertions were correctly updated (count changed from 1 to 2, new provider test added).

---

## Severity Legend

| Severity | Meaning |
|---|---|
| **Fundamental** | Breaks architecture, violates core invariants, or creates tech debt that compounds |
| **Major** | Correctness issue, significant pattern violation, or missing critical behavior |
| **Minor** | Style inconsistency, small DRY violation, or improvement that can wait |

**This PR has 0 Fundamental, 0 Major, and 8 Minor issues.** It is ready to merge with optional cleanup.
