# Code Review: Issue #11 - Inworld TTS Adapter

**Branch:** `feat/11-inworld-tts`
**Commits:** 4 (`12ea402..06d5ef3`)
**Reviewer:** Claude Opus 4.6 (automated)
**Date:** 2026-04-05

---

## Diff Summary

| File | Action | Lines |
|------|--------|-------|
| `backend/src/providers/tts/inworld.ts` | Created | 104 |
| `backend/src/providers/tts/registry.ts` | Modified | +2 |
| `backend/tests/providers/inworld-tts.test.ts` | Created | 376 |
| `backend/tests/providers/registry.test.ts` | Modified | +13/-2 |
| `tasks/11/execution-log.md` | Created | 134 |

**Total:** +627/-2 lines across 5 files (4 production-relevant).

---

## Verification Outcomes

| Check | Result |
|-------|--------|
| Build (`npm run build`) | PASS |
| Tests (`npm test`) | 178/178 PASS (14 test files) |
| Lint | PASS (clean) |

---

## Strengths

1. **Faithful pattern replication.** The Inworld provider follows the same structural patterns as ElevenLabs: module-level helpers (`mapVoice`, `clamp`, `buildAudioConfig`), private API response interfaces, and an exported class implementing `ITTSProvider`. This consistency makes the codebase predictable.

2. **ESM compliance.** All imports use `.js` extensions (`./types.js`, `./inworld.js`). The file is pure ESM with no CJS patterns.

3. **Clean interface contract adherence.** The class correctly implements all three `ITTSProvider` methods (`getVoices`, `synthesize`, `validateCredentials`) with the exact signatures and return types from `types.ts`.

4. **Thorough test coverage.** 25 unit tests cover identity properties, all three interface methods, edge cases (empty arrays, null descriptions, no tags), error handling (HTTP errors, network failures), audio config permutations (speed clamping, format mapping, sampleRate, combined options, omitted config), and temperature pass-through.

5. **TDD discipline.** Commits follow Red-Green order: tests first (`12ea402`), implementation second (`b59a6a6`), registry last (`fff7220`).

6. **Defensive API response handling.** Both `getVoices` and `synthesize` read `response.text()` on error to include the body in the thrown error message, matching the ElevenLabs pattern exactly.

---

## Issues

### Minor

1. **Plan called for `resolveFormat()` but implementation uses `buildAudioConfig()`**
   - File: `backend/src/providers/tts/inworld.ts:44`
   - The plan's file map says the provider should have a `resolveFormat()` helper (matching ElevenLabs), but implementation uses `buildAudioConfig()` instead. This is actually a *better* design for Inworld since the API takes a structured `audioConfig` object rather than a query-string format. The deviation from plan is justified by the different API shape. **No action needed** -- just noting the intentional divergence.

2. **Test data differs from plan's test data**
   - File: `backend/tests/providers/inworld-tts.test.ts:58-77`
   - The plan used voice names like "Ashley" and "Alex"; the implementation uses "Luna" and "Atlas". The test logic is identical and correct. **No action needed** -- cosmetic difference only.

3. **The `getVoices` language fallback test is split into two tests vs plan's single test**
   - File: `backend/tests/providers/inworld-tts.test.ts:112-132`
   - The plan tested the language fallback within the 3-voice fixture; implementation tests it with a dedicated single-voice fixture with empty `languages: []`. This is actually better isolation. **No action needed.**

4. **Registry test uses strict equality instead of `arrayContaining`**
   - File: `backend/tests/providers/registry.test.ts:34`
   - Plan suggested `expect.arrayContaining(['elevenlabs', 'inworld'])` with `toHaveLength(2)`. Implementation uses `toEqual(['elevenlabs', 'inworld'])`. Both work; strict equality is fine and arguably more precise since it also asserts order. **No action needed.**

### No Major or Fundamental Issues Found

---

## Detailed Code Analysis

### `inworld.ts` - Provider Implementation (104 lines)

**Auth pattern:** Uses `Authorization: Basic ${apiKey}` header, consistent across all three methods. This matches Inworld's documented auth scheme.

**Voice mapping (`mapVoice`):**
- Maps `voiceId` -> `id`, `displayName` -> `name`
- Language: takes first element of `languages[]` with `'en'` fallback
- Gender: extracts from `tags` array via `.find()` for `'male'` or `'female'`
- Null-to-undefined conversion for `description` (correct -- `IVoice.description` is `string | undefined`, not `string | null`)
- `previewUrl: undefined` -- Inworld API doesn't provide preview URLs
- `providerMeta` preserves `languages`, `tags`, `isCustom` for downstream use

**Synthesize:**
- Sends JSON body with `text`, `voiceId`, `modelId` (hardcoded `inworld-tts-1.5-max`)
- `temperature` passed through directly (not inverted like ElevenLabs' stability mapping -- correct, Inworld uses temperature natively)
- `audioConfig` is a nested object with `speakingRate`, `audioEncoding`, `sampleRateHertz`
- Speed clamped to `[0.5, 1.5]` range
- Format uppercased for API compatibility
- Response is JSON with `audioContent` as base64 -- decoded via `Buffer.from(data.audioContent, 'base64')`

**Error handling pattern:** Consistent with ElevenLabs -- reads response body on error, throws with status code and body text.

### `registry.ts` - Registry Changes (+2 lines)

Clean addition: one import line, one map entry. No changes to existing logic. The `PROVIDERS` map's constructor signature `new (apiKey: string) => ITTSProvider` correctly matches `InworldTTSProvider`'s constructor.

### `inworld-tts.test.ts` - Test Suite (376 lines, 25 tests)

Test structure mirrors ElevenLabs test file:
- `beforeEach`: stubs `fetch`, creates provider
- `afterEach`: restores mocks
- Groups: `id and name` (2), `validateCredentials` (3), `getVoices` (7), `synthesize` (13)

All tests use `vi.stubGlobal('fetch', mockFetch)` for HTTP mocking, consistent with ElevenLabs tests.

### `registry.test.ts` - Registry Test Changes (+13/-2 lines)

Adds `InworldTTSProvider` import, adds instance test for `'inworld'` key, updates provider count from 1 to 2 and list assertion.

---

## Known Limitations

1. **No streaming support.** The `synthesize` method buffers the entire base64-encoded response in memory. For long texts, this could be memory-intensive. This matches ElevenLabs' current implementation (also fully buffered). Streaming could be added later as an enhancement across both providers.

2. **Hardcoded model ID.** `DEFAULT_MODEL = 'inworld-tts-1.5-max'` is not configurable. If Inworld releases new models, this would need a code change. Could be made configurable via `ISynthesizeOptions` in a future iteration.

3. **No rate limiting or retry logic.** Neither this provider nor ElevenLabs implements retry on transient failures (429, 503). This is consistent across providers and could be added at a higher abstraction layer.

4. **Base URL is not configurable.** Hardcoded to `https://api.inworld.ai`. This is consistent with ElevenLabs (`https://api.elevenlabs.io`). Both could benefit from an env-var override for testing against staging APIs, but this is a cross-cutting concern.

---

## PR Readiness

**Ready to merge: Yes**

**Reasoning:** The implementation correctly implements the `ITTSProvider` interface, follows all established codebase patterns (ESM imports with `.js` extensions, module-level helpers, error handling), has comprehensive test coverage (25 tests), and all verification checks pass (build, 178/178 tests, lint clean). No major or fundamental issues were identified. The minor deviations from the plan are justified improvements. The code would pass a staff-engineer review.
