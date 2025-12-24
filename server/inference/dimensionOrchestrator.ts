/**
 * 维度编排器 - 统一调度6维度对话引导系统
 * 
 * 职责：
 * 1. 根据模式（极速/标准/深度）决定维度覆盖范围
 * 2. 追踪维度完成进度，决定下一个问题
 * 3. 将6维度映射到L1/L2字段
 * 4. 生成动态prompt注入内容
 */

import {
  DIMENSION_ORDER,
  DIMENSION_NAMES,
  GUIDANCE_QUESTIONS,
  createConversationTracker,
  type InsightDimension,
  type GuidanceQuestion,
  type ConversationTracker,
  type DimensionCoverage
} from './dialogGuidanceSystem';

import {
  L1_FIELDS,
  L2_FIELDS,
  type TierFieldConfig
} from './informationTiers';

// ============ 模式配置 ============

export type RegistrationMode = 'express' | 'standard' | 'deep';

export interface ModeConfig {
  mode: RegistrationMode;
  requiredDimensions: InsightDimension[];
  optionalDimensions: InsightDimension[];
  maxQuestionsPerDimension: number;
  followUpBudget: number;
  skipLowPriority: boolean;
}

export const MODE_CONFIGS: Record<RegistrationMode, ModeConfig> = {
  express: {
    mode: 'express',
    requiredDimensions: ['interest', 'career'],
    optionalDimensions: ['lifestyle'],
    maxQuestionsPerDimension: 1,
    followUpBudget: 1,
    skipLowPriority: true
  },
  standard: {
    mode: 'standard',
    requiredDimensions: ['interest', 'lifestyle', 'personality', 'social', 'career', 'expectation'],
    optionalDimensions: [],
    maxQuestionsPerDimension: 2,
    followUpBudget: 6,
    skipLowPriority: false
  },
  deep: {
    mode: 'deep',
    requiredDimensions: ['interest', 'lifestyle', 'personality', 'social', 'career', 'expectation'],
    optionalDimensions: [],
    maxQuestionsPerDimension: 3,
    followUpBudget: 12,
    skipLowPriority: false
  }
};

// ============ 维度到L2字段映射 ============
// 注意：同时映射informationTiers定义的字段名和stateManager产生的字段名

export const DIMENSION_TO_L2_FIELDS: Record<InsightDimension, string[]> = {
  interest: ['topInterests', 'primaryInterests', 'interests', 'hobbies'],
  lifestyle: ['activityTimePreference', 'groupSizeComfort', 'lifestyle', 'lifeStage'],
  personality: ['socialStyle', 'personality', 'personalityTraits'],
  social: ['groupSizeComfort', 'socialStyle', 'socialPreference', 'icebreakerRole'],
  career: ['occupationHint', 'industryHint', 'seniority', 'educationLevel', 'occupation', 'industry', 'seniorityLevel', 'companyName', 'structuredOccupation'],
  expectation: ['intent', 'relationshipStatus', 'expectation', 'matchingGoal']
};

// L1握手阶段必填字段
export const HANDSHAKE_FIELDS = ['displayName', 'gender', 'ageRange', 'currentCity'];

// ============ 编排器状态 ============

export interface OrchestratorState {
  mode: RegistrationMode;
  config: ModeConfig;
  tracker: ConversationTracker;
  handshakeComplete: boolean;
  handshakeFieldsCollected: string[];
  currentPhase: 'handshake' | 'dimension_guided' | 'confirmation';
  followUpUsed: number;
  askedQuestionIds: string[];
}

export function createOrchestratorState(mode: RegistrationMode): OrchestratorState {
  return {
    mode,
    config: MODE_CONFIGS[mode],
    tracker: createConversationTracker(),
    handshakeComplete: false,
    handshakeFieldsCollected: [],
    currentPhase: 'handshake',
    followUpUsed: 0,
    askedQuestionIds: []
  };
}

// ============ 核心编排逻辑 ============

export interface NextQuestionResult {
  phase: 'handshake' | 'dimension_guided' | 'confirmation' | 'complete';
  question?: GuidanceQuestion;
  suggestedPrompt?: string;
  dimension?: InsightDimension;
  isFollowUp: boolean;
  reason: string;
}

/**
 * 获取下一个推荐问题
 */
