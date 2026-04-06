import type { IDatabase } from '../../src/db/interfaces.js';
import type { DialogMessage, DialogWithMessages } from '../../src/db/types.js';
import type { ILLMProvider } from '../../src/providers/llm/types.js';
import { editDialog, DialogNotFoundError, LLMResponseError } from '../../src/services/dialog-editing.js';
import { createDatabase } from '../../src/db/factory.js';

const DIALOG: DialogWithMessages = {
  id: 1,
  title: 'Test Dialog',
  description: null,
  language: 'en',
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  messages: [
    { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hello there' },
    { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?' },
  ],
};

function makeLLMResponse(messages: { order: number; character: number; text: string }[]): string {
  return JSON.stringify({ messages });
}

function createMocks() {
  const getWithMessages = vi.fn<(id: number) => Promise<DialogWithMessages | null>>();
  const updateMessage = vi.fn<(id: number, data: { text?: string }) => Promise<DialogMessage>>();

  const db = {
    dialogs: { getWithMessages, updateMessage },
    async transaction<T>(fn: () => Promise<T>): Promise<T> { return fn(); },
  } as unknown as IDatabase;

  const complete = vi.fn<() => Promise<string>>();
  const llmProvider = {
    id: 'test-provider',
    name: 'Test Provider',
    complete,
  } as unknown as ILLMProvider;

  return { db, llmProvider, getWithMessages, updateMessage, complete };
}

describe('editDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates only changed messages and returns refreshed dialog', async () => {
    const { db, llmProvider, getWithMessages, updateMessage, complete } = createMocks();

    const updatedDialog: DialogWithMessages = {
      ...DIALOG,
      messages: [
        { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hello there' },
        { id: 11, dialog_id: 1, order: 2, character: 2, text: 'I am doing great!' },
      ],
    };

    // First call: fetch original; second call: return updated
    getWithMessages.mockResolvedValueOnce(DIALOG);
    getWithMessages.mockResolvedValueOnce(updatedDialog);
    updateMessage.mockResolvedValueOnce(updatedDialog.messages[1]);

    complete.mockResolvedValueOnce(
      makeLLMResponse([
        { order: 1, character: 1, text: 'Hello there' },
        { order: 2, character: 2, text: 'I am doing great!' },
      ]),
    );

    const result = await editDialog({
      dialogId: 1,
      llmProvider,
      instructions: 'Make it friendlier',
      model: 'test-model',
      db,
    });

    expect(getWithMessages).toHaveBeenCalledTimes(2);
    expect(getWithMessages).toHaveBeenCalledWith(1);
    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(updateMessage).toHaveBeenCalledWith(11, { text: 'I am doing great!' });
    expect(result).toEqual(updatedDialog);
  });

  it('throws when dialog is not found', async () => {
    const { db, llmProvider, getWithMessages } = createMocks();
    getWithMessages.mockResolvedValueOnce(null);

    await expect(
      editDialog({
        dialogId: 999,
        llmProvider,
        instructions: 'Edit it',
        model: 'test-model',
        db,
      }),
    ).rejects.toThrow(DialogNotFoundError);
  });

  it('throws when LLM returns wrong message count', async () => {
    const { db, llmProvider, getWithMessages, complete } = createMocks();
    getWithMessages.mockResolvedValueOnce(DIALOG);

    complete.mockResolvedValueOnce(
      makeLLMResponse([
        { order: 1, character: 1, text: 'Hello there' },
      ]),
    );

    await expect(
      editDialog({
        dialogId: 1,
        llmProvider,
        instructions: 'Edit it',
        model: 'test-model',
        db,
      }),
    ).rejects.toThrow(LLMResponseError);
  });

  it('throws when LLM returns mismatched character values', async () => {
    const { db, llmProvider, getWithMessages, complete } = createMocks();
    getWithMessages.mockResolvedValueOnce(DIALOG);

    // character 2 where original has character 1
    complete.mockResolvedValueOnce(
      makeLLMResponse([
        { order: 1, character: 2, text: 'Hello there' },
        { order: 2, character: 2, text: 'Hi, how are you?' },
      ]),
    );

    await expect(
      editDialog({
        dialogId: 1,
        llmProvider,
        instructions: 'Edit it',
        model: 'test-model',
        db,
      }),
    ).rejects.toThrow(LLMResponseError);
  });

  it('throws when LLM returns invalid JSON', async () => {
    const { db, llmProvider, getWithMessages, complete } = createMocks();
    getWithMessages.mockResolvedValueOnce(DIALOG);

    complete.mockResolvedValueOnce(
      'this is not valid json at all',
    );

    await expect(
      editDialog({
        dialogId: 1,
        llmProvider,
        instructions: 'Edit it',
        model: 'test-model',
        db,
      }),
    ).rejects.toThrow(LLMResponseError);
  });

  it('does not call updateMessage when nothing changed', async () => {
    const { db, llmProvider, getWithMessages, updateMessage, complete } = createMocks();

    getWithMessages.mockResolvedValueOnce(DIALOG);
    getWithMessages.mockResolvedValueOnce(DIALOG);

    // LLM returns exact same texts
    complete.mockResolvedValueOnce(
      makeLLMResponse([
        { order: 1, character: 1, text: 'Hello there' },
        { order: 2, character: 2, text: 'Hi, how are you?' },
      ]),
    );

    const result = await editDialog({
      dialogId: 1,
      llmProvider,
      instructions: 'Edit it',
      model: 'test-model',
      db,
    });

    expect(updateMessage).not.toHaveBeenCalled();
    expect(result).toEqual(DIALOG);
  });

  it('parses JSON preceded by conversational text', async () => {
    const { db, llmProvider, getWithMessages, updateMessage, complete } = createMocks();

    const updatedDialog: DialogWithMessages = {
      ...DIALOG,
      messages: [
        { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hey!' },
        { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?' },
      ],
    };

    getWithMessages.mockResolvedValueOnce(DIALOG);
    getWithMessages.mockResolvedValueOnce(updatedDialog);
    updateMessage.mockResolvedValueOnce(updatedDialog.messages[0]);

    const jsonBody = makeLLMResponse([
      { order: 1, character: 1, text: 'Hey!' },
      { order: 2, character: 2, text: 'Hi, how are you?' },
    ]);

    complete.mockResolvedValueOnce(
      'Here is the edited dialog:\n```json\n' + jsonBody + '\n```',
    );

    const result = await editDialog({
      dialogId: 1,
      llmProvider,
      instructions: 'Make it casual',
      model: 'test-model',
      db,
    });

    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual(updatedDialog);
  });

  it('parses JSON from code fence with CRLF line endings', async () => {
    const { db, llmProvider, getWithMessages, updateMessage, complete } = createMocks();

    const updatedDialog: DialogWithMessages = {
      ...DIALOG,
      messages: [
        { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hey!' },
        { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?' },
      ],
    };

    getWithMessages.mockResolvedValueOnce(DIALOG);
    getWithMessages.mockResolvedValueOnce(updatedDialog);
    updateMessage.mockResolvedValueOnce(updatedDialog.messages[0]);

    const jsonBody = makeLLMResponse([
      { order: 1, character: 1, text: 'Hey!' },
      { order: 2, character: 2, text: 'Hi, how are you?' },
    ]);

    complete.mockResolvedValueOnce(
      '```json\r\n' + jsonBody + '\r\n```',
    );

    const result = await editDialog({
      dialogId: 1,
      llmProvider,
      instructions: 'Make it casual',
      model: 'test-model',
      db,
    });

    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual(updatedDialog);
  });

  it('parses bare JSON embedded in conversational text without code fences', async () => {
    const { db, llmProvider, getWithMessages, updateMessage, complete } = createMocks();

    const updatedDialog: DialogWithMessages = {
      ...DIALOG,
      messages: [
        { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hey!' },
        { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?' },
      ],
    };

    getWithMessages.mockResolvedValueOnce(DIALOG);
    getWithMessages.mockResolvedValueOnce(updatedDialog);
    updateMessage.mockResolvedValueOnce(updatedDialog.messages[0]);

    const jsonBody = makeLLMResponse([
      { order: 1, character: 1, text: 'Hey!' },
      { order: 2, character: 2, text: 'Hi, how are you?' },
    ]);

    complete.mockResolvedValueOnce(
      'Sure! Here is the result: ' + jsonBody + '\n\nLet me know if you need more changes.',
    );

    const result = await editDialog({
      dialogId: 1,
      llmProvider,
      instructions: 'Make it casual',
      model: 'test-model',
      db,
    });

    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual(updatedDialog);
  });

  it('rolls back all updates if one fails mid-loop', async () => {
    const { db, llmProvider, getWithMessages, updateMessage, complete } = createMocks();

    getWithMessages.mockResolvedValueOnce(DIALOG);

    complete.mockResolvedValueOnce(
      makeLLMResponse([
        { order: 1, character: 1, text: 'Changed 1' },
        { order: 2, character: 2, text: 'Changed 2' },
      ]),
    );

    // First updateMessage succeeds, second fails
    updateMessage.mockResolvedValueOnce({ id: 10, dialog_id: 1, order: 1, character: 1, text: 'Changed 1' });
    updateMessage.mockRejectedValueOnce(new Error('DB write failed'));

    await expect(
      editDialog({
        dialogId: 1,
        llmProvider,
        instructions: 'Change both',
        model: 'test-model',
        db,
      }),
    ).rejects.toThrow('DB write failed');

    // Both updateMessage calls were attempted but the transaction should have rolled back
    expect(updateMessage).toHaveBeenCalledTimes(2);
  });

  it('strips markdown code fences from LLM response', async () => {
    const { db, llmProvider, getWithMessages, updateMessage, complete } = createMocks();

    const updatedDialog: DialogWithMessages = {
      ...DIALOG,
      messages: [
        { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hey!' },
        { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?' },
      ],
    };

    getWithMessages.mockResolvedValueOnce(DIALOG);
    getWithMessages.mockResolvedValueOnce(updatedDialog);
    updateMessage.mockResolvedValueOnce(updatedDialog.messages[0]);

    const jsonBody = makeLLMResponse([
      { order: 1, character: 1, text: 'Hey!' },
      { order: 2, character: 2, text: 'Hi, how are you?' },
    ]);

    complete.mockResolvedValueOnce(
      '```json\n' + jsonBody + '\n```',
    );

    const result = await editDialog({
      dialogId: 1,
      llmProvider,
      instructions: 'Make it casual',
      model: 'test-model',
      db,
    });

    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(updateMessage).toHaveBeenCalledWith(10, { text: 'Hey!' });
    expect(result).toEqual(updatedDialog);
  });
});

describe('editDialog integration (real SQLite)', () => {
  let realDb: IDatabase;

  beforeEach(async () => {
    realDb = await createDatabase({ provider: 'local', local: { path: ':memory:' }, encryptionKey: 'test-key-32-chars-long-enough!!' });
  });

  afterEach(async () => {
    await realDb.close();
  });

  it('rolls back all message updates when one fails mid-transaction', async () => {
    // Seed a dialog with 3 messages
    const dialog = await realDb.dialogs.create({ title: 'Test', language: 'en' });
    await realDb.dialogs.createMessage({ dialog_id: dialog.id, order: 1, character: 1, text: 'Original 1' });
    await realDb.dialogs.createMessage({ dialog_id: dialog.id, order: 2, character: 2, text: 'Original 2' });
    await realDb.dialogs.createMessage({ dialog_id: dialog.id, order: 3, character: 1, text: 'Original 3' });

    // Mock LLM that returns edited messages
    let callCount = 0;
    const mockLlm: ILLMProvider = {
      id: 'test',
      name: 'Test',
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        messages: [
          { order: 1, character: 1, text: 'Changed 1' },
          { order: 2, character: 2, text: 'Changed 2' },
          { order: 3, character: 1, text: 'Changed 3' },
        ],
      })),
      getModels: vi.fn(),
      validateCredentials: vi.fn(),
    } as unknown as ILLMProvider;

    // Wrap the real db to make the second updateMessage call throw
    const originalUpdateMessage = realDb.dialogs.updateMessage.bind(realDb.dialogs);
    realDb.dialogs.updateMessage = async (id: number, data: { text?: string }) => {
      callCount++;
      if (callCount === 2) throw new Error('Simulated DB failure');
      return originalUpdateMessage(id, data);
    };

    await expect(
      editDialog({
        dialogId: dialog.id,
        llmProvider: mockLlm,
        instructions: 'Change everything',
        model: 'test-model',
        db: realDb,
      }),
    ).rejects.toThrow('Simulated DB failure');

    // Verify that NO messages were changed (transaction rolled back)
    const afterFail = await realDb.dialogs.getWithMessages(dialog.id);
    expect(afterFail!.messages[0].text).toBe('Original 1');
    expect(afterFail!.messages[1].text).toBe('Original 2');
    expect(afterFail!.messages[2].text).toBe('Original 3');
  });
});
