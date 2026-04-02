import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  openAIConstructorMock,
  embeddingsCreateMock,
} = vi.hoisted(() => ({
  openAIConstructorMock: vi.fn(),
  embeddingsCreateMock: vi.fn(),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function MockOpenAI(this: any, options: unknown) {
    openAIConstructorMock(options);
    this.embeddings = {
      create: embeddingsCreateMock,
    };
  }),
}));

describe('EmbeddingClient', () => {
  beforeEach(() => {
    vi.resetModules();
    openAIConstructorMock.mockReset();
    embeddingsCreateMock.mockReset();
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.EMBEDDING_TIMEOUT_MS;
    delete process.env.EMBEDDING_MAX_RETRIES;
  });

  it('creates a bounded OpenAI client with timeout and retries', async () => {
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    embeddingsCreateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
      model: 'text-embedding-3-small',
    });

    const { EmbeddingClient } = await import('../embeddingClient');
    const client = new EmbeddingClient();
    await client.embed('hello');

    expect(openAIConstructorMock).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'sk-openai-test',
      timeout: 10000,
      maxRetries: 2,
    }));
  });

  it('supports timeout and retry overrides from env', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-deepseek-test';
    process.env.EMBEDDING_TIMEOUT_MS = '2500';
    process.env.EMBEDDING_MAX_RETRIES = '1';
    embeddingsCreateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
      model: 'text-embedding-3-small',
    });

    const { EmbeddingClient } = await import('../embeddingClient');
    const client = new EmbeddingClient();
    await client.embed('hello');

    expect(openAIConstructorMock).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'sk-deepseek-test',
      baseURL: 'https://api.deepseek.com',
      timeout: 2500,
      maxRetries: 1,
    }));
  });
});
