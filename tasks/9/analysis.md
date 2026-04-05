# Analysis: Issue #9 — TTS Provider Interface + Registry + ElevenLabs Adapter

## What the Task Requires

Create a TTS provider abstraction layer in `backend/src/providers/tts/` that defines a universal interface for text-to-speech providers, implements the first concrete adapter (ElevenLabs), and provides a registry/factory for instantiating providers by ID. This is Phase 3 work (Backend TTS Providers, 1/4) and does NOT modify the DB layer.

### Files to Create

| File | Role |
|------|------|
| `backend/src/providers/tts/types.ts` | `IVoice`, `ISynthesizeOptions`, `ITTSProvider` interfaces |
| `backend/src/providers/tts/registry.ts` | `createTTSProvider()` factory, `getSupportedTTSProviders()` |
| `backend/src/providers/tts/elevenlabs.ts` | `ElevenLabsTTSProvider` class implementing `ITTSProvider` |
| `backend/tests/providers/elevenlabs.test.ts` | Unit tests with mocked `fetch` |

### Interfaces Required

**IVoice** — represents a single voice from a TTS provider:
- `id: string` — provider-specific voice ID (e.g., `"JBFqnCBsd6RMkjVDRZzb"`)
- `name: string` — human-readable name (e.g., `"Rachel"`)
- `language: string` — BCP 47 or ISO 639-1 code
- `gender?: string` — extracted from provider labels
- `description?: string` — voice description
- `previewUrl?: string` — URL to sample audio
- `providerMeta?: Record<string, unknown>` — raw extra data from the provider

**ISynthesizeOptions** — parameters for a TTS synthesis request:
- `voiceId: string` — which voice to use
- `text: string` — the text to convert
- `speed?: number` — playback speed multiplier
- `temperature?: number` — maps to ElevenLabs `stability` (inverse)
- `format?: string` — output audio format (e.g., `"mp3_44100_128"`)
- `sampleRate?: number` — sample rate in Hz

**ITTSProvider** — the provider contract:
- `id: string` — natural key matching DB provider ID (e.g., `"elevenlabs"`)
- `name: string` — display name
- `getVoices(): Promise<IVoice[]>` — list available voices
- `synthesize(opts: ISynthesizeOptions): Promise<Buffer>` — convert text to audio
- `validateCredentials(): Promise<boolean>` — check if API key is valid

---

## Constraints from Project Guidance

1. **ESM everywhere** — `"type": "module"`, all imports use `.js` extensions (e.g., `'./types.js'`, `'./elevenlabs.js'`).
2. **Provider IDs are natural string keys** — `"elevenlabs"`, `"google"`, etc. Match the DB `providers.id` field exactly.
3. **This module does NOT modify the DB layer** — It's a standalone `providers/tts/` directory. It will receive API keys as constructor arguments, not fetch them from the DB directly.
4. **TDD by default** — Write tests first (RED), then implement (GREEN), then refactor.
5. **Vitest with `globals: true`** — `describe`, `it`, `expect`, `beforeEach`, `afterEach`, `vi` available without import.
6. **No external TTS SDK dependencies** — Use native `fetch` (Node 18+ built-in) to call ElevenLabs REST API directly. No `elevenlabs-js` package.
7. **TypeScript strict mode** — `strict: true` in tsconfig.
8. **`vi.restoreAllMocks()` in `afterEach`** — per `backend/CLAUDE.md`.
9. **No `console.log`** — ESLint `no-console: warn`.
10. **Target ES2022** — can use top-level await, but module resolution is `bundler`.

---

## Key Files and Systems

### Existing Files (to reference, not modify)

| File | Role | Key Content |
|------|------|-------------|
| `backend/src/db/types.ts` | Domain types | `Provider` type with `id`, `name`, `type`, `enabled`, `created_at` (lines 1-11) |
| `backend/src/db/interfaces.ts` | Repository interfaces | `IProviderRepository.getDecryptedKey(id)` returns decrypted API key (line 55) |
| `backend/src/db/local/providers.ts` | SQLite provider repo | `getDecryptedKey()` decrypts stored key using `crypto.ts` |
| `backend/src/db/local/crypto.ts` | AES-256-GCM encryption | `encrypt()` / `decrypt()` used for API key storage |
| `backend/src/plugins/db.ts` | DB Fastify plugin | Exposes `fastify.db.providers` for route access |
| `backend/vitest.config.ts` | Test config | `globals: true`, `pool: 'forks'`, tsx loader |
| `backend/tests/db/providers.test.ts` | Provider DB tests | Reference for test patterns, encryption key usage |
| `backend/tests/helpers.ts` | Route test helper | `buildTestApp()` for integration tests |

### Files to Create

| File | Role |
|------|------|
| `backend/src/providers/tts/types.ts` | Interface definitions |
| `backend/src/providers/tts/registry.ts` | Factory and provider listing |
| `backend/src/providers/tts/elevenlabs.ts` | ElevenLabs adapter |
| `backend/tests/providers/elevenlabs.test.ts` | Tests with mocked fetch |

