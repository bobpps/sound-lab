# Analysis: Issue #11 -- Inworld TTS Adapter

## What the Task Requires

Implement an Inworld AI TTS provider adapter that conforms to the existing `ITTSProvider` interface, register it in the TTS provider registry, and write comprehensive unit tests. This is the third TTS provider in Phase 3 (after ElevenLabs and Google).

**Deliverables:**
1. Create `backend/src/providers/tts/inworld.ts` -- the adapter class
2. Create `backend/tests/providers/inworld-tts.test.ts` -- unit tests
3. Modify `backend/src/providers/tts/registry.ts` -- add `inworld` entry

## Constraints from Project Guidance

- **ESM everywhere**: All imports must use `.js` extensions (e.g., `import { ... } from './types.js'`)
- **`"type": "module"`** in package.json -- native ES modules, no CommonJS
- **TypeScript strict mode**: `strict: true` in tsconfig
- **TDD by default**: Write tests first, then implement (Red -> Green -> Refactor)
- **Vitest with `globals: true`**: No need to import `describe`, `it`, `expect`, `vi`
- **`vi.restoreAllMocks()` in `afterEach`**: Standard cleanup pattern
- **Provider IDs are natural string keys**: `"inworld"` (not auto-increment)
- **No new dependencies needed**: Uses native `fetch` (global in Node 18+), no SDK required
- **Constructor takes single `apiKey: string` param**: Matches registry's `new (apiKey: string) => ITTSProvider` type

## Key Files and Systems Involved

### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/providers/tts/inworld.ts` | `InworldTTSProvider` class implementing `ITTSProvider` |
| `backend/tests/providers/inworld-tts.test.ts` | Unit tests mocking `fetch`, testing all 3 interface methods |

### Files to Modify

| File | Change |
|------|--------|
| `backend/src/providers/tts/registry.ts` | Add `inworld: InworldTTSProvider` to `PROVIDERS` map + import |

### Files to Reference (read-only)

| File | Purpose |
|------|---------|
| `backend/src/providers/tts/types.ts` | `ITTSProvider`, `IVoice`, `ISynthesizeOptions` interfaces |
| `backend/src/providers/tts/elevenlabs.ts` | Reference implementation (pattern to follow) |
| `backend/tests/providers/elevenlabs.test.ts` | Reference test structure (pattern to follow) |
| `backend/tests/providers/registry.test.ts` | Will need updating to expect `inworld` in supported list |

## Inworld TTS API Details

### Authentication

- **Method**: HTTP Basic Authentication
- **Header**: `Authorization: Basic <api-key>`
- The API key is a Base64-encoded credential obtained from the Inworld Portal (Settings > API Keys)
- The key is passed directly as-is (already Base64-encoded), no additional encoding needed

### Base URL

```
https://api.inworld.ai
```

### Endpoints

#### 1. List Voices

```
GET https://api.inworld.ai/tts/v1/voices
```

**Query Parameters:**
- `filter` (optional, string): Filter by language using ISO 639-1 codes (e.g., `language=en`)

**Response (200):**
```json
{
  "voices": [
    {
      "voiceId": "Alex",
      "displayName": "Alex",
      "languages": ["en"],
      "description": "Energetic and expressive mid-range male voice, with a mildly nasal quality",
      "tags": ["male", "energetic", "expressive", "mid-range"],
      "isCustom": false
    },
    {
      "voiceId": "Ashley",
      "displayName": "Ashley",
      "languages": ["en"],
      "description": "A warm, natural female voice",
      "tags": ["female", "warm", "natural"],
      "isCustom": false
    }
  ]
}
```

**Note:** This endpoint is deprecated (removal scheduled July 1, 2026). For the purposes of this adapter, it is still functional and the simplest way to list voices. A future migration to the replacement Voices API can be done later.

**Error Response (4XX):**
```json
{
  "code": 3,
  "message": "Invalid language code: 'English'. Must be a 2-letter ISO 639-1 code",
  "details": []
}
```

#### 2. Synthesize Speech (Non-Streaming)

```
POST https://api.inworld.ai/tts/v1/voice
```

**Request Body:**
```json
{
  "text": "Hello world",
  "voiceId": "Ashley",
  "modelId": "inworld-tts-1.5-max",
  "audioConfig": {
    "audioEncoding": "MP3",
    "sampleRateHertz": 48000,
    "bitRate": 128000,
    "speakingRate": 1.0
  },
  "temperature": 1.0,
  "timestampType": "TIMESTAMP_TYPE_UNSPECIFIED",
  "applyTextNormalization": "ON"
}
```

**Field Details:**
- `text` (required, string): Max 2,000 characters
- `voiceId` (required, string): Voice identifier (e.g., "Ashley", "Alex", "Dennis")
- `modelId` (required, string): Model to use
- `audioConfig` (optional, object):
  - `audioEncoding`: `LINEAR16` | `MP3` | `OGG_OPUS` | `ALAW` | `MULAW` | `FLAC` | `PCM` | `WAV` (default: `MP3`)
  - `sampleRateHertz`: 8000-48000 (default: 48000)
  - `bitRate`: bits/second (default: 128000)
  - `speakingRate`: 0.5-1.5 (default: 1.0)
