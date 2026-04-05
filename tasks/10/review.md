# Code Review: Issue #10 — Google Cloud TTS Adapter

## Diff Summary

| File | Lines | Status |
|------|-------|--------|
| `backend/src/providers/tts/google.ts` | +133 | New — Google TTS adapter |
| `backend/tests/providers/google-tts.test.ts` | +334 | New — 20 tests |
| `backend/src/providers/tts/registry.ts` | modified | Added `google` entry |
| `backend/tests/providers/registry.test.ts` | modified | Updated for google provider |
| `backend/package.json` | modified | Added `@google-cloud/text-to-speech: ^6.4.0` |

## Verification Outcomes

- **Build:** Clean (reported by implementer)
- **Tests:** 175/175 passing (reported by implementer)
- **Lint:** Clean (reported by implementer)

## Strengths

1. **Consistent pattern with ElevenLabs.** The class follows the same ITTSProvider contract — `id`, `name`, `getVoices()`, `synthesize()`, `validateCredentials()`. Registry integration is identical (one line in the PROVIDERS map). A developer familiar with the ElevenLabs adapter can read this instantly.

2. **Correct ESM compliance.** All imports use `.js` extensions (`'./types.js'`, `'./google.js'`). Tests import from `'../../src/providers/tts/google.js'`. No violations.

3. **Robust credential validation.** `parseCredentials()` rejects non-JSON input and JSON missing `client_email`/`private_key` with clear error messages. Both failure modes are tested.

4. **Defensive handling of Google SDK quirks.** `resolveGender()` handles both string (`'FEMALE'`) and numeric enum (`2`) forms of `ssmlGender`, which the Google SDK may return depending on transport (gRPC vs REST). `GENDER_MAP` correctly maps the protobuf `SsmlVoiceGender` enum values (1=MALE, 2=FEMALE, 3=NEUTRAL), and 0 (SSML_VOICE_GENDER_UNSPECIFIED) falls through to `undefined`. All four branches are tested.

5. **Smart language code extraction.** `extractLanguageCode()` handles both standard (`en-US-Wavenet-A`) and three-letter locale voices (`cmn-CN-Wavenet-A`) by taking the first two hyphen-delimited segments. Both cases are tested.

6. **Comprehensive test suite.** 20 tests organized into 5 clear describe blocks. Tests cover: identity, constructor validation, credential validation (success + failure), voice listing (full mapping, gender mapping, numeric enums, empty list, null list, API errors), and synthesis (buffer return, default params, language extraction, speed, format, sampleRate inclusion/omission, API errors). Mocking is clean — module-level `vi.mock` with factory function.

7. **Error wrapping preserves context.** Both `getVoices()` and `synthesize()` catch SDK errors and re-throw with a `Google TTS API error:` prefix, consistent with ElevenLabs' `ElevenLabs API error:` pattern.

8. **Registry test properly mocks the SDK.** The registry test file mocks `@google-cloud/text-to-speech` so that `createTTSProvider('google', credentials)` succeeds without real credentials. This is the correct approach since the registry imports GoogleTTSProvider at module level.

## Issues

### Minor

1. **Non-null assertions on `v.name` in `getVoices()` (line 84)**
   - File: `backend/src/providers/tts/google.ts:84`
   - `v.name!` is used twice. The Google SDK types mark `name` as `string | null | undefined`. In practice, every voice returned by the API has a name, so the assertion is safe. However, a voice with a null name would produce a runtime `null` in the `id` field.
   - Impact: Extremely low — the API never returns nameless voices.
   - Recommendation: Consider a defensive filter (`voices.filter(v => v.name)`) before the map, or use `v.name ?? ''` as a fallback. Not blocking.

2. **Non-null assertion on `response!.audioContent` in `synthesize()` (line 122)**
   - File: `backend/src/providers/tts/google.ts:122`
   - `response!.audioContent` uses `!` to assert the response is non-null. The SDK destructuring `[response]` could theoretically yield undefined if the SDK returns an unexpected tuple shape.
   - Impact: Very low — the SDK always returns `[response, metadata, call]`.
   - Recommendation: Acceptable. If paranoia is warranted, a guard like `if (!response?.audioContent) throw new Error(...)` would be safer. Not blocking.

3. **`temperature` option is silently ignored**
   - File: `backend/src/providers/tts/google.ts:97-123`
   - `ISynthesizeOptions.temperature` is defined in the interface. ElevenLabs maps it to `stability` (inverted). Google TTS has no equivalent parameter, so it is silently ignored. This is acceptable behavior, but callers may not realize it has no effect.
   - Impact: Low — no incorrect behavior, just no-op.
   - Recommendation: Acceptable. Could add a comment noting that Google TTS does not support temperature. Not blocking.

