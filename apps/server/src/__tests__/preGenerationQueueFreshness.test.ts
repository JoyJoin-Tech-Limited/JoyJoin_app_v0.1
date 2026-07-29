import { describe, expect, it } from 'vitest';
import { isPreGenerationJobFresh } from '../jobs/preGenerationQueue';

describe('pre-generation running-job freshness', () => {
  const now = Date.parse('2026-07-29T12:00:00.000Z');

  it('keeps a recently updated running job in flight', () => {
    expect(isPreGenerationJobFresh(new Date(now - 10_000), now)).toBe(true);
  });

  it('lets on-demand generation recover from a stale running job', () => {
    expect(isPreGenerationJobFresh(new Date(now - 60_000), now)).toBe(false);
    expect(isPreGenerationJobFresh(new Date('invalid'), now)).toBe(false);
  });
});