---

## ElevenLabs API Endpoints

### Authentication

All ElevenLabs API requests require the `xi-api-key` header:
```
xi-api-key: <ELEVENLABS_API_KEY>
```

Base URL: `https://api.elevenlabs.io`

### GET /v1/voices — List Available Voices

**Request:**
```
GET https://api.elevenlabs.io/v1/voices
Headers: xi-api-key: <key>
```

**Response (200):**
```json
{
  "voices": [
    {
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "name": "Rachel",
      "category": "professional",
      "labels": {
        "accent": "American",
        "gender": "female",
        "description": "expressive",
        "age": "middle-aged",
        "use_case": "social media"
      },
      "description": "A warm, expressive voice...",
      "preview_url": "https://storage.googleapis.com/.../sample.mp3",
      "verified_languages": [
        {
          "language": "en",
          "locale": "en-US"
        }
      ],
      "settings": {
        "stability": 1,
        "similarity_boost": 1,
        "style": 0,
        "speed": 1
      }
    }
  ],
  "has_more": true,
  "total_count": 1
}
```

**Mapping to IVoice:**
- `voice_id` -> `id`
- `name` -> `name`
- `verified_languages[0]?.locale ?? verified_languages[0]?.language ?? 'en'` -> `language`
- `labels?.gender` -> `gender`
- `description` -> `description`
- `preview_url` -> `previewUrl`
- Remaining fields -> `providerMeta`

### POST /v1/text-to-speech/{voice_id} — Synthesize Speech

**Request:**
```
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format={format}
Headers:
  Content-Type: application/json
  xi-api-key: <key>
Body:
{
  "text": "Hello world",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75,
    "speed": 1.0
  }
}
```

**Response (200):** Binary audio data (`application/octet-stream`)

**Mapping from ISynthesizeOptions:**
- `voiceId` -> path param `{voice_id}`
- `text` -> body `text`
- `speed` -> body `voice_settings.speed` (default 1.0)
- `temperature` -> body `voice_settings.stability` (inverted: stability = 1 - temperature, clamped to [0, 1])
- `format` -> query param `output_format` (default `"mp3_44100_128"`)
- `sampleRate` -> encoded in `output_format` string if provided

### GET /v1/user — Validate Credentials

**Request:**
```
GET https://api.elevenlabs.io/v1/user
Headers: xi-api-key: <key>
```

