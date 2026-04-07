const { MockWebSocket, mockSockets } = vi.hoisted(() => {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly sentMessages: string[] = [];
    readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    readyState = MockWebSocket.CONNECTING;
    autoEmitCloseOnClose = true;
    terminated = false;
    closeCode?: number;
    closeReason?: string;

    constructor(public readonly url: string) {
      mockSockets.push(this);
    }

    on(event: string, listener: (...args: unknown[]) => void): this {
      const handlers = this.listeners.get(event) ?? [];
      handlers.push(listener);
      this.listeners.set(event, handlers);
      return this;
    }

    off(event: string, listener: (...args: unknown[]) => void): this {
      const handlers = this.listeners.get(event) ?? [];
      this.listeners.set(
        event,
        handlers.filter((candidate) => candidate !== listener),
      );
      return this;
    }

    once(event: string, listener: (...args: unknown[]) => void): this {
      const wrapped = (...args: unknown[]) => {
        this.off(event, wrapped);
        listener(...args);
      };

      return this.on(event, wrapped);
    }

    send(data: string, callback?: (error?: Error) => void): void {
      this.sentMessages.push(data);
      callback?.();
    }

    close(code = 1000, reason = ''): void {
      this.closeCode = code;
      this.closeReason = reason;
      this.readyState = this.autoEmitCloseOnClose
        ? MockWebSocket.CLOSED
        : MockWebSocket.CLOSING;

      if (!this.autoEmitCloseOnClose) {
        return;
      }

      this.emit('close', code, Buffer.from(reason));
    }

    terminate(): void {
      this.terminated = true;
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', this.closeCode ?? 1006, Buffer.from(this.closeReason ?? 'terminated'));
    }

    open(): void {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    }

    fail(error: Error): void {
      this.emit('error', error);
    }

    receive(payload: object): void {
      this.emit('message', Buffer.from(JSON.stringify(payload)));
    }

    private emit(event: string, ...args: unknown[]): void {
      const handlers = this.listeners.get(event) ?? [];
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  const mockSockets: MockWebSocket[] = [];

  return { MockWebSocket, mockSockets };
});

vi.mock('ws', () => ({
  WebSocket: MockWebSocket,
}));

import { ElevenLabsRealtimeProvider } from '../../src/providers/realtime/elevenlabs.js';
import type { RealtimeEvent } from '../../src/providers/realtime/types.js';

describe('ElevenLabsRealtimeProvider', () => {
  let provider: ElevenLabsRealtimeProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    provider = new ElevenLabsRealtimeProvider('test-api-key');
    mockSockets.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns agent IDs from the ElevenLabs agents API across pages', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          agents: [{ agent_id: 'agent-1' }],
          has_more: true,
          next_cursor: 'cursor-2',
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          agents: [{ agent_id: 'agent-2' }, { agent_id: 'agent-1' }],
          has_more: false,
          next_cursor: null,
        }), { status: 200 }),
      );

    const models = await provider.getModels();

    expect(models).toEqual(['agent-1', 'agent-2']);

    const firstUrl = new URL(String(mockFetch.mock.calls[0][0]));
    expect(firstUrl.pathname).toBe('/v1/convai/agents');
    expect(firstUrl.searchParams.get('page_size')).toBe('100');
    expect(firstUrl.searchParams.get('archived')).toBe('false');

    const secondUrl = new URL(String(mockFetch.mock.calls[1][0]));
    expect(secondUrl.searchParams.get('cursor')).toBe('cursor-2');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(URL),
      { headers: { 'xi-api-key': 'test-api-key' } },
    );
  });

  it('creates a session via signed URL and sends conversation overrides on open', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent-123&token=abc',
      }), { status: 200 }),
    );

    const events: RealtimeEvent[] = [];
    const sessionPromise = provider.createSession(
      {
        model: 'agent-123',
        systemPrompt: 'Be concise.',
        voice: 'voice-456',
      },
      (event) => {
        events.push(event);
      },
    );

    await vi.waitFor(() => {
      expect(mockSockets).toHaveLength(1);
    });

    const socket = mockSockets[0];
    expect(socket.url).toContain('token=abc');

    socket.open();
    await vi.waitFor(() => {
      expect(socket.sentMessages).toHaveLength(1);
    });

    expect(JSON.parse(socket.sentMessages[0])).toEqual({
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: 'Be concise.',
          },
        },
        tts: {
          voice_id: 'voice-456',
        },
      },
    });

    socket.receive({
      type: 'conversation_initiation_metadata',
      conversation_initiation_metadata_event: {
        conversation_id: 'conv-123',
        agent_output_audio_format: 'pcm_16000',
        user_input_audio_format: 'pcm_16000',
      },
    });

    const session = await sessionPromise;
    await session.sendAudio(Buffer.from('hello'));

    expect(JSON.parse(socket.sentMessages[1])).toEqual({
      user_audio_chunk: Buffer.from('hello').toString('base64'),
    });
    expect(events).toEqual([]);
  });

  it('maps ElevenLabs websocket events into generic realtime events and responds to ping', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent-789&token=abc',
      }), { status: 200 }),
    );

    const events: RealtimeEvent[] = [];
    const sessionPromise = provider.createSession(
      {
        model: 'agent-789',
        systemPrompt: '',
      },
      (event) => {
        events.push(event);
      },
    );

    await vi.waitFor(() => {
      expect(mockSockets).toHaveLength(1);
    });

    const socket = mockSockets[0];
    socket.open();
    socket.receive({
      type: 'conversation_initiation_metadata',
      conversation_initiation_metadata_event: {
        conversation_id: 'conv-789',
      },
    });

    await sessionPromise;

    socket.receive({
      type: 'user_transcript',
      user_transcription_event: {
        user_transcript: 'Hello there',
      },
    });
    socket.receive({
      type: 'agent_response',
      agent_response_event: {
        agent_response: 'Hi. How can I help?',
      },
    });
    socket.receive({
      type: 'agent_response_correction',
      agent_response_correction_event: {
        original_agent_response: 'Hi. How can I help you today?',
        corrected_agent_response: 'Hi. How can I help?',
      },
    });
    socket.receive({
      type: 'audio',
      audio_event: {
        audio_base_64: 'c29tZS1hdWRpbw==',
        event_id: 42,
        alignment: { chars: ['H'] },
      },
    });
    socket.receive({
      type: 'ping',
      ping_event: {
        event_id: 99,
      },
    });

    await vi.waitFor(() => {
      expect(socket.sentMessages).toHaveLength(2);
    });

    expect(events).toEqual([
      {
        type: 'transcript',
        data: { role: 'user', text: 'Hello there' },
      },
      {
        type: 'transcript',
        data: { role: 'assistant', text: 'Hi. How can I help?' },
      },
      {
        type: 'transcript',
        data: {
          role: 'assistant',
          text: 'Hi. How can I help?',
          corrected: true,
          originalText: 'Hi. How can I help you today?',
        },
      },
      {
        type: 'audio',
        data: {
          audioBase64: 'c29tZS1hdWRpbw==',
          eventId: 42,
          alignment: { chars: ['H'] },
        },
      },
    ]);
    expect(JSON.parse(socket.sentMessages[1])).toEqual({
      type: 'pong',
      event_id: 99,
    });
  });

  it('emits session_end when the upstream websocket closes after initialization', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent-close&token=abc',
      }), { status: 200 }),
    );

    const events: RealtimeEvent[] = [];
    const sessionPromise = provider.createSession(
      {
        model: 'agent-close',
        systemPrompt: 'prompt',
      },
      (event) => {
        events.push(event);
      },
    );

    await vi.waitFor(() => {
      expect(mockSockets).toHaveLength(1);
    });

    const socket = mockSockets[0];
    socket.open();
    socket.receive({
      type: 'conversation_initiation_metadata',
      conversation_initiation_metadata_event: {
        conversation_id: 'conv-close',
      },
    });

    const session = await sessionPromise;
    socket.close(1011, 'upstream failure');

    await vi.waitFor(() => {
      expect(events).toEqual([
        {
          type: 'session_end',
          data: { code: 1011, reason: 'upstream failure' },
        },
      ]);
    });

    await session.close();
  });

  it('terminates the socket if ElevenLabs never responds to the close handshake', async () => {
    vi.useFakeTimers();

    try {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({
          signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent-stuck&token=abc',
        }), { status: 200 }),
      );

      const events: RealtimeEvent[] = [];
      const sessionPromise = provider.createSession(
        {
          model: 'agent-stuck',
          systemPrompt: 'prompt',
        },
        (event) => {
          events.push(event);
        },
      );

      await vi.waitFor(() => {
        expect(mockSockets).toHaveLength(1);
      });

      const socket = mockSockets[0];
      socket.open();
      socket.receive({
        type: 'conversation_initiation_metadata',
        conversation_initiation_metadata_event: {
          conversation_id: 'conv-stuck',
        },
      });

      const session = await sessionPromise;
      socket.autoEmitCloseOnClose = false;

      const closePromise = session.close();

      expect(socket.readyState).toBe(MockWebSocket.CLOSING);
      await vi.advanceTimersByTimeAsync(5_000);
      await closePromise;

      expect(socket.terminated).toBe(true);
      expect(events).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects when the websocket closes before session initialization completes', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent-fail&token=abc',
      }), { status: 200 }),
    );

    const sessionPromise = provider.createSession(
      {
        model: 'agent-fail',
        systemPrompt: 'prompt',
      },
      vi.fn(),
    );

    await vi.waitFor(() => {
      expect(mockSockets).toHaveLength(1);
    });

    const socket = mockSockets[0];
    socket.open();
    socket.close(4001, 'invalid overrides');

    await expect(sessionPromise).rejects.toThrow(
      'ElevenLabs realtime session closed before initialization (4001: invalid overrides)',
    );
  });
});
