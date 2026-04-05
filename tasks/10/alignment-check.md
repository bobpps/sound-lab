# Alignment Check -- Issue #10: Google TTS Adapter

## Original Analysis Summary

The analysis (`tasks/10/analysis.md`) and plan (`tasks/10/plan.md`) specified:

1. **New class** `GoogleTTSProvider` in `backend/src/providers/tts/google.ts` implementing the `ITTSProvider` interface (properties: `id`, `name`; methods: `getVoices`, `synthesize`, `validateCredentials`).
2. **Authentication:** Treat the `apiKey` string as JSON-serialized service account credentials (`client_email` + `private_key`). Parse in constructor, pass to `TextToSpeechClient({ credentials })`. Throw a clear error if JSON is invalid or missing required fields.
3. **Voice mapping:** Google voice fields -> `IVoice`: `name` -> `id`/`name`, `languageCodes[0]` -> `language`, `ssmlGender` -> `gender` (lowercase), `providerMeta` carries `naturalSampleRateHertz` and `ssmlGender`. Handle both string and numeric `ssmlGender` (protobuf enum: 0=UNSPECIFIED, 1=MALE, 2=FEMALE, 3=NEUTRAL).
4. **Synthesize mapping:** `voiceId` -> `voice.name` with language code extracted from voiceId prefix; `text` -> `input.text`; `speed` -> `audioConfig.speakingRate` (default 1.0); `format` -> `audioConfig.audioEncoding` (default MP3); `sampleRate` -> `audioConfig.sampleRateHertz` (conditional); `temperature` -> not supported (skip).
5. **validateCredentials:** Call `client.listVoices({ languageCode: 'en-US' })`, return `true` on success, `false` on error.
6. **Registry:** Register under key `"google"` in `backend/src/providers/tts/registry.ts`.
7. **Tests:** Comprehensive unit tests in `backend/tests/providers/google-tts.test.ts` using `vi.mock('@google-cloud/text-to-speech')` pattern. Update `backend/tests/providers/registry.test.ts` to cover the new provider.
8. **TDD workflow:** 9 tasks in the plan, following red-green-refactor with failing tests committed before implementation.

---

## What Was Implemented

### `backend/src/providers/tts/google.ts` (133 lines)

- `parseCredentials(apiKey)` -- validates JSON, checks for `client_email` + `private_key`, throws descriptive error.
- `GENDER_MAP` constant + `resolveGender()` helper -- handles both numeric (0-3) and string (`MALE`/`FEMALE`/`NEUTRAL`) ssmlGender values, returns lowercase or undefined.
- `extractLanguageCode(voiceId)` -- splits on `-`, takes first two segments (handles standard `en-US-Wavenet-A` and three-part `cmn-CN-Wavenet-A` patterns).
- `GoogleTTSProvider` class:
  - `id = 'google'`, `name = 'Google Cloud TTS'` -- readonly.
  - Constructor parses credentials, creates `TextToSpeechClient`.
  - `getVoices()` -- calls `client.listVoices({})`, maps response to `IVoice[]`, wraps errors with `Google TTS API error:` prefix, handles null/empty voices array.
  - `synthesize(opts)` -- builds `audioConfig` (encoding, speakingRate, conditional sampleRateHertz), calls `client.synthesizeSpeech`, returns `Buffer.from(response.audioContent)`, wraps errors.
  - `validateCredentials()` -- calls `client.listVoices({ languageCode: 'en-US' })`, returns boolean.

### `backend/tests/providers/google-tts.test.ts` (334 lines)

- 21 test cases across 5 describe blocks: `id and name` (2), `constructor` (2), `validateCredentials` (2), `getVoices` (7), `synthesize` (9).
- Covers: identity, invalid JSON, missing fields, credential validation success/failure, voice mapping with string/numeric gender, empty/null voices, API errors, synthesize request building with defaults and all options, language code extraction, buffer return type, conditional sampleRateHertz, error wrapping.

### `backend/src/providers/tts/registry.ts` (22 lines)

