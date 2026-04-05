# Google TTS Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Google Cloud Text-to-Speech adapter conforming to the `ITTSProvider` interface and register it in the TTS provider registry.

**Architecture:** New `GoogleTTSProvider` class in `backend/src/providers/tts/google.ts` wraps the `@google-cloud/text-to-speech` SDK. The constructor accepts a JSON-serialized service account credentials string (matching the existing `(apiKey: string) => ITTSProvider` registry signature). Voice listing, synthesis, and credential validation delegate to the SDK client. Registration in the existing registry makes it available under key `"google"`.

**Tech Stack:** TypeScript, `@google-cloud/text-to-speech` npm package, Vitest (with `vi.mock` for SDK mocking)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `backend/src/providers/tts/google.ts` | Create | `GoogleTTSProvider` class implementing `ITTSProvider` |
| `backend/tests/providers/google-tts.test.ts` | Create | Unit tests for `GoogleTTSProvider` (mocked SDK) |
| `backend/src/providers/tts/registry.ts` | Modify | Add `google` entry to `PROVIDERS` map |
| `backend/tests/providers/registry.test.ts` | Modify | Update registry tests to include `google` |

---

### Task 1: Install the Google Cloud TTS dependency

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install the npm package**

Run from the **worktree root**:

```bash
cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts && npm install --workspace=backend @google-cloud/text-to-speech
```

- [ ] **Step 2: Verify installation**

Run: `cat backend/package.json | grep text-to-speech`

Expected: a line like `"@google-cloud/text-to-speech": "^X.Y.Z"` in `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json package-lock.json
git commit -m "chore: add @google-cloud/text-to-speech dependency"
```

---

### Task 2: Write failing tests for GoogleTTSProvider identity and validateCredentials

**Files:**
- Create: `backend/tests/providers/google-tts.test.ts`

- [ ] **Step 1: Write the test file with identity and validateCredentials tests**

Create `backend/tests/providers/google-tts.test.ts`:

```typescript
import { GoogleTTSProvider } from '../../src/providers/tts/google.js';

// Mock the entire @google-cloud/text-to-speech module
const mockListVoices = vi.fn();
const mockSynthesizeSpeech = vi.fn();

vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: vi.fn().mockImplementation(() => ({
    listVoices: mockListVoices,
    synthesizeSpeech: mockSynthesizeSpeech,
  })),
}));

const FAKE_CREDENTIALS = JSON.stringify({
  client_email: 'test@test.iam.gserviceaccount.com',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n',
});

describe('GoogleTTSProvider', () => {
  let provider: GoogleTTSProvider;

  beforeEach(() => {
    provider = new GoogleTTSProvider(FAKE_CREDENTIALS);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "google"', () => {
      expect(provider.id).toBe('google');
    });

    it('has name "Google Cloud TTS"', () => {
      expect(provider.name).toBe('Google Cloud TTS');
    });
  });

  describe('constructor', () => {
    it('throws when apiKey is not valid JSON', () => {
      expect(() => new GoogleTTSProvider('not-json')).toThrow(
        'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
      );
    });

    it('throws when JSON lacks required fields', () => {
      expect(() => new GoogleTTSProvider(JSON.stringify({ foo: 'bar' }))).toThrow(
        'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
      );
    });
  });

  describe('validateCredentials', () => {
    it('returns true when listVoices succeeds', async () => {
      mockListVoices.mockResolvedValue([{ voices: [] }]);

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockListVoices).toHaveBeenCalledWith({ languageCode: 'en-US' });
    });

    it('returns false when listVoices throws', async () => {
      mockListVoices.mockRejectedValue(new Error('UNAUTHENTICATED'));

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run tests/providers/google-tts.test.ts`

Expected: FAIL — module `../../src/providers/tts/google.js` does not exist.

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/tests/providers/google-tts.test.ts
git commit -m "test: add failing tests for GoogleTTSProvider identity and validateCredentials"
```

---

### Task 3: Implement GoogleTTSProvider skeleton (id, name, constructor, validateCredentials)

**Files:**
- Create: `backend/src/providers/tts/google.ts`

- [ ] **Step 1: Implement the minimal provider**

Create `backend/src/providers/tts/google.ts`:

```typescript
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

