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
 * 专家优化版原型向量 V6
 * 
 * V6核心改进（基于V3题目优化后的模拟结果）：
 * 1. 降低过热原型（夸夸豚17%→8%, 太阳鸡17%→8%, 织网蛛16%→8%）
 *    - 策略：增加极端维度要求，使匹配门槛更高
 * 2. 提升过冷原型（灵感章鱼1.4%→8%, 机智狐1.2%→8%, 沉思猫头鹰0.7%→8%）
 *    - 策略：向量更接近中心，降低匹配门槛
 * 3. 保持稳定原型（隐身猫12%, 稳如龟7%, 暖心熊6%）
 */
export const archetypeTraitScoresOptimized: Record<string, TraitScores> = {
  // ========== 高能量区（需提高匹配门槛）==========
  
  // 开心柯基: 极致外向 + 极低C（更极端）
  "开心柯基": {
    affinity: 65,
    openness: 60,
    conscientiousness: 30,  // V6: 更低，提高门槛
    emotionalStability: 50,
    extraversion: 100,      // 极致外向
    positivity: 95,
  },
  
  // 太阳鸡: 需要极高C+E+X才能匹配（提高门槛）
  "太阳鸡": {
    affinity: 80,
    openness: 35,           // V6: 更低
    conscientiousness: 100, // V6: 极致
    emotionalStability: 100,// V6: 极致
    extraversion: 85,       // V6: 需要高外向
    positivity: 90,
  },
  
  // 夸夸豚: 极致A+P（提高门槛）
  "夸夸豚": {
    affinity: 100,          // V6: 极致
    openness: 45,           // V6: 降低
    conscientiousness: 40,  // V6: 降低
    emotionalStability: 60,
    extraversion: 72,
    positivity: 100,        // V6: 极致
  },
  
  // 机智狐: 中等门槛（V6.2平衡）
  "机智狐": {
    affinity: 42,
    openness: 80,           // V6.2: 平衡
    conscientiousness: 45,
    emotionalStability: 62,
    extraversion: 78,       // V6.2: 平衡
    positivity: 60,
  },

  // ========== 中能量区 ==========
  
  // 淡定海豚: 保持高C+E，低X
  "淡定海豚": {
    affinity: 55,
    openness: 50,
    conscientiousness: 90,
    emotionalStability: 90,
    extraversion: 35,
    positivity: 65,
  },
  
  // 织网蛛: 需要极致O+A（提高门槛）
  "织网蛛": {
    affinity: 95,           // V6: 极致
    openness: 100,          // V6: 极致
    conscientiousness: 48,
    emotionalStability: 45, // V6: 降低
    extraversion: 55,
    positivity: 55,
  },
  
  // 暖心熊: 保持极致A + 低X
  "暖心熊": {
    affinity: 92,
    openness: 48,
    conscientiousness: 55,
    emotionalStability: 78,
    extraversion: 35,
    positivity: 85,
  },
  
  // 灵感章鱼: 更接近中心（降低门槛）
  "灵感章鱼": {
    affinity: 50,
    openness: 80,           // V6: 从98降低
    conscientiousness: 45,  // V6: 从32提高
    emotionalStability: 45, // V6: 从35提高
    extraversion: 45,       // V6: 更接近中心
    positivity: 65,
  },

  // ========== 低能量区 ==========
  
  // 沉思猫头鹰: 平衡门槛（V6.4最终版）
  "沉思猫头鹰": {
    affinity: 42,
    openness: 68,           // V6.4: 在V6.2(72)和V6.3(58)之间
    conscientiousness: 72,  // V6.4: 在V6.2(78)和V6.3(62)之间
    emotionalStability: 68,
    extraversion: 34,
    positivity: 50,
  },
  
  // 定心大象: 保持极致C+E
  "定心大象": {
    affinity: 52,
    openness: 38,
    conscientiousness: 95,
    emotionalStability: 92,
    extraversion: 30,
    positivity: 52,
  },

  // ========== 超低能量区 ==========
  
  // 稳如龟: 保持现有配置
  "稳如龟": {
    affinity: 48,
    openness: 52,
    conscientiousness: 70,
    emotionalStability: 85,
    extraversion: 28,
    positivity: 42,
  },
  
  // 隐身猫: 保持现有配置
  "隐身猫": {
    affinity: 48,
    openness: 42,
    conscientiousness: 52,
    emotionalStability: 72,
    extraversion: 22,
    positivity: 45,
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
