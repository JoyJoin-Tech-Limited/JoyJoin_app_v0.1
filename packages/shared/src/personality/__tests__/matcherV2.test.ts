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
      // P5c (2026-09-14): vector updated to the debiased measured scale — was the
      // old-scale idealized { A: 90, C: 50, E: 60, O: 60, X: 90, P: 90 }, which is
      // unreachable on the recalibrated scale (A saturates ≈44–67 under high X) and
      // now assigns spider. New vector sits inside hamster's measured cluster
      // (hamster centroid { A: 44, C: 40, E: 25, O: 74, X: 97, P: 86 }).
      const userTraits: Record<TraitKey, number> = { A: 50, C: 42, E: 30, O: 72, X: 95, P: 85 };
      const results = matcher.findBestMatches(userTraits, undefined, 3);

      expect(results.length).toBeGreaterThan(0);
      const topMatch = results[0];
      expect(['hamster_praise', 'corgi']).toContain(topMatch.archetype);
      expect(topMatch.score).toBeGreaterThan(60);
    });
  });

  describe('confusion-pair tie-breaker', () => {
    it('high-X user between corgi and koala should strongly favor corgi', () => {
      // P5c (2026-09-14): vector updated to the debiased measured scale — was
      // { A: 70, C: 55, E: 70, O: 60, X: 88, P: 80 } (old scale; now assigns spider).
      // New vector sits inside corgi's measured cluster (centroid
      // { A: 35, C: 35, E: 24, O: 78, X: 98, P: 88 }); X remains the decisive
      // differentiator (corgi X=98, koala X=54).
      const userTraits: Record<TraitKey, number> = { A: 40, C: 38, E: 30, O: 75, X: 93, P: 84 };
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
