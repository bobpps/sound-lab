import { WebSocket } from 'ws';
import type {
  IRealtimeProvider,
  IRealtimeSession,
  RealtimeEvent,
  RealtimeSessionConfig,
} from './types.js';

const API_BASE_URL = 'https://api.elevenlabs.io';
const LIST_AGENTS_URL = `${API_BASE_URL}/v1/convai/agents`;
const SIGNED_URL_PATH = '/v1/convai/conversation/get-signed-url';
const PAGE_SIZE = 100;
const SESSION_INIT_TIMEOUT_MS = 15_000;
const SESSION_CLOSE_TIMEOUT_MS = 5_000;

interface ElevenLabsAgentSummary {
  agent_id?: string;
}

interface ElevenLabsListAgentsResponse {
  agents?: ElevenLabsAgentSummary[];
  has_more?: boolean;
  next_cursor?: string | null;
}

interface ElevenLabsSignedUrlResponse {
  signed_url?: string;
}

interface ElevenLabsConversationInitiationMetadataEvent {
  conversation_id?: string;
  agent_output_audio_format?: string;
  user_input_audio_format?: string;
}

interface ElevenLabsPingEvent {
  event_id?: number;
  ping_ms?: number;
}

interface ElevenLabsAudioEvent {
  audio_base_64?: string;
  event_id?: number;
  alignment?: unknown;
}

interface ElevenLabsUserTranscriptEvent {
  user_transcript?: string;
}

interface ElevenLabsAgentResponseEvent {
  agent_response?: string;
}

interface ElevenLabsAgentResponseCorrectionEvent {
  original_agent_response?: string;
  corrected_agent_response?: string;
}

interface ElevenLabsServerMessage {
  type?: string;
  conversation_initiation_metadata_event?: ElevenLabsConversationInitiationMetadataEvent;
  ping_event?: ElevenLabsPingEvent;
  audio_event?: ElevenLabsAudioEvent;
  user_transcription_event?: ElevenLabsUserTranscriptEvent;
  agent_response_event?: ElevenLabsAgentResponseEvent;
  agent_response_correction_event?: ElevenLabsAgentResponseCorrectionEvent;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function bufferToString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value).toString('utf8');
  }

  if (Array.isArray(value)) {
    return Buffer.concat(
      value.map((chunk) => (typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))),
    ).toString('utf8');
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  return '';
}

async function readJson<T>(response: Response, invalidMessage: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(invalidMessage);
  }
}

async function throwApiError(response: Response): Promise<never> {
  const body = await response.text();
  const suffix = body ? ` ${body}` : '';
  throw new Error(`ElevenLabs API error: ${response.status}${suffix}`);
}

