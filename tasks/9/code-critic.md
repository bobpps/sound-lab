# Code Review: feat/9-tts-provider

## Abstraction problems

### [ABS-1] Dead field in interface: `sampleRate` declared but never used -- Major
**File:** `backend/src/providers/tts/types.ts:17`
**What's wrong:** `ISynthesizeOptions.sampleRate` is declared as an optional field but no implementation reads it. `ElevenLabsTTSProvider.synthesize()` ignores it entirely. ElevenLabs encodes sample rate inside their `output_format` string (e.g. `mp3_44100_128`, `pcm_24000`), so a separate `sampleRate` field is semantically meaningless for this provider.
**Why it's bad:** It's a lie in the contract. Callers see `sampleRate`, set it, and nothing happens. When a second provider is added (e.g. Google Cloud TTS, which does have a separate sample rate param), someone will have to decide whether to make ElevenLabs silently ignore it or retroactively wire it up. Dead fields in interfaces accumulate confusion.

### [ABS-2] `format` field leaks provider-specific semantics through the generic interface -- Major
**File:** `backend/src/providers/tts/types.ts:16`, `backend/src/providers/tts/elevenlabs.ts:65`
**What's wrong:** `ISynthesizeOptions.format` is typed as `string`, and the ElevenLabs implementation defaults it to `'mp3_44100_128'` -- a value that only makes sense in the ElevenLabs API. Other providers use entirely different format identifiers (Google uses `LINEAR16`, `OGG_OPUS`, etc.). The "generic" interface is actually ElevenLabs-shaped.
**Why it's bad:** The next provider implementation will either have to translate ElevenLabs-style format strings or add its own incompatible default. The abstraction pretends to be provider-agnostic but isn't. Callers will have to know which provider is behind the interface to pass a valid `format`.

### [ABS-3] Hardcoded model_id with no escape hatch -- Minor
**File:** `backend/src/providers/tts/elevenlabs.ts:80`
**What's wrong:** `model_id` is hardcoded to `'eleven_multilingual_v2'`. There is no way to select a different model (e.g., `eleven_turbo_v2_5`, `eleven_flash_v2_5`) without editing the source code.
**Why it's bad:** ElevenLabs has multiple models with different latency/quality tradeoffs. Locking to one model means the provider cannot be used for latency-sensitive scenarios (e.g., realtime voice agents that need `eleven_flash`). This will eventually require either an `ISynthesizeOptions` extension or a constructor param, which is a breaking change to the interface.

### [ABS-4] Hardcoded similarity_boost with no override -- Minor
**File:** `backend/src/providers/tts/elevenlabs.ts:84`
**What's wrong:** `similarity_boost` is hardcoded to `0.75`. This is a significant quality parameter in ElevenLabs that affects how closely the output matches the original voice.
**Why it's bad:** Same as above -- no way to tune it without source modification. Less critical than model selection, but still a dial that users will want to turn.

## Potential bugs

### [BUG-1] Error messages discard the response body -- Major
**File:** `backend/src/providers/tts/elevenlabs.ts:57`, `backend/src/providers/tts/elevenlabs.ts:91`
**What's wrong:** On non-OK responses, the code throws `Error(`ElevenLabs API error: ${response.status}`)` but never reads `response.body` or `response.text()`. ElevenLabs returns structured error bodies with details like `{"detail":{"status":"invalid_api_key","message":"..."}}`.
**Why it's bad:** When something goes wrong in production, the error log will say "ElevenLabs API error: 422" and nothing else. The developer will then have to reproduce the exact call with the exact parameters to figure out what ElevenLabs actually complained about. The diagnostic information is right there in the response and is being thrown away.

### [BUG-2] URL parameter not encoded -- Minor
**File:** `backend/src/providers/tts/elevenlabs.ts:71`
**What's wrong:** `opts.voiceId` and `format` are interpolated directly into the URL string without `encodeURIComponent()`. The URL is built via template literal: `` `${BASE_URL}/v1/text-to-speech/${opts.voiceId}?output_format=${format}` ``.
**Why it's bad:** If `voiceId` or `format` ever contains characters that need URL encoding (unlikely for ElevenLabs voice IDs today, but not impossible with custom/cloned voice IDs), the request will go to the wrong URL or fail silently. Using `URL` + `URLSearchParams` is the correct way to build URLs.

### [BUG-3] `speed` is not validated or clamped -- Minor
**File:** `backend/src/providers/tts/elevenlabs.ts:66`
**What's wrong:** `temperature` is carefully clamped to `[0, 1]`, but `speed` is passed through raw with no validation. ElevenLabs accepts speed in the range `[0.25, 4.0]`. Values outside this range will cause a 422 error from the API.
**Why it's bad:** Inconsistent validation. The code already has a `clamp()` helper and uses it for temperature. Not using it for speed means the caller gets a cryptic "ElevenLabs API error: 422" (see BUG-1) instead of either a clamped value or a clear validation error.

## Code quality

### [QUAL-1] Default language fallback is silently wrong -- Minor
**File:** `backend/src/providers/tts/elevenlabs.ts:24`
**What's wrong:** When a voice has no `verified_languages` (empty array or undefined), the `mapVoice` function defaults `language` to `'en'`. This is a silent assumption that may not be correct -- the voice could be French, Japanese, or anything.
**Why it's bad:** Downstream code that filters or groups voices by language will misclassify these voices. The data is wrong, not missing. `undefined` or `'unknown'` would be more honest than a fabricated `'en'`.

### [QUAL-2] `as` cast on unvalidated API response -- Minor
**File:** `backend/src/providers/tts/elevenlabs.ts:60`
**What's wrong:** `(await response.json()) as ElevenLabsVoicesResponse` trusts the API response to match the TypeScript type with zero runtime validation. If ElevenLabs changes their API shape (e.g., wraps `voices` in a `data` field or changes `voice_id` to `id`), the code will silently produce garbage data.
**Why it's bad:** This is the classic `as` trust problem. It works until the external API changes, and then it fails silently with undefined fields instead of a clear error. Not critical for an internal tool, but worth noting.

## Testing violations

### [TEST-1] Tests mock `fetch` for an external API adapter -- this is correct, but coverage has a gap -- Minor
**File:** `backend/tests/providers/elevenlabs.test.ts`
**What's wrong:** The tests mock `fetch` (correct for an external API adapter), but there is no test for what happens when `response.json()` returns an unexpected shape (e.g., missing `voices` key, or `voices` is not an array). The `as` cast in production code means this would produce a runtime crash on `.map()`, but no test covers it.
**Why it's bad:** The happy path and error-status paths are well-covered, but the "API returned 200 with garbage body" path is not tested. This is a realistic failure mode when APIs evolve.

## Summary
- Critical issues: 0
- Major: 3 (ABS-1, ABS-2, BUG-1)
- Minor: 6 (ABS-3, ABS-4, BUG-2, BUG-3, QUAL-1, QUAL-2, TEST-1)
- Overall assessment: Clean, well-structured code with consistent patterns and good test coverage. The main problems are in the interface design -- the generic `ISynthesizeOptions` is shaped too closely around ElevenLabs specifics (dead `sampleRate`, provider-specific `format`), and error diagnostics are thrown away. Nothing is fundamentally broken, but the abstraction will creak when the second provider arrives.
