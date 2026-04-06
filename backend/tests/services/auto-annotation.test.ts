import type { IDatabase } from '../../src/db/interfaces.js';
import type { ILLMProvider } from '../../src/providers/llm/types.js';
import type {
  DialogWithMessages,
  AnnotationPrompt,
  AnnotatedDialog,
  AnnotatedMessage,
  AnnotatedDialogWithMessages,
} from '../../src/db/types.js';
import { autoAnnotate } from '../../src/services/auto-annotation.js';

function createMockDb(): IDatabase {
  return {
    dialogs: {
      list: vi.fn(),
      getById: vi.fn(),
      getWithMessages: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMessage: vi.fn(),
      updateMessage: vi.fn(),
      deleteMessage: vi.fn(),
    },
    annotations: {
      listByDialog: vi.fn(),
      getWithMessages: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      createMessage: vi.fn(),
      updateMessage: vi.fn(),
      deleteMessage: vi.fn(),
    },
    annotationPrompts: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    agentPrompts: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    providers: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getDecryptedKey: vi.fn(),
      setKey: vi.fn(),
    },
    close: vi.fn(),
  };
}

function createMockLLMProvider(): ILLMProvider {
  return {
    id: 'test-llm',
    name: 'Test LLM',
    getModels: vi.fn(),
    complete: vi.fn(),
    validateCredentials: vi.fn(),
  };
}

