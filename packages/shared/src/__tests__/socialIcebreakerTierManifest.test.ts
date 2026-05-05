import { describe, it, expect } from 'vitest';
import { resolveLegacyTier } from '../socialIcebreakerTierManifest';

describe('socialIcebreakerTierManifest', () => {
  describe('resolveLegacyTier', () => {
    it('resolves legacy standard to glow', () => {
      expect(resolveLegacyTier('standard')).toBe('glow');
    });

    it('resolves legacy premium to blaze', () => {
      expect(resolveLegacyTier('premium')).toBe('blaze');
    });

    it('resolves legacy bar to breeze', () => {
      expect(resolveLegacyTier('bar')).toBe('breeze');
    });

    it('returns breeze for undefined input', () => {
      expect(resolveLegacyTier(undefined)).toBe('breeze');
    });

    it('returns breeze for unknown strings', () => {
      expect(resolveLegacyTier('unknown')).toBe('breeze');
      expect(resolveLegacyTier('')).toBe('breeze');
    });

    it('passes through canonical tier IDs unchanged', () => {
      expect(resolveLegacyTier('breeze')).toBe('breeze');
      expect(resolveLegacyTier('glow')).toBe('glow');
      expect(resolveLegacyTier('blaze')).toBe('blaze');
    });
  });
});
