import WebSocket, { type RawData } from 'ws';
import type { IRealtimeProvider, IRealtimeSession, RealtimeEvent, RealtimeSessionConfig } from './types.js';

const GEMINI_REALTIME_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_AUDIO_MIME_TYPE = 'audio/pcm;rate=16000';
const SESSION_CLOSE_TIMEOUT_MS = 5000;

interface GeminiModelRecord {
  name?: string;
  baseModelId?: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toBuffer(raw: RawData): Buffer {
  if (typeof raw === 'string') {
    return Buffer.from(raw);
  }

  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw);
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(raw.map((chunk) => toBuffer(chunk)));
  }

  return Buffer.from(raw);
}

function parseJsonMessage(raw: RawData): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(toBuffer(raw).toString());
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function createErrorEvent(message: string, details?: Record<string, unknown>): RealtimeEvent {
  return {
    type: 'error',
    data: {
      message,
      ...details,
    },
  };
}

function createTranscriptEvent(
  role: 'user' | 'assistant',
  text: string,
  final = true,
): RealtimeEvent {
  return {
    type: 'transcript',
    data: {
      role,
      text,
      final,
    },
  };
}

function createAudioEvent(data: string, mimeType?: string): RealtimeEvent {
  return {
    type: 'audio',
    data: {
      chunk: data,
      mimeType: mimeType ?? GEMINI_AUDIO_MIME_TYPE,
    },
  };
}

async function sendJson(socket: WebSocket, payload: Record<string, unknown>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    socket.send(JSON.stringify(payload), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function normalizeModelName(name: string): string {
  return name.startsWith('models/') ? name.slice('models/'.length) : name;
}

function getLiveModelName(model: GeminiModelRecord): string | null {
  const candidate = typeof model.baseModelId === 'string'
    ? model.baseModelId
    : typeof model.name === 'string'
      ? normalizeModelName(model.name)
      : null;

  if (!candidate) {
    return null;
  }

  const methods = Array.isArray(model.supportedGenerationMethods)
    ? model.supportedGenerationMethods
    : [];

  return methods.includes('bidiGenerateContent') ? candidate : null;
}

async function readErrorResponse(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.clone().json();
    if (isRecord(body) && typeof body.error === 'object' && body.error !== null) {
      const error = body.error as Record<string, unknown>;
      if (typeof error.message === 'string') {
        return error.message;
      }
    }

    if (isRecord(body) && typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // Ignore JSON parsing failures and fall back to raw text.
  }

  try {
    const text = await response.clone().text();
    if (text.trim()) {
      return text;
    }
  } catch {
    // Ignore text parsing failures.
  }

  return fallback;
}

function buildSetupMessage(config: RealtimeSessionConfig): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['AUDIO'],
  };

  if (config.voice) {
    generationConfig.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: config.voice,
        },
      },
    };
  }

  const setup: Record<string, unknown> = {
    model: `models/${normalizeModelName(config.model)}`,
    generationConfig,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };

  if (config.systemPrompt) {
    setup.systemInstruction = {
      parts: [{ text: config.systemPrompt }],
    };
  }

  return { setup };
}

function closeSocket(socket: WebSocket, code: number, reason: string): void {
  if (socket.readyState >= WebSocket.CLOSING) {
    return;
  }

  socket.close(code, reason);
}

function waitForSocketClose(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const finish = (): void => {
      if (resolved) {
        return;
      }

      resolved = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      resolve();
    };

    socket.once('close', () => {
      finish();
    });

    timeoutHandle = setTimeout(() => {
      if ('terminate' in socket && typeof socket.terminate === 'function') {
        socket.terminate();
      }

      finish();
    }, SESSION_CLOSE_TIMEOUT_MS);
  });
}

function extractGoAwayEvent(goAway: Record<string, unknown>): RealtimeEvent {
  const message = typeof goAway.message === 'string'
    ? goAway.message
    : 'Gemini Live API requested session shutdown';

  return createErrorEvent(message, {
    source: 'gemini',
    timeLeft: typeof goAway.timeLeft === 'string' ? goAway.timeLeft : undefined,
  });
}

function emitServerContent(
  serverContent: Record<string, unknown>,
  onEvent: (event: RealtimeEvent) => void,
): void {
  const inputTranscription = isRecord(serverContent.inputTranscription)
    ? serverContent.inputTranscription
    : null;
  if (typeof inputTranscription?.text === 'string' && inputTranscription.text) {
    onEvent(createTranscriptEvent('user', inputTranscription.text));
  }

  const outputTranscription = isRecord(serverContent.outputTranscription)
    ? serverContent.outputTranscription
    : null;
  if (typeof outputTranscription?.text === 'string' && outputTranscription.text) {
    onEvent(createTranscriptEvent('assistant', outputTranscription.text));
  }

  const modelTurn = isRecord(serverContent.modelTurn) ? serverContent.modelTurn : null;
  const parts = Array.isArray(modelTurn?.parts) ? modelTurn.parts : [];

  for (const part of parts) {
    if (!isRecord(part)) {
      continue;
    }

    const inlineData = isRecord(part.inlineData) ? part.inlineData : null;
    if (typeof inlineData?.data === 'string' && inlineData.data) {
      onEvent(createAudioEvent(
        inlineData.data,
        typeof inlineData.mimeType === 'string' ? inlineData.mimeType : undefined,
      ));
      continue;
    }

    if (!outputTranscription && typeof part.text === 'string' && part.text) {
      onEvent(createTranscriptEvent(
        'assistant',
        part.text,
        typeof serverContent.turnComplete === 'boolean' ? serverContent.turnComplete : true,
      ));
    }
  }
}