4. **`audioConfig` typed as `Record<string, unknown>` bypasses SDK types (line 98)**
   - File: `backend/src/providers/tts/google.ts:98`
   - The `audioConfig` object is typed as `Record<string, unknown>` rather than using the SDK's `IAudioConfig` type. This was likely done to conditionally add `sampleRateHertz`, but it loses type-safety on the config keys.
   - Impact: Low — the values being set (`audioEncoding`, `speakingRate`, `sampleRateHertz`) are all valid Google TTS fields. A typo would be caught by integration testing.
   - Recommendation: Could use the SDK's type with a spread or conditional assignment. Not blocking.

5. **Duplicate `vi.clearAllMocks()` in test setup**
   - File: `backend/tests/providers/google-tts.test.ts:25,29`
   - `vi.clearAllMocks()` is called in both `beforeEach` (line 25) and `afterEach` (line 29). Only one is needed — `beforeEach` ensures clean state before each test, and `afterEach` is redundant.
   - Impact: None — harmless redundancy.
   - Recommendation: Remove one (conventionally keep `afterEach` per project conventions seen in registry test). Not blocking.

6. **`format` passthrough without validation**
   - File: `backend/src/providers/tts/google.ts:99`
   - `opts.format ?? 'MP3'` passes the format string directly to Google's `audioEncoding`. Google only accepts specific values (`LINEAR16`, `MP3`, `OGG_OPUS`, `MULAW`, `ALAW`). An invalid format will produce a Google API error, which is correctly caught and re-thrown. However, validating upfront would give a better error message.
   - Impact: Low — the error is still surfaced, just with a less clear message from Google's API.
   - Recommendation: Optional improvement for a follow-up. Not blocking.

### Major

None.

### Fundamental

None.

## Test Coverage Analysis

| Method | Tests | Edge Cases |
|--------|-------|------------|
| `id` / `name` | 2 | Identity fields |
| `constructor` | 2 | Invalid JSON, missing fields |
| `validateCredentials` | 2 | Success, auth failure |
| `getVoices` | 7 | Full mapping, gender lowercase, numeric enums, empty list, null list, empty request param, API error |
| `synthesize` | 7 | Buffer return, default params, language extraction (2-part), language extraction (3-part), speed, format, sampleRate present, sampleRate absent, API error |
| Registry (`createTTSProvider`) | 3 | ElevenLabs, Google, unsupported |
| Registry (`getSupportedTTSProviders`) | 1 | Lists both providers |
| **Total** | **~24 new tests** | |

**Coverage gaps (not blocking):**
- No test for `extractLanguageCode` when voiceId has fewer than 2 parts (single-segment ID) -- the fallback returns the input, which is tested only by the `if (parts.length >= 2)` branch being always true in existing tests.
- No test for `synthesize` with empty text (Google API would return a valid but silent audio file).
- No test for constructor when `client_email` is present but `private_key` is missing, or vice versa (both are checked together, so passing JSON with only one field would test the partial case -- but existing "lacks required fields" test already covers `{ foo: 'bar' }` which misses both).

All gaps are extremely low risk.

## Known Limitations

1. **No SSML support.** `synthesize()` always uses `{ text: opts.text }` for input. Google TTS also supports SSML via `{ ssml: '...' }`. The current interface does not expose this.
2. **No retry/timeout logic.** SDK calls have no retry policy or timeout. Acceptable for an internal tool.
3. **`temperature` is a no-op.** The interface defines it, ElevenLabs uses it, but Google has no equivalent.
4. **Credential scope is minimal.** Only `client_email` and `private_key` are extracted from the JSON credentials. Some service accounts may include `project_id` which could be relevant for quota tracking. The Google SDK handles this gracefully via the credentials object.
5. **Single-page voice listing.** The Google TTS `listVoices` API returns all voices in one response (no pagination), so this is not a practical concern.

## PR Readiness

**Status: Ready to merge**

**Reasoning:** The implementation is clean, well-tested (~24 new tests, all passing), and follows the established patterns from the ElevenLabs adapter and codebase conventions (ESM `.js` extensions, `type` imports, ITTSProvider interface, registry factory pattern, error wrapping). The 6 minor issues are all low-risk and non-blocking -- they represent optional improvements for follow-up work. No major or fundamental issues were found. The Google SDK integration is correctly abstracted behind the shared interface, credential parsing is robust, and edge cases (numeric enums, null responses, three-letter locales) are properly handled and tested.
