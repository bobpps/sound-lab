import {
  createRealtimeProvider,
  getSupportedRealtimeProviders,
  registerRealtimeProvider,
} from '../../src/providers/realtime/registry.js';
import { InworldRealtimeProvider } from '../../src/providers/realtime/inworld.js';
import { ElevenLabsRealtimeProvider } from '../../src/providers/realtime/elevenlabs.js';
import { GeminiRealtimeProvider } from '../../src/providers/realtime/gemini.js';
import type {
  IRealtimeProvider,
  IRealtimeSession,
  RealtimeEvent,
  RealtimeSessionConfig,
} from '../../src/providers/realtime/types.js';

class TestRealtimeProvider implements IRealtimeProvider {
  readonly id = 'test-realtime-provider';
  readonly name = 'Test Realtime Provider';

  constructor(private readonly apiKey: string) {}

  async getModels(): Promise<string[]> {
    return [this.apiKey];
  }

  async createSession(
    _config: RealtimeSessionConfig,
    _onEvent: (event: RealtimeEvent) => void,
  ): Promise<IRealtimeSession> {
    return {
      sendAudio(): void {},
      async close(): Promise<void> {},
    };
  }
}

describe('Realtime Provider Registry', () => {
  const providerId = `test-realtime-${Math.random().toString(36).slice(2)}`;

  it('creates the built-in Gemini realtime provider', () => {
    const provider = createRealtimeProvider('gemini-realtime', 'test-key');

    expect(provider).toBeInstanceOf(GeminiRealtimeProvider);
    expect(provider.id).toBe('gemini-realtime');
  });

  it('returns the built-in ElevenLabs realtime provider', () => {
    const provider = createRealtimeProvider('elevenlabs-realtime', 'test-key');

    expect(provider).toBeInstanceOf(ElevenLabsRealtimeProvider);
    expect(provider.id).toBe('elevenlabs-realtime');
  });

  it('returns a registered realtime provider', () => {
    registerRealtimeProvider(providerId, TestRealtimeProvider);

    const provider = createRealtimeProvider(providerId, 'test-key');

    expect(provider).toBeInstanceOf(TestRealtimeProvider);
    expect(provider.id).toBe('test-realtime-provider');
  });

  it('throws for unsupported provider ID', () => {
    expect(() => createRealtimeProvider('unknown-realtime-provider', 'key')).toThrow(
      'Unsupported realtime provider: unknown-realtime-provider',
    );
  });

  it('includes registered providers in the supported list', () => {
    const providers = getSupportedRealtimeProviders();

    expect(providers).toContain('gemini-realtime');
    expect(providers).toContain('elevenlabs-realtime');
    expect(providers).toContain('inworld-realtime');
    expect(providers).toContain(providerId);
  });

  it('creates the built-in Inworld realtime provider', () => {
    const provider = createRealtimeProvider('inworld-realtime', 'test-key');

    expect(provider).toBeInstanceOf(InworldRealtimeProvider);
    expect(provider.id).toBe('inworld-realtime');
  });
});