- `temperature` (optional, number): Range (0, 2.0], default 1.0. Higher = more expressive/random
- `timestampType` (optional): `TIMESTAMP_TYPE_UNSPECIFIED` | `WORD` | `CHARACTER`
- `applyTextNormalization` (optional): `APPLY_TEXT_NORMALIZATION_UNSPECIFIED` | `ON` | `OFF`

**Response (200):**
```json
{
  "audioContent": "<base64-encoded audio bytes>",
  "usage": {
    "processedCharactersCount": 11,
    "modelId": "inworld-tts-1.5-max"
  },
  "timestampInfo": { ... }
}
```

The `audioContent` field contains the audio data as a base64-encoded string. Must be decoded to get raw audio bytes.

**Maximum output audio size:** 16MB

### Available Models

| Model | Description | Languages |
|-------|-------------|-----------|
| `inworld-tts-1.5-max` | Best quality, recommended default | 16 languages |
| `inworld-tts-1.5-mini` | Lower latency, lighter | 16 languages |
| `inworld-tts-1` | Legacy model | 24 languages |
| `inworld-tts-1-max` | Legacy max quality | 24 languages |

### Supported Audio Encodings

`LINEAR16`, `MP3`, `OGG_OPUS`, `ALAW`, `MULAW`, `FLAC`, `PCM`, `WAV`

### Supported Languages (15+)

English, Spanish, French, Korean, Dutch, Chinese, German, Italian, Japanese, Polish, Portuguese, Russian, Hindi, Arabic, Hebrew

### Credential Validation

There is **no dedicated user/account endpoint** for Inworld TTS API (unlike ElevenLabs which has `/v1/user`). The best approach for `validateCredentials()` is to call the List Voices endpoint (`GET /tts/v1/voices`) and check for a 200 response. This is a lightweight GET request that requires valid authentication.

## How the Existing Provider Pattern Works

### Interface (`types.ts`)

```typescript
interface ITTSProvider {
  readonly id: string;         // Natural string key, e.g. "elevenlabs"
  readonly name: string;       // Display name, e.g. "ElevenLabs"
  getVoices(): Promise<IVoice[]>;
  synthesize(opts: ISynthesizeOptions): Promise<Buffer>;
  validateCredentials(): Promise<boolean>;
}
```

### IVoice Structure

```typescript
interface IVoice {
  id: string;
  name: string;
  language: string;           // Single language string
  gender?: string;
  description?: string;
  previewUrl?: string;
  providerMeta?: Record<string, unknown>;
}
```

Note: `IVoice.language` is a single string, but Inworld voices have `languages: string[]` (array). Need to pick the first language or join them.

### ISynthesizeOptions

```typescript
interface ISynthesizeOptions {
  voiceId: string;
  text: string;
  speed?: number;
  temperature?: number;
  format?: string;
  sampleRate?: number;
}
```

### ElevenLabs Implementation Pattern

1. **Constructor**: Takes `apiKey: string`, stores as `private readonly`
2. **`id` / `name`**: Readonly properties
3. **`getVoices()`**: Calls API, maps response to `IVoice[]` using a helper `mapVoice()` function
4. **`synthesize()`**: Calls API with mapped options, returns `Buffer` from response
5. **`validateCredentials()`**: Calls a lightweight endpoint, returns `boolean`, catches all errors -> `false`
6. **Error handling**: Reads response body text, throws `new Error('Provider API error: STATUS BODY')`
7. **Helper functions**: Private/module-level for mapping and validation (e.g., `clamp()`, `resolveFormat()`, `mapVoice()`)
8. **Response types**: Provider-specific interfaces defined at the top of the file

### Registry Pattern (`registry.ts`)

```typescript
const PROVIDERS: Record<string, new (apiKey: string) => ITTSProvider> = {
  elevenlabs: ElevenLabsTTSProvider,
};
```

To add Inworld: import the class and add `inworld: InworldTTSProvider` to the map.

### Test Pattern (`elevenlabs.test.ts`)

1. **Setup**: `vi.stubGlobal('fetch', mockFetch)` to mock all HTTP
2. **Groups**: `describe` blocks for `id and name`, `validateCredentials`, `getVoices`, `synthesize`
3. **Mock responses**: `new Response(body, { status })` -- uses the standard `Response` API
4. **Assertions**: Check URL, headers, body, response mapping
5. **Error cases**: Non-200 responses, network errors
6. **Cleanup**: `vi.restoreAllMocks()` in `afterEach`

### Registry Test Pattern (`registry.test.ts`)

Tests `createTTSProvider()` for known IDs and throws for unknown IDs. Also tests `getSupportedTTSProviders()` returns correct list.

## Mapping: Inworld API -> ITTSProvider Interface

### `getVoices()` Mapping

