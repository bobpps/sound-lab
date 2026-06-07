import type { IVoice } from '../tts/types.js';

export type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';
export type GeminiTurnCoverage =
  | 'TURN_INCLUDES_ONLY_ACTIVITY'
  | 'TURN_INCLUDES_ALL_INPUT'
  | 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO';

export interface GeminiRealtimeModelSettings {
  enableAffectiveDialog?: boolean;
  proactivity?: {
    proactiveAudio: boolean;
  };
  realtimeInputConfig?: {
    turnCoverage: GeminiTurnCoverage;
  };
  thinkingConfig?: {
    includeThoughts?: boolean;
    thinkingBudget?: number;
    thinkingLevel?: GeminiThinkingLevel;
  };
}

export interface RealtimeSessionConfig {
  geminiModelSettings?: GeminiRealtimeModelSettings;
  geminiTranscriptMode?: 'live' | 'final';
  language?: string;
  model: string;
  systemPrompt: string;
  voice?: string;
}

export interface RealtimeEvent {
  type: 'transcript' | 'audio' | 'error' | 'session_start' | 'session_end';
  data: unknown;
}

export interface IRealtimeSession {
  sendAudio(chunk: Buffer): void | Promise<void>;
  close(): Promise<void>;
}

export interface IRealtimeProvider {
  readonly id: string;
  readonly name: string;
  getModels(): Promise<string[]>;
  getVoices(model?: string): Promise<IVoice[]>;
  createSession(
    config: RealtimeSessionConfig,
    onEvent: (event: RealtimeEvent) => void,
  ): Promise<IRealtimeSession>;
}
