# Analysis — Issue #10: Google TTS Adapter

## What the Task Requires

Implement `GoogleTTSProvider` class in `backend/src/providers/tts/google.ts` that:
1. Implements `ITTSProvider` interface (id, name, getVoices, synthesize, validateCredentials)
2. Uses `@google-cloud/text-to-speech` npm package
3. Maps Google Cloud voice format to `IVoice`
4. Maps `ISynthesizeOptions` to Google synthesize request
5. Returns audio as `Buffer`

Register it in `backend/src/providers/tts/registry.ts` under the key `"google"`.

Write comprehensive tests in `backend/tests/providers/google-tts.test.ts` following the ElevenLabs test patterns.

## Google Cloud TTS API Patterns

### Client Construction
```typescript
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
const client = new TextToSpeechClient({ credentials: { client_email, private_key } });
```

### listVoices
```typescript
const [response] = await client.listVoices({});
// response.voices: Array<{ name, languageCodes[], ssmlGender, naturalSampleRateHertz }>
```

### synthesizeSpeech
```typescript
const [response] = await client.synthesizeSpeech({
  input: { text: 'Hello' },
  voice: { languageCode: 'en-US', name: 'en-US-Wavenet-A' },
  audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, sampleRateHertz: 24000 },
});
// response.audioContent: Uint8Array
```

## Authentication Approach

**Key decision:** The registry uses `(apiKey: string) => ITTSProvider` constructor signature. Google Cloud TTS requires service account credentials (JSON with `client_email` + `private_key`), not a simple API key.

**Solution:** Treat the `apiKey` string as JSON-serialized service account credentials. Parse in constructor, pass to `TextToSpeechClient({ credentials })`. This fits the existing registry pattern without interface changes.

## Voice Mapping: Google → IVoice

| Google field | IVoice field |
|---|---|
| `name` (e.g. "en-US-Wavenet-A") | `id` |
| `name` | `name` |
| `languageCodes[0]` | `language` |
| `ssmlGender` (MALE/FEMALE/NEUTRAL) | `gender` (lowercase) |
| — | `description`: undefined |
| — | `previewUrl`: undefined |
| `{ naturalSampleRateHertz, ssmlGender }` | `providerMeta` |

## ISynthesizeOptions → Google Request Mapping

| ISynthesizeOptions | Google Request |
|---|---|
| `voiceId` | `voice.name` (extract languageCode from voiceId prefix) |
| `text` | `input.text` |
| `speed` | `audioConfig.speakingRate` |
| `format` | `audioConfig.audioEncoding` (map: mp3→MP3, linear16→LINEAR16, ogg_opus→OGG_OPUS) |
| `sampleRate` | `audioConfig.sampleRateHertz` |
| `temperature` | Not directly supported — could skip or log warning |

## validateCredentials Strategy

Call `client.listVoices({ languageCode: 'en-US' })` — if it succeeds, credentials are valid. Catch errors → return false.

## Test Mocking Strategy

Use `vi.mock('@google-cloud/text-to-speech')` to mock the module. Create mock methods (`listVoices`, `synthesizeSpeech`) as `vi.fn()`. The mock factory returns `{ TextToSpeechClient: vi.fn().mockImplementation(() => ({ listVoices: mockListVoices, synthesizeSpeech: mockSynthesize })) }`.

This differs from ElevenLabs tests (which mock global `fetch`) because Google uses a client class.

## Risks and Assumptions

1. **gRPC dependency weight:** `@google-cloud/text-to-speech` pulls in gRPC. Acceptable for a backend tool.
2. **ssmlGender as enum:** Google protobuf may return `ssmlGender` as a number (0=UNSPECIFIED, 1=MALE, 2=FEMALE, 3=NEUTRAL). Need to handle both string and number forms.
3. **ESM compatibility:** The Google client package should work with ESM but needs verification.
4. **Credentials JSON parsing:** If apiKey is not valid JSON, constructor should throw clearly.
5. **Voice language extraction:** voiceId format is "languageCode-VoiceType-Letter" (e.g. "en-US-Wavenet-A"), extract "en-US" as languageCode for synthesize request.
