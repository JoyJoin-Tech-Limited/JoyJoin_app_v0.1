/**
 * 12-Archetype Six-Dimensional Trait Scores
 * 每个社交原型对应的六维人格特质评分 (0-100)
 */

export interface TraitScores {
  affinity: number;        // 亲和力：善于与他人建立联系、友好、体贴、关心他人的程度
  openness: number;        // 开放性：好奇心、愿意尝试新事物、富有想象力的程度
  conscientiousness: number; // 尽责性：可靠性、组织性、责任感、谨慎性的程度
  emotionalStability: number; // 情绪稳定：情绪波动小、冷静、抗压能力的程度
  extraversion: number;    // 外向性：社交活跃、精力充沛、喜欢与人互动的程度
  positivity: number;      // 积极性：乐观、热情、充满正能量的程度
}

export const archetypeTraitScores: Record<string, TraitScores> = {
  // 高能量区 (82-95)
  "开心柯基": {
    affinity: 90,
    openness: 80,
    conscientiousness: 65,
    emotionalStability: 80,
    extraversion: 95,
    positivity: 95,
  },
  "太阳鸡": {
    affinity: 90,
    openness: 70,
    conscientiousness: 80,
    emotionalStability: 95,
    extraversion: 85,
    positivity: 95,
  },
  "夸夸豚": {
    affinity: 95,
    openness: 75,
    conscientiousness: 70,
    emotionalStability: 85,
    extraversion: 85,
    positivity: 95,
  },
  "机智狐": {
    affinity: 70,
    openness: 95,
    conscientiousness: 65,
    emotionalStability: 75,
    extraversion: 85,
    positivity: 80,
  },
  
  // 中能量区 (68-75)
  "淡定海豚": {
    affinity: 85,
    openness: 80,
    conscientiousness: 85,
    emotionalStability: 90,
    extraversion: 70,
    positivity: 85,
  },
  "织网蛛": {
    affinity: 90,
    openness: 85,
    conscientiousness: 85,
    emotionalStability: 80,
    extraversion: 70,
    positivity: 75,
  },
  "暖心熊": {
    affinity: 95,
    openness: 75,
    conscientiousness: 80,
    emotionalStability: 90,
    extraversion: 65,
    positivity: 85,
  },
  "灵感章鱼": {
    affinity: 65,
    openness: 95,
    conscientiousness: 60,
    emotionalStability: 65,
    extraversion: 70,
    positivity: 80,
  },
  
  // 低能量区 (52-55)
  "沉思猫头鹰": {
    affinity: 60,
    openness: 90,
    conscientiousness: 90,
    emotionalStability: 85,
    extraversion: 50,
    positivity: 65,
  },
  "定心大象": {
    affinity: 85,
    openness: 65,
    conscientiousness: 95,
    emotionalStability: 95,
    extraversion: 45,
    positivity: 75,
  },
  
  // 超低能量区 (30-38)
  "稳如龟": {
    affinity: 55,
    openness: 80,
    conscientiousness: 90,
    emotionalStability: 90,
    extraversion: 35,
    positivity: 60,
  },
  "隐身猫": {
    affinity: 60,
    openness: 55,
    conscientiousness: 70,
    emotionalStability: 85,
    extraversion: 30,
    positivity: 65,
  },
};

/**
 * 根据archetype名称获取该原型的六维特质分数
 */
export function getTraitScoresForArchetype(archetype: string): TraitScores {
  return (
    archetypeTraitScores[archetype] || {
      affinity: 70,
      openness: 70,
      conscientiousness: 70,
      emotionalStability: 70,
      extraversion: 70,
      positivity: 70,
    }
  );
}

/**
 * 将0-100的分数转换为0-10的雷达图显示范围
 */
export function normalizeScoreTo10(score: number): number {
  return Math.round((score / 100) * 10 * 10) / 10;
}
