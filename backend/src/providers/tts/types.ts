export interface IVoice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  description?: string;
  previewUrl?: string;
  providerMeta?: Record<string, unknown>;
}

export interface ISynthesizeOptions {
  voiceId: string;
  text: string;
  speed?: number;
  temperature?: number;
  format?: string;
  sampleRate?: number;
  model?: string;
}

export interface ITTSProvider {
  readonly id: string;
  readonly name: string;
  getModels(): Promise<string[]>;
  getVoices(model?: string): Promise<IVoice[]>;
  synthesize(opts: ISynthesizeOptions): Promise<Buffer>;
  validateCredentials(): Promise<boolean>;
}
