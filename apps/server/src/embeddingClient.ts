import OpenAI from 'openai';
import { logger } from './lib/logger';

const EMBEDDING_TIMEOUT_MS = parseInt(process.env.EMBEDDING_TIMEOUT_MS || '10000', 10);
const EMBEDDING_MAX_RETRIES = parseInt(process.env.EMBEDDING_MAX_RETRIES || '2', 10);

/**
 * Semantic profile embeddings — OpenAI SDK against **DeepSeek** OpenAI-compatible API only.
 *
 * **Policy:** JoyJoin does not use OpenAI (vendor) for embeddings. Set `DEEPSEEK_API_KEY`.
 * Chat/completion routing uses MiniMax + DeepSeek via `socialModelRouter` / `creativeModelRouter`.
 */
export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  provider: 'deepseek';
}

type ProviderConfig = { provider: 'deepseek'; apiKey: string; baseURL: string } | null;

function getProviderConfig(): ProviderConfig {
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    };
  }

  return null;
}

function resolveEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL?.trim() || 'text-embedding-3-small';
}

export class EmbeddingClient {
  private client: OpenAI | null = null;
  private readonly providerConfig = getProviderConfig();

  private getClient(): OpenAI | null {
    if (!this.providerConfig) {
      return null;
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.providerConfig.apiKey,
        baseURL: this.providerConfig.baseURL,
        timeout: EMBEDDING_TIMEOUT_MS,
        maxRetries: EMBEDDING_MAX_RETRIES,
      });
    }

    return this.client;
  }

  async embed(text: string): Promise<EmbeddingResult | null> {
    const input = text.trim();
    if (!input) {
      return null;
    }

    const client = this.getClient();
    if (!client || !this.providerConfig) {
      return null;
    }

    try {
      const modelId = resolveEmbeddingModel();
      const response = await client.embeddings.create({
        model: modelId,
        input,
      });

      const vector = response.data[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        logger.warn('Embedding provider returned no vector', {
          provider: this.providerConfig.provider,
        });
        return null;
      }

      return {
        vector,
        model: response.model ?? modelId,
        dimensions: vector.length,
        provider: 'deepseek',
      };
    } catch (error) {
      logger.warn('Semantic embedding generation degraded', {
        provider: this.providerConfig.provider,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return null;
    }
  }
}

export const embeddingClient = new EmbeddingClient();