export function getNextQuestion(
  state: OrchestratorState,
  collectedFields: Record<string, unknown>
): NextQuestionResult {
  const { config, tracker, askedQuestionIds } = state;

  // Phase 1: 握手阶段 - 收集L1必填字段
  if (!state.handshakeComplete) {
    const missingHandshake = HANDSHAKE_FIELDS.filter(
      field => !collectedFields[field]
    );

    if (missingHandshake.length > 0) {
      return {
        phase: 'handshake',
        suggestedPrompt: generateHandshakePrompt(missingHandshake[0]),
        isFollowUp: false,
        reason: `握手阶段：收集 ${missingHandshake[0]}`
      };
    }

    // 握手完成，进入维度引导阶段
    state.handshakeComplete = true;
    state.currentPhase = 'dimension_guided';
  }

  // Phase 2: 维度引导阶段
  const requiredDims = config.requiredDimensions;
  
  for (const dimension of DIMENSION_ORDER) {
    // 跳过不在当前模式要求范围内的维度
    if (!requiredDims.includes(dimension) && !config.optionalDimensions.includes(dimension)) {
      continue;
    }

    const coverage = tracker.dimensions.get(dimension);
    const questionsAskedForDim = coverage?.questionAsked || 0;

    // 检查是否已达到该维度的问题上限
    if (questionsAskedForDim >= config.maxQuestionsPerDimension) {
      continue;
    }

    // 检查该维度是否已有足够信息
    const dimL2Fields = DIMENSION_TO_L2_FIELDS[dimension];
    const filledCount = dimL2Fields.filter(f => collectedFields[f]).length;
    if (filledCount >= dimL2Fields.length * 0.5) {
      // 已收集超过50%的相关字段，跳过
      continue;
    }

    // 获取该维度的可用问题
    const availableQuestions = GUIDANCE_QUESTIONS.filter(q => 
      q.dimension === dimension && 
      !askedQuestionIds.includes(q.id) &&
      (!config.skipLowPriority || q.priority >= 4)
    ).sort((a, b) => b.priority - a.priority);

    if (availableQuestions.length > 0) {
      const nextQ = availableQuestions[0];
      return {
        phase: 'dimension_guided',
        question: nextQ,
        dimension,
        suggestedPrompt: nextQ.question,
        isFollowUp: false,
        reason: `维度引导：${DIMENSION_NAMES[dimension]}(${questionsAskedForDim + 1}/${config.maxQuestionsPerDimension})`
      };
    }
  }

  // Phase 3: 所有维度完成，进入确认阶段
  return {
    phase: 'complete',
    isFollowUp: false,
    reason: '所有维度已覆盖，可进入确认阶段'
  };
}

/**
 * 记录问题已被问过
 */
export function markQuestionAsked(
  state: OrchestratorState,
  questionId: string,
  dimension: InsightDimension
): void {
  state.askedQuestionIds.push(questionId);
  
  const coverage = state.tracker.dimensions.get(dimension);
  if (coverage) {
    coverage.questionAsked += 1;
  }
}

/**
 * 更新维度覆盖信息
 */
export function updateDimensionCoverage(
  state: OrchestratorState,
  dimension: InsightDimension,
  insights: string[],
  confidence: number
): void {
  const coverage = state.tracker.dimensions.get(dimension);
  if (coverage) {
    coverage.insights.push(...insights);
    coverage.confidence = Math.max(coverage.confidence, confidence);
    if (confidence >= 0.7) {
      coverage.covered = true;
    }
  }
}

// ============ Prompt生成 ============

function generateHandshakePrompt(field: string): string {
  const prompts: Record<string, string> = {
    displayName: '怎么称呼你呀？',
    gender: '性别方便说吗？',
    ageRange: '方便透露一下年龄吗？大概就行~',
    currentCity: '你平时主要在哪个城市活动呀？'
  };
  return prompts[field] || `请提供${field}`;
}

/**
 * 生成维度过渡话术
 */
export function generateDimensionTransition(
  fromDimension: InsightDimension | null,
  toDimension: InsightDimension
): string {
  const transitions: Record<string, string> = {
    'null_interest': '好的，基础信息收到啦～先聊点轻松的~',
    'interest_lifestyle': '听起来挺有意思的！那平时生活节奏怎么样呀？',
    'lifestyle_personality': '了解了～那我好奇问一下~',
    'personality_social': '嗯嗯，那在交朋友方面呢~',
    'social_career': '聊得不错～那工作方面方便说说吗？这样能帮你匹配到更合适的朋友~',
    'career_expectation': '好的，最后想了解一下~'
  };

  const key = `${fromDimension || 'null'}_${toDimension}`;
  return transitions[key] || '';
}

/**
 * 生成动态prompt注入内容
 */
