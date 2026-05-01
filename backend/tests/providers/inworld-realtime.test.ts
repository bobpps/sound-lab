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

import { InworldRealtimeProvider } from '../../src/providers/realtime/inworld.js';
import type { RealtimeEvent } from '../../src/providers/realtime/types.js';

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('InworldRealtimeProvider', () => {
  const mockFetch = vi.fn<typeof fetch>();
  let provider: InworldRealtimeProvider;

  beforeEach(() => {
    mockSocketInstances.length = 0;
    vi.stubGlobal('fetch', mockFetch);
    provider = new InworldRealtimeProvider('test-api-key');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('has the expected id and name', () => {
    expect(provider.id).toBe('inworld-realtime');
    expect(provider.name).toBe('Inworld Realtime');
  });

  it('lists available Inworld models from the Inworld models endpoint', async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse({
      models: [
        { model: 'openai/gpt-4.1-nano' },
        { model: 'google-ai-studio/gemini-2.5-flash' },
        { model: 'openai/gpt-4.1-nano' },
        { model: 123 },
        {},
      ],
    }));

    await expect(provider.getModels()).resolves.toEqual([
      'google-ai-studio/gemini-2.5-flash',
      'openai/gpt-4.1-nano',
    ]);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.inworld.ai/llm/v1alpha/models',
      {
        headers: {
          Authorization: 'Basic test-api-key',
        },
      },
    );
  });

  it('opens an upstream socket, waits for session.created, sends session.update, and streams audio', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'openai/gpt-4.1-nano',
        systemPrompt: 'Be concise',
        voice: 'Olivia',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0] as {
      url: string;
      options?: Record<string, unknown>;
      send: ReturnType<typeof vi.fn>;
      open(): void;
      emitMessage(message: unknown): void;
    };

    expect(socket).toBeDefined();
    expect(socket.options).toEqual({
      headers: {
        Authorization: 'Basic test-api-key',
      },
    });

    const url = new URL(socket.url);
    expect(url.origin + url.pathname).toBe('wss://api.inworld.ai/api/v1/realtime/session');
    expect(url.searchParams.get('protocol')).toBe('realtime');
    expect(url.searchParams.get('key')).toMatch(/^voice-/);

    socket.open();
    expect(socket.send).not.toHaveBeenCalled();

    socket.emitMessage({
      type: 'session.created',
      session: { id: 'session-1' },
    });

    expect(JSON.parse(socket.send.mock.calls[0]![0] as string)).toEqual({
      type: 'session.update',
      session: {
        type: 'realtime',
        model: 'openai/gpt-4.1-nano',
        instructions: 'Be concise',
        output_modalities: ['audio'],
        audio: {
          input: {
            turn_detection: {
              type: 'semantic_vad',
              eagerness: 'medium',
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            voice: 'Olivia',
            model: 'inworld-tts-1.5-mini',
            speed: 1,
          },
        },
      },
    });

    socket.emitMessage({
      type: 'session.updated',
      session: { id: 'session-1' },
    });

    const session = await sessionPromise;
    await session.sendAudio(Buffer.from('hello-audio'));

    expect(JSON.parse(socket.send.mock.calls[1]![0] as string)).toEqual({
      type: 'input_audio_buffer.append',
      audio: Buffer.from('hello-audio').toString('base64'),
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('maps upstream transcript, audio, error, and close events into RealtimeEvent', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'google-ai-studio/gemini-2.5-flash',
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
    socket.emitMessage({ type: 'session.created', session: { id: 'session-1' } });
    socket.emitMessage({ type: 'session.updated', session: { id: 'session-1' } });

    await sessionPromise;

    socket.emitMessage({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-user-1',
      content_index: 0,
      transcript: 'hello from user',
    });
    socket.emitMessage({
      type: 'response.output_audio.delta',
      item_id: 'item-assistant-1',
      response_id: 'resp-1',
      content_index: 0,
      output_index: 0,
      delta: 'YmFzZTY0LWF1ZGlv',
    });
    socket.emitMessage({
      type: 'response.output_audio_transcript.done',
      item_id: 'item-assistant-1',
      response_id: 'resp-1',
      content_index: 0,
      output_index: 0,
      transcript: 'assistant reply',
    });
    socket.emitMessage({
      type: 'error',
      event_id: 'evt-1',
      error: {
        message: 'Upstream error',
        code: 'bad_request',
        type: 'server_error',
      },
    });

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
            itemId: 'item-user-1',
            responseId: undefined,
            contentIndex: 0,
            outputIndex: undefined,
          },
        },
      ],
      [
        {
          type: 'audio',
          data: {
            chunk: 'YmFzZTY0LWF1ZGlv',
            itemId: 'item-assistant-1',
            responseId: 'resp-1',
            contentIndex: 0,
            outputIndex: 0,
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
            itemId: 'item-assistant-1',
            responseId: 'resp-1',
            contentIndex: 0,
            outputIndex: 0,
          },
        },
      ],
      [
        {
          type: 'error',
          data: {
            message: 'Upstream error',
            code: 'bad_request',
            source: 'inworld',
            upstreamType: 'server_error',
            eventId: 'evt-1',
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

  it('rejects startup when Inworld returns an error before session.updated', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'openai/gpt-4.1-nano',
        systemPrompt: 'Be concise',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0] as {
      close: ReturnType<typeof vi.fn>;
      open(): void;
      emitMessage(message: unknown): void;
    };

    socket.open();
    socket.emitMessage({ type: 'session.created', session: { id: 'session-1' } });
    socket.emitMessage({
      type: 'error',
      error: {
        message: 'Invalid model',
      },
    });

    await expect(sessionPromise).rejects.toThrow('Invalid model');
    expect(onEvent).toHaveBeenCalledWith({
      type: 'error',
      data: {
        message: 'Invalid model',
        code: undefined,
        source: 'inworld',
        upstreamType: undefined,
        eventId: undefined,
      },
    });
    expect(socket.close).toHaveBeenCalledWith(1011, 'Invalid model');
  });

  it('rejects startup when Inworld does not finish the session handshake in time', async () => {
    vi.useFakeTimers();

    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'openai/gpt-4.1-nano',
        systemPrompt: 'Be concise',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0] as {
      close: ReturnType<typeof vi.fn>;
      open(): void;
    };

    socket.open();
    const rejection = expect(sessionPromise).rejects.toThrow(
      'Inworld Realtime session startup timed out after 10000ms',
    );

    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
    expect(socket.close).toHaveBeenCalledWith(
      1011,
      'Inworld Realtime session startup timed out after 10000ms',
    );
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session_end' }),
    );
  });

  it('does not emit session_end when the session is closed intentionally', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'openai/gpt-4.1-nano',
        systemPrompt: 'Be concise',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0] as {
      close: ReturnType<typeof vi.fn>;
      open(): void;
      emitMessage(message: unknown): void;
    };

    socket.open();
    socket.emitMessage({ type: 'session.created', session: { id: 'session-1' } });
    socket.emitMessage({ type: 'session.updated', session: { id: 'session-1' } });

    const session = await sessionPromise;
    await session.close();

    expect(socket.close).toHaveBeenCalledWith(1000, 'Session closed');
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session_end' }),
    );
  });
});
