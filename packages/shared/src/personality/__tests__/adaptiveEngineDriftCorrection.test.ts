import { describe, expect, it } from 'vitest';
import { applyMeasurementDriftCorrections } from '../adaptiveEngine';
import type { ArchetypeMatch, TraitKey } from '../types';

const baseTraits: Record<TraitKey, number> = {
  A: 50,
  C: 50,
  E: 50,
  O: 50,
  X: 50,
  P: 50,
};

function matches(...archetypes: string[]): ArchetypeMatch[] {
  return archetypes.map((archetype, index) => ({
    archetype,
    score: 90 - index * 10,
    confidence: 0.9 - index * 0.1,
  }));
}

describe('applyMeasurementDriftCorrections', () => {
  it('waits until enough questions have been answered', () => {
    const corrected = applyMeasurementDriftCorrections(
      { ...baseTraits, C: 63, O: 50, P: 79 },
      matches('corgi', 'rooster', 'hamster_praise'),
      8
    );

    expect(corrected[0].archetype).toBe('corgi');
  });

  it('promotes rooster when corgi wins from high-X drift but C/P remain rooster-like', () => {
    const corrected = applyMeasurementDriftCorrections(
      { ...baseTraits, C: 63, O: 50, X: 90, P: 79 },
      matches('corgi', 'rooster', 'hamster_praise'),
      14
    );

    expect(corrected[0].archetype).toBe('rooster');
    expect(corrected[0].score).toBeGreaterThanOrEqual(90);
  });

  it('promotes koala when dolphin wins despite high A/E/O/P warmth signals', () => {
    const corrected = applyMeasurementDriftCorrections(
      { ...baseTraits, A: 88, E: 83, O: 80, P: 70 },
      matches('dolphin_calm', 'spider', 'koala'),
      15
    );

    expect(corrected[0].archetype).toBe('koala');
  });

  it('promotes octopus when fox wins from inflated X but A/O/C indicate creative drift', () => {
    const corrected = applyMeasurementDriftCorrections(
      { ...baseTraits, A: 54, C: 47, O: 90, X: 89, P: 78 },
      matches('fox', 'octopus', 'corgi'),
      14
    );

    expect(corrected[0].archetype).toBe('octopus');
  });

  it('does not rewrite a low-affinity fox signature into octopus', () => {
    const corrected = applyMeasurementDriftCorrections(
      { ...baseTraits, A: 39, C: 41, O: 92, X: 69, P: 66 },
      matches('fox', 'octopus', 'corgi'),
      20
    );

    expect(corrected[0].archetype).toBe('fox');
  });
});
