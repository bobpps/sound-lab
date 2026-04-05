# Inworld TTS Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Inworld AI as the third TTS provider in Sound Lab, implementing the `ITTSProvider` interface with full test coverage.

**Architecture:** A new `InworldTTSProvider` class wraps Inworld's REST API (Basic Auth, JSON request/response with base64 audio). It implements the same `ITTSProvider` interface as ElevenLabs, registered in the provider registry under the `"inworld"` key. Module-level helper functions handle voice mapping, format resolution, and speed clamping.

**Tech Stack:** TypeScript (ESM), Vitest, native `fetch`, `Buffer.from(base64)` for audio decoding.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/tests/providers/inworld-tts.test.ts` | Create | Unit tests for `InworldTTSProvider` (all 3 interface methods + edge cases) |
| `backend/src/providers/tts/inworld.ts` | Create | `InworldTTSProvider` class, Inworld API types, `mapVoice()` / `resolveFormat()` / `clamp()` helpers |
| `backend/src/providers/tts/registry.ts` | Modify | Import `InworldTTSProvider`, add `inworld` entry to `PROVIDERS` map |
| `backend/tests/providers/registry.test.ts` | Modify | Update assertions to expect `inworld` in supported providers list |

---

### Task 1: Write Inworld TTS Provider Tests

**Files:**
- Create: `backend/tests/providers/inworld-tts.test.ts`

This task writes all tests first (Red phase). The tests will not pass until Task 2 implements the provider.

- [ ] **Step 1: Create the test file with imports, setup, and identity tests**

```typescript
import { InworldTTSProvider } from '../../src/providers/tts/inworld.js';

describe('InworldTTSProvider', () => {
  let provider: InworldTTSProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    provider = new InworldTTSProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "inworld"', () => {
      expect(provider.id).toBe('inworld');
    });

    it('has name "Inworld"', () => {
      expect(provider.name).toBe('Inworld');
    });
  });
});
```

- [ ] **Step 2: Add validateCredentials tests**

Add inside the outer `describe`, after the `id and name` block:

```typescript
  describe('validateCredentials', () => {
    it('returns true when List Voices API returns 200', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ voices: [] }), { status: 200 }),
      );

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.inworld.ai/tts/v1/voices',
        { headers: { 'Authorization': 'Basic test-api-key' } },
      );
    });

    it('returns false when API returns 401', async () => {
      mockFetch.mockResolvedValue(
        new Response('Unauthorized', { status: 401 }),
      );

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });

    it('returns false when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });
  });
```

- [ ] **Step 3: Add getVoices tests**

Add inside the outer `describe`, after the `validateCredentials` block:

```typescript
  describe('getVoices', () => {
    const voicesResponse = {
      voices: [
        {
          voiceId: 'Ashley',
          displayName: 'Ashley',
          languages: ['en'],
          description: 'A warm, natural female voice',
          tags: ['female', 'warm', 'natural'],
          isCustom: false,
        },
        {
          voiceId: 'Alex',
          displayName: 'Alex',
          languages: ['en', 'es'],
          description: 'Energetic male voice',
          tags: ['male', 'energetic'],
          isCustom: false,
        },
        {
          voiceId: 'CustomVoice',
          displayName: 'My Custom',
          languages: [],
          description: null,
          tags: [],
          isCustom: true,
        },
      ],
    };

    it('returns mapped IVoice array', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices).toHaveLength(3);
      expect(voices[0]).toEqual({
        id: 'Ashley',
        name: 'Ashley',
        language: 'en',
        gender: 'female',
        description: 'A warm, natural female voice',
        previewUrl: undefined,
        providerMeta: {
          languages: ['en'],
          tags: ['female', 'warm', 'natural'],
          isCustom: false,
        },
      });
    });

    it('extracts male gender from tags', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices[1]!.gender).toBe('male');
    });

    it('uses first language from array, falls back to en', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices[0]!.language).toBe('en');
      expect(voices[1]!.language).toBe('en');
      expect(voices[2]!.language).toBe('en');
    });

    it('handles voice with no tags and no description', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices[2]).toEqual({
        id: 'CustomVoice',
        name: 'My Custom',
        language: 'en',
        gender: undefined,
        description: undefined,
        previewUrl: undefined,
        providerMeta: {
          languages: [],
          tags: [],
          isCustom: true,
        },
      });
    });

    it('sends correct request with auth header', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ voices: [] }), { status: 200 }),
      );

      await provider.getVoices();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.inworld.ai/tts/v1/voices',
        { headers: { 'Authorization': 'Basic test-api-key' } },
      );
    });

    it('returns empty array for empty voice list', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ voices: [] }), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices).toEqual([]);
    });

    it('throws on non-200 response with body', async () => {
      mockFetch.mockResolvedValue(
        new Response('Server Error', { status: 500 }),
      );

      await expect(provider.getVoices()).rejects.toThrow(
        'Inworld API error: 500 Server Error',
      );
    });
  });
