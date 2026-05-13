import OpenAI from 'openai';
import { logger } from './lib/logger';

const EMBEDDING_TIMEOUT_MS = parseInt(process.env.EMBEDDING_TIMEOUT_MS || '10000', 10);
const EMBEDDING_MAX_RETRIES = parseInt(process.env.EMBEDDING_MAX_RETRIES || '2', 10);

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  provider: 'self_hosted';
}

function getProviderConfig(): { apiKey: string; baseURL: string } | null {
  const baseURL = process.env.EMBEDDING_BASE_URL?.trim();
  if (!baseURL) {
    return null;
  }

  return {
    apiKey: process.env.EMBEDDING_API_KEY?.trim() || '',
    baseURL,
  };
}

function resolveEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL?.trim() || 'granite-embedding-97m-multilingual-r2';
}

export class EmbeddingClient {
  private client: OpenAI | null = null;
  private readonly endpoint = getProviderConfig();

  private getClient(): OpenAI | null {
    if (!this.endpoint) {
      return null;
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.endpoint.apiKey,
        baseURL: this.endpoint.baseURL,
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
    if (!client) {
      return null;
    }

    try {
      const modelId = resolveEmbeddingModel();
      const response = await client.embeddings.create({
        model: modelId,
        input,
        encoding_format: 'float',
      });

      const vector = response.data[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        logger.warn('Embedding provider returned no vector');
        return null;
      }

      return {
        vector,
        model: response.model ?? modelId,
        dimensions: vector.length,
        provider: 'self_hosted',
      };
    } catch (error) {
      logger.warn('Semantic embedding generation degraded', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return null;
    }
  }
}

export const embeddingClient = new EmbeddingClient();
