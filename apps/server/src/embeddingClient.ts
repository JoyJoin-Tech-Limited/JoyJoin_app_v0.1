import OpenAI from 'openai';
import { logger } from './lib/logger';

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  provider: 'openai' | 'deepseek';
}

type ProviderConfig =
  | { provider: 'openai'; apiKey: string; baseURL?: string }
  | { provider: 'deepseek'; apiKey: string; baseURL: string }
  | null;

function getProviderConfig(): ProviderConfig {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
    };
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return {
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    };
  }

  return null;
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
      const response = await client.embeddings.create({
        model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
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
        model: response.model ?? (process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'),
        dimensions: vector.length,
        provider: this.providerConfig.provider,
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