export function generateDynamicPromptInjection(
  state: OrchestratorState,
  collectedFields: Record<string, unknown>
): string {
  const nextQ = getNextQuestion(state, collectedFields);
  
  const lines: string[] = [
    '## 当前对话引导状态',
    '',
    `**阶段**: ${nextQ.phase === 'handshake' ? '握手阶段（收集基础信息）' : 
                nextQ.phase === 'dimension_guided' ? '维度引导阶段' : 
                nextQ.phase === 'complete' ? '即将完成' : '确认阶段'}`,
    `**模式**: ${state.mode === 'express' ? '极速模式' : state.mode === 'standard' ? '标准模式' : '深度模式'}`,
    ''
  ];

  if (nextQ.phase === 'handshake') {
    lines.push(`**下一步**: 请自然地询问用户的${nextQ.reason.split('收集 ')[1] || '基础信息'}`);
    lines.push(`**建议问法**: "${nextQ.suggestedPrompt}"`);
  } else if (nextQ.phase === 'dimension_guided' && nextQ.question) {
    const transition = state.tracker.currentDimension !== nextQ.dimension
      ? generateDimensionTransition(state.tracker.currentDimension, nextQ.dimension!)
      : '';
    
    lines.push(`**当前维度**: ${DIMENSION_NAMES[nextQ.dimension!]}`);
    lines.push(`**建议问题**: "${nextQ.suggestedPrompt}"`);
    if (transition) {
      lines.push(`**过渡话术**: "${transition}"`);
    }
    if (nextQ.question.followUp) {
      lines.push(`**追问备选**: "${nextQ.question.followUp}"`);
    }
  } else if (nextQ.phase === 'complete') {
    lines.push('**下一步**: 汇总已收集的信息，请用户确认');
  }

  // 添加维度进度概览
  lines.push('');
  lines.push('### 维度覆盖进度');
  for (const dim of state.config.requiredDimensions) {
    const coverage = state.tracker.dimensions.get(dim);
    const status = coverage?.covered ? '✅' : coverage?.questionAsked ? '🔄' : '⏳';
    lines.push(`- ${status} ${DIMENSION_NAMES[dim]}: ${coverage?.questionAsked || 0}/${state.config.maxQuestionsPerDimension}问`);
  }

  return lines.join('\n');
}

// ============ 字段完成度计算 ============

export interface CompletionStatus {
  l1Percentage: number;
  l2Percentage: number;
  dimensionCoverage: Record<InsightDimension, number>;
  overallScore: number;
  missingCritical: string[];
}

export function calculateCompletionStatus(
  collectedFields: Record<string, unknown>,
  state: OrchestratorState
): CompletionStatus {
  // L1 完成度
  const l1Required = L1_FIELDS.filter(f => f.required);
  const l1Filled = l1Required.filter(f => collectedFields[f.field]);
  const l1Percentage = Math.round((l1Filled.length / l1Required.length) * 100);

  // L2 完成度（基于模式要求的维度）
  // 改进：支持数组值和低置信度条目的检测
  const relevantL2Fields = state.config.requiredDimensions.flatMap(
    dim => DIMENSION_TO_L2_FIELDS[dim]
  );
  const uniqueL2 = Array.from(new Set(relevantL2Fields));
  const l2Filled = uniqueL2.filter(f => {
    const value = collectedFields[f];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
  const l2Percentage = uniqueL2.length > 0 
    ? Math.round((l2Filled.length / uniqueL2.length) * 100)
    : 0;

  // 各维度覆盖度
  const dimensionCoverage: Record<InsightDimension, number> = {} as Record<InsightDimension, number>;
  for (const dim of DIMENSION_ORDER) {
    const fields = DIMENSION_TO_L2_FIELDS[dim];
    const filled = fields.filter(f => collectedFields[f]).length;
    dimensionCoverage[dim] = fields.length > 0 ? Math.round((filled / fields.length) * 100) : 0;
  }

  // 综合评分
  const overallScore = Math.round(l1Percentage * 0.4 + l2Percentage * 0.6);

  // 缺失的关键字段
  const missingCritical = HANDSHAKE_FIELDS.filter(f => !collectedFields[f]);

  return {
    l1Percentage,
    l2Percentage,
    dimensionCoverage,
    overallScore,
    missingCritical
  };
}

// ============ 导出单例工厂 ============

const sessionStates = new Map<string, OrchestratorState>();

export function getOrCreateOrchestratorState(
  sessionId: string,
  mode: RegistrationMode = 'standard'
): OrchestratorState {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, createOrchestratorState(mode));
  }
  return sessionStates.get(sessionId)!;
}

export function clearOrchestratorState(sessionId: string): void {
  sessionStates.delete(sessionId);
}
