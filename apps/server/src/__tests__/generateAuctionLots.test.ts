import { describe, it, expect, afterEach } from 'vitest';
import { generateAuctionLots } from '../socialIcebreakerAIService';

describe('generateAuctionLots', () => {
  afterEach(() => {
    delete process.env.SOCIAL_AUCTION_LLM_ENABLED;
  });

  it('returns normalized fallback lots when LLM is disabled', async () => {
    delete process.env.SOCIAL_AUCTION_LLM_ENABLED;
    const result = await generateAuctionLots({ participantCount: 4 });
    expect(result.data.length).toBeGreaterThanOrEqual(2);
    expect(result.data[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
    });
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.promptVersion).toBe('social-auction-lots-v2');
  });
});
