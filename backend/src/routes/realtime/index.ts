import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { WebSocket } from 'ws';
import { Type } from '@sinclair/typebox';
import type { IRealtimeSession, RealtimeEvent, RealtimeSessionConfig } from '../../providers/realtime/types.js';
import { RealtimeModelsResponse, RealtimeProviderIdParam } from '../../schemas/realtime.js';
import { ErrorResponse } from '../../schemas/common.js';
import { Voice } from '../../schemas/tts.js';

interface RealtimeAccess {
  providerId: string;
  apiKey: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    realtimeApiKey?: string;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sendSocketEvent(socket: WebSocket, event: RealtimeEvent): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(event));
}

function sendSocketError(socket: WebSocket, message: string): void {
  sendSocketEvent(socket, {
    type: 'error',
    data: { message },
  });
}

function parseMessage(raw: Buffer): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw.toString());
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractSessionConfig(message: Record<string, unknown>): RealtimeSessionConfig | null {
  const source = isRecord(message.data) ? message.data : message;
  const model = source.model;
  const systemPrompt = source.systemPrompt;
  const language = source.language;
  const voice = source.voice;

  if (typeof model !== 'string' || typeof systemPrompt !== 'string') {
    return null;
  }

  if (language !== undefined && typeof language !== 'string') {
    return null;
  }

  if (voice !== undefined && typeof voice !== 'string') {
    return null;
  }

  return {
    ...(language ? { language } : {}),
    model,
    systemPrompt,
    ...(voice ? { voice } : {}),
  };
}

function extractAudioChunk(message: Record<string, unknown>): Buffer | null {
  if (typeof message.data !== 'string') {
    return null;
  }

  return Buffer.from(message.data, 'base64');
}

const realtimeRoutes: FastifyPluginAsync = async (fastify) => {
  async function resolveRealtimeAccess(
    providerId: string,
    reply: FastifyReply,
  ): Promise<RealtimeAccess | null> {
    const provider = await fastify.db.providers.getById(providerId);
    if (!provider || provider.type !== 'realtime') {
      reply.notFound(`Realtime provider ${providerId} not found`);
      return null;
    }

    const apiKey = await fastify.db.providers.getDecryptedKey(providerId);
    if (!apiKey) {
      reply.badRequest(`No API key configured for provider ${providerId}`);
      return null;
    }

    return { providerId, apiKey };
  }

  fastify.get('/:providerId/models', {
    schema: {
      params: RealtimeProviderIdParam,
      response: {
        200: RealtimeModelsResponse,
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const access = await resolveRealtimeAccess(providerId, reply);
    if (!access) return;

    try {
      const provider = fastify.createRealtimeProvider(access.providerId, access.apiKey);
      return provider.getModels();
    } catch {
      reply.badRequest(`Provider ${access.providerId} is not supported`);
    }
  });

  fastify.get('/:providerId/voices', {
    schema: {
      params: RealtimeProviderIdParam,
      querystring: Type.Object({
        model: Type.Optional(Type.String()),
      }, { additionalProperties: false }),
      response: {
        200: Type.Array(Voice),
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const { model } = request.query as { model?: string };
    const access = await resolveRealtimeAccess(providerId, reply);
    if (!access) return;

    try {
      const provider = fastify.createRealtimeProvider(access.providerId, access.apiKey);
      return provider.getVoices(model);
    } catch {
      reply.badRequest(`Provider ${access.providerId} is not supported`);
    }
  });

  fastify.get('/:providerId/session', {
    websocket: true,
    schema: {
      params: RealtimeProviderIdParam,
    },
    preValidation: async (request, reply) => {
      const { providerId } = request.params as { providerId: string };
      const access = await resolveRealtimeAccess(providerId, reply);
      if (!access) {
        return reply;
      }

      request.realtimeApiKey = access.apiKey;
    },
  }, (socket, request) => {
    const providerId = (request.params as { providerId: string }).providerId;
    const apiKey = request.realtimeApiKey;

    let session: IRealtimeSession | null = null;
    let sessionStarted = false;
    let sessionStartPending = false;
    let sessionEndSent = false;
    let closePromise: Promise<void> | null = null;

    const closeSession = async (notifyClient: boolean): Promise<void> => {
      if (closePromise) {
        await closePromise;
        return;
      }

      closePromise = (async () => {
        const activeSession = session;
        session = null;
        sessionStarted = false;
        sessionStartPending = false;

        if (activeSession) {
          await activeSession.close();
        }

        if (notifyClient && !sessionEndSent) {
          sessionEndSent = true;
          sendSocketEvent(socket, { type: 'session_end', data: null });
        }
      })();

      await closePromise;
    };

    socket.on('message', async (rawMessage: Buffer) => {
      const message = parseMessage(rawMessage);
      if (!message) {
        sendSocketError(socket, 'Invalid realtime message JSON');
        return;
      }

      try {
        switch (message.type) {
          case 'session_start': {
            if (sessionStarted || sessionStartPending) {
              sendSocketError(socket, 'Realtime session already started');
              return;
            }

            const config = extractSessionConfig(message);
            if (!config || !apiKey) {
              sendSocketError(socket, 'Invalid session_start payload');
              return;
            }

            sessionStartPending = true;

            try {
              const provider = fastify.createRealtimeProvider(providerId, apiKey);
              session = await provider.createSession(config, (event) => {
                if (event.type === 'session_end') {
                  sessionEndSent = true;
                  void closeSession(false);
                }

                sendSocketEvent(socket, event);
              });

              sessionStarted = true;
              sendSocketEvent(socket, {
                type: 'session_start',
                data: config,
              });
            } catch (error) {
              sendSocketError(
                socket,
                getErrorMessage(error, 'Failed to create realtime session'),
              );
            } finally {
              sessionStartPending = false;
            }
            return;
          }

          case 'audio': {
            if (!session) {
              sendSocketError(socket, 'Realtime session has not started');
              return;
            }

            const chunk = extractAudioChunk(message);
            if (!chunk) {
              sendSocketError(socket, 'Invalid audio payload');
              return;
            }

            await session.sendAudio(chunk);
            return;
          }

          case 'session_end': {
            await closeSession(true);

            if (socket.readyState === WebSocket.OPEN) {
              socket.close(1000, 'Session ended');
            }
            return;
          }

          default:
            sendSocketError(
              socket,
              `Unsupported realtime message type: ${String(message.type)}`,
            );
        }
      } catch (error) {
        fastify.log.error(error);
        sendSocketError(
          socket,
          getErrorMessage(error, 'Unexpected realtime session error'),
        );
      }
    });

    socket.on('close', () => {
      void closeSession(false);
    });

    socket.on('error', (error) => {
      fastify.log.error(error);
      void closeSession(false);
    });
  });
};

export default realtimeRoutes;
