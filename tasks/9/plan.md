# TTS Provider Interface + Registry + ElevenLabs Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a universal TTS provider abstraction layer with an ElevenLabs adapter, enabling text-to-speech synthesis through a pluggable registry/factory pattern.

**Architecture:** A standalone `backend/src/providers/tts/` module with three files: type definitions (interfaces), a concrete ElevenLabs adapter using native `fetch`, and a registry/factory that maps provider IDs to adapter instances. The module is decoupled from the DB layer — API keys are injected via constructor. Future route handlers will bridge the DB (key retrieval) and provider (synthesis) layers.

**Tech Stack:** TypeScript (strict, ES2022), Vitest (globals: true), native `fetch` (Node 18+), ESM with `.js` import extensions.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/providers/tts/types.ts` | Create | `IVoice`, `ISynthesizeOptions`, `ITTSProvider` interfaces |
| `backend/src/providers/tts/elevenlabs.ts` | Create | `ElevenLabsTTSProvider` class implementing `ITTSProvider` |
| `backend/src/providers/tts/registry.ts` | Create | `createTTSProvider()` factory, `getSupportedTTSProviders()` |
| `backend/tests/providers/elevenlabs.test.ts` | Create | Unit tests for ElevenLabs adapter with mocked `fetch` |
| `backend/tests/providers/registry.test.ts` | Create | Unit tests for registry/factory |

---

## Task 1: Type Definitions

**Files:**
- Create: `backend/src/providers/tts/types.ts`

No tests for pure type files — they are verified by the compiler when used in subsequent tasks.

- [ ] **Step 1: Create the types file**

```typescript
// backend/src/providers/tts/types.ts

export interface IVoice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  description?: string;
  previewUrl?: string;
  providerMeta?: Record<string, unknown>;
}

export interface ISynthesizeOptions {
  voiceId: string;
  text: string;
  speed?: number;
  temperature?: number;
  format?: string;
  sampleRate?: number;
}

