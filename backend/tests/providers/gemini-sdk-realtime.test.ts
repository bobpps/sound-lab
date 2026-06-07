const {
  MockGoogleGenAI,
  mockConnect,
  mockInstances,
  mockSession,
} = vi.hoisted(() => {
  const mockInstances: unknown[] = [];
  const mockSession = {
    close: vi.fn(),
    sendRealtimeInput: vi.fn(),
  };
  const mockConnect = vi.fn().mockResolvedValue(mockSession);

  class MockGoogleGenAI {
    readonly live = {
      connect: mockConnect,
    };

    constructor(public readonly options: unknown) {
      mockInstances.push(this);
    }
  }

  return {
    MockGoogleGenAI,
    mockConnect,
    mockInstances,
    mockSession,
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: MockGoogleGenAI,
  Modality: {
    AUDIO: 'AUDIO',
  },
  ThinkingLevel: {
    HIGH: 'HIGH',
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    MINIMAL: 'MINIMAL',
    THINKING_LEVEL_UNSPECIFIED: 'THINKING_LEVEL_UNSPECIFIED',
  },
  TurnCoverage: {
    TURN_COVERAGE_UNSPECIFIED: 'TURN_COVERAGE_UNSPECIFIED',
    TURN_INCLUDES_ALL_INPUT: 'TURN_INCLUDES_ALL_INPUT',
    TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO',
    TURN_INCLUDES_ONLY_ACTIVITY: 'TURN_INCLUDES_ONLY_ACTIVITY',
  },
}));

import { GeminiSdkRealtimeProvider } from '../../src/providers/realtime/gemini-sdk.js';
import type { RealtimeEvent } from '../../src/providers/realtime/types.js';

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('GeminiSdkRealtimeProvider', () => {
  const mockFetch = vi.fn<typeof fetch>();
  let provider: GeminiSdkRealtimeProvider;

  beforeEach(() => {
    mockConnect.mockClear();
    mockConnect.mockResolvedValue(mockSession);
    mockInstances.length = 0;
    mockSession.close.mockClear();
    mockSession.sendRealtimeInput.mockClear();
    vi.stubGlobal('fetch', mockFetch);
    provider = new GeminiSdkRealtimeProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('has the expected id and name', () => {
    expect(provider.id).toBe('gemini-realtime-sdk');
    expect(provider.name).toBe('Gemini Realtime SDK');
  });

  it('returns Gemini SDK realtime voices with official gender labels', async () => {
    const voices = await provider.getVoices('gemini-3.1-flash-live-preview');

    expect(voices).toHaveLength(30);
    expect(voices.find((voice) => voice.id === 'Kore')).toMatchObject({
      id: 'Kore',
      name: 'Kore',
      language: 'multi',
      gender: 'female',
      providerMeta: {
        supportedModels: ['gemini-3.1-flash-live-preview'],
      },
    });
    expect(voices.find((voice) => voice.id === 'Puck')?.gender).toBe('male');
  });

  it('lists live Gemini models and strips the models/ prefix', async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse({
      models: [
        {
          name: 'models/gemini-3.1-flash-live-preview',
          supportedGenerationMethods: ['bidiGenerateContent'],
        },
        {
          name: 'models/gemini-2.5-flash',
          supportedGenerationMethods: ['generateContent'],
        },
      ],
    }));

    await expect(provider.getModels()).resolves.toEqual([
      'gemini-3.1-flash-live-preview',
    ]);
  });

  it('connects through the SDK and sends audio chunks', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        geminiModelSettings: {
          enableAffectiveDialog: true,
          proactivity: {
            proactiveAudio: true,
          },
          realtimeInputConfig: {
            turnCoverage: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO',
          },
          thinkingConfig: {
            thinkingBudget: 1024,
          },
        },
        model: 'models/gemini-2.5-flash-native-audio-latest',
        systemPrompt: 'Be concise',
        voice: 'Kore',
      },
      onEvent,
    );

    await vi.waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });

    const instance = mockInstances[0] as { options: unknown };
    expect(instance.options).toEqual({
      apiKey: 'test-api-key',
      httpOptions: { apiVersion: 'v1alpha' },
    });
    expect(mockConnect.mock.calls[0]![0]).toMatchObject({
      model: 'gemini-2.5-flash-native-audio-latest',
      config: {
        enableAffectiveDialog: true,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        proactivity: {
          proactiveAudio: true,
        },
        realtimeInputConfig: {
          turnCoverage: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO',
        },
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
        systemInstruction: 'Be concise',
        thinkingConfig: {
          thinkingBudget: 1024,
        },
      },
    });

    mockConnect.mock.calls[0]![0].callbacks.onmessage({ setupComplete: {} });

    const session = await sessionPromise;
    session.sendAudio(Buffer.from('hello-audio'));

    expect(mockSession.sendRealtimeInput).toHaveBeenCalledWith({
      audio: {
        data: Buffer.from('hello-audio').toString('base64'),
        mimeType: 'audio/pcm;rate=16000',
      },
    });
  });

  it('maps SDK server messages into RealtimeEvent payloads', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        geminiTranscriptMode: 'final',
        model: 'gemini-3.1-flash-live-preview',
        systemPrompt: 'Be helpful',
      },
      onEvent,
    );

    await vi.waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });

    const callbacks = mockConnect.mock.calls[0]![0].callbacks;
    callbacks.onmessage({ setupComplete: {} });
    await sessionPromise;

    callbacks.onmessage({
      serverContent: {
        inputTranscription: {
          text: 'При',
        },
      },
    });
    callbacks.onmessage({
      serverContent: {
        inputTranscription: {
          text: 'вет',
        },
      },
    });
    callbacks.onmessage({
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: {
                data: 'YmFzZTY0LWF1ZGlv',
                mimeType: 'audio/pcm;rate=24000',
              },
            },
          ],
        },
      },
    });
    callbacks.onmessage({
      serverContent: {
        outputTranscription: {
          text: 'assistant reply',
        },
        turnComplete: true,
      },
    });

    expect(onEvent.mock.calls).toEqual([
      [
        {
          type: 'transcript',
          data: {
            final: true,
            role: 'user',
            text: 'Привет',
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
            final: true,
            role: 'assistant',
            text: 'assistant reply',
          },
        },
      ],
    ]);
  });

  it('closes SDK sessions without emitting remote session_end', async () => {
    const onEvent = vi.fn<(event: RealtimeEvent) => void>();
    const sessionPromise = provider.createSession(
      {
        model: 'gemini-3.1-flash-live-preview',
        systemPrompt: 'Be concise',
      },
      onEvent,
    );

    await vi.waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });

    const callbacks = mockConnect.mock.calls[0]![0].callbacks;
    callbacks.onmessage({ setupComplete: {} });

    const session = await sessionPromise;
    const closePromise = session.close();
    callbacks.onclose({ code: 1000, reason: 'closed' });
    await closePromise;

    expect(mockSession.sendRealtimeInput).toHaveBeenCalledWith({ audioStreamEnd: true });
    expect(mockSession.close).toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session_end' }),
    );
  });
});
