# Code Review: Issue #9 — TTS Provider Interface + Registry + ElevenLabs Adapter

## Diff Summary

| File | Lines | Status |
|------|-------|--------|
| `backend/src/providers/tts/types.ts` | +26 | New — interfaces |
| `backend/src/providers/tts/elevenlabs.ts` | +108 | New — ElevenLabs adapter |
| `backend/src/providers/tts/registry.ts` | +20 | New — factory/registry |
| `backend/tests/providers/elevenlabs.test.ts` | +272 | New — 18 tests |
| `backend/tests/providers/registry.test.ts` | +31 | New — 3 tests |
| `tasks/9/execution-log.md` | +79 | New — execution log |
| **Total** | **+536** | **6 files** |

Commits: 6 (bf6f7ea → 2738cce), clean incremental TDD progression.

## Verification Outcomes

- **Build:** Clean (`tsc --noEmit` + frontend vite build) per execution log
- **Tests:** 149 total, 13 files, all passing (21 new tests for this feature)
- **Lint:** Clean per execution log

## Strengths

1. **Clean interface design.** `ITTSProvider` is minimal and well-scoped — three methods (`getVoices`, `synthesize`, `validateCredentials`) plus two readonly identity fields. Follows the existing repo+factory conventions from `backend/CLAUDE.md`.

2. **Correct ESM compliance.** All imports use `.js` extensions (`'./types.js'`, `'./elevenlabs.js'`, `'../../src/providers/tts/elevenlabs.js'`). Consistent with the project's ESM-everywhere rule.

3. **Solid TDD execution.** 21 tests covering all three methods plus the registry. Each commit adds tests before implementation (red-green progression verified in commit log). Tests are well-structured with Arrange-Act-Assert.

4. **Good defensive coding.** `mapVoice` handles null/undefined with `??` coalescing, `clamp()` prevents out-of-range temperature values, `validateCredentials` catches network errors gracefully.

5. **Provider-agnostic interface.** The `ITTSProvider` + registry pattern cleanly separates the abstraction from the ElevenLabs-specific implementation. Adding a new provider requires only a new class and one line in the `PROVIDERS` map.

6. **Correct use of `type` imports.** `import type { ITTSProvider, IVoice, ISynthesizeOptions }` ensures interfaces are erased at compile time and don't create runtime dependencies.

## Issues

### Minor

1. **`sampleRate` field declared in `ISynthesizeOptions` but never used**
   - File: `backend/src/providers/tts/types.ts:17`
   - `sampleRate?: number` is defined in the interface but no provider reads it. The ElevenLabs adapter uses `format` (which bakes in sample rate, e.g., `mp3_44100_128`).
   - Impact: Dead interface field. Could confuse consumers who set it expecting it to work.
   - Recommendation: Remove now, or document that it is reserved for future providers. Low risk either way since it is optional.

2. **`format` field is ElevenLabs-specific, not generic**
   - File: `backend/src/providers/tts/types.ts:16`
   - The `format` field accepts ElevenLabs-specific strings like `mp3_44100_128` and `pcm_24000`. Other TTS providers (Google, Azure) use different format enums entirely.
   - Impact: Low for now (single provider). Will need abstraction when adding a second provider — e.g., a generic `outputFormat: 'mp3' | 'wav' | 'ogg' | 'pcm'` with provider-specific mapping.
   - Recommendation: Acceptable for v1. Document the intent in a comment or track as a known limitation.

3. **Error messages discard response body**
   - File: `backend/src/providers/tts/elevenlabs.ts:57,91`
   - `throw new Error(`ElevenLabs API error: ${response.status}`)` only includes the status code. ElevenLabs returns detailed JSON error bodies (e.g., `{"detail":{"status":"invalid_api_key","message":"..."}}`).
   - Impact: Harder to debug production issues. Users see "ElevenLabs API error: 422" with no detail.
   - Recommendation: Parse and include the response body text in the error message. Example: `const body = await response.text(); throw new Error(`ElevenLabs API error: ${response.status} - ${body}`);`

4. **URL query parameter not encoded**
   - File: `backend/src/providers/tts/elevenlabs.ts:71`
   - `output_format=${format}` is string-interpolated into the URL without `encodeURIComponent`. The current format values (`mp3_44100_128`, `pcm_24000`) are safe, but if a consumer passes a format with special characters it would produce an invalid URL.
   - Impact: Negligible in practice. ElevenLabs formats are alphanumeric.
   - Recommendation: Use `URLSearchParams` or `encodeURIComponent` for defense in depth.

5. **Hardcoded `model_id` and `similarity_boost`**
   - File: `backend/src/providers/tts/elevenlabs.ts:80,84`
   - `model_id: 'eleven_multilingual_v2'` and `similarity_boost: 0.75` are hardcoded. These are reasonable defaults, but there's no way for callers to override them without modifying the adapter.
   - Impact: Low for v1. May need constructor options or `ISynthesizeOptions` extension for model selection later.
   - Recommendation: Acceptable for now. Track as a known enhancement.

6. **No barrel export (`index.ts`) for the `providers/tts` module**
   - File: `backend/src/providers/tts/` (directory)
   - The `db/` module doesn't use barrel exports either, so this is consistent with the existing pattern. However, consumers will need to import from three separate files.
   - Impact: None — consistent with codebase conventions.
   - Recommendation: No action needed. Mentioned for completeness.

### Major

None.

### Fundamental

None.

## Test Coverage Analysis

| Method | Tests | Edge Cases |
|--------|-------|------------|
| `id` / `name` | 2 | Identity fields |
| `validateCredentials` | 3 | 200 OK, 401 Unauthorized, network error |
| `getVoices` | 5 | Full mapping, missing optionals, empty list, API key header, 500 error |
| `synthesize` | 8 | Buffer return, URL+format, body defaults, custom format, temperature mapping, temperature clamping, custom speed, 400 error |
| `createTTSProvider` | 2 | Valid provider, unsupported provider |
| `getSupportedTTSProviders` | 1 | Returns expected list |
| **Total** | **21** | |

**Coverage gaps (not blocking):**
- No test for `synthesize` with empty text (though the API would handle this)
- No test for `getVoices` when fetch throws (network error) — only tested for `validateCredentials`
- No test for negative temperature values (clamped correctly by `clamp()` but untested path)

These are all extremely low-risk given the simple logic involved and the existing clamping test.

## Known Limitations

1. **Single-page voice listing.** `getVoices()` does not paginate. The ElevenLabs API supports pagination via `next_page_token`, but for reasonable voice counts (~100-200) a single page suffices. Documented in execution log.
2. **Provider-specific format strings.** The `format` field accepts raw ElevenLabs format strings. Future providers will need a mapping layer.
3. **Hardcoded model.** `eleven_multilingual_v2` is always used. No option to select `eleven_monolingual_v1` or other models.
4. **`sampleRate` unused.** Declared in the interface but not consumed.
5. **No retry/timeout logic.** Fetch calls have no timeout or retry. Acceptable for an internal tool; may need improvement for production workloads.

## PR Readiness

**Status: Ready to merge**

**Reasoning:** The implementation is clean, well-tested (21 tests, all passing), follows existing codebase conventions (ESM, TDD, repo+factory pattern), and has no major or fundamental issues. The 6 minor issues are all low-risk quality-of-life improvements that can be addressed in follow-up work without blocking the merge. The interface design is sound and extensible for future providers.
