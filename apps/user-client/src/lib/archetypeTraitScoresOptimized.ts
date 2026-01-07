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

import type { TraitScores } from "./archetypeTraitScores";

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
  
  // 开心柯基: V6.9提高匹配率（3.3%→8%）
  "开心柯基": {
    affinity: 60,
    openness: 55,
    conscientiousness: 42,
    emotionalStability: 55,
    extraversion: 85,       // V6.9: 进一步降低门槛
    positivity: 82,         // V6.9: 进一步降低门槛
  },
  
  // 太阳鸡: V6.9降低门槛（3.9%→6%）
  "太阳鸡": {
    affinity: 82,
    openness: 35,
    conscientiousness: 92,  // V6.9: 略降低
    emotionalStability: 95,
    extraversion: 85,       // V6.9: 降低门槛
    positivity: 88,
  },
  
  // 夸夸豚: V6.9提高匹配率（2.2%→8%）
  "夸夸豚": {
    affinity: 88,           // V6.9: 降低门槛
    openness: 42,
    conscientiousness: 42,
    emotionalStability: 58,
    extraversion: 72,       // V6.9: 降低门槛
    positivity: 90,         // V6.9: 降低门槛
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
  
  // 淡定海豚: V6.9区分策略 - 强调A/O，提高门槛
  "淡定海豚": {
    affinity: 78,           // V6.9: 更极端A
    openness: 62,           // V6.9: 更极端O
    conscientiousness: 85,
    emotionalStability: 88,
    extraversion: 28,       // V6.9: 更低X
    positivity: 72,
  },
  
  // 织网蛛: V6.9提高门槛（降低17%→8%）
  "织网蛛": {
    affinity: 98,           // V6.9: 极致
    openness: 100,          // 保持极致
    conscientiousness: 42,  // V6.9: 降低
    emotionalStability: 38, // V6.9: 更极端
    extraversion: 60,       // V6.9: 提高
    positivity: 48,
  },
  
  // 暖心熊: V6.9降低门槛（3.3%→6%）
  "暖心熊": {
    affinity: 85,           // V6.9: 略降低
    openness: 48,
    conscientiousness: 55,
    emotionalStability: 78,
    extraversion: 35,
    positivity: 82,
  },
  
  // 灵感章鱼: V6.9适应O覆盖增加
  "灵感章鱼": {
    affinity: 50,
    openness: 92,           // V6.9: 提高O门槛
    conscientiousness: 42,
    emotionalStability: 42,
    extraversion: 48,
    positivity: 62,
  },

  // ========== 低能量区 (V6.7恢复) ==========
  
  // 沉思猫头鹰: V6.9适应O覆盖增加
  "沉思猫头鹰": {
    affinity: 44,
    openness: 85,           // V6.9: 提高O门槛
    conscientiousness: 72,
    emotionalStability: 68,
    extraversion: 32,
    positivity: 48,
  },
  
  // 定心大象: V6.9区分策略 - 强调C/X维度
  "定心大象": {
    affinity: 48,           // V6.9: 降低A（与淡定海豚区分）
    openness: 35,           // V6.9: 降低O
    conscientiousness: 95,  // V6.9: 极致C
    emotionalStability: 92,
    extraversion: 38,       // V6.9: 提高X（决断协调）
    positivity: 55,
  },

  // ========== 超低能量区 (V6.7恢复) ==========
  
  // 稳如龟: V6.9提高门槛（降低14%→8%）
  "稳如龟": {
    affinity: 48,
    openness: 45,           // V6.9: 降低
    conscientiousness: 78,  // V6.9: 提高
    emotionalStability: 92, // V6.9: 更极端
    extraversion: 22,       // V6.9: 更极端
    positivity: 38,
  },
  
  // 隐身猫: 提高门槛（V6.5调整）
  "隐身猫": {
    affinity: 45,
    openness: 38,           // V6.5: 更极端
    conscientiousness: 48,
    emotionalStability: 78, // V6.5: 更极端
    extraversion: 18,       // V6.5: 更极端
    positivity: 42,
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
