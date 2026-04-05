// Read-model types mirroring backend entities.
// Create/Update types live in feature-specific directories (YAGNI).

// --- Provider ---

export type ProviderType = 'tts' | 'llm' | 'realtime';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  created_at: string;
}

// --- Dialog ---

export interface Dialog {
  id: number;
  title: string;
  description: string | null;
  language: string;
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

// --- Voice ---

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  description?: string;
  previewUrl?: string;
  providerMeta?: Record<string, unknown>;
}

// --- API Error Response ---

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}
