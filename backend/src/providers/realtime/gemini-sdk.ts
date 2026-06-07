import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  TurnCoverage,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import type { IRealtimeProvider, IRealtimeSession, RealtimeEvent, RealtimeSessionConfig } from './types.js';
import type { IVoice } from '../tts/types.js';
import { buildGeminiVoices } from '../gemini-voices.js';

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_AUDIO_MIME_TYPE = 'audio/pcm;rate=16000';
const SESSION_CLOSE_TIMEOUT_MS = 5000;
interface GeminiModelRecord {
  name?: string;
  baseModelId?: string;
  supportedGenerationMethods?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  if (isRecord(error) && error.error instanceof Error) {
    return error.error.message;
  }

  return fallback;
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

function mergeTranscriptText(previous: string, next: string): string {
  const current = previous.trim();
  const hasExplicitWordBoundary = /^\s/.test(next);
  const incoming = next.trim();

  if (!incoming) {
    return current;
  }

  if (!current || incoming.startsWith(current)) {
    return incoming;
  }

  if (/^[,.:;!?]/u.test(incoming)) {
    return `${current}${incoming}`;
  }

  if (/[,.!?;:]$/u.test(current) || hasExplicitWordBoundary) {
    return `${current} ${incoming}`;
  }

  return `${current}${incoming}`;
}

class GeminiTranscriptBuffer {
  private assistantText = '';
  private userText = '';

  constructor(private readonly onEvent: (event: RealtimeEvent) => void) {}

  add(role: 'user' | 'assistant', text: string): void {
    if (role === 'user') {
      this.userText = mergeTranscriptText(this.userText, text);
      return;
    }

    this.assistantText = mergeTranscriptText(this.assistantText, text);
  }

  flush(role: 'user' | 'assistant'): void {
    const text = role === 'user' ? this.userText : this.assistantText;
    if (!text.trim()) {
      return;
    }

    this.onEvent(createTranscriptEvent(role, text.trim(), true));

    if (role === 'user') {
      this.userText = '';
      return;
    }

    this.assistantText = '';
  }

  flushAll(): void {
    this.flush('user');
    this.flush('assistant');
  }
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

function mapThinkingLevel(level: string): ThinkingLevel {
  switch (level) {
    case 'minimal':
      return ThinkingLevel.MINIMAL;
    case 'low':
      return ThinkingLevel.LOW;
    case 'medium':
      return ThinkingLevel.MEDIUM;
    case 'high':
      return ThinkingLevel.HIGH;
    default:
      return ThinkingLevel.THINKING_LEVEL_UNSPECIFIED;
  }
}

function mapTurnCoverage(turnCoverage: string): TurnCoverage {
  switch (turnCoverage) {
    case 'TURN_INCLUDES_ONLY_ACTIVITY':
      return TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY;
    case 'TURN_INCLUDES_ALL_INPUT':
      return TurnCoverage.TURN_INCLUDES_ALL_INPUT;
    case 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO':
      return TurnCoverage.TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO;
    default:
      return TurnCoverage.TURN_COVERAGE_UNSPECIFIED;
  }
}

function getSdkApiVersion(config: RealtimeSessionConfig): 'v1alpha' | 'v1beta' {
  const modelSettings = config.geminiModelSettings;
  const requiresAlpha =
    modelSettings?.enableAffectiveDialog !== undefined
    || modelSettings?.proactivity !== undefined;

  return requiresAlpha ? 'v1alpha' : 'v1beta';
}

function buildLiveConfig(config: RealtimeSessionConfig): LiveConnectConfig {
  const liveConfig: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
  const modelSettings = config.geminiModelSettings;

  if (config.voice) {
    liveConfig.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: config.voice,
        },
      },
    };
  }

  if (config.systemPrompt) {
    liveConfig.systemInstruction = config.systemPrompt;
  }

  if (modelSettings?.thinkingConfig) {
    liveConfig.thinkingConfig = {};

    if (modelSettings.thinkingConfig.includeThoughts !== undefined) {
      liveConfig.thinkingConfig.includeThoughts = modelSettings.thinkingConfig.includeThoughts;
    }

    if (modelSettings.thinkingConfig.thinkingBudget !== undefined) {
      liveConfig.thinkingConfig.thinkingBudget = modelSettings.thinkingConfig.thinkingBudget;
    }

    if (modelSettings.thinkingConfig.thinkingLevel !== undefined) {
      liveConfig.thinkingConfig.thinkingLevel =
        mapThinkingLevel(modelSettings.thinkingConfig.thinkingLevel);
    }
  }

  if (modelSettings?.enableAffectiveDialog !== undefined) {
    liveConfig.enableAffectiveDialog = modelSettings.enableAffectiveDialog;
  }

  if (modelSettings?.proactivity) {
    liveConfig.proactivity = modelSettings.proactivity;
  }

  if (modelSettings?.realtimeInputConfig) {
    liveConfig.realtimeInputConfig = {
      turnCoverage: mapTurnCoverage(modelSettings.realtimeInputConfig.turnCoverage),
    };
  }

  return liveConfig;
}

