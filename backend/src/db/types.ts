// --- Provider ---

export type ProviderType = 'tts' | 'llm' | 'realtime';

export interface Provider {
  id: string; // natural key: "elevenlabs", "google", "openai", etc.
  name: string;
  type: ProviderType;
  enabled: boolean;
  created_at: string;
}

export interface CreateProvider {
  id: string;
  name: string;
  type: ProviderType;
}

export interface UpdateProvider {
  name?: string;
  type?: ProviderType;
  enabled?: boolean;
}

// --- Dialog ---

export interface Dialog {
  id: number;
  title: string;
  description: string | null;
  language: string; // BCP 47
  created_by: string | null;
  created_at: string;
}

export interface DialogMessage {
  id: number;
  dialog_id: number;
  order: number;
  character: 1 | 2;
  text: string;
}

export interface DialogWithMessages extends Dialog {
  messages: DialogMessage[];
}

export interface CreateDialog {
  title: string;
  description?: string;
  language: string;
  created_by?: string;
}

export interface UpdateDialog {
  title?: string;
  description?: string;
  language?: string;
}

export interface CreateDialogMessage {
  dialog_id: number;
  order: number;
  character: 1 | 2;
  text: string;
}

export interface UpdateDialogMessage {
  character?: 1 | 2;
  text?: string;
}

// --- Annotated Dialog ---

export interface AnnotatedDialog {
  id: number;
  dialog_id: number;
  provider_id: string;
  title: string;
  created_by: string | null;
  created_at: string;
}

export interface AnnotatedMessage {
  id: number;
  annotated_dialog_id: number;
  dialog_message_id: number;
  text: string;
}

export interface AnnotatedDialogWithMessages extends AnnotatedDialog {
  messages: AnnotatedMessage[];
}

export interface CreateAnnotatedDialog {
  dialog_id: number;
  provider_id: string;
  title: string;
  created_by?: string;
}

export interface CreateAnnotatedMessage {
  annotated_dialog_id: number;
  dialog_message_id: number;
  text: string;
}

export interface UpdateAnnotatedMessage {
  text: string;
}

// --- Annotation Prompt ---

export interface AnnotationPrompt {
  id: number;
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateAnnotationPrompt {
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by?: string;
}

export interface UpdateAnnotationPrompt {
  title?: string;
  provider_id?: string;
  language?: string;
  prompt?: string;
}

// --- Agent Prompt ---

export interface AgentPrompt {
  id: number;
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateAgentPrompt {
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by?: string;
}

export interface UpdateAgentPrompt {
  title?: string;
  provider_id?: string;
  language?: string;
  prompt?: string;
}
