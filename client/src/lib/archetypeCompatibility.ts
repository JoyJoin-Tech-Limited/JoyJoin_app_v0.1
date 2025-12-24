// Archetype Compatibility Matrix
// 12x12 compatibility scoring based on energy levels and social styles
// Scores range from 0 to 100, where:
// 90-100: Best Matches (complementary personalities)
// 70-89: Good Matches (compatible with some chemistry)
// 50-69: Moderate Matches (can work but may need adjustment)
// 30-49: Challenging Matches (different vibes, requires effort)
// 0-29: Difficult Matches (very different energies)

const archetypes = [
  '开心柯基',   // 0: High energy, warm & extroverted
  '太阳鸡',     // 1: High energy, optimistic & expressive
  '夸夸豚',     // 2: High energy, affirming & supportive
  '机智狐',     // 3: High energy, clever & observant
  '淡定海豚',   // 4: Medium energy, calm & intuitive
  '织网蛛',     // 5: Medium energy, thoughtful & connector
  '暖心熊',     // 6: Medium energy, nurturing & protective
  '灵感章鱼',   // 7: Medium energy, creative & expressive
  '沉思猫头鹰', // 8: Low energy, analytical & thoughtful
  '定心大象',   // 9: Low energy, stable & grounded
  '稳如龟',     // 10: Very low energy, steady & peaceful
  '隐身猫',     // 11: Very low energy, introspective & observant
];

// Compatibility matrix (symmetric)
export const compatibilityMatrix: Record<string, Record<string, number>> = {
  '开心柯基': {
    '开心柯基': 85,
    '太阳鸡': 92,
    '夸夸豚': 88,
    '机智狐': 80,
    '淡定海豚': 70,
    '织网蛛': 72,
    '暖心熊': 75,
    '灵感章鱼': 78,
    '沉思猫头鹰': 55,
    '定心大象': 58,
    '稳如龟': 45,
    '隐身猫': 48,
  },
  '太阳鸡': {
    '开心柯基': 92,
    '太阳鸡': 88,
    '夸夸豚': 85,
    '机智狐': 82,
    '淡定海豚': 72,
    '织网蛛': 70,
    '暖心熊': 78,
    '灵感章鱼': 80,
    '沉思猫头鹰': 58,
    '定心大象': 62,
    '稳如龟': 48,
    '隐身猫': 52,
  },
  '夸夸豚': {
    '开心柯基': 88,
    '太阳鸡': 85,
    '夸夸豚': 86,
    '机智狐': 78,
    '淡定海豚': 74,
    '织网蛛': 76,
    '暖心熊': 82,
    '灵感章鱼': 79,
    '沉思猫头鹰': 60,
    '定心大象': 64,
    '稳如龟': 50,
    '隐身猫': 54,
  },
  '机智狐': {
    '开心柯基': 80,
    '太阳鸡': 82,
    '夸夸豚': 78,
    '机智狐': 84,
    '淡定海豚': 75,
    '织网蛛': 80,
    '暖心熊': 72,
    '灵感章鱼': 82,
    '沉思猫头鹰': 68,
    '定心大象': 65,
    '稳如龟': 52,
    '隐身猫': 60,
  },
  '淡定海豚': {
    '开心柯基': 70,
    '太阳鸡': 72,
    '夸夸豚': 74,
    '机智狐': 75,
    '淡定海豚': 82,
    '织网蛛': 85,
    '暖心熊': 80,
    '灵感章鱼': 84,
    '沉思猫头鹰': 72,
    '定心大象': 75,
    '稳如龟': 65,
    '隐身猫': 70,
  },
  '织网蛛': {
    '开心柯基': 72,
    '太阳鸡': 70,
    '夸夸豚': 76,
    '机智狐': 80,
    '淡定海豚': 85,
    '织网蛛': 80,
    '暖心熊': 82,
    '灵感章鱼': 86,
    '沉思猫头鹰': 75,
    '定心大象': 78,
    '稳如龟': 68,
    '隐身猫': 72,
  },
  '暖心熊': {
    '开心柯基': 75,
    '太阳鸡': 78,
    '夸夸豚': 82,
    '机智狐': 72,
    '淡定海豚': 80,
    '织网蛛': 82,
    '暖心熊': 84,
    '灵感章鱼': 80,
    '沉思猫头鹰': 70,
    '定心大象': 76,
    '稳如龟': 62,
    '隐身猫': 66,
  },
  '灵感章鱼': {
    '开心柯基': 78,
    '太阳鸡': 80,
    '夸夸豚': 79,
    '机智狐': 82,
    '淡定海豚': 84,
    '织网蛛': 86,
    '暖心熊': 80,
    '灵感章鱼': 82,
    '沉思猫头鹰': 74,
    '定心大象': 72,
    '稳如龟': 64,
    '隐身猫': 68,
  },
  '沉思猫头鹰': {
    '开心柯基': 55,
    '太阳鸡': 58,
    '夸夸豚': 60,
    '机智狐': 68,
    '淡定海豚': 72,
    '织网蛛': 75,
    '暖心熊': 70,
    '灵感章鱼': 74,
    '沉思猫头鹰': 80,
    '定心大象': 85,
    '稳如龟': 78,
    '隐身猫': 82,
  },
  '定心大象': {
    '开心柯基': 58,
    '太阳鸡': 62,
    '夸夸豚': 64,
    '机智狐': 65,
    '淡定海豚': 75,
    '织网蛛': 78,
    '暖心熊': 76,
    '灵感章鱼': 72,
    '沉思猫头鹰': 85,
    '定心大象': 82,
    '稳如龟': 80,
    '隐身猫': 84,
  },
  '稳如龟': {
    '开心柯基': 45,
    '太阳鸡': 48,
    '夸夸豚': 50,
    '机智狐': 52,
    '淡定海豚': 65,
    '织网蛛': 68,
    '暖心熊': 62,
    '灵感章鱼': 64,
    '沉思猫头鹰': 78,
    '定心大象': 80,
    '稳如龟': 85,
    '隐身猫': 88,
  },
  '隐身猫': {
    '开心柯基': 48,
    '太阳鸡': 52,
    '夸夸豚': 54,
    '机智狐': 60,
    '淡定海豚': 70,
    '织网蛛': 72,
    '暖心熊': 66,
    '灵感章鱼': 68,
    '沉思猫头鹰': 82,
    '定心大象': 84,
    '稳如龟': 88,
    '隐身猫': 86,
  },
};

export function getArchetypeCompatibility(primaryRole: string, targetRole: string): number {
  return compatibilityMatrix[primaryRole]?.[targetRole] ?? 50;
}

export function getTopCompatibleArchetypes(primaryRole: string, limit: number = 5) {
  const compatibility = compatibilityMatrix[primaryRole];
  if (!compatibility) return [];

  return archetypes
    .filter((arch) => arch !== primaryRole)
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