| Inworld Voice Field | IVoice Field | Mapping |
|---------------------|--------------|---------|
| `voiceId` | `id` | Direct |
| `displayName` | `name` | Direct |
| `languages[0]` | `language` | First element, fallback to `'en'` |
| `tags` (find gender tag) | `gender` | Extract from tags array: look for `'male'`/`'female'` |
| `description` | `description` | Direct |
| (none) | `previewUrl` | `undefined` (Inworld doesn't provide preview URLs) |
| `{ languages, tags, isCustom }` | `providerMeta` | Preserve extra Inworld-specific data |

### `synthesize()` Mapping

| ISynthesizeOptions Field | Inworld Request Field | Mapping |
|--------------------------|----------------------|---------|
| `voiceId` | `voiceId` | Direct |
| `text` | `text` | Direct |
| `speed` | `audioConfig.speakingRate` | Direct (both are floats, Inworld range 0.5-1.5) |
| `temperature` | `temperature` | Direct (Inworld range (0, 2.0]) |
| `format` | `audioConfig.audioEncoding` | Map string, default `MP3` |
| `sampleRate` | `audioConfig.sampleRateHertz` | Direct integer |

**Critical difference from ElevenLabs**: Inworld returns `audioContent` as base64-encoded string in a JSON response, NOT raw binary. Must `Buffer.from(audioContent, 'base64')` to decode.

### `validateCredentials()` Mapping

Call `GET /tts/v1/voices` with auth header. Return `true` on 200, `false` on any error.

## Audio Format Mapping

For the `format` field in `ISynthesizeOptions`, map to Inworld's `audioEncoding` enum:

| Input Format String | Inworld audioEncoding |
|--------------------|----------------------|
| `mp3` | `MP3` |
| `linear16` / `pcm` | `LINEAR16` |
| `ogg_opus` / `opus` | `OGG_OPUS` |
| `wav` | `WAV` |
| `flac` | `FLAC` |
| `alaw` | `ALAW` |
| `mulaw` | `MULAW` |
| (default) | `MP3` |

The simplest approach: if `opts.format` is provided, uppercase it and pass directly to `audioEncoding`. If not provided, default to `MP3`.

## Risks and Assumptions

### Risks

1. **Deprecated List Voices endpoint**: The `GET /tts/v1/voices` endpoint is deprecated with removal scheduled for July 1, 2026. The replacement "Voices API" may have a different URL/schema. This is acceptable for now since the endpoint is still functional, but a comment should note the deprecation.

2. **No dedicated credential validation endpoint**: Unlike ElevenLabs (`/v1/user`), Inworld has no user/account info endpoint. Using List Voices for validation is a reasonable proxy but makes a slightly heavier call.

3. **Base64 response format**: Unlike ElevenLabs which returns raw audio bytes, Inworld returns base64-encoded audio in a JSON wrapper. This means extra decoding step and different response parsing.

4. **Voice naming convention**: Inworld voice IDs are human-readable names (e.g., "Ashley", "Alex") rather than opaque UUIDs like ElevenLabs. This means voice IDs could potentially change.

### Assumptions

1. **API key is already Base64-encoded**: The constructor receives the API key as stored by the user, which is already the Base64 credential from the Inworld Portal. No additional encoding is needed.

2. **Default model**: Use `inworld-tts-1.5-max` as the default model (best quality, recommended by docs).

3. **Default audio format**: MP3 at 48kHz (Inworld defaults), matching reasonable expectations.

4. **Gender extraction from tags**: The `tags` array contains gender information (e.g., `["male", "energetic"]`). Extract by checking for `"male"` or `"female"` in the array.

5. **Single language mapping**: `IVoice.language` is a string, not an array. Take the first element of `languages[]`, falling back to `'en'`.

6. **No preview URLs**: Inworld's List Voices response does not include preview audio URLs, so `previewUrl` will always be `undefined`.

## Unknowns Resolved

| Unknown | Resolution |
|---------|------------|
| Authentication method | Basic Auth with `Authorization: Basic <api-key>` header |
| How to list voices | `GET /tts/v1/voices` with optional `filter=language=xx` parameter |
| How to synthesize | `POST /tts/v1/voice` with JSON body, response contains base64 `audioContent` |
| Audio response format | JSON with `audioContent` as base64 string (NOT raw binary like ElevenLabs) |
| How to validate credentials | Call List Voices endpoint, check for 200 response |
| Default model | `inworld-tts-1.5-max` |
| Available audio encodings | `MP3`, `LINEAR16`, `OGG_OPUS`, `ALAW`, `MULAW`, `FLAC`, `PCM`, `WAV` |
| Voice gender info | Extracted from `tags` array, not a dedicated field |
| Request body field casing | camelCase for non-streaming endpoint (`voiceId`, `modelId`, `audioConfig`) |
| Speed mapping | `ISynthesizeOptions.speed` -> `audioConfig.speakingRate` (Inworld range 0.5-1.5) |
| Temperature mapping | Direct mapping, Inworld range (0, 2.0], ISynthesizeOptions has no explicit range |
