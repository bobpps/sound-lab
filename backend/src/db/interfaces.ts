import type {
  Dialog, DialogMessage, DialogWithMessages,
  CreateDialog, UpdateDialog, CreateDialogMessage, UpdateDialogMessage,
  AnnotatedDialog, AnnotatedDialogWithMessages, CreateAnnotatedDialog,
  AnnotatedMessage, CreateAnnotatedMessage, UpdateAnnotatedMessage,
  AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt,
  AgentPrompt, CreateAgentPrompt, UpdateAgentPrompt,
  Provider, CreateProvider, UpdateProvider, ProviderType,
} from './types.js';

export interface IDialogRepository {
  list(): Promise<Dialog[]>;
  getById(id: number): Promise<Dialog | null>;
  getWithMessages(id: number): Promise<DialogWithMessages | null>;
  create(data: CreateDialog): Promise<Dialog>;
  update(id: number, data: UpdateDialog): Promise<Dialog>;
  delete(id: number): Promise<void>;
  createMessage(data: CreateDialogMessage): Promise<DialogMessage>;
  updateMessage(id: number, data: UpdateDialogMessage): Promise<DialogMessage>;
  deleteMessage(id: number): Promise<void>;
}

export interface IAnnotationRepository {
  listByDialog(dialogId: number): Promise<AnnotatedDialog[]>;
  getWithMessages(id: number): Promise<AnnotatedDialogWithMessages | null>;
  create(data: CreateAnnotatedDialog): Promise<AnnotatedDialog>;
  delete(id: number): Promise<void>;
  createMessage(data: CreateAnnotatedMessage): Promise<AnnotatedMessage>;
  updateMessage(id: number, data: UpdateAnnotatedMessage): Promise<AnnotatedMessage>;
  deleteMessage(id: number): Promise<void>;
}

export interface IAnnotationPromptRepository {
  list(): Promise<AnnotationPrompt[]>;
  getById(id: number): Promise<AnnotationPrompt | null>;
  create(data: CreateAnnotationPrompt): Promise<AnnotationPrompt>;
  update(id: number, data: UpdateAnnotationPrompt): Promise<AnnotationPrompt>;
  delete(id: number): Promise<void>;
}

export interface IAgentPromptRepository {
  list(): Promise<AgentPrompt[]>;
  getById(id: number): Promise<AgentPrompt | null>;
  create(data: CreateAgentPrompt): Promise<AgentPrompt>;
  update(id: number, data: UpdateAgentPrompt): Promise<AgentPrompt>;
  delete(id: number): Promise<void>;
}

export interface IProviderRepository {
  list(type?: ProviderType): Promise<Provider[]>;
  getById(id: string): Promise<Provider | null>;
  create(data: CreateProvider): Promise<Provider>;
  update(id: string, data: UpdateProvider): Promise<Provider>;
  delete(id: string): Promise<void>;
  getDecryptedKey(id: string): Promise<string | null>;
  setKey(id: string, key: string): Promise<void>;
}

export interface IDatabase {
  dialogs: IDialogRepository;
  annotations: IAnnotationRepository;
  annotationPrompts: IAnnotationPromptRepository;
  agentPrompts: IAgentPromptRepository;
  providers: IProviderRepository;
  close(): Promise<void>;
}
