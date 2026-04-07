const { MockOpenAI, MockWebSocket, mockSocketInstances } = vi.hoisted(() => {
  const MockOpenAI = vi.fn();
  const mockSocketInstances: unknown[] = [];

  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly url: URL;
    readonly options: Record<string, unknown>;

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

    constructor(url: URL, options: Record<string, unknown>) {
      this.url = url;
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

  return { MockOpenAI, MockWebSocket, mockSocketInstances };
});

vi.mock('openai', () => ({
  default: MockOpenAI,
}));

vi.mock('ws', () => ({
  default: MockWebSocket,
}));

import OpenAI from 'openai';
import { OpenAIRealtimeProvider } from '../../src/providers/realtime/openai.js';
import type { RealtimeEvent } from '../../src/providers/realtime/types.js';

const OpenAIMock = vi.mocked(OpenAI);

describe('OpenAIRealtimeProvider', () => {
  let modelsList: { list: ReturnType<typeof vi.fn> };
  let provider: OpenAIRealtimeProvider;

  beforeEach(() => {
    mockSocketInstances.length = 0;
    modelsList = { list: vi.fn() };

    OpenAIMock.mockImplementation(() => ({
      models: modelsList,
    }) as unknown as OpenAI);

    provider = new OpenAIRealtimeProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the OpenAI client with the provided API key', () => {
    expect(OpenAIMock).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
  });

  it('filters realtime-capable models from OpenAI model list', async () => {
    async function* generateModels() {
      yield { id: 'gpt-realtime' };
      yield { id: 'gpt-4o-realtime-preview-2025-06-03' };
      yield { id: 'gpt-audio-mini' };
      yield { id: 'gpt-4o' };
      yield { id: 'whisper-1' };
      yield { id: 'gpt-realtime' };
    }

    modelsList.list.mockReturnValue(generateModels());

    await expect(provider.getModels()).resolves.toEqual([
      'gpt-4o-realtime-preview-2025-06-03',
      'gpt-audio-mini',
      'gpt-realtime',
    ]);
  });

  it('opens an upstream realtime socket and sends session.update before resolving', async () => {
    modelsList.list.mockReturnValue((async function* empty() {})());

    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'gpt-realtime',
        systemPrompt: 'Be concise',
        voice: 'marin',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0];
    expect(socket).toBeDefined();
    expect(socket.url.toString()).toBe('wss://api.openai.com/v1/realtime?model=gpt-realtime');
    expect(socket.options).toEqual({
      headers: {
        Authorization: 'Bearer test-api-key',
      },
    });

    socket.open();

    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(socket.send.mock.calls[0][0] as string)).toEqual({
      type: 'session.update',
      session: {
        type: 'realtime',
        model: 'gpt-realtime',
        instructions: 'Be concise',
        output_modalities: ['audio'],
        audio: {
          input: {
            format: {
              type: 'audio/pcm',
              rate: 24000,
            },
            noise_reduction: {
              type: 'near_field',
            },
            transcription: {
              model: 'gpt-4o-mini-transcribe',
            },
            turn_detection: {
              type: 'server_vad',
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            format: {
              type: 'audio/pcm',
              rate: 24000,
            },
            voice: 'marin',
          },
        },
      },
    });

    socket.emitMessage({
      type: 'session.updated',
      session: {
        model: 'gpt-realtime',
      },
    });

    const session = await sessionPromise;
    await session.sendAudio(Buffer.from('hello-audio'));

    expect(JSON.parse(socket.send.mock.calls[1][0] as string)).toEqual({
      type: 'input_audio_buffer.append',
      audio: Buffer.from('hello-audio').toString('base64'),
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('maps upstream transcript, audio, error, and close events into RealtimeEvent', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'gpt-realtime-mini',
        systemPrompt: 'Be helpful',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0];
    socket.open();
    socket.emitMessage({ type: 'session.updated', session: { model: 'gpt-realtime-mini' } });

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
        type: 'invalid_request_error',
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
            source: 'openai',
            upstreamType: 'invalid_request_error',
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

  it('rejects startup when OpenAI returns an error before session.updated', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'gpt-realtime',
        systemPrompt: 'Be concise',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0];
    socket.open();
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
        source: 'openai',
        upstreamType: undefined,
        eventId: undefined,
      },
    });
  });

  it('does not emit session_end when the session is closed intentionally', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'gpt-realtime',
        systemPrompt: 'Be concise',
      },
      onEvent,
    );

    const socket = mockSocketInstances[0];
    socket.open();
    socket.emitMessage({ type: 'session.updated', session: { model: 'gpt-realtime' } });

    const session = await sessionPromise;
    await session.close();

    expect(socket.close).toHaveBeenCalledWith(1000, 'Session closed');
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session_end' }),
    );
  });
});