function parseCredentials(apiKey: string): GoogleCredentials {
  let parsed: unknown;
  try {
    parsed = JSON.parse(apiKey);
  } catch {
    throw new Error(
      'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
    );
  }

  const creds = parsed as Record<string, unknown>;
  if (
    typeof creds.client_email !== 'string' ||
    typeof creds.private_key !== 'string'
  ) {
    throw new Error(
      'Invalid Google credentials: apiKey must be a JSON string with client_email and private_key',
    );
  }

  return { client_email: creds.client_email, private_key: creds.private_key };
}

export class GoogleTTSProvider implements ITTSProvider {
  readonly id = 'google';
  readonly name = 'Google Cloud TTS';

  private readonly client: TextToSpeechClient;

  constructor(apiKey: string) {
    const credentials = parseCredentials(apiKey);
    this.client = new TextToSpeechClient({ credentials });
  }

  async getVoices(): Promise<IVoice[]> {
    throw new Error('Not implemented');
  }

  async synthesize(_opts: ISynthesizeOptions): Promise<Buffer> {
    throw new Error('Not implemented');
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.client.listVoices({ languageCode: 'en-US' });
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run tests/providers/google-tts.test.ts`

Expected: All 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/providers/tts/google.ts
git commit -m "feat: implement GoogleTTSProvider skeleton with constructor and validateCredentials"
```

---

### Task 4: Write failing tests for getVoices

**Files:**
- Modify: `backend/tests/providers/google-tts.test.ts`

- [ ] **Step 1: Add getVoices tests**

Add the following `describe` block inside the main `describe('GoogleTTSProvider', ...)`, after the `validateCredentials` describe block:

```typescript
  describe('getVoices', () => {
    const googleVoicesResponse = [
      {
        voices: [
          {
            name: 'en-US-Wavenet-A',
            languageCodes: ['en-US'],
            ssmlGender: 'FEMALE',
            naturalSampleRateHertz: 24000,
          },
          {
            name: 'de-DE-Standard-B',
            languageCodes: ['de-DE'],
            ssmlGender: 'MALE',
            naturalSampleRateHertz: 24000,
          },
          {
            name: 'ja-JP-Neural2-C',
            languageCodes: ['ja-JP'],
            ssmlGender: 'NEUTRAL',
            naturalSampleRateHertz: 24000,
          },
        ],
      },
    ];

    it('returns mapped IVoice array', async () => {
      mockListVoices.mockResolvedValue(googleVoicesResponse);

      const voices = await provider.getVoices();

      expect(voices).toHaveLength(3);
      expect(voices[0]).toEqual({
        id: 'en-US-Wavenet-A',
        name: 'en-US-Wavenet-A',
        language: 'en-US',
        gender: 'female',
        description: undefined,
        previewUrl: undefined,
        providerMeta: {
          naturalSampleRateHertz: 24000,
          ssmlGender: 'FEMALE',
        },
      });
    });

    it('maps gender to lowercase', async () => {
      mockListVoices.mockResolvedValue(googleVoicesResponse);

      const voices = await provider.getVoices();

      expect(voices[0]!.gender).toBe('female');
      expect(voices[1]!.gender).toBe('male');
      expect(voices[2]!.gender).toBe('neutral');
    });

    it('handles numeric ssmlGender enum values', async () => {
      mockListVoices.mockResolvedValue([
        {
          voices: [
            {
              name: 'en-US-Wavenet-A',
              languageCodes: ['en-US'],
              ssmlGender: 1,
              naturalSampleRateHertz: 24000,
            },
            {
              name: 'en-US-Wavenet-B',
              languageCodes: ['en-US'],
              ssmlGender: 2,
              naturalSampleRateHertz: 24000,
            },
            {
              name: 'en-US-Wavenet-C',
              languageCodes: ['en-US'],
              ssmlGender: 3,
              naturalSampleRateHertz: 24000,
            },
            {
              name: 'en-US-Wavenet-D',
              languageCodes: ['en-US'],
              ssmlGender: 0,
              naturalSampleRateHertz: 24000,
            },
          ],
        },
      ]);

      const voices = await provider.getVoices();

      expect(voices[0]!.gender).toBe('male');
      expect(voices[1]!.gender).toBe('female');
      expect(voices[2]!.gender).toBe('neutral');
      expect(voices[3]!.gender).toBeUndefined();
    });

    it('returns empty array when no voices returned', async () => {
      mockListVoices.mockResolvedValue([{ voices: [] }]);

      const voices = await provider.getVoices();

      expect(voices).toEqual([]);
    });

    it('handles null voices array', async () => {
      mockListVoices.mockResolvedValue([{ voices: null }]);

      const voices = await provider.getVoices();

      expect(voices).toEqual([]);
    });

    it('calls listVoices with empty request', async () => {
      mockListVoices.mockResolvedValue([{ voices: [] }]);

      await provider.getVoices();

      expect(mockListVoices).toHaveBeenCalledWith({});
    });

    it('throws on API error', async () => {
      mockListVoices.mockRejectedValue(new Error('API unavailable'));

      await expect(provider.getVoices()).rejects.toThrow(
        'Google TTS API error: API unavailable',
      );
    });
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run tests/providers/google-tts.test.ts`

Expected: 7 new tests FAIL with "Not implemented", earlier tests still pass.

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/tests/providers/google-tts.test.ts
git commit -m "test: add failing tests for GoogleTTSProvider.getVoices"
```

---

### Task 5: Implement getVoices

**Files:**
- Modify: `backend/src/providers/tts/google.ts`

- [ ] **Step 1: Add gender mapping helper and implement getVoices**

Add the following constant and function **above** the `GoogleTTSProvider` class definition (after the `parseCredentials` function):

```typescript
const GENDER_MAP: Record<number, string> = {
  1: 'male',
  2: 'female',
  3: 'neutral',
};

function resolveGender(ssmlGender: string | number | null | undefined): string | undefined {
  if (typeof ssmlGender === 'number') {
    return GENDER_MAP[ssmlGender];
  }
  if (typeof ssmlGender === 'string') {
    const lower = ssmlGender.toLowerCase();
    if (lower === 'male' || lower === 'female' || lower === 'neutral') {
      return lower;
    }
  }
  return undefined;
}
```

Then replace the `getVoices` method stub with:

```typescript
  async getVoices(): Promise<IVoice[]> {
    let response;
    try {
      [response] = await this.client.listVoices({});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Google TTS API error: ${message}`);
    }

    const voices = response.voices ?? [];

    return voices.map((v) => ({
      id: v.name!,
      name: v.name!,
      language: v.languageCodes?.[0] ?? 'unknown',
      gender: resolveGender(v.ssmlGender),
      description: undefined,
      previewUrl: undefined,
      providerMeta: {
        naturalSampleRateHertz: v.naturalSampleRateHertz,
        ssmlGender: v.ssmlGender,
      },
    }));
  }
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run tests/providers/google-tts.test.ts`

Expected: All tests PASS (identity, constructor, validateCredentials, getVoices).

- [ ] **Step 3: Commit**

```bash
git add backend/src/providers/tts/google.ts
git commit -m "feat: implement GoogleTTSProvider.getVoices with gender mapping"
```

---

### Task 6: Write failing tests for synthesize

**Files:**
- Modify: `backend/tests/providers/google-tts.test.ts`

- [ ] **Step 1: Add synthesize tests**

Add the following `describe` block inside the main `describe('GoogleTTSProvider', ...)`, after the `getVoices` describe block:

```typescript
  describe('synthesize', () => {
    const fakeAudioContent = new Uint8Array([0x49, 0x44, 0x33, 0x04]);

    it('returns audio Buffer for valid request', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      const result = await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello world',
      });

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(Buffer.from(fakeAudioContent));
    });

    it('sends correct request with defaults', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello world',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith({
        input: { text: 'Hello world' },
        voice: { languageCode: 'en-US', name: 'en-US-Wavenet-A' },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
        },
      });
    });

    it('extracts languageCode from voiceId prefix', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'de-DE-Standard-B',
        text: 'Hallo Welt',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: { languageCode: 'de-DE', name: 'de-DE-Standard-B' },
        }),
      );
    });

    it('extracts languageCode from three-part locale voiceId', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'cmn-CN-Wavenet-A',
        text: 'Hello',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-A' },
        }),
      );
    });

    it('uses custom speed as speakingRate', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello',
        speed: 1.5,
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({ speakingRate: 1.5 }),
        }),
      );
    });

    it('maps format string to audioEncoding', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello',
        format: 'OGG_OPUS',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({ audioEncoding: 'OGG_OPUS' }),
        }),
      );
    });

    it('includes sampleRateHertz when sampleRate is provided', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello',
        sampleRate: 16000,
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({ sampleRateHertz: 16000 }),
        }),
      );
    });

    it('does not include sampleRateHertz when sampleRate is not provided', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: fakeAudioContent }]);

      await provider.synthesize({
        voiceId: 'en-US-Wavenet-A',
        text: 'Hello',
      });

      const callArgs = mockSynthesizeSpeech.mock.calls[0]![0];
      expect(callArgs.audioConfig).not.toHaveProperty('sampleRateHertz');
    });

    it('throws on API error', async () => {
      mockSynthesizeSpeech.mockRejectedValue(new Error('Quota exceeded'));

      await expect(
        provider.synthesize({ voiceId: 'en-US-Wavenet-A', text: 'Hello' }),
      ).rejects.toThrow('Google TTS API error: Quota exceeded');
    });
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run tests/providers/google-tts.test.ts`

Expected: 9 new synthesize tests FAIL with "Not implemented", earlier tests still pass.

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/tests/providers/google-tts.test.ts
git commit -m "test: add failing tests for GoogleTTSProvider.synthesize"
```

---

### Task 7: Implement synthesize

**Files:**
- Modify: `backend/src/providers/tts/google.ts`

- [ ] **Step 1: Add language extraction helper**

Add the following function **above** the `GoogleTTSProvider` class definition (after the `resolveGender` function):

```typescript
function extractLanguageCode(voiceId: string): string {
  // Voice IDs follow the pattern: "languageCode-VoiceType-Letter"
  // e.g. "en-US-Wavenet-A" → "en-US", "cmn-CN-Wavenet-A" → "cmn-CN"
  const parts = voiceId.split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return voiceId;
}
```

- [ ] **Step 2: Replace the synthesize method stub**

Replace the `synthesize` method with:

```typescript
  async synthesize(opts: ISynthesizeOptions): Promise<Buffer> {
    const audioConfig: Record<string, unknown> = {
      audioEncoding: opts.format ?? 'MP3',
      speakingRate: opts.speed ?? 1.0,
    };

    if (opts.sampleRate !== undefined) {
      audioConfig.sampleRateHertz = opts.sampleRate;
    }

    let response;
    try {
      [response] = await this.client.synthesizeSpeech({
        input: { text: opts.text },
        voice: {
          languageCode: extractLanguageCode(opts.voiceId),
          name: opts.voiceId,
        },
        audioConfig,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Google TTS API error: ${message}`);
    }

    return Buffer.from(response.audioContent as Uint8Array);
  }
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run tests/providers/google-tts.test.ts`

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/providers/tts/google.ts
git commit -m "feat: implement GoogleTTSProvider.synthesize with language extraction"
```

---

### Task 8: Register Google in the TTS registry and update registry tests

**Files:**
- Modify: `backend/src/providers/tts/registry.ts`
- Modify: `backend/tests/providers/registry.test.ts`

- [ ] **Step 1: Write updated registry tests first**

Replace the full contents of `backend/tests/providers/registry.test.ts` with:

```typescript
import { createTTSProvider, getSupportedTTSProviders } from '../../src/providers/tts/registry.js';
import { ElevenLabsTTSProvider } from '../../src/providers/tts/elevenlabs.js';
import { GoogleTTSProvider } from '../../src/providers/tts/google.js';

// Mock Google TTS client so GoogleTTSProvider constructor doesn't need real credentials
vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: vi.fn().mockImplementation(() => ({
    listVoices: vi.fn(),
    synthesizeSpeech: vi.fn(),
  })),
}));

describe('TTS Provider Registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTTSProvider', () => {
    it('returns ElevenLabsTTSProvider for "elevenlabs"', () => {
      const provider = createTTSProvider('elevenlabs', 'test-key');

      expect(provider).toBeInstanceOf(ElevenLabsTTSProvider);
      expect(provider.id).toBe('elevenlabs');
    });

    it('returns GoogleTTSProvider for "google"', () => {
      const credentials = JSON.stringify({
        client_email: 'test@test.iam.gserviceaccount.com',
        private_key: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n',
      });

      const provider = createTTSProvider('google', credentials);

      expect(provider).toBeInstanceOf(GoogleTTSProvider);
      expect(provider.id).toBe('google');
    });

    it('throws for unsupported provider ID', () => {
      expect(() => createTTSProvider('unknown', 'key')).toThrow(
        'Unsupported TTS provider: unknown',
      );
    });
  });

  describe('getSupportedTTSProviders', () => {
    it('returns array containing all registered providers', () => {
      const providers = getSupportedTTSProviders();

      expect(providers).toContain('elevenlabs');
      expect(providers).toContain('google');
      expect(providers).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run registry tests to verify the new ones fail**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run tests/providers/registry.test.ts`

Expected: FAIL — `google` not in providers, `GoogleTTSProvider` import issues or test failures.

- [ ] **Step 3: Update the registry**

Replace the full contents of `backend/src/providers/tts/registry.ts` with:

```typescript
import type { ITTSProvider } from './types.js';
import { ElevenLabsTTSProvider } from './elevenlabs.js';
import { GoogleTTSProvider } from './google.js';

const PROVIDERS: Record<string, new (apiKey: string) => ITTSProvider> = {
  elevenlabs: ElevenLabsTTSProvider,
  google: GoogleTTSProvider,
};

export function createTTSProvider(providerId: string, apiKey: string): ITTSProvider {
  const Provider = PROVIDERS[providerId];

  if (!Provider) {
    throw new Error(`Unsupported TTS provider: ${providerId}`);
  }

  return new Provider(apiKey);
}

export function getSupportedTTSProviders(): string[] {
  return Object.keys(PROVIDERS);
}
```

- [ ] **Step 4: Run registry tests to verify they pass**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run tests/providers/registry.test.ts`

Expected: All 4 tests PASS.

- [ ] **Step 5: Run ALL tests to ensure nothing is broken**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run`

Expected: All tests across the entire backend PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/providers/tts/registry.ts backend/tests/providers/registry.test.ts
git commit -m "feat: register GoogleTTSProvider in TTS provider registry"
```

---

### Task 9: Final verification and cleanup

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx vitest run`

Expected: All tests PASS with zero failures.

- [ ] **Step 2: Run the linter**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx eslint src/providers/tts/google.ts`

Expected: No lint errors.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd F:/InterviewProj/sources/sound-lab/.claude/worktrees/feat/10-google-tts/backend && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 4: Review final file structure**

Confirm these files exist and have the expected content:

```bash
ls -la backend/src/providers/tts/google.ts backend/tests/providers/google-tts.test.ts
```

Expected: Both files exist.

- [ ] **Step 5: Verify git status is clean**

Run: `git status`

Expected: Working tree clean, all changes committed.
