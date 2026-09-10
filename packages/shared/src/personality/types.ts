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
  /** Xiaoyue commentary pre-attached by the server so the client can show it immediately without waiting for the answer API call. */
  commentary?: string;
  /**
   * Social Desirability Index (0–100), declared on ipsative (forced-choice)
   * options only. Author-assigned face-validity estimate of how socially
   * desirable the self-description reads to a peer audience (pre-launch: no
   * live ratings exist; recalibrate with real data later).
   * Invariant: within one ipsative item the two options' SDIs differ by at
   * most 10 — enforced by scripts/simulate/audit-ipsative-sdi.ts.
   * Not scored: the engine never reads this field at runtime.
   */
  socialDesirabilityIndex?: number;
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
  /**
   * Defaults to 'choice' if absent.
   * 'ipsative' = two-option forced choice between equally socially desirable
   * poles (equal SDI, see QuestionOption.socialDesirabilityIndex) loading on
   * rival traits. Served only when AssessmentConfig.enableIpsativeItems is
   * true; clients render it through the standard choice surface.
   */
  questionType?: 'choice' | 'slider' | 'emoji_tap' | 'ipsative';
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
  /** Override normalizeTraitScore multiplier (default: 15) */
  traitScoreMultiplier?: number;
  /** Per-trait baseline offset subtracted before normalization (default: all 0) */
  traitScoreBaselines?: Partial<Record<TraitKey, number>>;
  /** Use fixed question sequence instead of adaptive selection */
  useFixedQuestions?: boolean;
  /** Ordered list of question IDs for fixed-question mode */
  fixedQuestionIds?: string[];
  /** Inject pure single-trait calibration questions after anchors (default: true) */
  enableCalibrationQuestions?: boolean;
  /** Max calibration questions per session (default: 2) */
  maxCalibrationQuestions?: number;
  /**
   * Plan Item 1 (2026-09-09): when true, the selector may serve ipsative
   * (forced-choice, equal-SDI) items from questionsV4Ipsative inside the
   * normal 8–16 adaptive utility pool. Default OFF — when off or absent the
   * selector filters ipsative items out, keeping behavior byte-identical to
   * the pre-flag engine. Scoring has no ipsative branch: the zero-sum rival
   * debit is baked into each option's traitScores (see questionsV4Ipsative).
   */
  enableIpsativeItems?: boolean;
  /**
   * Plan Item 2 (2026-09-09, amended contract): when true, consistency-pair
   * validity mechanics activate. The selector schedules CONSISTENCY_PAIRS
   * (near-paraphrase item pairs, see consistencyPairs.ts) with ≥4-question
   * spacing and a completion guarantee (closing-phase fallback); pair
   * disagreement folds into validityScore and traitConfidences (never trait
   * scores); a neutral-responding detector feeds validityScore; and a
   * match-confidence composition step in processAnswer multiplies
   * currentMatches confidence by validityScore. Default OFF — when off or
   * absent every code path is byte-identical to the pre-flag engine.
   */
  enableConsistencyFolding?: boolean;
  /**
   * Plan Item 4 (2026-09-09, contract item4-meta-consistency): when true, one
   * meta-consistency item (Q168, see metaConsistency.ts) is served as the LAST
   * closing-phase question. Its answer is a direct self-report on a target
   * trait (A); the engine compares it against its own estimate of that trait
   * and, on discrepancy ≥ 30, applies a bounded session-confidence multiplier
   * (×0.8) to match confidence — composed multiplicatively with Item 2's
   * validity composition. The item's options carry ZERO trait loadings: the
   * self-report measures self-view and must never feed the estimate it is
   * compared against. Trait scores are never touched. Default OFF — when off
   * or absent every code path is byte-identical to the pre-flag engine.
   */
  enableMetaConsistency?: boolean;
  /**
   * Plan Item 3 (2026-09-10, contract item3-trait-shrinkage): when true,
   * confidence-weighted trait shrinkage activates at the MATCH/REPORTING
   * boundary (see traitShrinkage.ts): the matcher and FinalResultV2 consume
   * reported = w·estimated + (1−w)·50 per trait, with w derived from Item
   * 12's calibrated per-trait expected-error curve. Raw engine state
   * (traitScores, traitConfidences) is never mutated — question selection
   * and termination read pre-shrink state. Composition order (flag-gated
   * steps only): Item 2 confidence fold → Item 3 trait shrinkage → match →
   * Item 2 validity composition → Item 4 meta multiplier. Default OFF —
   * when off or absent every code path is byte-identical to the pre-flag
   * engine.
   */
  enableTraitShrinkage?: boolean;
}

export const DEFAULT_ASSESSMENT_CONFIG: AssessmentConfig = {
  minQuestions: 10,
  softMaxQuestions: 12,
  hardMaxQuestions: 16,
  defaultConfidenceThreshold: 0.65,
  confusablePairThreshold: 0.70,
  anchorQuestionCount: 9,
  validityCheckPositions: [8, 12],
  milestonePositions: [4, 8, 12],
  enableTieredThreshold: false,
  tieredThresholdConfig: {
    confidenceGapThreshold: 0.10,
    dimensionCoverageThreshold: 0.75,
    maxExtraQuestions: 1,
  },
  useV2Matcher: true, // V2 matcher is now the standard algorithm
  enableCalibrationQuestions: true,
  maxCalibrationQuestions: 2,
  enableIpsativeItems: false, // Plan Item 1: ships dark; selector gate in adaptiveEngine
  enableConsistencyFolding: false, // Plan Item 2: ships dark; wiring in adaptiveEngine + consistencyPairs
  enableMetaConsistency: false, // Plan Item 4: ships dark; wiring in adaptiveEngine + metaConsistency
  enableTraitShrinkage: false, // Plan Item 3: ships dark; wiring in adaptiveEngine + traitShrinkage
};

export const V2_ASSESSMENT_CONFIG: AssessmentConfig = {
  minQuestions: 12,
  softMaxQuestions: 16,
  hardMaxQuestions: 20,
  defaultConfidenceThreshold: 0.70,
  confusablePairThreshold: 0.80,
  anchorQuestionCount: 9,
  validityCheckPositions: [8, 12, 16],
  milestonePositions: [4, 8, 14],
  enableTieredThreshold: true,
  tieredThresholdConfig: {
    confidenceGapThreshold: 0.15,
    dimensionCoverageThreshold: 0.80,
    maxExtraQuestions: 2,
  },
  useV2Matcher: true,
  enableCalibrationQuestions: true,
  maxCalibrationQuestions: 2,
  enableIpsativeItems: false, // Plan Item 1: ships dark
  enableConsistencyFolding: false, // Plan Item 2: ships dark
  enableMetaConsistency: false, // Plan Item 4: ships dark
  enableTraitShrinkage: false, // Plan Item 3: ships dark
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

/**
 * @deprecated Dead type — never wired to any engine code path. Plan Item 2's
 * consistency-pair registry (CONSISTENCY_PAIRS in consistencyPairs.ts) is a
 * net-new structure and deliberately does NOT extend this shape.
 */
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
