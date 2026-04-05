# Code Review: feat/10-google-tts

## Potential bugs

### [BUG-1] Non-null assertion on `v.name` will crash on malformed API response (Major)
**File:** `backend/src/providers/tts/google.ts:84`
**What's wrong:** `v.name!` is used twice in the voice mapping. The Google Cloud TTS API type marks `name` as `string | null | undefined`. If the API ever returns a voice object with a null/undefined name, this will produce `null` as the voice ID and name, silently creating broken `IVoice` objects rather than crashing visibly or filtering them out.
**Why it's bad:** The non-null assertion (`!`) suppresses the TypeScript safety net. Downstream code that receives an `IVoice` with `id: null` will behave unpredictably. The ElevenLabs provider doesn't have this problem because the ElevenLabs response type (`ElevenLabsVoice`) declares `voice_id: string` and `name: string` as non-optional.

### [BUG-2] Non-null assertion on `response!.audioContent` (Major)
**File:** `backend/src/providers/tts/google.ts:122`
**What's wrong:** `response!.audioContent as Uint8Array` has two issues stacked: a non-null assertion on `response` and a type assertion on `audioContent`. If the API returns a response with null `audioContent` (which is possible per the protobuf type), `Buffer.from(null as unknown as Uint8Array)` will throw an opaque runtime error.
**Why it's bad:** The error message will be something like "The first argument must be of type string or an instance of Buffer, ArrayBuffer, or Array" - completely unhelpful for debugging. A proper null check with a descriptive error would make failures diagnosable.

### [BUG-3] `extractLanguageCode` is naive about voice ID formats (Minor)
**File:** `backend/src/providers/tts/google.ts:51-58`
**What's wrong:** The function splits on `-` and takes the first two parts. The comment says `"cmn-CN-Wavenet-A" -> "cmn-CN"`, which is correct. But Google also has voice IDs like `"en-US-Studio-MultiSpeaker"` and potentially future formats. More critically, if a voice ID has fewer than 2 dash-separated parts (single segment), it returns the entire voiceId as the languageCode, which is definitely not a valid language code.
**Why it's bad:** Passing an invalid languageCode to `synthesizeSpeech` will result in a confusing API error. The fallback branch (`return voiceId`) is a silent failure path.

## Abstraction problems

### [ABS-1] `audioConfig` typed as `Record<string, unknown>` loses all type safety (Major)
**File:** `backend/src/providers/tts/google.ts:98`
**What's wrong:** The `audioConfig` object is explicitly typed as `Record<string, unknown>` instead of using the Google Cloud TTS SDK's own `IAudioConfig` type. This means any typo in property names (`audioEncoding` vs `audio_encoding`, `speakingRate` vs `speaking_rate`) will compile silently.
**Why it's bad:** The Google Cloud TTS SDK uses protobuf-generated types. By casting to `Record<string, unknown>`, the code opts out of compile-time checking for the most critical part of the synthesize request. If a property name is wrong, the API will silently use defaults instead of the requested values.

### [ABS-2] `temperature` from `ISynthesizeOptions` is silently ignored (Minor)
**File:** `backend/src/providers/tts/google.ts:97-105`
**What's wrong:** The `ISynthesizeOptions` interface includes a `temperature` field. The ElevenLabs provider maps it to inverted `stability`. The Google provider completely ignores it without any indication.
**Why it's bad:** A caller passing `temperature: 0.8` to the Google provider will get no error and no effect. This is a leaky abstraction: the unified `ISynthesizeOptions` interface promises a capability that one implementation silently drops. At minimum, a comment documenting the intentional omission would signal this is deliberate, not an oversight.

## Code quality

### [QUAL-1] Duplicate `vi.clearAllMocks()` in test setup (Minor)
**File:** `backend/tests/providers/google-tts.test.ts:23-29`
**What's wrong:** `vi.clearAllMocks()` is called in both `beforeEach` (line 24) and `afterEach` (line 28). This is redundant - one or the other suffices. The ElevenLabs test uses `vi.restoreAllMocks()` in `afterEach` only, which is the project convention per `backend/CLAUDE.md`.
**Why it's bad:** Inconsistency with the established project pattern (`vi.restoreAllMocks()` in `afterEach`). Also, `clearAllMocks` and `restoreAllMocks` are different: `clear` resets call history and return values but keeps the mock implementation, while `restore` replaces mocks with original implementations. The Google test uses `clear`, the ElevenLabs test uses `restore` - this is not just a style difference, it's a semantic difference.

### [QUAL-2] `GENDER_MAP` key `0` (SSML_VOICE_GENDER_UNSPECIFIED) returns `undefined` silently (Minor)
**File:** `backend/src/providers/tts/google.ts:32-36`
**What's wrong:** The Google protobuf enum for `SsmlVoiceGender` has value `0` for `SSML_VOICE_GENDER_UNSPECIFIED`. The `GENDER_MAP` doesn't have a key `0`, so `resolveGender(0)` returns `undefined` via the fallback. This is tested and works, but the map is not self-documenting about this deliberate omission.
**Why it's bad:** Minor readability issue. A reader has to trace through the function to understand that 0 maps to undefined. A comment or explicit `0: undefined` entry would make the intent clear.

### [QUAL-3] Inconsistent error handling between `getVoices` and `synthesize` in ElevenLabs vs Google (Minor)
**File:** `backend/src/providers/tts/google.ts:73-79` vs `backend/src/providers/tts/elevenlabs.ts:71-83`
**What's wrong:** ElevenLabs `getVoices` lets fetch errors propagate naturally (no try/catch), while Google wraps everything in try/catch and re-throws with a prefix. ElevenLabs checks `response.ok` and reads the body for error details; Google catches the SDK exception and extracts just the message. These are structurally different error handling strategies for the same interface method.
**Why it's bad:** Consumers of `ITTSProvider` cannot rely on a consistent error shape. One provider throws `"ElevenLabs API error: 500 Internal Server Error"` (with HTTP status), the other throws `"Google TTS API error: 7 PERMISSION_DENIED"` (with gRPC status). Any error handling or logging code that parses these messages will be provider-specific.

## Testing violations

### [TEST-1] Google TTS tests use mocks for an external SDK - acceptable but worth noting (Minor)
**File:** `backend/tests/providers/google-tts.test.ts:3-12`
**What's wrong:** The `backend/CLAUDE.md` says "Integration tests: in-memory SQLite (real SQL). Unit tests: mocked repos (isolates handler logic)." The Google TTS tests mock `@google-cloud/text-to-speech` entirely. This is reasonable for an external API client, but it means the tests verify the mock wiring, not the actual SDK behavior. If the Google SDK changes its return tuple structure (e.g., `[response]` becomes `{ response }`), these tests will continue to pass while production breaks.
**Why it's bad:** This is the nature of mocking external SDKs, and there's no good alternative without integration tests against the real API. Noting it as a known limitation, not a demand to change.

## Summary

| Severity | Count | Issues |
|----------|-------|--------|
| Major | 3 | BUG-1, BUG-2, ABS-1 |
| Minor | 5 | BUG-3, ABS-2, QUAL-1, QUAL-2, QUAL-3, TEST-1 |
| Fundamental | 0 | - |

**Overall assessment:** The implementation is structurally sound and follows the established provider pattern correctly. The registry is clean and minimal. The main concerns are the non-null assertions in the Google provider that trade type safety for brevity, and the `Record<string, unknown>` audioConfig that defeats the purpose of using a typed SDK. No architectural violations or fundamental issues.
