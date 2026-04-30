/**
 * MatcherV2 unit tests (M3)
 * Tests the core PrototypeMatcher assignment logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrototypeMatcher, setMatcherDebug } from '../matcherV2';
import { TraitKey } from '../types';

describe('PrototypeMatcher', () => {
  let matcher: PrototypeMatcher;

  beforeEach(() => {
    matcher = new PrototypeMatcher();
    setMatcherDebug(false);
  });

  describe('known-vector assignment', () => {
    it('high-A + high-X + high-P user should match hamster_praise or corgi', () => {
      const userTraits: Record<TraitKey, number> = { A: 90, C: 50, E: 60, O: 60, X: 90, P: 90 };
      const results = matcher.findBestMatches(userTraits, undefined, 3);

      expect(results.length).toBeGreaterThan(0);
      const topMatch = results[0];
      expect(['hamster_praise', 'corgi']).toContain(topMatch.archetype);
      expect(topMatch.score).toBeGreaterThan(60);
    });
  });

  describe('confusion-pair tie-breaker', () => {
    it('high-X user between corgi and koala should strongly favor corgi', () => {
      // corgi: X=95, koala: X=48. High X is the decisive differentiator.
      const userTraits: Record<TraitKey, number> = { A: 70, C: 55, E: 70, O: 60, X: 88, P: 80 };
      const results = matcher.findBestMatches(userTraits, undefined, 3);

      expect(results.length).toBeGreaterThanOrEqual(2);
      const top = results[0];
      const runnerUp = results[1];

      expect(top.archetype).toBe('corgi');
      // The veto gate on koala for high-X users should create a decisive gap
      const koalaResult = results.find(r => r.archetype === 'koala');
      if (koalaResult) {
        expect(top.score - koalaResult.score).toBeGreaterThan(10);
      }
    });
  });

  describe('veto-rule suppression', () => {
    it('high-X + high-P user should have koala severely suppressed', () => {
      const userTraits: Record<TraitKey, number> = { A: 80, C: 60, E: 70, O: 55, X: 80, P: 85 };
      const results = matcher.findBestMatches(userTraits, undefined, 12);

      const koalaResult = results.find(r => r.archetype === 'koala');
      expect(koalaResult).toBeDefined();
      // Koala has X=48; the veto rule penalizes high-X users heavily
      expect(koalaResult!.score).toBeLessThan(50);

      // Ensure koala is not in top 3
      const top3 = results.slice(0, 3).map(r => r.archetype);
      expect(top3).not.toContain('koala');
    });
  });
});
