/**
 * V4 Adaptive Assessment System - Shared Types
 * 自适应性格测评系统 V4 - 共享类型定义
 */

export type TraitKey = 'A' | 'C' | 'E' | 'O' | 'X' | 'P';

export interface TraitScores {
  A?: number;  // Affinity 亲和力
  C?: number;  // Conscientiousness 责任心
  E?: number;  // EmotionalStability 情绪稳定
  O?: number;  // Openness 开放性
  X?: number;  // Extraversion 外向性
  P?: number;  // Positivity 积极性
}

export interface QuestionOption {
  value: string;
  text: string;
  traitScores: TraitScores;
}

export type QuestionLevel = 1 | 2 | 3;

export interface AdaptiveQuestion {
  id: string;
  level: QuestionLevel;
  category: string;
  scenarioText: string;
  questionText: string;
  primaryTraits: TraitKey[];
  options: QuestionOption[];
  isAnchor?: boolean;
  variants?: string[];
  variantOf?: string;
  discriminationIndex?: number;
  isReversed?: boolean;
  isAttentionCheck?: boolean;
}

export interface TraitConfidence {
  trait: TraitKey;
  score: number;
  confidence: number;
  sampleCount: number;
}

export interface ArchetypeMatch {
  archetype: string;
  score: number;
  confidence: number;
}

export interface AdaptiveSessionState {
  sessionId: string;
  userId?: number;
  currentQuestionIndex: number;
  answeredQuestions: AnsweredQuestion[];
  traitConfidences: Record<TraitKey, TraitConfidence>;
  archetypeMatches: ArchetypeMatch[];
  phase: 'pre_signup' | 'post_signup' | 'completed';
  startedAt: string;
  updatedAt: string;
}

export interface AnsweredQuestion {
  questionId: string;
  selectedOption: string;
  traitScores: TraitScores;
  answeredAt: string;
}

export interface PreSignupState {
  answers: AnsweredQuestion[];
  partialTraitScores: Record<TraitKey, number>;
  previewArchetype?: string;
  expiresAt: string;
}

export interface AssessmentConfig {
  minQuestions: number;
  softMaxQuestions: number;
  hardMaxQuestions: number;
  defaultConfidenceThreshold: number;
  confusablePairThreshold: number;
  anchorQuestionCount: number;
  validityCheckPositions: number[];
  milestonePositions: number[];
  enableTieredThreshold: boolean;
  tieredThresholdConfig: {
    confidenceGapThreshold: number;
    dimensionCoverageThreshold: number;
    maxExtraQuestions: number;
  };
  useV2Matcher?: boolean;
}

export const DEFAULT_ASSESSMENT_CONFIG: AssessmentConfig = {
  minQuestions: 8,
  softMaxQuestions: 10,
  hardMaxQuestions: 14,
  defaultConfidenceThreshold: 0.65,
  confusablePairThreshold: 0.70,
  anchorQuestionCount: 6,
  validityCheckPositions: [6, 10],
  milestonePositions: [5, 8, 11],
  enableTieredThreshold: false,
  tieredThresholdConfig: {
    confidenceGapThreshold: 0.10,
    dimensionCoverageThreshold: 0.75,
    maxExtraQuestions: 1,
  },
  useV2Matcher: false,
};

export const V2_ASSESSMENT_CONFIG: AssessmentConfig = {
  minQuestions: 12,
  softMaxQuestions: 16,
  hardMaxQuestions: 20,
  defaultConfidenceThreshold: 0.70,
  confusablePairThreshold: 0.80,
  anchorQuestionCount: 6,
  validityCheckPositions: [8, 12, 16],
  milestonePositions: [6, 10, 14],
  enableTieredThreshold: true,
  tieredThresholdConfig: {
    confidenceGapThreshold: 0.15,
    dimensionCoverageThreshold: 0.80,
    maxExtraQuestions: 2,
  },
  useV2Matcher: true,
};

export interface ConfusableArchetypePair {
  archetypes: [string, string];
  differentiatingTraits: TraitKey[];
  requiredConfidence: number;
}

export const CONFUSABLE_ARCHETYPE_PAIRS: ConfusableArchetypePair[] = [
  { archetypes: ['夸夸豚', '淡定海豚'], differentiatingTraits: ['X', 'E'], requiredConfidence: 0.82 },
  { archetypes: ['机智狐', '灵感章鱼'], differentiatingTraits: ['X', 'C'], requiredConfidence: 0.82 },
  { archetypes: ['暖心熊', '定心大象'], differentiatingTraits: ['O', 'X'], requiredConfidence: 0.82 },
  { archetypes: ['沉思猫头鹰', '稳如龟'], differentiatingTraits: ['O', 'A'], requiredConfidence: 0.82 },
  { archetypes: ['开心柯基', '太阳鸡'], differentiatingTraits: ['O', 'C'], requiredConfidence: 0.82 },
  { archetypes: ['稳如龟', '隐身猫'], differentiatingTraits: ['O', 'C'], requiredConfidence: 0.82 },
];

export interface ValidityCheckPair {
  question1Id: string;
  question2Id: string;
  expectedRelation: 'inverse' | 'consistent';
  targetTraits: TraitKey[];
}

export interface AssessmentResult {
  sessionId: string;
  userId: number;
  primaryArchetype: string;
  secondaryArchetype?: string;
  traitScores: Record<TraitKey, number>;
  traitConfidences: Record<TraitKey, number>;
  totalQuestions: number;
  validityScore: number;
  completedAt: string;
}

export interface XiaoyueFeedback {
  questionId: string;
  optionFeedback: Record<string, string>;
  progressMilestone?: string;
  prototypeHint?: string;
}

export interface MilestoneMessage {
  position: number;
  message: string;
  xiaoyueMood: 'thinking' | 'excited' | 'encouraging';
}

export const MILESTONE_MESSAGES: MilestoneMessage[] = [
  { position: 5, message: '嗯嗯，开始有点懂你了~', xiaoyueMood: 'thinking' },
  { position: 8, message: '越来越清晰啦！快成型了~', xiaoyueMood: 'encouraging' },
  { position: 11, message: '最后几题确认一下~', xiaoyueMood: 'excited' },
];
