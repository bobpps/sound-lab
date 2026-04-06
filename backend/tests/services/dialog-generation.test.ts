import type { ILLMProvider, ILLMMessage } from '../../src/providers/llm/types.js';
import type { IDialogRepository } from '../../src/db/interfaces.js';
import type { Dialog, DialogMessage, DialogWithMessages } from '../../src/db/types.js';

function createMockLLMProvider(overrides: Partial<ILLMProvider> = {}): ILLMProvider {
  return {
    id: 'openai',
    name: 'OpenAI',
    getModels: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
    complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>().mockResolvedValue('[]'),
    validateCredentials: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    ...overrides,
  };
}

function createMockDialogRepo(): {
  repo: IDialogRepository;
  mockCreate: ReturnType<typeof vi.fn>;
  mockCreateMessage: ReturnType<typeof vi.fn>;
  mockGetWithMessages: ReturnType<typeof vi.fn>;
} {
  const mockCreate = vi.fn<(data: { title: string; language: string }) => Promise<Dialog>>()
    .mockResolvedValue({
      id: 1,
      title: 'Test dialog',
      description: null,
      language: 'en-US',
      created_by: null,
      created_at: '2026-01-01T00:00:00.000Z',
    });

  const mockCreateMessage = vi.fn<(data: { dialog_id: number; order: number; character: 1 | 2; text: string }) => Promise<DialogMessage>>()
    .mockImplementation(async (data) => ({
      id: Math.floor(Math.random() * 1000),
      dialog_id: data.dialog_id,
      order: data.order,
      character: data.character,
      text: data.text,
    }));

  const mockGetWithMessages = vi.fn<(id: number) => Promise<DialogWithMessages | null>>();

  const repo: IDialogRepository = {
    list: vi.fn(),
    getById: vi.fn(),
    getWithMessages: mockGetWithMessages,
    create: mockCreate,
    update: vi.fn(),
    delete: vi.fn(),
    createMessage: mockCreateMessage,
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
  };

  return { repo, mockCreate, mockCreateMessage, mockGetWithMessages };
}

const VALID_LLM_RESPONSE = JSON.stringify([
  { character: 1, text: 'Hello, tech support?' },
  { character: 2, text: 'Yes, how can I help you today?' },
  { character: 1, text: 'My printer is not working.' },
  { character: 2, text: 'I see. Have you tried turning it off and on again?' },
]);