```

- [ ] **Step 4: Add synthesize tests**

Add inside the outer `describe`, after the `getVoices` block:

```typescript
  describe('synthesize', () => {
    const fakeAudioBase64 = Buffer.from(
      new Uint8Array([0x49, 0x44, 0x33, 0x04]),
    ).toString('base64');

    const synthesizeResponse = {
      audioContent: fakeAudioBase64,
      usage: { processedCharactersCount: 11, modelId: 'inworld-tts-1.5-max' },
    };

    it('returns audio Buffer decoded from base64 response', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      const result = await provider.synthesize({
        voiceId: 'Ashley',
        text: 'Hello world',
      });

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(Buffer.from(new Uint8Array([0x49, 0x44, 0x33, 0x04])));
    });

    it('sends correct URL and auth header', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'Ashley', text: 'Hello' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.inworld.ai/tts/v1/voice',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic test-api-key',
          },
        }),
      );
    });

    it('sends correct request body with defaults', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'Ashley', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        text: 'Hello',
        voiceId: 'Ashley',
        modelId: 'inworld-tts-1.5-max',
      });
    });

    it('includes audioConfig when speed is provided', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({
        voiceId: 'Ashley',
        text: 'Hello',
        speed: 1.3,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig.speakingRate).toBe(1.3);
    });

    it('clamps speed to 0.5-1.5 range', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({
        voiceId: 'Ashley',
        text: 'Hello',
        speed: 3.0,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig.speakingRate).toBe(1.5);
    });

    it('clamps speed below minimum to 0.5', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({
        voiceId: 'Ashley',
        text: 'Hello',
        speed: 0.1,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig.speakingRate).toBe(0.5);
    });

    it('passes temperature directly', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({
        voiceId: 'Ashley',
        text: 'Hello',
        temperature: 1.5,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.temperature).toBe(1.5);
    });

    it('does not include temperature when not provided', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'Ashley', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.temperature).toBeUndefined();
    });

    it('maps format to uppercase audioEncoding', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({
        voiceId: 'Ashley',
        text: 'Hello',
        format: 'ogg_opus',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig.audioEncoding).toBe('OGG_OPUS');
    });

    it('maps sampleRate to audioConfig.sampleRateHertz', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({
        voiceId: 'Ashley',
        text: 'Hello',
        sampleRate: 24000,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig.sampleRateHertz).toBe(24000);
    });

    it('builds audioConfig with all options combined', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({
        voiceId: 'Ashley',
        text: 'Hello',
        speed: 0.8,
        format: 'wav',
        sampleRate: 16000,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig).toEqual({
        speakingRate: 0.8,
        audioEncoding: 'WAV',
        sampleRateHertz: 16000,
      });
    });

    it('omits audioConfig entirely when no audio options provided', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(synthesizeResponse), { status: 200 }),
      );

      await provider.synthesize({ voiceId: 'Ashley', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.audioConfig).toBeUndefined();
    });

    it('throws on non-200 response with body', async () => {
      mockFetch.mockResolvedValue(
        new Response('Bad Request', { status: 400 }),
      );

      await expect(
        provider.synthesize({ voiceId: 'Ashley', text: 'Hello' }),
      ).rejects.toThrow('Inworld API error: 400 Bad Request');
    });
  });
```

- [ ] **Step 5: Run tests to verify they all fail (Red phase)**

Run from the worktree root:

```bash
cd backend && npx vitest run tests/providers/inworld-tts.test.ts
```

Expected: All tests FAIL because `InworldTTSProvider` does not exist yet. The import should fail with a module-not-found or similar error.

- [ ] **Step 6: Commit the test file**

```bash
git add backend/tests/providers/inworld-tts.test.ts
git commit -m "test: add Inworld TTS provider tests (red phase)"
```

---

### Task 2: Implement InworldTTSProvider Class

**Files:**
- Create: `backend/src/providers/tts/inworld.ts`

- [ ] **Step 1: Create the provider file with types and helpers**

```typescript
import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://api.inworld.ai';
const DEFAULT_MODEL = 'inworld-tts-1.5-max';

interface InworldVoice {
  voiceId: string;
  displayName: string;
  languages: string[];
  description: string | null;
  tags: string[];
  isCustom: boolean;
}

interface InworldVoicesResponse {
  voices: InworldVoice[];
}

interface InworldSynthesizeResponse {
  audioContent: string;
  usage?: {
    processedCharactersCount: number;
    modelId: string;
  };
}

