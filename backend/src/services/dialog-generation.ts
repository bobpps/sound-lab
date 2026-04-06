import type { ILLMProvider, ILLMMessage } from '../providers/llm/types.js';
import type { IDialogRepository } from '../db/interfaces.js';
import type { DialogWithMessages } from '../db/types.js';

export interface GenerateDialogParams {
  llmProvider: ILLMProvider;
  dialogRepo: IDialogRepository;
  model: string;
  language: string;
  prompt: string;
  messageCount: number;
}

interface LLMDialogMessage {
  character: number;
  text: string;
}

function buildSystemPrompt(language: string, messageCount: number): string {
  return [
    'You are a dialog script writer.',
    `Generate a dialog with exactly ${messageCount} messages between two characters (character 1 and character 2).`,
    `The dialog must be written in the language specified by BCP 47 tag: ${language}.`,
    'Respond ONLY with a JSON array. No markdown, no explanation, no extra text.',
    'Each element must be an object with exactly two fields:',
    '  - "character": either 1 or 2 (integer)',
    '  - "text": the message text (string)',
    '',
    'Example for 2 messages:',
    '[{"character":1,"text":"Hello"},{"character":2,"text":"Hi there"}]',
  ].join('\n');
}

function extractJSON(raw: string): string {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return raw.trim();
}

function parseAndValidate(raw: string): LLMDialogMessage[] {
  const jsonStr = extractJSON(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${jsonStr.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('LLM response is not a JSON array');
  }

  if (parsed.length === 0) {
    throw new Error('LLM returned an empty message array');
  }

  const messages: LLMDialogMessage[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Message at index ${i} is not an object`);
    }
    const { character, text } = item as Record<string, unknown>;
    if (character !== 1 && character !== 2) {
      throw new Error(`Message at index ${i} has invalid character: ${character} (must be 1 or 2)`);
    }
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error(`Message at index ${i} has invalid or empty text`);
    }
    messages.push({ character: character as 1 | 2, text });
  }

  return messages;
}

export async function generateDialog(params: GenerateDialogParams): Promise<DialogWithMessages> {
  const { llmProvider, dialogRepo, model, language, prompt, messageCount } = params;

  const systemPrompt = buildSystemPrompt(language, messageCount);
  const messages: ILLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  const raw = await llmProvider.complete(messages, model);
  const parsedMessages = parseAndValidate(raw);

  // Create dialog — title derived from prompt (truncate if too long)
  const title = prompt.length > 100 ? prompt.slice(0, 97) + '...' : prompt;
  const dialog = await dialogRepo.create({ title, language });

  // Create messages in order
  for (let i = 0; i < parsedMessages.length; i++) {
    await dialogRepo.createMessage({
      dialog_id: dialog.id,
      order: i + 1,
      character: parsedMessages[i].character as 1 | 2,
      text: parsedMessages[i].text,
    });
  }

  // Return full dialog with messages
  const result = await dialogRepo.getWithMessages(dialog.id);
  if (!result) {
    throw new Error('Failed to retrieve created dialog');
  }
  return result;
}
