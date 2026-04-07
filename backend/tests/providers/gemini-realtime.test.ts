const { MockWebSocket, mockSocketInstances } = vi.hoisted(() => {
  const mockSocketInstances: unknown[] = [];

  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly url: string;
    readonly options: Record<string, unknown> | undefined;

    readyState = MockWebSocket.CONNECTING;
    send = vi.fn((data: string, callback?: (error?: Error) => void) => {
      callback?.();
      return true;
    });
    close = vi.fn((code?: number, reason?: string) => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', code ?? 1000, Buffer.from(reason ?? ''));
    });

    private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

    constructor(url: string | URL, options?: Record<string, unknown>) {
      this.url = url.toString();
      this.options = options;
      mockSocketInstances.push(this);
    }

    on(event: string, listener: (...args: unknown[]) => void): this {
      const listeners = this.listeners.get(event) ?? [];
      listeners.push(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    once(event: string, listener: (...args: unknown[]) => void): this {
      const onceListener = (...args: unknown[]) => {
        this.off(event, onceListener);
        listener(...args);
      };

      return this.on(event, onceListener);
    }

    off(event: string, listener: (...args: unknown[]) => void): this {
      const listeners = this.listeners.get(event);
      if (!listeners) {
        return this;
      }

      this.listeners.set(
        event,
        listeners.filter((candidate) => candidate !== listener),
      );

      return this;
    }

    emit(event: string, ...args: unknown[]): boolean {
      const listeners = this.listeners.get(event);
      if (!listeners?.length) {
        return false;
      }

      for (const listener of [...listeners]) {
        listener(...args);
      }

      return true;
    }

    open(): void {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    }

    emitMessage(message: unknown): void {
      this.emit('message', Buffer.from(JSON.stringify(message)));
    }
  }

  return { MockWebSocket, mockSocketInstances };
});

vi.mock('ws', () => ({
  default: MockWebSocket,
}));

import { GeminiRealtimeProvider } from '../../src/providers/realtime/gemini.js';
import type { RealtimeEvent } from '../../src/providers/realtime/types.js';

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('GeminiRealtimeProvider', () => {
  const mockFetch = vi.fn<typeof fetch>();
  let provider: GeminiRealtimeProvider;

  beforeEach(() => {
    mockSocketInstances.length = 0;
    vi.stubGlobal('fetch', mockFetch);
    provider = new GeminiRealtimeProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('has the expected id and name', () => {
    expect(provider.id).toBe('gemini-realtime');
    expect(provider.name).toBe('Gemini Realtime');
  });

  it('lists live Gemini models and strips the models/ prefix', async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse({
      models: [
        {
          name: 'models/gemini-3.1-flash-live-preview',
          supportedGenerationMethods: ['bidiGenerateContent'],
        },
        {
          name: 'models/gemini-2.5-flash-live-preview',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-2.5-flash',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-3.1-flash-live-preview',
          supportedGenerationMethods: ['bidiGenerateContent'],
        },
      ],
    }));

    await expect(provider.getModels()).resolves.toEqual([
      'gemini-2.5-flash-live-preview',
      'gemini-3.1-flash-live-preview',
    ]);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models?key=test-api-key&pageSize=1000',
    );
  });

  it('opens an upstream Gemini socket, sends setup, and streams PCM audio', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'gemini-3.1-flash-live-preview',
        systemPrompt: 'Be concise',
        voice: 'Kore',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0] as {
      url: string;
      send: ReturnType<typeof vi.fn>;
      open(): void;
      emitMessage(message: unknown): void;
    };

    expect(socket.url).toBe(
      'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=test-api-key',
    );

    socket.open();

    expect(JSON.parse(socket.send.mock.calls[0]![0] as string)).toEqual({
      setup: {
        model: 'models/gemini-3.1-flash-live-preview',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore',
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: 'Be concise' }],
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });

    socket.emitMessage({ setupComplete: {} });

    const session = await sessionPromise;
    await session.sendAudio(Buffer.from('hello-audio'));

    expect(JSON.parse(socket.send.mock.calls[1]![0] as string)).toEqual({
      realtimeInput: {
        audio: {
          data: Buffer.from('hello-audio').toString('base64'),
          mimeType: 'audio/pcm;rate=16000',
        },
      },
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('maps Gemini server messages into RealtimeEvent payloads', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'models/gemini-3.1-flash-live-preview',
        systemPrompt: 'Be helpful',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0] as {
      readyState: number;
      open(): void;
      emit(event: string, ...args: unknown[]): boolean;
      emitMessage(message: unknown): void;
    };

    socket.open();
    socket.emitMessage({ setupComplete: {} });

    await sessionPromise;

    socket.emitMessage({
      serverContent: {
        inputTranscription: {
          text: 'hello from user',
        },
      },
    });
    socket.emitMessage({
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/pcm;rate=24000',
                data: 'YmFzZTY0LWF1ZGlv',
              },
            },
          ],
        },
      },
    });
    socket.emitMessage({
      serverContent: {
        outputTranscription: {
          text: 'assistant reply',
        },
      },
    });
    socket.emit('error', new Error('Gemini websocket error'));
    socket.readyState = MockWebSocket.CLOSED;
    socket.emit('close', 1011, Buffer.from('upstream closed'));

    expect(onEvent.mock.calls).toEqual([
      [
        {
          type: 'transcript',
          data: {
            role: 'user',
            text: 'hello from user',
            final: true,
          },
        },
      ],
      [
        {
          type: 'audio',
          data: {
            chunk: 'YmFzZTY0LWF1ZGlv',
            mimeType: 'audio/pcm;rate=24000',
          },
        },
      ],
      [
        {
          type: 'transcript',
          data: {
            role: 'assistant',
            text: 'assistant reply',
            final: true,
          },
        },
      ],
      [
        {
          type: 'error',
          data: {
            message: 'Gemini websocket error',
            source: 'gemini',
          },
        },
      ],
      [
        {
          type: 'session_end',
          data: {
            code: 1011,
            reason: 'upstream closed',
          },
        },
      ],
    ]);
  });

  it('rejects startup if Gemini closes the socket before setup completes', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'gemini-3.1-flash-live-preview',
        systemPrompt: 'Be concise',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0] as {
      open(): void;
      emit(event: string, ...args: unknown[]): boolean;
    };

    socket.open();
    socket.emit('close', 1008, Buffer.from('invalid setup'));

    await expect(sessionPromise).rejects.toThrow('invalid setup');
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session_end' }),
    );
  });

  it('does not emit session_end when the session is closed intentionally', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'gemini-3.1-flash-live-preview',
        systemPrompt: 'Be concise',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0] as {
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      open(): void;
      emitMessage(message: unknown): void;
    };

    socket.open();
    socket.emitMessage({ setupComplete: {} });

    const session = await sessionPromise;
    await session.close();

    expect(JSON.parse(socket.send.mock.calls[1]![0] as string)).toEqual({
      realtimeInput: {
        audioStreamEnd: true,
      },
    });
    expect(socket.close).toHaveBeenCalledWith(1000, 'Session closed');
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session_end' }),
    );
  });
});
