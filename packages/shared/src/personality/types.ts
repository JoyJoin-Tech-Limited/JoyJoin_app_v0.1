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
}

export const DEFAULT_ASSESSMENT_CONFIG: AssessmentConfig = {
  minQuestions: 9,
  softMaxQuestions: 14,
  hardMaxQuestions: 20,
  defaultConfidenceThreshold: 0.72,
  confusablePairThreshold: 0.78,
  anchorQuestionCount: 6,
  validityCheckPositions: [6, 12],
  milestonePositions: [8, 12, 16],
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
  { position: 8, message: '嗯嗯，开始有点懂你了~', xiaoyueMood: 'thinking' },
  { position: 12, message: '越来越清晰啦！你的性格画像快成型了~', xiaoyueMood: 'encouraging' },
  { position: 16, message: '就差一点点了！帮我确认最后几个细节~', xiaoyueMood: 'excited' },
];
