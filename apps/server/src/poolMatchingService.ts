
//my path:/Users/felixg/projects/JoyJoin3/server/poolMatchingService.ts
/**
 * Pool-Based Matching Service (池内匹配服务)
 * 两阶段匹配模型 - Stage 2: 用户报名后，在活动池内进行智能分组
 * 
 * 匹配逻辑：
 * 1. 硬约束过滤：检查用户是否符合活动池的硬性限制（性别、行业、年龄等）
 * 2. 软约束评分：基于6个维度计算用户之间的配对兼容性分数
 *    - Chemistry     (性格化学反应):  28%  — 原型兼容性矩阵
 *    - Interest      (兴趣重叠度):    28%  — Heat 加权 Jaccard 相似度
 *    - Social Affinity (社交同频度):  20%  — 人生阶段亲和力 + 学历同频 + 同乡亲和（可选）
 *    - Background Diversity (背景多样性): 15% — 行业多样性 + 性别多样性
 *    - Preference    (活动偏好):       5%  — 社交目的 + 酒局偏好（低权重：场景分化力有限）
 *    - Language      (语言沟通):       4%  — 语言共同覆盖（低权重：普通话普及率高，区分度低）
 * 3. 智能分组：使用贪婪+优化算法形成高质量小组
 */

// ── Extracted matching helpers (behavior-preserving modularization) ─────────
// Every symbol below was previously defined inline in this file. Definitions
// now live in ./matching/* and are re-exported here so the public API of this
// module is unchanged for every importer.
export * from "./matching/chemistryScoring";
export * from "./matching/interestScoring";
export * from "./matching/pairDimensionScoring";
export * from "./matching/strictnessWeights";
export * from "./matching/genderBalance";
export * from "./matching/energyComposition";
export * from "./matching/magnetismRules";
export * from "./matching/compositionGates";
export * from "./matching/poolMatchingTypes";
export * from "./matching/hardConstraints";
export * from "./matching/pairScoring";
export * from "./matching/groupScoring";
export * from "./matching/poolFormation";
export * from "./matching/matchRun";
export * from "./matching/matchPersistence";
