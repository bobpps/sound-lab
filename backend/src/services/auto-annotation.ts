import type { IDatabase } from '../db/interfaces.js';
import type { ILLMProvider, ILLMMessage } from '../providers/llm/types.js';
import type { AnnotatedDialogWithMessages } from '../db/types.js';

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
  if (!dialog) throw new Error('Dialog not found');

  const prompt = await db.annotationPrompts.getById(params.annotationPromptId);
  if (!prompt) throw new Error('Annotation prompt not found');

  if (dialog.messages.length === 0) throw new Error('Dialog has no messages');

  const annotatedDialog = await db.annotations.create({
    dialog_id: params.dialogId,
    provider_id: params.providerId,
    title: params.title,
  });

  const history: ILLMMessage[] = [];

  for (const message of dialog.messages) {
    const messages: ILLMMessage[] = [
      { role: 'system', content: prompt.prompt },
      ...history,
      { role: 'user', content: message.text },
    ];

    const annotatedText = await llmProvider.complete(messages, params.model);

    history.push(
      { role: 'user', content: message.text },
      { role: 'assistant', content: annotatedText },
    );

    await db.annotations.createMessage({
      annotated_dialog_id: annotatedDialog.id,
      dialog_message_id: message.id,
      text: annotatedText,
    });
  }

  const result = await db.annotations.getWithMessages(annotatedDialog.id);
  return result!;
}
