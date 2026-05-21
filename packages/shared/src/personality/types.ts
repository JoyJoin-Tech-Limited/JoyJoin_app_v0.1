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
  /** Semantic key for a custom icon asset (e.g. Lovart illustration). Consumed by clients; not scored. */
  iconAssetKey?: string;
}

export type QuestionLevel = 1 | 2 | 3;

export type CohortType = 
  | 'creative_explorer'    // octopus, fox, owl (high O + mid X)
  | 'quiet_anchor'         // cat, turtle, elephant (low X + high C)
  | 'social_catalyst'      // corgi, rooster, hamster_praise (high X + high P)
  | 'steady_harmonizer'    // koala, dolphin_calm, spider (high A + mid-high E)
  | 'reflective_stabilizer' // owl, turtle (high C + differentiated O/E)
  | 'universal';           // Works for all cohorts

export interface SliderConfig {
  leftLabel: string;
  rightLabel: string;
  leftEmoji?: string;
  rightEmoji?: string;
  traitMappings: Array<{
    traitKey: TraitKey;
    /** slider 0→100 maps linearly to scoreAtZero→scoreAt100 */
    scoreAtZero: number;
    scoreAt100: number;
  }>;
}

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
  isForcedChoice?: boolean; // Forced-choice tradeoff questions between competing traits
  targetPairs?: string[]; // Archetype names this question is designed to differentiate
  cohortTag?: CohortType; // Which cohort this question is best suited for
  /** Defaults to 'choice' if absent */
  questionType?: 'choice' | 'slider' | 'emoji_tap';
  sliderConfig?: SliderConfig;
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
  minQuestions: 10,
  softMaxQuestions: 12,
  hardMaxQuestions: 16,
  defaultConfidenceThreshold: 0.65,
  confusablePairThreshold: 0.70,
  anchorQuestionCount: 8,
  validityCheckPositions: [8, 12],
  milestonePositions: [4, 8, 12],
  enableTieredThreshold: false,
  tieredThresholdConfig: {
    confidenceGapThreshold: 0.10,
    dimensionCoverageThreshold: 0.75,
    maxExtraQuestions: 1,
  },
  useV2Matcher: true, // V2 matcher is now the standard algorithm
};

export const V2_ASSESSMENT_CONFIG: AssessmentConfig = {
  minQuestions: 12,
  softMaxQuestions: 16,
  hardMaxQuestions: 20,
  defaultConfidenceThreshold: 0.70,
  confusablePairThreshold: 0.80,
  anchorQuestionCount: 8,
  validityCheckPositions: [8, 12, 16],
  milestonePositions: [4, 8, 14],
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
  { archetypes: ['hamster_praise', 'dolphin_calm'], differentiatingTraits: ['X', 'E'], requiredConfidence: 0.82 },
  { archetypes: ['fox', 'octopus'], differentiatingTraits: ['X', 'C'], requiredConfidence: 0.82 },
  { archetypes: ['koala', 'elephant'], differentiatingTraits: ['O', 'X'], requiredConfidence: 0.82 },
  { archetypes: ['owl', 'turtle'], differentiatingTraits: ['O', 'A'], requiredConfidence: 0.82 },
  { archetypes: ['corgi', 'rooster'], differentiatingTraits: ['O', 'C'], requiredConfidence: 0.82 },
  { archetypes: ['turtle', 'cat'], differentiatingTraits: ['O', 'C'], requiredConfidence: 0.82 },
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

// Milestone messaging is defined in feedback.ts (MilestoneConfig / milestoneConfigs / getMilestoneMessage).
// MilestoneMessage and MILESTONE_MESSAGES were removed to eliminate the duplicate — use getMilestoneMessage() instead.
