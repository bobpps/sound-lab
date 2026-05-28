import { buildTestApp } from '../helpers.js';
import type { FastifyInstance } from 'fastify';
import type {
  IRealtimeSession,
  RealtimeEvent,
  RealtimeSessionConfig,
} from '../../src/providers/realtime/types.js';

interface TestRealtimeProvider {
  id: string;
  name: string;
  getModels: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
  createSession: ReturnType<typeof vi.fn>;
}

interface TestWebSocketClient {
  send(data: string): void;
  terminate(): void;
  once(
    event: 'message',
    listener: (data: { toString(): string }) => void,
  ): void;
}

function waitForSocketMessage(socket: TestWebSocketClient): Promise<RealtimeEvent> {
  return new Promise((resolve) => {
    socket.once('message', (data) => {
      resolve(JSON.parse(data.toString()) as RealtimeEvent);
    });
  });
}

describe('Realtime routes', () => {
  let app: FastifyInstance;
  let mockGetModels: ReturnType<typeof vi.fn>;
  let mockGetVoices: ReturnType<typeof vi.fn>;
  let mockCreateSession: ReturnType<typeof vi.fn>;
  let mockSendAudio: ReturnType<typeof vi.fn>;
  let mockCloseSession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockGetModels = vi.fn<() => Promise<string[]>>();
    mockGetVoices = vi.fn();
    mockCreateSession = vi.fn<
      (
        config: RealtimeSessionConfig,
        onEvent: (event: RealtimeEvent) => void,
      ) => Promise<IRealtimeSession>
    >();
    mockSendAudio = vi.fn<(chunk: Buffer) => Promise<void>>();
    mockCloseSession = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    app = await buildTestApp();

    (app as Record<string, unknown>).createRealtimeProvider = vi.fn(
      (): TestRealtimeProvider => ({
        id: 'openai-realtime',
        name: 'OpenAI Realtime',
        getModels: mockGetModels,
        getVoices: mockGetVoices,
        createSession: mockCreateSession,
      }),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  async function seedRealtimeProvider(id = 'openai-realtime', name = 'OpenAI Realtime') {
    await app.db.providers.create({ id, name, type: 'realtime' });
    await app.db.providers.setKey(id, 'test-api-key');
  }

  async function connectRealtimeSocket(path: string): Promise<TestWebSocketClient> {
    return (app as FastifyInstance & {
      injectWS(pathname: string): Promise<TestWebSocketClient>;
    }).injectWS(path);
  }

  describe('GET /realtime/:providerId/models', () => {
    it('returns models from the realtime provider', async () => {
      await seedRealtimeProvider();
      mockGetModels.mockResolvedValueOnce(['gpt-realtime', 'gpt-realtime-mini']);

      const res = await app.inject({
        method: 'GET',
        url: '/realtime/openai-realtime/models',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(['gpt-realtime', 'gpt-realtime-mini']);
    });

    it('returns 404 when provider does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/realtime/nonexistent/models',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when provider is not realtime type', async () => {
      await app.db.providers.create({ id: 'openai', name: 'OpenAI', type: 'llm' });
      await app.db.providers.setKey('openai', 'test-key');

      const res = await app.inject({
        method: 'GET',
        url: '/realtime/openai/models',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when provider has no API key', async () => {
      await app.db.providers.create({
        id: 'openai-realtime',
        name: 'OpenAI Realtime',
        type: 'realtime',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/realtime/openai-realtime/models',
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when provider is not supported by registry', async () => {
      await seedRealtimeProvider('unsupported-realtime', 'Unsupported Realtime');
      (app as Record<string, unknown>).createRealtimeProvider = vi.fn(() => {
        throw new Error('Unsupported realtime provider: unsupported-realtime');
      });

      const res = await app.inject({
        method: 'GET',
        url: '/realtime/unsupported-realtime/models',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /realtime/:providerId/voices', () => {
    it('returns voices for the selected realtime model', async () => {
      await seedRealtimeProvider();
      mockGetVoices.mockResolvedValueOnce([
        {
          id: 'marin',
          name: 'Marin',
          language: 'multi',
          gender: 'female',
        },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/realtime/openai-realtime/voices?model=gpt-realtime',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([
        {
          id: 'marin',
          name: 'Marin',
          language: 'multi',
          gender: 'female',
        },
      ]);
      expect(mockGetVoices).toHaveBeenCalledWith('gpt-realtime');
    });
  });

  describe('GET /realtime/:providerId/session websocket', () => {
    it('creates a provider session when session_start is received', async () => {
      await seedRealtimeProvider();
      mockCreateSession.mockResolvedValueOnce({
        sendAudio: mockSendAudio,
        close: mockCloseSession,
      });

      const socket = await connectRealtimeSocket('/realtime/openai-realtime/session');
      const messagePromise = waitForSocketMessage(socket);

      socket.send(JSON.stringify({
        type: 'session_start',
        data: {
          model: 'gpt-realtime',
          systemPrompt: 'You are helpful',
          language: 'en-US',
          voice: 'alloy',
        },
      }));

      const event = await messagePromise;

      expect(event).toEqual({
        type: 'session_start',
        data: {
          model: 'gpt-realtime',
          systemPrompt: 'You are helpful',
          language: 'en-US',
          voice: 'alloy',
        },
      });
      expect(mockCreateSession).toHaveBeenCalledWith(
        {
          model: 'gpt-realtime',
          systemPrompt: 'You are helpful',
          language: 'en-US',
          voice: 'alloy',
        },
        expect.any(Function),
      );

      socket.terminate();
    });

    it('forwards base64 audio to the realtime session', async () => {
      await seedRealtimeProvider();
      mockCreateSession.mockResolvedValueOnce({
        sendAudio: mockSendAudio,
        close: mockCloseSession,
      });

      const socket = await connectRealtimeSocket('/realtime/openai-realtime/session');

      const startMessage = waitForSocketMessage(socket);
      socket.send(JSON.stringify({
        type: 'session_start',
        model: 'gpt-realtime',
        systemPrompt: 'You are helpful',
      }));
      await startMessage;

      socket.send(JSON.stringify({
        type: 'audio',
        data: Buffer.from('hello-audio').toString('base64'),
      }));

      await vi.waitFor(() => {
        expect(mockSendAudio).toHaveBeenCalledWith(Buffer.from('hello-audio'));
      });

      socket.terminate();
    });

    it('closes the provider session on session_end', async () => {
      await seedRealtimeProvider();
      mockCreateSession.mockResolvedValueOnce({
        sendAudio: mockSendAudio,
        close: mockCloseSession,
      });

      const socket = await connectRealtimeSocket('/realtime/openai-realtime/session');

      const startMessage = waitForSocketMessage(socket);
      socket.send(JSON.stringify({
        type: 'session_start',
        data: {
          model: 'gpt-realtime',
          systemPrompt: 'You are helpful',
        },
      }));
      await startMessage;

      const endMessage = waitForSocketMessage(socket);
      socket.send(JSON.stringify({ type: 'session_end' }));

      expect(await endMessage).toEqual({ type: 'session_end', data: null });
      await vi.waitFor(() => {
        expect(mockCloseSession).toHaveBeenCalledTimes(1);
      });
    });

    it('closes the provider session when the socket closes', async () => {
      await seedRealtimeProvider();
      mockCreateSession.mockResolvedValueOnce({
        sendAudio: mockSendAudio,
        close: mockCloseSession,
      });

      const socket = await connectRealtimeSocket('/realtime/openai-realtime/session');

      const startMessage = waitForSocketMessage(socket);
      socket.send(JSON.stringify({
        type: 'session_start',
        data: {
          model: 'gpt-realtime',
          systemPrompt: 'You are helpful',
        },
      }));
      await startMessage;

      socket.terminate();

      await vi.waitFor(() => {
        expect(mockCloseSession).toHaveBeenCalledTimes(1);
      });
    });

    it('returns an error event for malformed JSON without crashing the handler', async () => {
      await seedRealtimeProvider();
      mockCreateSession.mockResolvedValueOnce({
        sendAudio: mockSendAudio,
        close: mockCloseSession,
      });

      const socket = await connectRealtimeSocket('/realtime/openai-realtime/session');
      const errorMessage = waitForSocketMessage(socket);

      socket.send('not-json');

      expect(await errorMessage).toEqual({
        type: 'error',
        data: { message: 'Invalid realtime message JSON' },
      });

      socket.terminate();
    });
  });
});
