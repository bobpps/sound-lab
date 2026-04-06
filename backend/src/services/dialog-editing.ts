import type { IDatabase } from '../db/interfaces.js';
import type { DialogWithMessages } from '../db/types.js';
import type { ILLMProvider, ILLMMessage } from '../providers/llm/types.js';

export class DialogNotFoundError extends Error {
  constructor(dialogId: number) {
    super(`Dialog ${dialogId} not found`);
    this.name = 'DialogNotFoundError';
  }
}

export class LLMResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMResponseError';
  }
}

export interface EditDialogParams {
  dialogId: number;
  llmProvider: ILLMProvider;
  instructions: string;
  model: string;
  db: IDatabase;
}

interface LLMResponseMessage {
  order: number;
  character: 1 | 2;
  text: string;
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();

  // Try to find JSON inside a code fence (anywhere in the text, CRLF-safe)
  const fenceMatch = trimmed.match(/```(?:\w*)\r?\n([\s\S]*?)\r?\n```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find the outermost { ... } block (handles preamble/postamble text)
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function parseLLMResponse(raw: string): LLMResponseMessage[] {
  const cleaned = extractJson(raw.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new LLMResponseError('Failed to parse JSON from LLM response');
  }

  const obj = parsed as { messages?: unknown };
  if (!obj || !Array.isArray(obj.messages)) {
    throw new LLMResponseError('Failed to parse JSON: missing messages array');
  }

  for (const m of obj.messages) {
    const msg = m as Record<string, unknown>;
    if (typeof msg.order !== 'number' || typeof msg.character !== 'number' || typeof msg.text !== 'string') {
      throw new LLMResponseError('Failed to parse JSON: invalid message shape in LLM response');
    }
  }

  return obj.messages as LLMResponseMessage[];
}

export async function editDialog(params: EditDialogParams): Promise<DialogWithMessages> {
  const { dialogId, llmProvider, instructions, model, db } = params;

  const dialog = await db.dialogs.getWithMessages(dialogId);
  if (!dialog) {
    throw new DialogNotFoundError(dialogId);
  }

  const systemPrompt = [
    'You are a dialog editor. You will receive a dialog as JSON and instructions for how to edit it.',
    'Return the edited dialog in the same JSON format: { "messages": [{ "order": number, "character": number, "text": string }] }',
    'Keep the same number of messages and the same character assignments. Only change the text fields as instructed.',
  ].join('\n');

  const userPrompt = [
    'Dialog:',
    JSON.stringify({
      messages: dialog.messages.map((m) => ({
        order: m.order,
        character: m.character,
        text: m.text,
      })),
    }),
    '',
    `Instructions: ${instructions}`,
  ].join('\n');

  const messages: ILLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const rawResponse = await llmProvider.complete(messages, model);
  const editedMessages = parseLLMResponse(rawResponse);

  if (editedMessages.length !== dialog.messages.length) {
    throw new LLMResponseError(
      `Message count mismatch: expected ${dialog.messages.length}, got ${editedMessages.length}`,
    );
  }

  for (let i = 0; i < dialog.messages.length; i++) {
    if (editedMessages[i].order !== dialog.messages[i].order) {
      throw new LLMResponseError(
        `Order mismatch at message ${i + 1}: expected ${dialog.messages[i].order}, got ${editedMessages[i].order}`,
      );
    }
    if (editedMessages[i].character !== dialog.messages[i].character) {
      throw new LLMResponseError(
        `Character mismatch at message ${i + 1}: expected ${dialog.messages[i].character}, got ${editedMessages[i].character}`,
      );
    }
  }

  await db.transaction(async () => {
    for (let i = 0; i < dialog.messages.length; i++) {
      const original = dialog.messages[i];
      const edited = editedMessages[i];
      if (edited.text !== original.text) {
        await db.dialogs.updateMessage(original.id, { text: edited.text });
      }
    }
  });

  const updated = await db.dialogs.getWithMessages(dialogId);
  return updated!;
}