export interface ITTSProvider {
  readonly id: string;
  readonly name: string;
  getVoices(): Promise<IVoice[]>;
  synthesize(opts: ISynthesizeOptions): Promise<Buffer>;
  validateCredentials(): Promise<boolean>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `backend/`:
```bash
npx tsc --noEmit src/providers/tts/types.ts
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/providers/tts/types.ts
git commit -m "feat(tts): add IVoice, ISynthesizeOptions, ITTSProvider interfaces"
```

---

## Task 2: ElevenLabs Adapter — `validateCredentials()`

**Files:**
- Create: `backend/tests/providers/elevenlabs.test.ts`
- Create: `backend/src/providers/tts/elevenlabs.ts`

- [ ] **Step 1: Write failing tests for `validateCredentials()`**

```typescript
// backend/tests/providers/elevenlabs.test.ts

import { ElevenLabsTTSProvider } from '../../src/providers/tts/elevenlabs.js';

describe('ElevenLabsTTSProvider', () => {
  let provider: ElevenLabsTTSProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    provider = new ElevenLabsTTSProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id and name', () => {
    it('has id "elevenlabs"', () => {
      expect(provider.id).toBe('elevenlabs');
    });

    it('has name "ElevenLabs"', () => {
      expect(provider.name).toBe('ElevenLabs');
    });
  });

  describe('validateCredentials', () => {
    it('returns true when API returns 200', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/user',
        { headers: { 'xi-api-key': 'test-api-key' } },
      );
    });

    it('returns false when API returns 401', async () => {
      mockFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });

    it('returns false when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/providers/elevenlabs.test.ts
```
Expected: FAIL — cannot resolve `../../src/providers/tts/elevenlabs.js`.

- [ ] **Step 3: Implement minimal `ElevenLabsTTSProvider` with `validateCredentials()`**

```typescript
// backend/src/providers/tts/elevenlabs.ts

import type { ITTSProvider, IVoice, ISynthesizeOptions } from './types.js';

const BASE_URL = 'https://api.elevenlabs.io';

export class ElevenLabsTTSProvider implements ITTSProvider {
  readonly id = 'elevenlabs';
  readonly name = 'ElevenLabs';

  constructor(private readonly apiKey: string) {}

  async getVoices(): Promise<IVoice[]> {
    throw new Error('Not implemented');
  }

  async synthesize(_opts: ISynthesizeOptions): Promise<Buffer> {
    throw new Error('Not implemented');
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/v1/user`, {
        headers: { 'xi-api-key': this.apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/providers/elevenlabs.test.ts
```
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/providers/tts/elevenlabs.ts backend/tests/providers/elevenlabs.test.ts
git commit -m "feat(tts): add ElevenLabsTTSProvider with validateCredentials"
```

---

## Task 3: ElevenLabs Adapter — `getVoices()`

**Files:**
- Modify: `backend/tests/providers/elevenlabs.test.ts`
- Modify: `backend/src/providers/tts/elevenlabs.ts`

- [ ] **Step 1: Write failing tests for `getVoices()`**

Add this `describe` block inside the existing `describe('ElevenLabsTTSProvider')`, after the `validateCredentials` block:

```typescript
  describe('getVoices', () => {
    const voicesResponse = {
      voices: [
        {
          voice_id: 'voice-1',
          name: 'Rachel',
          category: 'professional',
          labels: { gender: 'female', accent: 'American', age: 'young' },
          description: 'A warm voice',
          preview_url: 'https://example.com/rachel.mp3',
          verified_languages: [{ language: 'en', locale: 'en-US' }],
          settings: { stability: 0.5, similarity_boost: 0.75 },
        },
        {
          voice_id: 'voice-2',
          name: 'Adam',
          category: 'premade',
          labels: { gender: 'male' },
          description: null,
          preview_url: null,
          verified_languages: [],
        },
      ],
    };

    it('returns mapped IVoice array', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices).toHaveLength(2);
      expect(voices[0]).toEqual({
        id: 'voice-1',
        name: 'Rachel',
        language: 'en-US',
        gender: 'female',
        description: 'A warm voice',
        previewUrl: 'https://example.com/rachel.mp3',
        providerMeta: {
          category: 'professional',
          labels: { gender: 'female', accent: 'American', age: 'young' },
          settings: { stability: 0.5, similarity_boost: 0.75 },
        },
      });
    });

    it('handles voice with missing optional fields', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(voicesResponse), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices[1]).toEqual({
        id: 'voice-2',
        name: 'Adam',
        language: 'en',
        gender: 'male',
        description: undefined,
        previewUrl: undefined,
        providerMeta: {
          category: 'premade',
          labels: { gender: 'male' },
          settings: undefined,
        },
      });
    });

    it('sends correct request with API key', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ voices: [] }), { status: 200 }),
      );

      await provider.getVoices();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/voices',
        { headers: { 'xi-api-key': 'test-api-key' } },
      );
    });

    it('returns empty array for empty voice list', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ voices: [] }), { status: 200 }),
      );

      const voices = await provider.getVoices();

      expect(voices).toEqual([]);
    });

    it('throws on non-200 response', async () => {
      mockFetch.mockResolvedValue(
        new Response('Server Error', { status: 500 }),
      );

      await expect(provider.getVoices()).rejects.toThrow(
        'ElevenLabs API error: 500',
      );
    });
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run from `backend/`:
```bash
npx vitest run tests/providers/elevenlabs.test.ts
```
Expected: The 5 new `getVoices` tests FAIL (current implementation throws "Not implemented"). The 4 existing tests still pass.

- [ ] **Step 3: Implement `getVoices()`**

In `backend/src/providers/tts/elevenlabs.ts`, replace the `getVoices` stub with:

```typescript
  async getVoices(): Promise<IVoice[]> {
    const response = await fetch(`${BASE_URL}/v1/voices`, {
      headers: { 'xi-api-key': this.apiKey },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const data = (await response.json()) as ElevenLabsVoicesResponse;
    return data.voices.map(mapVoice);
  }
```

Add these types and the helper function at the top of the file, below the imports:

```typescript
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string | null;
  preview_url?: string | null;
  verified_languages?: Array<{ language: string; locale?: string }>;
  settings?: Record<string, unknown>;
}

interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

function mapVoice(v: ElevenLabsVoice): IVoice {
  const language =
    v.verified_languages?.[0]?.locale ??
    v.verified_languages?.[0]?.language ??
    'en';

  return {
    id: v.voice_id,
    name: v.name,
    language,
    gender: v.labels?.gender,
    description: v.description ?? undefined,
    previewUrl: v.preview_url ?? undefined,
    providerMeta: {
      category: v.category,
      labels: v.labels,
      settings: v.settings,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/providers/elevenlabs.test.ts
```
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/providers/tts/elevenlabs.ts backend/tests/providers/elevenlabs.test.ts
git commit -m "feat(tts): implement ElevenLabs getVoices with response mapping"
```

---

## Task 4: ElevenLabs Adapter — `synthesize()`

**Files:**
- Modify: `backend/tests/providers/elevenlabs.test.ts`
- Modify: `backend/src/providers/tts/elevenlabs.ts`

- [ ] **Step 1: Write failing tests for `synthesize()`**

Add this `describe` block inside the existing `describe('ElevenLabsTTSProvider')`, after the `getVoices` block:

```typescript
  describe('synthesize', () => {
    const fakeAudio = new Uint8Array([0x49, 0x44, 0x33, 0x04]);

    it('returns audio Buffer for valid request', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      const result = await provider.synthesize({
        voiceId: 'voice-1',
        text: 'Hello world',
      });

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(Buffer.from(fakeAudio));
    });

    it('sends correct URL with voice_id and default format', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/voice-1?output_format=mp3_44100_128',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': 'test-api-key',
          },
        }),
      );
    });

    it('sends correct request body with defaults', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({ voiceId: 'voice-1', text: 'Hello' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        text: 'Hello',
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: 1.0,
        },
      });
    });

    it('uses custom format when provided', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({
        voiceId: 'voice-1',
        text: 'Hello',
        format: 'pcm_24000',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/voice-1?output_format=pcm_24000',
        expect.anything(),
      );
    });

    it('maps temperature to inverted stability', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({
        voiceId: 'voice-1',
        text: 'Hello',
        temperature: 0.8,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.voice_settings.stability).toBeCloseTo(0.2);
    });

    it('clamps temperature to [0, 1] before inverting', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({
        voiceId: 'voice-1',
        text: 'Hello',
        temperature: 1.5,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.voice_settings.stability).toBe(0);
    });

    it('uses custom speed when provided', async () => {
      mockFetch.mockResolvedValue(new Response(fakeAudio, { status: 200 }));

      await provider.synthesize({
        voiceId: 'voice-1',
        text: 'Hello',
        speed: 1.5,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.voice_settings.speed).toBe(1.5);
    });

    it('throws on non-200 response', async () => {
      mockFetch.mockResolvedValue(new Response('Bad Request', { status: 400 }));

      await expect(
        provider.synthesize({ voiceId: 'voice-1', text: 'Hello' }),
      ).rejects.toThrow('ElevenLabs API error: 400');
    });
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run from `backend/`:
```bash
npx vitest run tests/providers/elevenlabs.test.ts
```
Expected: The 8 new `synthesize` tests FAIL. The 9 existing tests still pass.

- [ ] **Step 3: Implement `synthesize()`**

In `backend/src/providers/tts/elevenlabs.ts`, add this helper function below the existing `mapVoice` function:

```typescript
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

Then replace the `synthesize` stub with:

```typescript
  async synthesize(opts: ISynthesizeOptions): Promise<Buffer> {
    const format = opts.format ?? 'mp3_44100_128';
    const speed = opts.speed ?? 1.0;
    const stability = opts.temperature !== undefined
      ? 1 - clamp(opts.temperature, 0, 1)
      : 0.5;

    const url = `${BASE_URL}/v1/text-to-speech/${opts.voiceId}?output_format=${format}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text: opts.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability,
          similarity_boost: 0.75,
          speed,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/providers/elevenlabs.test.ts
```
Expected: All 17 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/providers/tts/elevenlabs.ts backend/tests/providers/elevenlabs.test.ts
git commit -m "feat(tts): implement ElevenLabs synthesize with temperature mapping"
```

---

## Task 5: Registry / Factory

**Files:**
- Create: `backend/tests/providers/registry.test.ts`
- Create: `backend/src/providers/tts/registry.ts`

- [ ] **Step 1: Write failing tests for the registry**

```typescript
// backend/tests/providers/registry.test.ts

import { createTTSProvider, getSupportedTTSProviders } from '../../src/providers/tts/registry.js';
import { ElevenLabsTTSProvider } from '../../src/providers/tts/elevenlabs.js';

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

    it('throws for unsupported provider ID', () => {
      expect(() => createTTSProvider('unknown', 'key')).toThrow(
        'Unsupported TTS provider: unknown',
      );
    });
  });

  describe('getSupportedTTSProviders', () => {
    it('returns array containing "elevenlabs"', () => {
      const providers = getSupportedTTSProviders();

      expect(providers).toEqual(['elevenlabs']);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `backend/`:
```bash
npx vitest run tests/providers/registry.test.ts
```
Expected: FAIL — cannot resolve `../../src/providers/tts/registry.js`.

- [ ] **Step 3: Implement the registry**

```typescript
// backend/src/providers/tts/registry.ts

import type { ITTSProvider } from './types.js';
import { ElevenLabsTTSProvider } from './elevenlabs.js';

const PROVIDERS: Record<string, new (apiKey: string) => ITTSProvider> = {
  elevenlabs: ElevenLabsTTSProvider,
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

- [ ] **Step 4: Run tests to verify they pass**

Run from `backend/`:
```bash
npx vitest run tests/providers/registry.test.ts
```
Expected: All 3 tests PASS.

- [ ] **Step 5: Run the full test suite to ensure nothing is broken**

Run from `backend/`:
```bash
npx vitest run
```
Expected: All tests across the project PASS (existing DB/route tests + all 20 new provider tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/providers/tts/registry.ts backend/tests/providers/registry.test.ts
git commit -m "feat(tts): add provider registry with factory and listing"
```

---

## Summary

| Task | What it builds | Tests |
|------|---------------|-------|
| 1 | `types.ts` — `IVoice`, `ISynthesizeOptions`, `ITTSProvider` | Type-checked by compiler |
| 2 | `elevenlabs.ts` — class skeleton + `validateCredentials()` | 4 tests |
| 3 | `elevenlabs.ts` — `getVoices()` with response mapping | 5 tests |
| 4 | `elevenlabs.ts` — `synthesize()` with temperature mapping | 8 tests |
| 5 | `registry.ts` — `createTTSProvider()` + `getSupportedTTSProviders()` | 3 tests |

**Total: 5 tasks, 20 tests, 4 source files.**
