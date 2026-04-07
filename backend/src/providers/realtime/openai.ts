import OpenAI from 'openai';
import WebSocket, { type RawData } from 'ws';
import type { IRealtimeProvider, IRealtimeSession, RealtimeEvent, RealtimeSessionConfig } from './types.js';

const REALTIME_MODEL_PREFIXES = [
  'gpt-realtime',
  'gpt-4o-realtime-preview',
  'gpt-audio',
] as const;

const DEFAULT_INPUT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

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

function extractRealtimeError(message: Record<string, unknown>): {
  message: string;
  code?: string;
  type?: string;
  eventId?: string;
} {
  const upstreamError = isRecord(message.error) ? message.error : null;
  const errorMessage = typeof upstreamError?.message === 'string'
    ? upstreamError.message
    : 'OpenAI Realtime API error';

  return {
    message: errorMessage,
    code: typeof upstreamError?.code === 'string' ? upstreamError.code : undefined,
    type: typeof upstreamError?.type === 'string' ? upstreamError.type : undefined,
    eventId: typeof message.event_id === 'string' ? message.event_id : undefined,
  };
}

function createTranscriptEvent(
  role: 'user' | 'assistant',
  text: string,
  final: boolean,
  message: Record<string, unknown>,
): RealtimeEvent {
  return {
    type: 'transcript',
    data: {
      role,
      text,
      final,
      itemId: typeof message.item_id === 'string' ? message.item_id : undefined,
      responseId: typeof message.response_id === 'string' ? message.response_id : undefined,
      contentIndex: typeof message.content_index === 'number' ? message.content_index : undefined,
      outputIndex: typeof message.output_index === 'number' ? message.output_index : undefined,
    },
  };
}

function createAudioEvent(message: Record<string, unknown>): RealtimeEvent | null {
  if (typeof message.delta !== 'string') {
    return null;
  }

  return {
    type: 'audio',
    data: {
      chunk: message.delta,
      itemId: typeof message.item_id === 'string' ? message.item_id : undefined,
      responseId: typeof message.response_id === 'string' ? message.response_id : undefined,
      contentIndex: typeof message.content_index === 'number' ? message.content_index : undefined,
      outputIndex: typeof message.output_index === 'number' ? message.output_index : undefined,
    },
  };
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

function sendJson(socket: WebSocket, payload: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.send(JSON.stringify(payload), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function buildSessionUpdate(config: RealtimeSessionConfig): Record<string, unknown> {
  const session: Record<string, unknown> = {
    type: 'realtime',
    model: config.model,
    instructions: config.systemPrompt,
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
          model: DEFAULT_INPUT_TRANSCRIPTION_MODEL,
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
      },
    },
  };

  const audio = session.audio as { output: Record<string, unknown> };
  if (config.voice) {
    audio.output.voice = config.voice;
  }

  return {
    type: 'session.update',
    session,
  };
}

class OpenAIRealtimeSession implements IRealtimeSession {
  private closePromise: Promise<void> | null = null;
  private closed = false;

  constructor(
    private readonly socket: WebSocket,
    private readonly suppressRemoteSessionEnd: () => void,
  ) {}

  async sendAudio(chunk: Buffer): Promise<void> {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('OpenAI Realtime session is not open');
    }

    await sendJson(this.socket, {
      type: 'input_audio_buffer.append',
      audio: chunk.toString('base64'),
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

    this.closePromise = new Promise((resolve) => {
      this.socket.once('close', () => {
        resolve();
      });

      if (this.socket.readyState === WebSocket.CLOSING) {
        return;
      }

      this.socket.close(1000, 'Session closed');
    });

    return this.closePromise;
  }
}

export class OpenAIRealtimeProvider implements IRealtimeProvider {
  readonly id = 'openai-realtime';
  readonly name = 'OpenAI Realtime';

  private readonly client: OpenAI;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new OpenAI({ apiKey });
  }

  async getModels(): Promise<string[]> {
    const models = new Set<string>();

    for await (const model of this.client.models.list()) {
      if (REALTIME_MODEL_PREFIXES.some((prefix) => model.id.startsWith(prefix))) {
        models.add(model.id);
      }
    }

    return [...models].sort();
  }

  async createSession(
    config: RealtimeSessionConfig,
    onEvent: (event: RealtimeEvent) => void,
  ): Promise<IRealtimeSession> {
    const url = new URL(OPENAI_REALTIME_URL);
    url.searchParams.set('model', config.model);

    const socket = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    let session: OpenAIRealtimeSession | null = null;
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

      socket.on('open', () => {
        void sendJson(socket, buildSessionUpdate(config)).catch((error) => {
          settleStartup(
            'reject',
            new Error(getErrorMessage(error, 'Failed to configure OpenAI Realtime session')),
          );
        });
      });

      socket.on('message', (rawMessage) => {
        const message = parseJsonMessage(rawMessage);
        if (!message) {
          onEvent(createErrorEvent('Invalid JSON event received from OpenAI Realtime API'));
          return;
        }

        switch (message.type) {
          case 'session.created':
            return;

          case 'session.updated': {
            if (!session) {
              session = new OpenAIRealtimeSession(socket, suppressRemoteSessionEnd);
            }

            settleStartup('resolve', session);
            return;
          }

          case 'conversation.item.input_audio_transcription.delta': {
            if (typeof message.delta === 'string') {
              onEvent(createTranscriptEvent('user', message.delta, false, message));
            }
            return;
          }

          case 'conversation.item.input_audio_transcription.completed': {
            if (typeof message.transcript === 'string') {
              onEvent(createTranscriptEvent('user', message.transcript, true, message));
            }
            return;
          }

          case 'conversation.item.input_audio_transcription.failed': {
            const realtimeError = extractRealtimeError(message);
            onEvent(createErrorEvent(realtimeError.message, {
              code: realtimeError.code,
              source: 'openai',
              upstreamType: realtimeError.type,
              eventId: realtimeError.eventId,
            }));
            return;
          }

          case 'response.output_audio.delta': {
            const audioEvent = createAudioEvent(message);
            if (audioEvent) {
              onEvent(audioEvent);
            }
            return;
          }

          case 'response.output_audio_transcript.delta': {
            if (typeof message.delta === 'string') {
              onEvent(createTranscriptEvent('assistant', message.delta, false, message));
            }
            return;
          }

          case 'response.output_audio_transcript.done': {
            if (typeof message.transcript === 'string') {
              onEvent(createTranscriptEvent('assistant', message.transcript, true, message));
            }
            return;
          }

          case 'error': {
            const realtimeError = extractRealtimeError(message);
            onEvent(createErrorEvent(realtimeError.message, {
              code: realtimeError.code,
              source: 'openai',
              upstreamType: realtimeError.type,
              eventId: realtimeError.eventId,
            }));

            if (!startupSettled) {
              settleStartup('reject', new Error(realtimeError.message));
            }
            return;
          }

          default:
            return;
        }
      });

      socket.on('error', (error) => {
        const message = getErrorMessage(error, 'OpenAI Realtime websocket error');
        onEvent(createErrorEvent(message, { source: 'openai' }));

        if (!startupSettled) {
          settleStartup('reject', new Error(message));
        }
      });

      socket.on('close', (code, reason) => {
        const closeReason = reason.toString();

        if (!startupSettled) {
          settleStartup(
            'reject',
            new Error(
              closeReason || `OpenAI Realtime socket closed before session was ready (${code})`,
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
