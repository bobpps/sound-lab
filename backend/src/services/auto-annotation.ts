import type { IDatabase } from '../db/interfaces.js';
import type { ILLMProvider, ILLMMessage } from '../providers/llm/types.js';
import type { AnnotatedDialogWithMessages } from '../db/types.js';

export type AutoAnnotateErrorCode =
  | 'DIALOG_NOT_FOUND'
  | 'PROMPT_NOT_FOUND'
  | 'EMPTY_DIALOG'
  | 'TTS_PROVIDER_NOT_FOUND'
  | 'PROMPT_PROVIDER_MISMATCH';

export class AutoAnnotateError extends Error {
  constructor(public readonly code: AutoAnnotateErrorCode, message: string) {
    super(message);
  }
}

export interface AutoAnnotateParams {
  dialogId: number;
  providerId: string;
  model: string;
  annotationPromptId: number;
  ttsProviderId: string;
  title: string;
}

export interface AutoAnnotateDeps {
  db: IDatabase;
  llmProvider: ILLMProvider;
}

export async function autoAnnotate(
  params: AutoAnnotateParams,
  deps: AutoAnnotateDeps,
): Promise<AnnotatedDialogWithMessages> {
  const { db, llmProvider } = deps;

  const dialog = await db.dialogs.getWithMessages(params.dialogId);
  if (!dialog) throw new AutoAnnotateError('DIALOG_NOT_FOUND', `Dialog ${params.dialogId} not found`);

  const ttsProvider = await db.providers.getById(params.ttsProviderId);
  if (!ttsProvider || ttsProvider.type !== 'tts') {
    throw new AutoAnnotateError('TTS_PROVIDER_NOT_FOUND', `TTS provider ${params.ttsProviderId} not found`);
  }

  const prompt = await db.annotationPrompts.getById(params.annotationPromptId);
  if (!prompt) throw new AutoAnnotateError('PROMPT_NOT_FOUND', `Annotation prompt ${params.annotationPromptId} not found`);

  if (prompt.provider_id !== params.ttsProviderId) {
    throw new AutoAnnotateError(
      'PROMPT_PROVIDER_MISMATCH',
      `Annotation prompt ${params.annotationPromptId} is for provider ${prompt.provider_id}, not ${params.ttsProviderId}`,
    );
  }

  if (dialog.messages.length === 0) throw new AutoAnnotateError('EMPTY_DIALOG', `Dialog ${params.dialogId} has no messages`);

  // Collect all LLM responses first
  const systemMessage: ILLMMessage = { role: 'system', content: prompt.prompt };
  const history: ILLMMessage[] = [];
  const llmResponses: string[] = [];

  for (const message of dialog.messages) {
    const userMessage: ILLMMessage = { role: 'user', content: message.text };
    const messages: ILLMMessage[] = [systemMessage, ...history, userMessage];

    const response = await llmProvider.complete(messages, params.model);
    llmResponses.push(response);

    history.push(userMessage);
    history.push({ role: 'assistant', content: response });
  }

  // Write to DB: create annotated dialog, then messages
  const annotatedDialog = await db.annotations.create({
    dialog_id: params.dialogId,
    provider_id: params.ttsProviderId,
    title: params.title,
  });

  try {
    for (let i = 0; i < dialog.messages.length; i++) {
      await db.annotations.createMessage({
        annotated_dialog_id: annotatedDialog.id,
        dialog_message_id: dialog.messages[i].id,
        text: llmResponses[i],
      });
    }

    const result = await db.annotations.getWithMessages(annotatedDialog.id);
    if (!result) throw new Error('Failed to retrieve created annotation');
    return result;
  } catch (err) {
    await db.annotations.delete(annotatedDialog.id);
    throw err;
  }
}
