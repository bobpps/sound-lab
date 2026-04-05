# Execution Log: Issue #11 -- Inworld TTS Adapter

## Research Phase

### Entry 1: Project Guidance Review

**Read:**
- `CLAUDE.md` (root) -- ESM everywhere, `.js` extensions in imports, TDD by default
- `backend/CLAUDE.md` -- Provider IDs are natural string keys, Vitest with `globals: true`, `vi.restoreAllMocks()` in `afterEach`
- `frontend/CLAUDE.md` -- Not directly relevant to this task (backend-only)
- `backend/tsconfig.json` -- `strict: true`, `module: ESNext`, `moduleResolution: bundler`
- `backend/package.json` -- `"type": "module"`, no Inworld SDK dependency (use native `fetch`)

**Key constraints identified:**
- Constructor must match `new (apiKey: string) => ITTSProvider` signature from registry
- All methods return Promises
- Error pattern: read response body, throw `new Error('Provider API error: STATUS BODY')`

### Entry 2: Existing Provider Analysis

**Read files:**
- `backend/src/providers/tts/types.ts` -- 3 interfaces: `IVoice`, `ISynthesizeOptions`, `ITTSProvider`
- `backend/src/providers/tts/elevenlabs.ts` -- Reference implementation (130 lines)
- `backend/src/providers/tts/registry.ts` -- Factory function + supported list
- `backend/tests/providers/elevenlabs.test.ts` -- 313 lines, comprehensive mocked `fetch` tests
- `backend/tests/providers/registry.test.ts` -- Tests for factory and provider list
- `backend/tests/helpers.ts` -- `buildTestApp()` helper (not needed for provider unit tests)

**Pattern summary:**
- Provider file structure: private interfaces for API response types at top, `mapVoice()` helper, utility functions, exported class
- Test structure: `vi.stubGlobal('fetch', mockFetch)`, grouped `describe` blocks for each method, `new Response()` for mocking
- Registry: simple map of `string -> constructor`, two exported functions

**Note:** Only ElevenLabs exists so far. Google TTS adapter (task 9) was listed in the plan but has not been implemented yet. The worktree's `backend/src/providers/tts/` directory contains only `elevenlabs.ts`, `registry.ts`, and `types.ts`.

### Entry 3: Inworld TTS API Research

**Sources consulted:**
- Inworld official docs: quickstart-tts, API reference for synthesize-speech and list-voices
- LiveKit Inworld TTS plugin docs
- Pipecat Inworld TTS integration docs
- Inworld TTS product page (inworld.ai/tts-api)
- GitHub inworld-ai/tts repo (training code only, no API docs)

**API findings:**

1. **Authentication**: Basic Auth, header `Authorization: Basic <api-key>`. Key is pre-encoded Base64 from the Inworld Portal.

2. **List Voices**: `GET https://api.inworld.ai/tts/v1/voices`
   - Optional `filter` query param (e.g., `language=en`)
   - Returns `{ voices: [{ voiceId, displayName, languages, description, tags, isCustom }] }`
   - DEPRECATED (removal July 1, 2026) -- acceptable for now

3. **Synthesize**: `POST https://api.inworld.ai/tts/v1/voice`
   - JSON body: `{ text, voiceId, modelId, audioConfig?, temperature?, timestampType? }`
   - Response: `{ audioContent: "<base64>", usage: { processedCharactersCount, modelId } }`
   - CRITICAL: `audioContent` is base64, not raw bytes (unlike ElevenLabs)

4. **No credential validation endpoint**: Must use List Voices as a proxy

5. **Models**: `inworld-tts-1.5-max` (recommended), `inworld-tts-1.5-mini`, `inworld-tts-1`, `inworld-tts-1-max`

6. **Audio formats**: `MP3` (default), `LINEAR16`, `OGG_OPUS`, `ALAW`, `MULAW`, `FLAC`, `PCM`, `WAV`

7. **Parameters**: `temperature` (0, 2.0] default 1.0, `speakingRate` 0.5-1.5 default 1.0, `sampleRateHertz` 8000-48000 default 48000

