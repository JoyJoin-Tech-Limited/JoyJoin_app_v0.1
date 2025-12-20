/**
 * 优化版12原型六维特质评分 - A/B测试实验组
 * 
 * 优化目标:
 * 1. 降低原型间相似度（从30对>98%降至<5对）
 * 2. 提高匹配区分边际（从0.48%提升至>2%）
 * 3. 平衡原型分布（开心柯基从18.7%降至~10%）
 * 
 * 调整策略:
 * - 每个原型突出1-2个"极端"维度（接近100或接近30）
 * - 相似原型在不同维度上拉开差距
 * - 保持原型的核心性格特征不变
 */

import type { TraitScores } from './archetypeTraitScores';

/**
 * 专家优化版原型向量 V2
 * 
 * 优化策略（基于数学+心理学分析）：
 * 1. 最大化最小成对余弦距离（目标<0.965）
 * 2. 每个原型突出1-2个"极端"维度（接近100或接近35）
 * 3. 使用外向性vs积极性区分高能量原型
 * 4. 使用责任心vs情绪稳定区分计划者vs守护者
 * 5. 使用开放性vs亲和力区分创意者vs共情者
 * 
 * 验收标准：
 * - 相似度>96.5%的原型对 ≤3对
 * - 原型分布方差 ≤±4%
 * - 低边际匹配(<1%) ≤35%
 * - 各维度跨度 ≥60（积极性≥55）
 */
/**
 * 专家优化版原型向量 V5
 * 
 * V5核心改进：
 * 1. 太阳鸡vs淡定海豚：太阳鸡更高外向(80)，淡定海豚更低外向(42)
 * 2. 定心大象vs隐身猫：定心大象极高C(100)，隐身猫中C(50)
 * 3. 机智狐vs灵感章鱼：机智狐更高X(95)和E(60)，灵感章鱼更低X(52)和E(35)
 * 4. 低能量原型的向量更接近中心，提高匹配率
 */
export const archetypeTraitScoresOptimized: Record<string, TraitScores> = {
  // ========== 高能量区 ==========
  
  // 开心柯基: 极致外向 + 中等偏低C
  "开心柯基": {
    affinity: 70,
    openness: 65,
    conscientiousness: 42,
    emotionalStability: 58,
    extraversion: 100,      // 极致外向
    positivity: 90,
  },
  
  // 太阳鸡: 高C+E，中等X（需要更极端的特征才能匹配）
  "太阳鸡": {
    affinity: 72,
    openness: 45,           // 降低：更专注于稳定而非探索
    conscientiousness: 92,  // 更高门槛
    emotionalStability: 98, // 极致稳定
    extraversion: 72,       // 降低：不需要极高外向
    positivity: 78,
  },
  
  // 夸夸豚: 极致A+P
  "夸夸豚": {
    affinity: 98,
    openness: 55,
    conscientiousness: 52,
    emotionalStability: 68,
    extraversion: 65,
    positivity: 98,
  },
  
  // 机智狐: 高O+X，中等E（比灵感章鱼更稳定更外向）
  "机智狐": {
    affinity: 42,
    openness: 95,
    conscientiousness: 38,
    emotionalStability: 60, // 关键区分：比灵感章鱼高25
    extraversion: 95,       // 关键区分：比灵感章鱼高43
    positivity: 68,
  },

  // ========== 中能量区 ==========
  
  // 淡定海豚: 高C+E，低X（比太阳鸡更内向）
  "淡定海豚": {
    affinity: 62,
    openness: 55,
    conscientiousness: 95,
    emotionalStability: 95,
    extraversion: 42,       // 关键区分：比太阳鸡低38
    positivity: 72,
  },
  
  // 织网蛛: 高O+A
  "织网蛛": {
    affinity: 82,
    openness: 90,
    conscientiousness: 58,
    emotionalStability: 55,
    extraversion: 58,
    positivity: 62,
  },
  
  // 暖心熊: 极致A + 低X
  "暖心熊": {
    affinity: 95,
    openness: 52,
    conscientiousness: 58,
    emotionalStability: 82,
    extraversion: 38,
    positivity: 88,
  },
  
  // 灵感章鱼: 极致O + 低C+E+X（比机智狐更敏感更内向）
  "灵感章鱼": {
    affinity: 52,
    openness: 98,
    conscientiousness: 32,
    emotionalStability: 35, // 关键区分：比机智狐低25
    extraversion: 52,       // 关键区分：比机智狐低43
    positivity: 82,
  },

  // ========== 低能量区 ==========
  
  // 沉思猫头鹰: 高O+C，低X+A
  "沉思猫头鹰": {
    affinity: 40,
    openness: 85,
    conscientiousness: 90,
    emotionalStability: 78,
    extraversion: 32,
    positivity: 52,
  },
  
  // 定心大象: 极致C+E，低O（比隐身猫更高C）
  "定心大象": {
    affinity: 58,
    openness: 35,
    conscientiousness: 100, // 关键区分：比隐身猫高50
    emotionalStability: 95,
    extraversion: 32,
    positivity: 58,
  },

  // ========== 超低能量区（向量更接近中心）==========
  
  // 稳如龟: 高E，中等其他（更接近中心便于匹配）
  "稳如龟": {
    affinity: 48,
    openness: 55,
    conscientiousness: 72,
    emotionalStability: 88,
    extraversion: 28,
    positivity: 45,
  },
  
  // 隐身猫: 低X+O，中等C（比定心大象更低C）
  "隐身猫": {
    affinity: 50,
    openness: 40,
    conscientiousness: 50,  // 关键区分：比定心大象低50
    emotionalStability: 75,
    extraversion: 22,
    positivity: 48,
  },
};

/**
 * A/B测试配置
 */
export type ABTestVariant = 'control' | 'optimized';

let currentVariant: ABTestVariant = 'control';

export function setABTestVariant(variant: ABTestVariant): void {
  currentVariant = variant;
  console.log(`[A/B Test] 切换到${variant === 'control' ? '对照组' : '优化组'}`);
}

export function getABTestVariant(): ABTestVariant {
  return currentVariant;
}