describe('generateDialog service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls LLM with system prompt and user prompt', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const mockComplete = vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
      .mockResolvedValue(VALID_LLM_RESPONSE);
    const llm = createMockLLMProvider({ complete: mockComplete });
    const { repo, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'en-US',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'A customer calling tech support about a broken printer',
      messageCount: 4,
    });

    expect(mockComplete).toHaveBeenCalledOnce();
    const [messages, model] = mockComplete.mock.calls[0];
    expect(model).toBe('gpt-4o');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('A customer calling tech support about a broken printer');
  });

  it('system prompt specifies JSON format, messageCount, and character constraint', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const mockComplete = vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
      .mockResolvedValue(VALID_LLM_RESPONSE);
    const llm = createMockLLMProvider({ complete: mockComplete });
    const { repo, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'en-US',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Two friends discussing lunch',
      messageCount: 6,
    });

    const systemPrompt = mockComplete.mock.calls[0][0][0].content;
    expect(systemPrompt).toContain('JSON');
    expect(systemPrompt).toContain('character');
    expect(systemPrompt).toContain('text');
    expect(systemPrompt).toMatch(/1|2/);
    expect(systemPrompt).toContain('6');
  });

  it('creates dialog with title derived from prompt and correct language', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(VALID_LLM_RESPONSE),
    });
    const { repo, mockCreate, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'ru-RU',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'ru-RU',
      prompt: 'A customer calling tech support about a broken printer',
      messageCount: 4,
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.language).toBe('ru-RU');
    expect(createArg.title).toBeDefined();
    expect(typeof createArg.title).toBe('string');
    expect(createArg.title.length).toBeGreaterThan(0);
  });

  it('creates messages in order with correct character and text', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const llmResponse = JSON.stringify([
      { character: 1, text: 'Hello there' },
      { character: 2, text: 'Hi, how are you?' },
      { character: 1, text: 'Fine, thanks' },
    ]);
    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(llmResponse),
    });
    const { repo, mockCreateMessage, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'en-US',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Simple greeting',
      messageCount: 3,
    });

    expect(mockCreateMessage).toHaveBeenCalledTimes(3);

    expect(mockCreateMessage).toHaveBeenNthCalledWith(1, {
      dialog_id: 1, order: 1, character: 1, text: 'Hello there',
    });
    expect(mockCreateMessage).toHaveBeenNthCalledWith(2, {
      dialog_id: 1, order: 2, character: 2, text: 'Hi, how are you?',
    });
    expect(mockCreateMessage).toHaveBeenNthCalledWith(3, {
      dialog_id: 1, order: 3, character: 1, text: 'Fine, thanks',
    });
  });

  it('returns DialogWithMessages from getWithMessages', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const expectedResult: DialogWithMessages = {
      id: 1,
      title: 'Generated dialog',
      description: null,
      language: 'en-US',
      created_by: null,
      created_at: '2026-01-01T00:00:00.000Z',
      messages: [
        { id: 10, dialog_id: 1, order: 1, character: 1, text: 'Hello' },
        { id: 11, dialog_id: 1, order: 2, character: 2, text: 'Hi' },
      ],
    };
    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(JSON.stringify([
          { character: 1, text: 'Hello' },
          { character: 2, text: 'Hi' },
        ])),
    });
    const { repo, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue(expectedResult);

    const result = await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Greeting',
      messageCount: 2,
    });

    expect(mockGetWithMessages).toHaveBeenCalledWith(1);
    expect(result).toEqual(expectedResult);
  });

  it('handles LLM response wrapped in markdown code fences', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const fencedResponse = '```json\n[\n  { "character": 1, "text": "Hello" },\n  { "character": 2, "text": "Hi" }\n]\n```';
    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(fencedResponse),
    });
    const { repo, mockCreateMessage, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'en-US',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Greeting',
      messageCount: 2,
    });

    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
    expect(mockCreateMessage).toHaveBeenNthCalledWith(1, {
      dialog_id: 1, order: 1, character: 1, text: 'Hello',
    });
    expect(mockCreateMessage).toHaveBeenNthCalledWith(2, {
      dialog_id: 1, order: 2, character: 2, text: 'Hi',
    });
  });

  it('throws on invalid JSON from LLM', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue('This is not JSON at all'),
    });
    const { repo } = createMockDialogRepo();

    await expect(generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Test',
      messageCount: 4,
    })).rejects.toThrow();
  });

  it('throws when LLM returns items with invalid character values', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const badResponse = JSON.stringify([
      { character: 3, text: 'Hello' },
      { character: 1, text: 'Hi' },
    ]);
    const llm = createMockLLMProvider({
      complete: vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
        .mockResolvedValue(badResponse),
    });
    const { repo } = createMockDialogRepo();

    await expect(generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'en-US',
      prompt: 'Test',
      messageCount: 2,
    })).rejects.toThrow();
  });

  it('system prompt includes the language', async () => {
    const { generateDialog } = await import('../../src/services/dialog-generation.js');

    const mockComplete = vi.fn<(messages: ILLMMessage[], model: string) => Promise<string>>()
      .mockResolvedValue(VALID_LLM_RESPONSE);
    const llm = createMockLLMProvider({ complete: mockComplete });
    const { repo, mockGetWithMessages } = createMockDialogRepo();
    mockGetWithMessages.mockResolvedValue({
      id: 1, title: 'Test', description: null, language: 'ja-JP',
      created_by: null, created_at: '2026-01-01T00:00:00.000Z',
      messages: [],
    });

    await generateDialog({
      llmProvider: llm,
      dialogRepo: repo,
      model: 'gpt-4o',
      language: 'ja-JP',
      prompt: 'A sushi restaurant order',
      messageCount: 4,
    });

    const systemPrompt = mockComplete.mock.calls[0][0][0].content;
    expect(systemPrompt).toContain('ja-JP');
  });
});
