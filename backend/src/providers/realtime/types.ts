import type { IVoice } from '../tts/types.js';

export interface RealtimeSessionConfig {
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