function mapVoice(v: InworldVoice): IVoice {
  const language = v.languages?.[0] ?? 'en';
  const gender = v.tags?.find((t) => t === 'male' || t === 'female');

  return {
    id: v.voiceId,
    name: v.displayName,
    language,
    gender,
    description: v.description ?? undefined,
    previewUrl: undefined,
    providerMeta: {
      languages: v.languages,
      tags: v.tags,
      isCustom: v.isCustom,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildAudioConfig(
  opts: ISynthesizeOptions,
): Record<string, unknown> | undefined {
  const config: Record<string, unknown> = {};

  if (opts.speed !== undefined) {
    config.speakingRate = clamp(opts.speed, 0.5, 1.5);
  }
  if (opts.format !== undefined) {
    config.audioEncoding = opts.format.toUpperCase();
  }
  if (opts.sampleRate !== undefined) {
    config.sampleRateHertz = opts.sampleRate;
  }

  return Object.keys(config).length > 0 ? config : undefined;
}
```

- [ ] **Step 2: Add the provider class**

Append to the same file, after the helper functions:

```typescript
export class InworldTTSProvider implements ITTSProvider {
  readonly id = 'inworld';
  readonly name = 'Inworld';

  constructor(private readonly apiKey: string) {}

  async getVoices(): Promise<IVoice[]> {
    const response = await fetch(`${BASE_URL}/tts/v1/voices`, {
      headers: { Authorization: `Basic ${this.apiKey}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Inworld API error: ${response.status} ${body}`);
    }

    const data = (await response.json()) as InworldVoicesResponse;
    return data.voices.map(mapVoice);
  }

  async synthesize(opts: ISynthesizeOptions): Promise<Buffer> {
    const audioConfig = buildAudioConfig(opts);

    const body: Record<string, unknown> = {
      text: opts.text,
      voiceId: opts.voiceId,
      modelId: DEFAULT_MODEL,
    };

    if (opts.temperature !== undefined) {
      body.temperature = opts.temperature;
    }
    if (audioConfig !== undefined) {
      body.audioConfig = audioConfig;
    }

    const response = await fetch(`${BASE_URL}/tts/v1/voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Inworld API error: ${response.status} ${text}`);
    }

    const data = (await response.json()) as InworldSynthesizeResponse;
    return Buffer.from(data.audioContent, 'base64');
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/tts/v1/voices`, {
        headers: { Authorization: `Basic ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 3: Run the Inworld TTS tests to verify they pass (Green phase)**

```bash
cd backend && npx vitest run tests/providers/inworld-tts.test.ts
```

Expected: All tests PASS.

- [ ] **Step 4: Commit the implementation**

```bash
git add backend/src/providers/tts/inworld.ts
git commit -m "feat: implement Inworld TTS provider"
```

---

### Task 3: Register in Registry and Update Registry Tests

**Files:**
- Modify: `backend/src/providers/tts/registry.ts`
- Modify: `backend/tests/providers/registry.test.ts`

- [ ] **Step 1: Update the registry test to expect inworld**

In `backend/tests/providers/registry.test.ts`, add the import and test case.

Add import at the top:

```typescript
import { InworldTTSProvider } from '../../src/providers/tts/inworld.js';
```

Add a new test inside the `createTTSProvider` describe block (after the ElevenLabs test):

```typescript
    it('returns InworldTTSProvider for "inworld"', () => {
      const provider = createTTSProvider('inworld', 'test-key');

      expect(provider).toBeInstanceOf(InworldTTSProvider);
      expect(provider.id).toBe('inworld');
    });
```

Update the `getSupportedTTSProviders` test assertion to include `inworld`:

```typescript
    it('returns array containing all supported providers', () => {
      const providers = getSupportedTTSProviders();

      expect(providers).toEqual(expect.arrayContaining(['elevenlabs', 'inworld']));
      expect(providers).toHaveLength(2);
    });
```

- [ ] **Step 2: Run registry tests to verify they fail (Red phase)**

```bash
cd backend && npx vitest run tests/providers/registry.test.ts
```

Expected: The new `inworld` test and the updated `getSupportedTTSProviders` test FAIL because the registry does not yet include `inworld`.

- [ ] **Step 3: Add inworld to the registry**

In `backend/src/providers/tts/registry.ts`, add the import:

```typescript
import { InworldTTSProvider } from './inworld.js';
```

Add the entry to the `PROVIDERS` map:

```typescript
const PROVIDERS: Record<string, new (apiKey: string) => ITTSProvider> = {
  elevenlabs: ElevenLabsTTSProvider,
  inworld: InworldTTSProvider,
};
```

- [ ] **Step 4: Run registry tests to verify they pass (Green phase)**

```bash
cd backend && npx vitest run tests/providers/registry.test.ts
```

Expected: All tests PASS (including the original ElevenLabs tests and the new Inworld tests).

- [ ] **Step 5: Run the full test suite to verify nothing is broken**

```bash
cd backend && npx vitest run
```

Expected: All tests PASS. No regressions.

- [ ] **Step 6: Commit the registry changes**

```bash
git add backend/src/providers/tts/registry.ts backend/tests/providers/registry.test.ts
git commit -m "feat: register Inworld TTS provider in registry"
```
