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

export const archetypeTraitScoresOptimized: Record<string, TraitScores> = {
  // ========== 高能量区 ==========
  
  // 开心柯基: 极致外向 + 较低责任心 (派对灵魂)
  "开心柯基": {
    affinity: 80,          // 降10: 区分于夸夸豚
    openness: 75,          // 降5
    conscientiousness: 45, // 降20: 核心差异点
    emotionalStability: 70,// 降10
    extraversion: 100,     // 提5: 极致外向
    positivity: 95,
  },
  
  // 太阳鸡: 极致情绪稳定 + 高责任心 (可靠暖阳)
  "太阳鸡": {
    affinity: 85,          // 降5
    openness: 60,          // 降10: 区分于机智狐
    conscientiousness: 90, // 提10: 核心差异点
    emotionalStability: 100,// 提5: 极致稳定
    extraversion: 80,      // 降5
    positivity: 90,        // 降5
  },
  
  // 夸夸豚: 极致亲和 + 较低开放 (赞美大师)
  "夸夸豚": {
    affinity: 100,         // 提5: 极致亲和
    openness: 60,          // 降15: 区分于机智狐
    conscientiousness: 65, // 降5
    emotionalStability: 80,// 降5
    extraversion: 75,      // 降10: 区分于开心柯基
    positivity: 100,       // 提5: 极致积极
  },
  
  // 机智狐: 极致开放 + 较低亲和 (创意先锋)
  "机智狐": {
    affinity: 55,          // 降15: 核心差异点
    openness: 100,         // 提5: 极致开放
    conscientiousness: 50, // 降15: 区分于沉思猫头鹰
    emotionalStability: 65,// 降10
    extraversion: 90,      // 提5
    positivity: 75,        // 降5
  },

  // ========== 中能量区 ==========
  
  // 淡定海豚: 极致责任心 + 情绪稳定 (靠谱队友)
  "淡定海豚": {
    affinity: 75,          // 降10: 区分于暖心熊
    openness: 70,          // 降10: 区分于织网蛛
    conscientiousness: 95, // 提10: 极致责任
    emotionalStability: 95,// 提5
    extraversion: 60,      // 降10
    positivity: 80,        // 降5
  },
  
  // 织网蛛: 高开放 + 高亲和 (人脉编织者)
  "织网蛛": {
    affinity: 90,          // 保持
    openness: 95,          // 提10: 核心差异点
    conscientiousness: 75, // 降10: 区分于淡定海豚
    emotionalStability: 70,// 降10: 区分于淡定海豚
    extraversion: 65,      // 降5
    positivity: 70,        // 降5
  },
  
  // 暖心熊: 极致亲和 + 低外向 (温柔港湾)
  "暖心熊": {
    affinity: 100,         // 提5: 极致亲和
    openness: 65,          // 降10: 区分于织网蛛
    conscientiousness: 70, // 降10
    emotionalStability: 95,// 提5
    extraversion: 50,      // 降15: 核心差异点
    positivity: 90,        // 提5
  },
  
  // 灵感章鱼: 极致开放 + 低责任心 (灵感源泉)
  "灵感章鱼": {
    affinity: 55,          // 降10: 区分于织网蛛
    openness: 100,         // 提5: 极致开放
    conscientiousness: 40, // 降20: 核心差异点
    emotionalStability: 55,// 降10: 区分于机智狐
    extraversion: 65,      // 降5
    positivity: 85,        // 提5
  },

  // ========== 低能量区 ==========
  
  // 沉思猫头鹰: 高责任心 + 高开放 + 低外向 (深度思考者)
  "沉思猫头鹰": {
    affinity: 50,          // 降10: 核心差异点
    openness: 85,          // 降5: 区分于灵感章鱼
    conscientiousness: 95, // 提5: 区分于稳如龟
    emotionalStability: 90,// 提5
    extraversion: 40,      // 降10
    positivity: 55,        // 降10
  },
  
  // 定心大象: 极致责任心+情稳 + 低开放 (稳定基石)
  "定心大象": {
    affinity: 80,          // 降5
    openness: 45,          // 降20: 核心差异点
    conscientiousness: 100,// 提5: 极致责任
    emotionalStability: 100,// 提5: 极致稳定
    extraversion: 40,      // 降5
    positivity: 70,        // 降5
  },

  // ========== 超低能量区 ==========
  
  // 稳如龟: 高情稳 + 低外向 + 中开放 (稳健观察者)
  "稳如龟": {
    affinity: 45,          // 降10: 核心差异点
    openness: 75,          // 降5
    conscientiousness: 85, // 降5: 区分于沉思猫头鹰
    emotionalStability: 95,// 提5
    extraversion: 30,      // 降5
    positivity: 50,        // 降10
  },
  
  // 隐身猫: 低外向 + 低开放 + 高情稳 (安静独行)
  "隐身猫": {
    affinity: 50,          // 降10
    openness: 40,          // 降15: 核心差异点
    conscientiousness: 65, // 降5
    emotionalStability: 90,// 提5
    extraversion: 25,      // 降5: 极致内向
    positivity: 55,        // 降10
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