function extractGoAwayEvent(goAway: Record<string, unknown>): RealtimeEvent {
  return createErrorEvent('Gemini Live API requested session shutdown', {
    source: 'gemini-sdk',
    timeLeft: typeof goAway.timeLeft === 'string' ? goAway.timeLeft : undefined,
  });
}

function emitServerContent(
  serverContent: Record<string, unknown>,
  onEvent: (event: RealtimeEvent) => void,
  transcriptBuffer?: GeminiTranscriptBuffer,
): void {
  const inputTranscription = isRecord(serverContent.inputTranscription)
    ? serverContent.inputTranscription
    : null;
  if (typeof inputTranscription?.text === 'string' && inputTranscription.text) {
    if (transcriptBuffer) {
      transcriptBuffer.add('user', inputTranscription.text);
    } else {
      onEvent(createTranscriptEvent('user', inputTranscription.text));
    }
  }

  const outputTranscription = isRecord(serverContent.outputTranscription)
    ? serverContent.outputTranscription
    : null;
  if (typeof outputTranscription?.text === 'string' && outputTranscription.text) {
    if (transcriptBuffer) {
      transcriptBuffer.flush('user');
      transcriptBuffer.add('assistant', outputTranscription.text);
    } else {
      onEvent(createTranscriptEvent('assistant', outputTranscription.text));
    }
  }

  const modelTurn = isRecord(serverContent.modelTurn) ? serverContent.modelTurn : null;
  const parts = Array.isArray(modelTurn?.parts) ? modelTurn.parts : [];

  for (const part of parts) {
    if (!isRecord(part)) {
      continue;
    }

    const inlineData = isRecord(part.inlineData) ? part.inlineData : null;
    if (typeof inlineData?.data === 'string' && inlineData.data) {
      transcriptBuffer?.flush('user');
      onEvent(createAudioEvent(
        inlineData.data,
        typeof inlineData.mimeType === 'string' ? inlineData.mimeType : undefined,
      ));
      continue;
    }

    if (!outputTranscription && typeof part.text === 'string' && part.text) {
      if (transcriptBuffer) {
        transcriptBuffer.flush('user');
        transcriptBuffer.add('assistant', part.text);
      } else {
        onEvent(createTranscriptEvent(
          'assistant',
          part.text,
          typeof serverContent.turnComplete === 'boolean' ? serverContent.turnComplete : true,
        ));
      }
    }
  }

  if (transcriptBuffer && serverContent.turnComplete === true) {
    transcriptBuffer.flush('assistant');
  }
}

class GeminiSdkRealtimeSession implements IRealtimeSession {
  private closePromise: Promise<void> | null = null;
  private closed = false;

  constructor(
    private readonly session: Session,
    private readonly waitForClose: () => Promise<void>,
    private readonly suppressRemoteSessionEnd: () => void,
  ) {}

  sendAudio(chunk: Buffer): void {
    if (this.closed) {
      throw new Error('Gemini SDK realtime session is not open');
    }

    this.session.sendRealtimeInput({
      audio: {
        data: chunk.toString('base64'),
        mimeType: GEMINI_AUDIO_MIME_TYPE,
      },
    });
  }

