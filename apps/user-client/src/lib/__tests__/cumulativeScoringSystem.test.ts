import { describe, it, expect } from 'vitest';
import { 
  accumulateTraitScores, 
  evaluatePersonality,
} from '../cumulativeScoringSystem';
import { personalityQuestionsV2, TraitScores } from '../../data/personalityQuestionsV2';

const SCORE_RANGE = {
  A: { min: -4, max: 30 },
  O: { min: -3, max: 35 },
  C: { min: 0, max: 30 },
  E: { min: 0, max: 28 },
  X: { min: -15, max: 38 },
};

const P_INTEGRATION = { X: 0.25, O: 0.35, A: 0.4 };

function getEffectiveScore(trait: keyof typeof SCORE_RANGE, ts: TraitScores): number {
  const base = ts[trait] || 0;
  const pContrib = ts.P || 0;
  if (trait === 'A') return base + pContrib * P_INTEGRATION.A;
  if (trait === 'O') return base + pContrib * P_INTEGRATION.O;
  if (trait === 'X') return base + pContrib * P_INTEGRATION.X;
  return base;
}

describe('Cumulative Scoring System', () => {
  describe('SCORE_RANGE validation', () => {
    it('should calculate correct per-dimension maximums from question bank', () => {
      const dimensions: (keyof typeof SCORE_RANGE)[] = ['A', 'O', 'C', 'E', 'X'];
      
      dimensions.forEach(dim => {
        const maxAnswers = personalityQuestionsV2.map(q => {
          let bestOption = q.options[0].traitScores;
          let bestScore = getEffectiveScore(dim, bestOption);
          
          q.options.forEach(opt => {
            const score = getEffectiveScore(dim, opt.traitScores);
            if (score > bestScore) {
              bestScore = score;
              bestOption = opt.traitScores;
            }
          });
          return bestOption;
        });

        const accumulated = accumulateTraitScores(maxAnswers);
        expect(accumulated[dim]).toBeLessThanOrEqual(SCORE_RANGE[dim].max);
      });
    });

    it('should never exceed SCORE_RANGE maximums for high-sum answer combination', () => {
      const maxAnswers: TraitScores[] = personalityQuestionsV2.map(q => {
        let bestOption = q.options[0].traitScores;
        q.options.forEach(opt => {
          const sumCurrent = (opt.traitScores.A || 0) + (opt.traitScores.O || 0) + (opt.traitScores.C || 0) + 
                            (opt.traitScores.E || 0) + (opt.traitScores.X || 0) + (opt.traitScores.P || 0);
          const sumBest = (bestOption.A || 0) + (bestOption.O || 0) + (bestOption.C || 0) + 
                         (bestOption.E || 0) + (bestOption.X || 0) + (bestOption.P || 0);
          if (sumCurrent > sumBest) bestOption = opt.traitScores;
        });
        return bestOption;
      });

      const accumulated = accumulateTraitScores(maxAnswers);
      
      expect(accumulated.A).toBeLessThanOrEqual(30);
      expect(accumulated.O).toBeLessThanOrEqual(35);
      expect(accumulated.C).toBeLessThanOrEqual(30);
      expect(accumulated.E).toBeLessThanOrEqual(28);
      expect(accumulated.X).toBeLessThanOrEqual(38);
    });

    it('should handle randomized answer combinations within bounds', () => {
      for (let trial = 0; trial < 20; trial++) {
        const randomAnswers = personalityQuestionsV2.map(q => {
          const idx = Math.floor(Math.random() * q.options.length);
          return q.options[idx].traitScores;
        });

        const result = evaluatePersonality(randomAnswers);
        
        expect(result.normalizedScores.affinity).toBeLessThanOrEqual(100);
        expect(result.normalizedScores.affinity).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScores.openness).toBeLessThanOrEqual(100);
        expect(result.normalizedScores.openness).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScores.conscientiousness).toBeLessThanOrEqual(100);
        expect(result.normalizedScores.conscientiousness).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScores.emotionalStability).toBeLessThanOrEqual(100);
        expect(result.normalizedScores.emotionalStability).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScores.extraversion).toBeLessThanOrEqual(100);
        expect(result.normalizedScores.extraversion).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('evaluatePersonality normalization', () => {
    it('should never return normalized values above 100', () => {
      const testCases = [
        personalityQuestionsV2.map(q => q.options[0].traitScores),
        personalityQuestionsV2.map(q => q.options[q.options.length - 1].traitScores),
        personalityQuestionsV2.map(q => q.options[Math.floor(q.options.length / 2)].traitScores),
      ];

      testCases.forEach((answers) => {
        const result = evaluatePersonality(answers);
        
        expect(result.normalizedScores.affinity).toBeLessThanOrEqual(100);
        expect(result.normalizedScores.openness).toBeLessThanOrEqual(100);
        expect(result.normalizedScores.conscientiousness).toBeLessThanOrEqual(100);
        expect(result.normalizedScores.emotionalStability).toBeLessThanOrEqual(100);
        expect(result.normalizedScores.extraversion).toBeLessThanOrEqual(100);
        
        expect(result.normalizedScores.affinity).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScores.openness).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScores.conscientiousness).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScores.emotionalStability).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScores.extraversion).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return valid archetype matches', () => {
      const answers = personalityQuestionsV2.map(q => q.options[0].traitScores);
      const result = evaluatePersonality(answers);

      expect(result.primaryMatch).toBeDefined();
      expect(result.primaryMatch.archetype).toBeTruthy();
      expect(result.primaryMatch.similarity).toBeGreaterThanOrEqual(0);
      expect(result.primaryMatch.similarity).toBeLessThanOrEqual(1);
      expect(result.primaryMatch.matchPercentage).toBeGreaterThanOrEqual(0);
      expect(result.primaryMatch.matchPercentage).toBeLessThanOrEqual(100);

      expect(result.secondaryMatch).toBeDefined();
      expect(result.secondaryMatch.archetype).not.toBe(result.primaryMatch.archetype);
    });
  });

  describe('P-dimension integration', () => {
    it('should distribute P scores to A, O, X dimensions', () => {
      const answersWithP: TraitScores[] = [{ P: 10, A: 0, O: 0, C: 0, E: 0, X: 0 }];
      const accumulated = accumulateTraitScores(answersWithP);
      
      expect(accumulated.A).toBeCloseTo(4, 5);
      expect(accumulated.O).toBeCloseTo(3.5, 5);
      expect(accumulated.X).toBeCloseTo(2.5, 5);
      expect(accumulated.C).toBe(0);
      expect(accumulated.E).toBe(0);
    });

    it('should preserve small P values without rounding to zero', () => {
      const answersWithSmallP: TraitScores[] = [{ P: 1, A: 0, O: 0, C: 0, E: 0, X: 0 }];
      const accumulated = accumulateTraitScores(answersWithSmallP);
      
      expect(accumulated.A).toBeCloseTo(0.4, 5);
      expect(accumulated.O).toBeCloseTo(0.35, 5);
      expect(accumulated.X).toBeCloseTo(0.25, 5);
    });
  });
});