**Response (200):** User info object (we only care that it's 200)
**Response (401):** Unauthorized (invalid key)

**Mapping for `validateCredentials()`:**
- Call `GET /v1/user`
- Return `true` if status 200
- Return `false` otherwise (catch errors too)

---

## How the TTS Provider Interacts with the Existing Provider DB Model

The TTS provider module is **decoupled** from the DB layer. The interaction flow is:

1. A route handler (future task) receives a request to synthesize speech for provider `"elevenlabs"`.
2. The handler calls `fastify.db.providers.getDecryptedKey("elevenlabs")` to get the API key.
3. The handler calls `createTTSProvider("elevenlabs", apiKey)` from the registry to instantiate the adapter.
4. The handler calls `provider.synthesize(options)` and returns the audio buffer.

The `ElevenLabsTTSProvider` constructor takes the API key as a parameter:
```typescript
class ElevenLabsTTSProvider implements ITTSProvider {
  constructor(private apiKey: string) {}
}
```

The registry factory function:
```typescript
function createTTSProvider(providerId: string, apiKey: string): ITTSProvider
```

This keeps the TTS module pure (no DB dependency) and lets the routing layer handle key retrieval.

---

## Testing Strategy

### What to Mock

**`global.fetch`** — The only external dependency. All three `ITTSProvider` methods (`getVoices`, `synthesize`, `validateCredentials`) make HTTP calls to the ElevenLabs API using native `fetch`.

### How to Mock

Use `vi.stubGlobal('fetch', vi.fn())` or `vi.spyOn(globalThis, 'fetch')`:

```typescript
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

afterEach(() => {
  vi.restoreAllMocks();
});
```

### Test Cases

**`getVoices()`:**
1. Returns mapped `IVoice[]` from ElevenLabs voice list response
2. Correctly maps `voice_id`, `name`, `labels.gender`, `description`, `preview_url`, `verified_languages`
3. Handles empty voice list
4. Throws/handles API error response (non-200)

**`synthesize()`:**
1. Returns audio Buffer for valid request
2. Sends correct URL with `voice_id` path param and `output_format` query param
3. Sends correct request body with `text`, `model_id`, `voice_settings`
4. Uses default values when optional params omitted
5. Maps `temperature` to `stability` correctly (inverted)
6. Throws on non-200 response

**`validateCredentials()`:**
1. Returns `true` when API returns 200
2. Returns `false` when API returns 401
3. Returns `false` on network error (fetch throws)

**Registry (`createTTSProvider`):**
1. Returns `ElevenLabsTTSProvider` for `"elevenlabs"`
2. Throws for unsupported provider ID
3. `getSupportedTTSProviders()` returns `["elevenlabs"]`

### Mock Data Shape

Voice list mock response:
```json
{
  "voices": [{
    "voice_id": "test-voice-1",
    "name": "Test Voice",
    "category": "premade",
    "labels": { "gender": "female", "accent": "American" },
    "description": "A test voice",
    "preview_url": "https://example.com/preview.mp3",
    "verified_languages": [{ "language": "en", "locale": "en-US" }]
  }]
}
```

Synthesize mock response:
```typescript
new Response(new Uint8Array([0x49, 0x44, 0x33]), { status: 200 }) // fake MP3 header bytes
```

---

## Risks and Assumptions

### Risks

1. **`fetch` global availability** — Node 18+ includes `fetch` globally. The project targets ES2022 and uses tsx, so `fetch` should be available. If not, we need to use `node:fetch` or polyfill.
2. **Buffer vs Uint8Array** — `response.arrayBuffer()` returns `ArrayBuffer`. Need to convert to `Buffer` with `Buffer.from(arrayBuffer)`. This is a Node.js pattern, not browser.
3. **ElevenLabs API pagination** — The `GET /v1/voices` endpoint is paginated (`has_more`, `next_page_token`, default `page_size=10`). For a complete voice list, we may need to paginate. Decision: start with a single page (set `page_size=100`), note pagination as a future enhancement.
4. **Temperature-to-stability mapping** — ElevenLabs uses `stability` (0-1, higher = more stable), while our interface uses `temperature` (higher = more varied). These are conceptually inverse. Mapping: `stability = 1 - clamp(temperature, 0, 1)`. This is a design decision that should be documented.
5. **Model ID hardcoding** — ElevenLabs requires a `model_id`. We default to `"eleven_multilingual_v2"`. This could be made configurable in a future task.

### Assumptions

1. **API key is passed to the constructor** — The TTS provider does not fetch keys from the DB. The caller is responsible for key retrieval.
2. **No streaming** — `synthesize()` returns a full `Buffer`, not a stream. Streaming can be added later via a separate `synthesizeStream()` method.
3. **Default model** — Using `"eleven_multilingual_v2"` as the default model for all synthesis requests.
4. **Default output format** — `"mp3_44100_128"` (MP3, 44.1kHz, 128kbps) unless overridden via `format` option.
5. **No rate limiting** — The provider does not implement rate limiting. ElevenLabs handles this server-side (429 responses).
6. **The `backend/src/providers/` directory does not exist yet** — It needs to be created along with `tts/` subdirectory.

### Unknowns Resolved

1. **Q: Does `backend/src/providers/` exist?** A: No. The glob search returned no files. Both `providers/` and `providers/tts/` directories must be created.

2. **Q: What ElevenLabs endpoints are needed?** A: Three endpoints:
   - `GET /v1/voices` — list voices (maps to `getVoices()`)
   - `POST /v1/text-to-speech/{voice_id}` — synthesize (maps to `synthesize()`)
   - `GET /v1/user` — validate API key (maps to `validateCredentials()`)

3. **Q: How does ElevenLabs authentication work?** A: `xi-api-key` HTTP header on every request. A `GET /v1/user` call returning 200 confirms the key is valid.

4. **Q: What voice properties does ElevenLabs return?** A: Extensive object including `voice_id`, `name`, `category`, `labels` (gender, accent, age, description, use_case), `description`, `preview_url`, `verified_languages` (with locale), `settings`, etc.

5. **Q: How should we mock fetch in tests?** A: `vi.stubGlobal('fetch', vi.fn())` with `vi.restoreAllMocks()` in `afterEach`. This is consistent with Vitest patterns. No need for `msw` or other mocking libraries since we're doing unit tests.

6. **Q: What output format does the TTS endpoint return?** A: Binary audio data (`application/octet-stream`). Use `response.arrayBuffer()` then `Buffer.from()`.

7. **Q: Is `similarity_boost` needed in voice_settings?** A: It's optional. We can default to `0.75` (ElevenLabs default) and not expose it in `ISynthesizeOptions` for now. Keep it simple.

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HTTP client | Native `fetch` | No extra deps, Node 18+ built-in |
| API key injection | Constructor param | Decoupled from DB, testable |
| Voice pagination | Single page, `page_size=100` | Sufficient for initial use, pagination is future work |
| Temperature mapping | `stability = 1 - temperature` | Conceptually inverse, simple math |
| Default model | `eleven_multilingual_v2` | Multi-language support, recommended by ElevenLabs |
| Default format | `mp3_44100_128` | Common format, good quality |
| Error handling | Throw on non-200 responses | Let caller decide how to handle |
| `similarity_boost` | Default `0.75`, not exposed | Keep interface simple, ElevenLabs-specific detail |