- Imports `GoogleTTSProvider`, adds `google: GoogleTTSProvider` to `PROVIDERS` map.

### `backend/tests/providers/registry.test.ts` (54 lines)

- Updated with Google TTS mock, tests for `createTTSProvider('google', credentials)`, updated `getSupportedTTSProviders` to expect length 2 with `"google"` included.

---

## Mismatches

### Minor

1. **`afterEach` uses `vi.clearAllMocks()` instead of `vi.restoreAllMocks()` in google-tts.test.ts (line 29).**
   The plan specified `vi.restoreAllMocks()` in `afterEach`. The implementation uses `vi.clearAllMocks()` instead. The `beforeEach` also calls `vi.clearAllMocks()`, making the `afterEach` redundant but not harmful. The backend CLAUDE.md convention says to use `vi.restoreAllMocks()` in `afterEach`. This is a minor style deviation -- `clearAllMocks` resets call history but does not restore original implementations, while `restoreAllMocks` does both. Since all mocks are module-level `vi.fn()` stubs (not spies on real implementations), the functional difference is negligible here.
   **Severity: Minor**

2. **`temperature` option not explicitly addressed in implementation.**
   The analysis noted that `ISynthesizeOptions.temperature` is "not directly supported -- could skip or log warning." The implementation silently ignores it (no log warning). The plan also chose to silently skip it. This is consistent with the plan's intent and the interface allows it (temperature is optional). No warning is logged, which is acceptable for an unsupported optional parameter.
   **Severity: Minor**

### No Major or Fundamental mismatches found.

---

## Corrections Made

1. **`response!.audioContent` non-null assertion (line 122 of google.ts).**
   The plan's code used `response.audioContent`, while the implementation uses `response!.audioContent`. This is a defensive correction -- TypeScript's type narrowing after the destructured `[response]` may leave `response` as possibly undefined. The `!` assertion is acceptable since the try/catch guarantees we only reach this line if the API call succeeded.

2. **No format mapping function implemented.**
   The analysis suggested mapping lowercase format strings (`mp3` -> `MP3`, `ogg_opus` -> `OGG_OPUS`). The implementation passes `opts.format` directly (e.g., `'OGG_OPUS'`). The test uses uppercase `'OGG_OPUS'` directly. This is a simplification -- the caller is expected to provide the format in the Google-compatible form. Given that the `ISynthesizeOptions.format` is a plain `string` with no enum constraint, this is a reasonable choice that avoids over-engineering.

---

## Final Alignment Verdict

**PASS**

The implementation faithfully matches the analysis and plan across all critical dimensions:

- **ITTSProvider contract conformance:** All 5 interface members (`id`, `name`, `getVoices`, `synthesize`, `validateCredentials`) are implemented with correct signatures and return types. The class uses `implements ITTSProvider` ensuring compile-time verification.
- **Authentication approach:** JSON-parsed service account credentials, matching the planned design for fitting the `(apiKey: string) => ITTSProvider` registry pattern.
- **Voice mapping:** Complete and correct, including the dual string/numeric ssmlGender handling identified as a risk in the analysis.
- **Synthesize mapping:** All supported options (voiceId, text, speed, format, sampleRate) correctly mapped. Language code extraction works for standard and three-part locale patterns. Conditional sampleRateHertz inclusion prevents sending undefined values.
- **Error handling:** Consistent `Google TTS API error:` prefix wrapping for both `getVoices` and `synthesize`. Constructor throws descriptive errors for invalid credentials.
- **Registry:** Properly registered under `"google"` key with updated tests.
- **Test coverage:** 21 tests covering all methods, edge cases (null voices, numeric gender enums, three-part locales), error paths, and the registry integration. Follows the established ElevenLabs test pattern with appropriate adaptations for the SDK mock approach.
- **Two minor deviations** (`clearAllMocks` vs `restoreAllMocks`, silent temperature skip) are inconsequential to correctness.

The implementation is production-ready and aligns with the original analysis and plan.