class GeminiRealtimeSession implements IRealtimeSession {
  private closePromise: Promise<void> | null = null;
  private closed = false;

  constructor(
    private readonly socket: WebSocket,
    private readonly suppressRemoteSessionEnd: () => void,
  ) {}

  async sendAudio(chunk: Buffer): Promise<void> {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Gemini Realtime session is not open');
    }

    await sendJson(this.socket, {
      realtimeInput: {
        audio: {
          data: chunk.toString('base64'),
          mimeType: GEMINI_AUDIO_MIME_TYPE,
        },
      },
    });
  }

  async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.closed = true;
    this.suppressRemoteSessionEnd();

    if (this.socket.readyState === WebSocket.CLOSED) {
      this.closePromise = Promise.resolve();
      return this.closePromise;
    }

    this.closePromise = waitForSocketClose(this.socket);

    if (this.socket.readyState === WebSocket.OPEN) {
      await sendJson(this.socket, {
        realtimeInput: {
          audioStreamEnd: true,
        },
      }).catch(() => {
        // Best effort flush before shutdown.
      });
    }

    closeSocket(this.socket, 1000, 'Session closed');

    return this.closePromise;
  }
}

export class GeminiRealtimeProvider implements IRealtimeProvider {
  readonly id = 'gemini-realtime';
  readonly name = 'Gemini Realtime';

  constructor(private readonly apiKey: string) {}

  async getModels(): Promise<string[]> {
    const models = new Set<string>();
    let pageToken: string | null = null;

    do {
      const url = new URL(GEMINI_MODELS_URL);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('pageSize', '1000');

      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        const message = await readErrorResponse(
          response,
          `Gemini models API error (${response.status})`,
        );
        throw new Error(`Gemini models API error: ${message}`);
      }

      const body = await response.json();
      if (!isRecord(body)) {
        throw new Error('Gemini models API returned an invalid response');
      }

      const pageModels = Array.isArray(body.models) ? body.models : [];
      for (const model of pageModels) {
        if (!isRecord(model)) {
          continue;
        }

        const liveModel = getLiveModelName(model);
        if (liveModel) {
          models.add(liveModel);
        }
      }

      pageToken = typeof body.nextPageToken === 'string' && body.nextPageToken
        ? body.nextPageToken
        : null;
    } while (pageToken);

    return [...models].sort();
  }

  async createSession(
    config: RealtimeSessionConfig,
    onEvent: (event: RealtimeEvent) => void,
  ): Promise<IRealtimeSession> {
    const url = new URL(GEMINI_REALTIME_URL);
    url.searchParams.set('key', this.apiKey);

    const socket = new WebSocket(url);

    let session: GeminiRealtimeSession | null = null;
    let startupSettled = false;
    let remoteSessionEndEnabled = true;

    const suppressRemoteSessionEnd = (): void => {
      remoteSessionEndEnabled = false;
    };

    return new Promise<IRealtimeSession>((resolve, reject) => {
      const settleStartup = (
        kind: 'resolve' | 'reject',
        payload: IRealtimeSession | Error,
      ): void => {
        if (startupSettled) {
          return;
        }

        startupSettled = true;

        if (kind === 'resolve') {
          resolve(payload as IRealtimeSession);
          return;
        }

        reject(payload as Error);
      };

      const failStartup = (message: string): void => {
        suppressRemoteSessionEnd();
        settleStartup('reject', new Error(message));
        closeSocket(socket, 1011, message);
      };

      socket.on('open', () => {
        void sendJson(socket, buildSetupMessage(config)).catch((error) => {
          failStartup(getErrorMessage(error, 'Failed to configure Gemini realtime session'));
        });
      });

      socket.on('message', (rawMessage) => {
        const message = parseJsonMessage(rawMessage);
        if (!message) {
          onEvent(createErrorEvent(
            'Invalid JSON event received from Gemini Live API',
            { source: 'gemini' },
          ));
          return;
        }

        if ('setupComplete' in message) {
          if (!session) {
            session = new GeminiRealtimeSession(socket, suppressRemoteSessionEnd);
          }

          settleStartup('resolve', session);
          return;
        }

        if (isRecord(message.serverContent)) {
          emitServerContent(message.serverContent, onEvent);
          return;
        }

        if (isRecord(message.goAway)) {
          const goAwayEvent = extractGoAwayEvent(message.goAway);
          onEvent(goAwayEvent);

          if (!startupSettled) {
            const payload = isRecord(goAwayEvent.data) ? goAwayEvent.data : null;
            failStartup(
              typeof payload?.message === 'string'
                ? payload.message
                : 'Gemini Live API requested session shutdown',
            );
          }
        }
      });

      socket.on('error', (error) => {
        const message = getErrorMessage(error, 'Gemini websocket error');
        onEvent(createErrorEvent(message, { source: 'gemini' }));

        if (!startupSettled) {
          failStartup(message);
        }
      });

      socket.on('close', (code, reason) => {
        const closeReason = toBuffer(reason).toString();

        if (!startupSettled) {
          settleStartup(
            'reject',
            new Error(
              closeReason || `Gemini websocket closed before session was ready (${code})`,
            ),
          );
          return;
        }

        if (remoteSessionEndEnabled) {
          onEvent({
            type: 'session_end',
            data: {
              code,
              reason: closeReason,
            },
          });
        }
      });
    });
  }
}
