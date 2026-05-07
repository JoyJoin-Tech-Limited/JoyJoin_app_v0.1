import { describe, it, expect } from 'vitest';
import { resolveTierDisplay, resolveTierDisplayEn, type TierMachineId } from '../socialIcebreakerTierManifest';

const defaultFlags = { glowVariant: 'standard' as const };

describe('socialIcebreakerTierManifest', () => {
  describe('resolveTierDisplay', () => {
    it('returns Chinese display for breeze', () => {
      expect(resolveTierDisplay('breeze', defaultFlags)).toBe('破冰局');
    });

    it('returns Chinese display for glow', () => {
      expect(resolveTierDisplay('glow', defaultFlags)).toBe('畅聊局');
    });

    it('returns Chinese display for blaze', () => {
      expect(resolveTierDisplay('blaze', defaultFlags)).toBe('狂欢局');
    });
  });

  describe('resolveTierDisplayEn', () => {
    it('returns English display for breeze', () => {
      expect(resolveTierDisplayEn('breeze')).toBe('Breeze');
    });

    it('returns English display for glow', () => {
      expect(resolveTierDisplayEn('glow')).toBe('Glow');
    });

    it('returns English display for blaze', () => {
      expect(resolveTierDisplayEn('blaze')).toBe('Blaze');
    });
  });
});
