// Archetype Compatibility Matrix
// 12x12 compatibility scoring based on energy levels and social styles
// Scores range from 0 to 100, where:
// 90-100: Best Matches (complementary personalities)
// 70-89: Good Matches (compatible with some chemistry)
// 50-69: Moderate Matches (can work but may need adjustment)
// 30-49: Challenging Matches (different vibes, requires effort)
// 0-29: Difficult Matches (very different energies)

const archetypes = [
  'corgi',   // 0: High energy, warm & extroverted
  'rooster',     // 1: High energy, optimistic & expressive
  'hamster_praise',     // 2: High energy, affirming & supportive
  'fox',     // 3: High energy, clever & observant
  'dolphin_calm',   // 4: Medium energy, calm & intuitive
  'spider',     // 5: Medium energy, thoughtful & connector
  'koala',     // 6: Medium energy, nurturing & protective
  'octopus',   // 7: Medium energy, creative & expressive
  'owl', // 8: Low energy, analytical & thoughtful
  'elephant',   // 9: Low energy, stable & grounded
  'turtle',     // 10: Very low energy, steady & peaceful
  'cat',     // 11: Very low energy, introspective & observant
];

// Compatibility matrix (symmetric)
export const compatibilityMatrix: Record<string, Record<string, number>> = {
  'corgi': {
    'corgi': 85,
    'rooster': 92,
    'hamster_praise': 88,
    'fox': 80,
    'dolphin_calm': 70,
    'spider': 72,
    'koala': 75,
    'octopus': 78,
    'owl': 55,
    'elephant': 58,
    'turtle': 45,
    'cat': 48,
  },
  'rooster': {
    'corgi': 92,
    'rooster': 88,
    'hamster_praise': 85,
    'fox': 82,
    'dolphin_calm': 72,
    'spider': 70,
    'koala': 78,
    'octopus': 80,
    'owl': 58,
    'elephant': 62,
    'turtle': 48,
    'cat': 52,
  },
  'hamster_praise': {
    'corgi': 88,
    'rooster': 85,
    'hamster_praise': 86,
    'fox': 78,
    'dolphin_calm': 74,
    'spider': 76,
    'koala': 82,
    'octopus': 79,
    'owl': 60,
    'elephant': 64,
    'turtle': 50,
    'cat': 54,
  },
  'fox': {
    'corgi': 80,
    'rooster': 82,
    'hamster_praise': 78,
    'fox': 84,
    'dolphin_calm': 75,
    'spider': 80,
    'koala': 72,
    'octopus': 82,
    'owl': 68,
    'elephant': 65,
    'turtle': 52,
    'cat': 60,
  },
  'dolphin_calm': {
    'corgi': 70,
    'rooster': 72,
    'hamster_praise': 74,
    'fox': 75,
    'dolphin_calm': 82,
    'spider': 85,
    'koala': 80,
    'octopus': 84,
    'owl': 72,
    'elephant': 75,
    'turtle': 65,
    'cat': 70,
  },
  'spider': {
    'corgi': 72,
    'rooster': 70,
    'hamster_praise': 76,
    'fox': 80,
    'dolphin_calm': 85,
    'spider': 80,
    'koala': 82,
    'octopus': 86,
    'owl': 75,
    'elephant': 78,
    'turtle': 68,
    'cat': 72,
  },
  'koala': {
    'corgi': 75,
    'rooster': 78,
    'hamster_praise': 82,
    'fox': 72,
    'dolphin_calm': 80,
    'spider': 82,
    'koala': 84,
    'octopus': 80,
    'owl': 70,
    'elephant': 76,
    'turtle': 62,
    'cat': 66,
  },
  'octopus': {
    'corgi': 78,
    'rooster': 80,
    'hamster_praise': 79,
    'fox': 82,
    'dolphin_calm': 84,
    'spider': 86,
    'koala': 80,
    'octopus': 82,
    'owl': 74,
    'elephant': 72,
    'turtle': 64,
    'cat': 68,
  },
  'owl': {
    'corgi': 55,
    'rooster': 58,
    'hamster_praise': 60,
    'fox': 68,
    'dolphin_calm': 72,
    'spider': 75,
    'koala': 70,
    'octopus': 74,
    'owl': 80,
    'elephant': 85,
    'turtle': 78,
    'cat': 82,
  },
  'elephant': {
    'corgi': 58,
    'rooster': 62,
    'hamster_praise': 64,
    'fox': 65,
    'dolphin_calm': 75,
    'spider': 78,
    'koala': 76,
    'octopus': 72,
    'owl': 85,
    'elephant': 82,
    'turtle': 80,
    'cat': 84,
  },
  'turtle': {
    'corgi': 45,
    'rooster': 48,
    'hamster_praise': 50,
    'fox': 52,
    'dolphin_calm': 65,
    'spider': 68,
    'koala': 62,
    'octopus': 64,
    'owl': 78,
    'elephant': 80,
    'turtle': 85,
    'cat': 88,
  },
  'cat': {
    'corgi': 48,
    'rooster': 52,
    'hamster_praise': 54,
    'fox': 60,
    'dolphin_calm': 70,
    'spider': 72,
    'koala': 66,
    'octopus': 68,
    'owl': 82,
    'elephant': 84,
    'turtle': 88,
    'cat': 86,
  },
};

export function getArchetypeCompatibility(primaryArchetype: string, targetArchetype: string): number {
  return compatibilityMatrix[primaryArchetype]?.[targetArchetype] ?? 50;
}

export function getTopCompatibleArchetypes(primaryArchetype: string, limit: number = 5) {
  const compatibility = compatibilityMatrix[primaryArchetype];
  if (!compatibility) return [];

  return archetypes
    .filter((arch) => arch !== primaryArchetype)
    .map((arch) => ({
      archetype: arch,
      score: compatibility[arch],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getCompatibilityCategory(score: number): string {
  if (score >= 90) return '最佳搭档';
  if (score >= 70) return '好搭档';
  if (score >= 50) return '可搭档';
  if (score >= 30) return '需要磨合';
  return '差异较大';
}