  async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.closed = true;
    this.suppressRemoteSessionEnd();

    this.closePromise = this.waitForClose();

    try {
      this.session.sendRealtimeInput({ audioStreamEnd: true });
    } catch {
      // Best effort flush before shutdown.
    }

    this.session.close();

    return this.closePromise;
  }
}

export class GeminiSdkRealtimeProvider implements IRealtimeProvider {
  readonly id = 'gemini-realtime-sdk';
  readonly name = 'Gemini Realtime SDK';

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

  async getVoices(model?: string): Promise<IVoice[]> {
    const supportedModels = model ? [model] : [];
    return buildGeminiVoices(supportedModels);
  }

  async createSession(
    config: RealtimeSessionConfig,
    onEvent: (event: RealtimeEvent) => void,
  ): Promise<IRealtimeSession> {
    const apiVersion = getSdkApiVersion(config);
    const ai = new GoogleGenAI({
      apiKey: this.apiKey,
      httpOptions: { apiVersion },
    });
    const transcriptBuffer = config.geminiTranscriptMode === 'final'
      ? new GeminiTranscriptBuffer(onEvent)
      : undefined;

    let sdkSession: Session | null = null;
    let startupSettled = false;
    let pendingSetupComplete = false;
    let remoteSessionEndEnabled = true;
    let resolveClose: (() => void) | null = null;
    let closeTimeout: ReturnType<typeof setTimeout> | null = null;

    const waitForClose = (): Promise<void> => new Promise((resolve) => {
      resolveClose = () => {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
        resolve();
      };

      closeTimeout = setTimeout(() => {
        resolveClose?.();
      }, SESSION_CLOSE_TIMEOUT_MS);
    });

    const finishClose = (): void => {
      resolveClose?.();
    };

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

      const resolveWhenReady = (): void => {
        if (!sdkSession) {
          pendingSetupComplete = true;
          return;
        }

        settleStartup(
          'resolve',
          new GeminiSdkRealtimeSession(
            sdkSession,
            waitForClose,
            suppressRemoteSessionEnd,
          ),
        );
      };

      void ai.live.connect({
        model: normalizeModelName(config.model),
        config: buildLiveConfig(config),
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (message.setupComplete) {
              resolveWhenReady();
              return;
            }

            if (message.serverContent) {
              emitServerContent(
                message.serverContent as unknown as Record<string, unknown>,
                onEvent,
                transcriptBuffer,
              );
              return;
            }

            if (message.goAway) {
              transcriptBuffer?.flushAll();
              onEvent(extractGoAwayEvent(message.goAway as unknown as Record<string, unknown>));
            }
          },
          onerror: (error) => {
            transcriptBuffer?.flushAll();
            const message = getErrorMessage(error, 'Gemini SDK realtime websocket error');
            onEvent(createErrorEvent(message, {
              apiVersion,
              source: 'gemini-sdk',
            }));

            if (!startupSettled) {
              settleStartup('reject', new Error(`${message} (Gemini SDK API ${apiVersion})`));
            }
          },
          onclose: (event) => {
            transcriptBuffer?.flushAll();
            finishClose();

            const code = typeof event.code === 'number' ? event.code : undefined;
            const reason = typeof event.reason === 'string' ? event.reason : '';

            if (!startupSettled) {
              settleStartup(
                'reject',
                new Error(
                  reason
                    ? `${reason} (Gemini SDK API ${apiVersion})`
                    : `Gemini SDK websocket closed before session was ready (${code ?? 'unknown'}, Gemini API ${apiVersion})`,
                ),
              );
              return;
            }

            if (remoteSessionEndEnabled) {
              onEvent({
                type: 'session_end',
                data: {
                  code,
                  reason,
                },
              });
            }
          },
        },
      }).then((session) => {
        sdkSession = session;

        if (pendingSetupComplete) {
          resolveWhenReady();
        }
      }).catch((error: unknown) => {
        const message = getErrorMessage(error, 'Failed to create Gemini SDK realtime session');
        settleStartup('reject', new Error(`${message} (Gemini SDK API ${apiVersion})`));
      });
    });
  }
}
