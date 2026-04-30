import type { ConnectionPointWithRarity } from '../types/groupAnalysis';

export interface MatchQuality {
  score: number;
  qualityTier: 'common' | 'rare' | 'epic';
  fillPercentage: number;
  visualBoost: number;
}

const RARITY_WEIGHTS = {
  common: 1,
  rare: 3,
  epic: 6,
};

const RARITY_VISUAL_BOOST = {
  common: 5,
  rare: 10,
  epic: 15,
};

export function calculateMatchQuality(
  connectionPoints: ConnectionPointWithRarity[]
): MatchQuality {
  const score = connectionPoints.reduce(
    (sum, cp) => sum + RARITY_WEIGHTS[cp.rarity],
    0
  );

  const hasEpic = connectionPoints.some((cp) => cp.rarity === 'epic');
  const hasRare = connectionPoints.some((cp) => cp.rarity === 'rare');
  const qualityTier = hasEpic ? 'epic' : hasRare ? 'rare' : 'common';

  const fillPercentage = Math.min((connectionPoints.length / 6) * 100, 100);
  const visualBoost = RARITY_VISUAL_BOOST[qualityTier];

  return { score, qualityTier, fillPercentage, visualBoost };
}

export function mapRarityToEnergyRingProps(
  connectionPoints: ConnectionPointWithRarity[]
) {
  const quality = calculateMatchQuality(connectionPoints);
  return {
    percentage: quality.fillPercentage,
    qualityTier: quality.qualityTier,
    visualBoost: quality.visualBoost,
  };
}
