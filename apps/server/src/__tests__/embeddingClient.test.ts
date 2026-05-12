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
    delete process.env.EMBEDDING_BASE_URL;
    delete process.env.EMBEDDING_API_KEY;
    delete process.env.EMBEDDING_TIMEOUT_MS;
    delete process.env.EMBEDDING_MAX_RETRIES;
  });

  it('creates a client from EMBEDDING_BASE_URL', async () => {
    process.env.EMBEDDING_BASE_URL = 'http://localhost:8000/v1';
    process.env.EMBEDDING_API_KEY = 'sk-local';
    embeddingsCreateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
      model: 'granite-embedding-97m-multilingual-r2',
    });

    const { EmbeddingClient } = await import('../embeddingClient');
    const client = new EmbeddingClient();
    const result = await client.embed('hello');

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-local',
        baseURL: 'http://localhost:8000/v1',
        timeout: 10000,
        maxRetries: 2,
      }),
    );
    expect(result?.provider).toBe('self_hosted');
    expect(result?.vector).toEqual([0.1, 0.2, 0.3]);
  });

  it('accepts empty API key for self-hosted endpoints without auth', async () => {
    process.env.EMBEDDING_BASE_URL = 'http://localhost:8000/v1';
    embeddingsCreateMock.mockResolvedValue({
      data: [{ embedding: [0.42] }],
      model: 'granite-embedding-97m-multilingual-r2',
    });

    const { EmbeddingClient } = await import('../embeddingClient');
    const client = new EmbeddingClient();
    const result = await client.embed('hello');

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: '',
        baseURL: 'http://localhost:8000/v1',
      }),
    );
    expect(result?.provider).toBe('self_hosted');
    expect(result?.vector).toEqual([0.42]);
  });

  it('supports timeout and retry overrides from env', async () => {
    process.env.EMBEDDING_BASE_URL = 'http://localhost:8000/v1';
    process.env.EMBEDDING_TIMEOUT_MS = '2500';
    process.env.EMBEDDING_MAX_RETRIES = '1';
    embeddingsCreateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
      model: 'granite-embedding-97m-multilingual-r2',
    });

    const { EmbeddingClient } = await import('../embeddingClient');
    const client = new EmbeddingClient();
    await client.embed('hello');

    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://localhost:8000/v1',
        timeout: 2500,
        maxRetries: 1,
      }),
    );
  });

  it('returns null when EMBEDDING_BASE_URL is not set', async () => {
    const { EmbeddingClient } = await import('../embeddingClient');
    const client = new EmbeddingClient();
    const result = await client.embed('hello');
    expect(result).toBeNull();
    expect(embeddingsCreateMock).not.toHaveBeenCalled();
  });
});