async function sendJson(socket: WebSocket, message: Record<string, unknown>): Promise<void> {
  if (socket.readyState !== WebSocket.OPEN) {
    throw new Error('ElevenLabs realtime socket is not open');
  }

  await new Promise<void>((resolve, reject) => {
    socket.send(JSON.stringify(message), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
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

function parseServerMessage(raw: unknown): ElevenLabsServerMessage | null {
  const payload = bufferToString(raw);
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as ElevenLabsServerMessage;
  } catch {
    return null;
  }
}

function buildConversationInitiationMessage(
  config: RealtimeSessionConfig,
): Record<string, unknown> {
  const conversationConfigOverride: Record<string, unknown> = {};
  const systemPrompt = config.systemPrompt.trim();
  const voiceId = config.voice?.trim();

  if (systemPrompt) {
    conversationConfigOverride.agent = {
      prompt: {
        prompt: systemPrompt,
      },
    };
  }

  if (voiceId) {
    conversationConfigOverride.tts = {
      voice_id: voiceId,
    };
  }

  if (Object.keys(conversationConfigOverride).length === 0) {
    return { type: 'conversation_initiation_client_data' };
  }

  return {
    type: 'conversation_initiation_client_data',
    conversation_config_override: conversationConfigOverride,
  };
}

class ElevenLabsRealtimeSession implements IRealtimeSession {
  private closePromise: Promise<void> | null = null;
  private closed = false;

  constructor(
    private readonly socket: WebSocket,
    private readonly dispose: () => void,
    private readonly suppressRemoteSessionEnd: () => void,
  ) {}

  async sendAudio(chunk: Buffer): Promise<void> {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('ElevenLabs Realtime session is not open');
    }

    await sendJson(this.socket, {
      user_audio_chunk: chunk.toString('base64'),
    });
  }

  async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.closed = true;
    this.suppressRemoteSessionEnd();
    this.dispose();

    if (this.socket.readyState === WebSocket.CLOSED) {
      this.closePromise = Promise.resolve();
      return this.closePromise;
    }

    this.closePromise = waitForSocketClose(this.socket);
    closeSocket(this.socket, 1000, 'Sound Lab session closed');

    await this.closePromise;
  }
}

export class ElevenLabsRealtimeProvider implements IRealtimeProvider {
  readonly id = 'elevenlabs-realtime';
  readonly name = 'ElevenLabs Realtime';

  constructor(private readonly apiKey: string) {}

  async getModels(): Promise<string[]> {
    const agentIds: string[] = [];
    let cursor: string | null = null;

    do {
      const url = new URL(LIST_AGENTS_URL);
      url.searchParams.set('page_size', String(PAGE_SIZE));
      url.searchParams.set('archived', 'false');

      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetch(url, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        await throwApiError(response);
      }

      const data = await readJson<ElevenLabsListAgentsResponse>(
        response,
        'ElevenLabs API returned an invalid agents response',
      );

      if (!Array.isArray(data.agents)) {
        throw new Error('ElevenLabs API returned an invalid agents response');
      }

      for (const agent of data.agents) {
        if (typeof agent.agent_id === 'string' && agent.agent_id) {
          agentIds.push(agent.agent_id);
        }
      }

      cursor = data.has_more ? data.next_cursor ?? null : null;
    } while (cursor);

    return [...new Set(agentIds)];
  }

  async createSession(
    config: RealtimeSessionConfig,
    onEvent: (event: RealtimeEvent) => void,
  ): Promise<IRealtimeSession> {
    const agentId = config.model.trim();

    if (!agentId) {
      throw new Error('ElevenLabs realtime sessions require an agent ID');
    }

    const signedUrl = await this.getSignedUrl(agentId);
    return this.openSession(signedUrl, config, onEvent);
  }

  private async getSignedUrl(agentId: string): Promise<string> {
    const url = new URL(SIGNED_URL_PATH, API_BASE_URL);
    url.searchParams.set('agent_id', agentId);

    const response = await fetch(url, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      await throwApiError(response);
    }

    const data = await readJson<ElevenLabsSignedUrlResponse>(
      response,
      'ElevenLabs API returned an invalid signed URL response',
    );

    if (!data.signed_url) {
      throw new Error('ElevenLabs API returned an invalid signed URL response');
    }

    return data.signed_url;
  }

  private async openSession(
    signedUrl: string,
    config: RealtimeSessionConfig,
    onEvent: (event: RealtimeEvent) => void,
  ): Promise<IRealtimeSession> {
    const socket = new WebSocket(signedUrl);
    const pingTimers = new Set<NodeJS.Timeout>();
    let suppressRemoteSessionEnd = false;

    const dispose = () => {
      for (const timer of pingTimers) {
        clearTimeout(timer);
      }

      pingTimers.clear();
    };

    const suppressSessionEnd = () => {
      suppressRemoteSessionEnd = true;
    };

    return new Promise<IRealtimeSession>((resolve, reject) => {
      let ready = false;
      let initCompleted = false;

      const initTimeout = setTimeout(() => {
        if (ready) {
          return;
        }

        dispose();
        reject(new Error('Timed out waiting for ElevenLabs realtime session to initialize'));
        socket.close();
      }, SESSION_INIT_TIMEOUT_MS);

      const completeInit = () => {
        if (initCompleted) {
          return;
        }

        initCompleted = true;
        clearTimeout(initTimeout);
      };

      socket.on('open', async () => {
        try {
          await sendJson(socket, buildConversationInitiationMessage(config));
        } catch (error) {
          completeInit();
          dispose();
          reject(new Error(getErrorMessage(error, 'Failed to initialize ElevenLabs session')));
          socket.close();
        }
      });

      socket.on('message', (rawMessage) => {
        const message = parseServerMessage(rawMessage);
        if (!message?.type) {
          onEvent({
            type: 'error',
            data: { message: 'Invalid ElevenLabs realtime message payload' },
          });
          return;
        }

        switch (message.type) {
          case 'conversation_initiation_metadata': {
            if (!ready) {
              ready = true;
              completeInit();
              resolve(new ElevenLabsRealtimeSession(socket, dispose, suppressSessionEnd));
            }

            return;
          }

          case 'ping': {
            const eventId = message.ping_event?.event_id;
            if (typeof eventId !== 'number') {
              onEvent({
                type: 'error',
                data: { message: 'Invalid ElevenLabs ping event payload' },
              });
              return;
            }

            const sendPong = () => {
              void sendJson(socket, {
                type: 'pong',
                event_id: eventId,
              }).catch((error) => {
                onEvent({
                  type: 'error',
                  data: {
                    message: getErrorMessage(error, 'Failed to respond to ElevenLabs ping'),
                  },
                });
              });
            };

            const delayMs = message.ping_event?.ping_ms;
            if (typeof delayMs === 'number' && Number.isFinite(delayMs) && delayMs > 0) {
              const timer = setTimeout(() => {
                pingTimers.delete(timer);
                sendPong();
              }, Math.min(delayMs, 1_000));

              pingTimers.add(timer);
              return;
            }

            sendPong();
            return;
          }

          case 'user_transcript': {
            const text = message.user_transcription_event?.user_transcript;
            if (typeof text === 'string' && text) {
              onEvent({
                type: 'transcript',
                data: { role: 'user', text },
              });
            }
            return;
          }

          case 'agent_response': {
            const text = message.agent_response_event?.agent_response;
            if (typeof text === 'string' && text) {
              onEvent({
                type: 'transcript',
                data: { role: 'assistant', text },
              });
            }
            return;
          }

          case 'agent_response_correction': {
            const correction = message.agent_response_correction_event?.corrected_agent_response;
            const original = message.agent_response_correction_event?.original_agent_response;

            if (typeof correction === 'string' && correction) {
              onEvent({
                type: 'transcript',
                data: {
                  role: 'assistant',
                  text: correction,
                  corrected: true,
                  originalText: original,
                },
              });
            }
            return;
          }

          case 'audio': {
            const audioBase64 = message.audio_event?.audio_base_64;
            if (typeof audioBase64 === 'string' && audioBase64) {
              onEvent({
                type: 'audio',
                data: {
                  audioBase64,
                  eventId: message.audio_event?.event_id,
                  alignment: message.audio_event?.alignment,
                },
              });
            }
            return;
          }

          default:
            return;
        }
      });

      socket.on('error', (error) => {
        const message = getErrorMessage(error, 'ElevenLabs realtime socket error');

        if (!ready) {
          completeInit();
          dispose();
          reject(new Error(message));
          return;
        }

        onEvent({
          type: 'error',
          data: { message },
        });
      });

      socket.on('close', (code, reason) => {
        const reasonText = bufferToString(reason);
        completeInit();
        dispose();

        if (!ready) {
          reject(
            new Error(
              reasonText
                ? `ElevenLabs realtime session closed before initialization (${code}: ${reasonText})`
                : `ElevenLabs realtime session closed before initialization (${code})`,
            ),
          );
          return;
        }

        if (!suppressRemoteSessionEnd) {
          onEvent({
            type: 'session_end',
            data: { code, reason: reasonText || undefined },
          });
        }
      });
    });
  }
}