### Entry 4: Key Design Decisions for Implementation

1. **Voice mapping**: `voiceId` -> `id`, `displayName` -> `name`, `languages[0]` -> `language`, gender extracted from `tags` array
2. **Format handling**: Accept format string, uppercase it for Inworld's `audioEncoding`. Support `sampleRate` -> `sampleRateHertz` direct mapping.
3. **Speed clamping**: Inworld's `speakingRate` range is 0.5-1.5, so clamp `opts.speed` to that range.
4. **Temperature passthrough**: Inworld supports (0, 2.0] which is wider than typical. Pass through, let the API validate.
5. **Base64 decoding**: Parse JSON response, extract `audioContent`, decode with `Buffer.from(audioContent, 'base64')`.
6. **Credential validation**: `GET /tts/v1/voices`, return `response.ok`, catch errors -> `false`.

### Entry 5: Registry Update Plan

Add to `backend/src/providers/tts/registry.ts`:
- Import: `import { InworldTTSProvider } from './inworld.js';`
- Map entry: `inworld: InworldTTSProvider`
- Registry test (`registry.test.ts`) will need updating to expect `['elevenlabs', 'inworld']` and test `createTTSProvider('inworld', 'key')` returns `InworldTTSProvider` instance.

---

## Implementation Phase

### Task 1: Write Inworld TTS Provider Tests (RED)

**Commit:** `12ea402` -- test: add Inworld TTS provider tests (RED phase)

- Created `backend/tests/providers/inworld-tts.test.ts` with 25 tests across 4 describe blocks
- Followed ElevenLabs test patterns: `vi.stubGlobal('fetch', mockFetch)`, `vi.restoreAllMocks()` in afterEach
- Test groups: id/name (2), validateCredentials (3), getVoices (7), synthesize (13)
- Verified RED: all tests fail with `Cannot find module '../../src/providers/tts/inworld.js'`
- No deviations from plan

### Task 2: Implement InworldTTSProvider (GREEN)

**Commit:** `b59a6a6` -- feat: implement InworldTTSProvider (GREEN phase)

- Created `backend/src/providers/tts/inworld.ts` matching the plan exactly
- Key implementation details:
  - Basic auth via `Authorization: Basic <apiKey>` header
  - Voice mapping: `voiceId` -> `id`, `displayName` -> `name`, gender extracted from tags
  - `buildAudioConfig()` returns undefined when no audio options provided (avoids sending empty object)
  - Speed clamped to [0.5, 1.5] per Inworld API limits
  - Temperature passed through directly (no inversion, unlike ElevenLabs)
  - Base64 decode for audio response (unlike ElevenLabs which uses raw arraybuffer)
- Verified GREEN: all 25 tests pass

### Task 3: Registry Integration (RED -> GREEN)

**Commit:** `fff7220` -- feat: register InworldTTSProvider in TTS registry

- Updated `backend/tests/providers/registry.test.ts`:
  - Added import for `InworldTTSProvider`
  - Added test: `returns InworldTTSProvider for "inworld"`
  - Updated `getSupportedTTSProviders` test to expect `['elevenlabs', 'inworld']` with length 2
- Verified RED: 2 registry tests fail as expected (provider not registered)
- Updated `backend/src/providers/tts/registry.ts`:
  - Added import for `InworldTTSProvider`
  - Added `inworld: InworldTTSProvider` to PROVIDERS map
- Verified GREEN: all 4 registry tests pass
- Full suite: **178 tests pass, 14 test files, 0 failures**

### Decisions & Findings

1. **No deviations from the plan.** The implementation matched the spec exactly.
2. **TDD cycle worked cleanly.** Each RED phase failed for the expected reason (module not found, then provider not registered), and each GREEN phase passed on first attempt.
3. **Key difference from ElevenLabs:** Inworld returns base64-encoded audio in JSON (vs raw binary stream), uses Basic auth (vs custom header), and has `audioConfig` as a nested object (vs flat query params/body fields).

## Status

Implementation complete. All 3 tasks done. Full test suite green (178/178).
