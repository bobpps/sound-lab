export interface ILLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ILLMProvider {
  readonly id: string;
  readonly name: string;
  getModels(): Promise<string[]>;
  complete(messages: ILLMMessage[], model: string): Promise<string>;
  validateCredentials(): Promise<boolean>;
}