const baseDialog: DialogWithMessages = {
  id: 1,
  title: 'Test Dialog',
  description: null,
  language: 'en',
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  messages: [
    { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hello there' },
    { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?' },
    { id: 12, dialog_id: 1, order: 3, character: 1, text: 'I am fine' },
  ],
};

const basePrompt: AnnotationPrompt = {
  id: 5,
  title: 'Test Prompt',
  provider_id: 'test-llm',
  language: 'en',
  prompt: 'Annotate the following message with SSML tags.',
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
};

const baseParams = {
  dialogId: 1,
  providerId: 'test-llm',
  model: 'test-model',
  annotationPromptId: 5,
  ttsProviderId: 'elevenlabs',
  title: 'Annotated Test Dialog',
};

describe('autoAnnotate', () => {
  let db: IDatabase;
  let llmProvider: ILLMProvider;

  beforeEach(() => {
    db = createMockDb();
    llmProvider = createMockLLMProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls LLM once per message with growing conversation history', async () => {
    (db.dialogs.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue(baseDialog);
    (db.annotationPrompts.getById as ReturnType<typeof vi.fn>).mockResolvedValue(basePrompt);
    (llmProvider.complete as ReturnType<typeof vi.fn>).mockResolvedValue('annotated text');
    (db.annotations.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 100, dialog_id: 1, provider_id: 'test-llm', title: 'Annotated Test Dialog',
      created_by: null, created_at: '2026-01-01T00:00:00Z',
    } satisfies AnnotatedDialog);
    (db.annotations.createMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, annotated_dialog_id: 100, dialog_message_id: 10, text: 'annotated text',
    } satisfies AnnotatedMessage);
    (db.annotations.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 100, dialog_id: 1, provider_id: 'test-llm', title: 'Annotated Test Dialog',
      created_by: null, created_at: '2026-01-01T00:00:00Z', messages: [],
    } satisfies AnnotatedDialogWithMessages);

    await autoAnnotate(baseParams, { db, llmProvider });

    expect(llmProvider.complete).toHaveBeenCalledTimes(3);

    // First call: system + first user message
    const firstCall = (llmProvider.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(firstCall).toHaveLength(2);
    expect(firstCall[0].role).toBe('system');
    expect(firstCall[1].role).toBe('user');

    // Second call: system + first msg + assistant response + second user message
    const secondCall = (llmProvider.complete as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(secondCall).toHaveLength(4);

    // Third call: system + 2 pairs + third user message
    const thirdCall = (llmProvider.complete as ReturnType<typeof vi.fn>).mock.calls[2][0];
    expect(thirdCall).toHaveLength(6);
  });

  it('creates AnnotatedDialog with correct fields', async () => {
    (db.dialogs.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue(baseDialog);
    (db.annotationPrompts.getById as ReturnType<typeof vi.fn>).mockResolvedValue(basePrompt);
    (llmProvider.complete as ReturnType<typeof vi.fn>).mockResolvedValue('annotated');
    (db.annotations.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 100, dialog_id: 1, provider_id: 'test-llm', title: 'Annotated Test Dialog',
      created_by: null, created_at: '2026-01-01T00:00:00Z',
    } satisfies AnnotatedDialog);
    (db.annotations.createMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, annotated_dialog_id: 100, dialog_message_id: 10, text: 'annotated',
    } satisfies AnnotatedMessage);
    (db.annotations.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 100, dialog_id: 1, provider_id: 'test-llm', title: 'Annotated Test Dialog',
      created_by: null, created_at: '2026-01-01T00:00:00Z', messages: [],
    } satisfies AnnotatedDialogWithMessages);

    await autoAnnotate(baseParams, { db, llmProvider });

    expect(db.annotations.create).toHaveBeenCalledWith({
      dialog_id: 1,
      provider_id: 'test-llm',
      title: 'Annotated Test Dialog',
    });
  });

  it('creates AnnotatedMessage for each dialog message', async () => {
    (db.dialogs.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue(baseDialog);
    (db.annotationPrompts.getById as ReturnType<typeof vi.fn>).mockResolvedValue(basePrompt);
    (llmProvider.complete as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('annotated-1')
      .mockResolvedValueOnce('annotated-2')
      .mockResolvedValueOnce('annotated-3');
    (db.annotations.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 100, dialog_id: 1, provider_id: 'test-llm', title: 'Annotated Test Dialog',
      created_by: null, created_at: '2026-01-01T00:00:00Z',
    } satisfies AnnotatedDialog);
    (db.annotations.createMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, annotated_dialog_id: 100, dialog_message_id: 10, text: 'annotated',
    } satisfies AnnotatedMessage);
    (db.annotations.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 100, dialog_id: 1, provider_id: 'test-llm', title: 'Annotated Test Dialog',
      created_by: null, created_at: '2026-01-01T00:00:00Z', messages: [],
    } satisfies AnnotatedDialogWithMessages);

    await autoAnnotate(baseParams, { db, llmProvider });

    expect(db.annotations.createMessage).toHaveBeenCalledTimes(3);
    expect(db.annotations.createMessage).toHaveBeenCalledWith({
      annotated_dialog_id: 100, dialog_message_id: 10, text: 'annotated-1',
    });
    expect(db.annotations.createMessage).toHaveBeenCalledWith({
      annotated_dialog_id: 100, dialog_message_id: 11, text: 'annotated-2',
    });
    expect(db.annotations.createMessage).toHaveBeenCalledWith({
      annotated_dialog_id: 100, dialog_message_id: 12, text: 'annotated-3',
    });
  });

  it('returns AnnotatedDialogWithMessages', async () => {
    const expected: AnnotatedDialogWithMessages = {
      id: 100, dialog_id: 1, provider_id: 'test-llm', title: 'Annotated Test Dialog',
      created_by: null, created_at: '2026-01-01T00:00:00Z',
      messages: [
        { id: 1, annotated_dialog_id: 100, dialog_message_id: 10, text: 'annotated-1' },
        { id: 2, annotated_dialog_id: 100, dialog_message_id: 11, text: 'annotated-2' },
        { id: 3, annotated_dialog_id: 100, dialog_message_id: 12, text: 'annotated-3' },
      ],
    };

    (db.dialogs.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue(baseDialog);
    (db.annotationPrompts.getById as ReturnType<typeof vi.fn>).mockResolvedValue(basePrompt);
    (llmProvider.complete as ReturnType<typeof vi.fn>).mockResolvedValue('annotated');
    (db.annotations.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 100, dialog_id: 1, provider_id: 'test-llm', title: 'Annotated Test Dialog',
      created_by: null, created_at: '2026-01-01T00:00:00Z',
    } satisfies AnnotatedDialog);
    (db.annotations.createMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, annotated_dialog_id: 100, dialog_message_id: 10, text: 'annotated',
    } satisfies AnnotatedMessage);
    (db.annotations.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue(expected);

    const result = await autoAnnotate(baseParams, { db, llmProvider });

    expect(result).toEqual(expected);
  });

  it('throws when dialog not found', async () => {
    (db.dialogs.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(autoAnnotate(baseParams, { db, llmProvider }))
      .rejects.toThrow('Dialog not found');
  });

  it('throws when annotation prompt not found', async () => {
    (db.dialogs.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue(baseDialog);
    (db.annotationPrompts.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(autoAnnotate(baseParams, { db, llmProvider }))
      .rejects.toThrow('Annotation prompt not found');
  });

  it('throws when dialog has no messages', async () => {
    const emptyDialog: DialogWithMessages = { ...baseDialog, messages: [] };
    (db.dialogs.getWithMessages as ReturnType<typeof vi.fn>).mockResolvedValue(emptyDialog);
    (db.annotationPrompts.getById as ReturnType<typeof vi.fn>).mockResolvedValue(basePrompt);

    await expect(autoAnnotate(baseParams, { db, llmProvider }))
      .rejects.toThrow('Dialog has no messages');
  });
});
