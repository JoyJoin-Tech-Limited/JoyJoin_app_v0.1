/**
 * Copy — Brand-governed copywriting modules
 *
 * Centralised copy management for mini-program文案.
 * See docs/copy/brand-copy-strategy.md for full governance rules.
 */

// 🔴 Hard Rule: Terminology
export {
  TERMINOLOGY_TABLE,
  BANNED_WORDS,
  findBannedWord,
  findLegacyTerms,
} from './terms.js';
export type { CanonicalTermId, TermEntry } from './terms.js';

// 🔴 Tone Mode Mapping
export {
  TONE_MODES,
  SURFACE_TONE_MAP,
  getToneForSurface,
  getToneConfig,
  validateCopyTone,
} from './toneMap.js';
export type { ToneMode, Surface, ToneModeConfig } from './toneMap.js';

// 🔴🟡 Error Baselines
export type { ErrorCode } from './errorBaselines.js';
export { getErrorMessage, getErrorForSurface, validateAllErrorTones } from './errorBaselines.js';

// 🟡 Empty States
export type { EmptySurface } from './emptyStates.js';
export {
  getEmptyStateMessage,
  getEmptyStatePrompt,
  getEmptyStateAction,
} from './emptyStates.js';

// 🟢 Mascot Voice
export {
  MASCOT_PATTERNS,
  getRandomPattern,
  interpolatePattern,
} from './mascotVoice.js';

// 🟢 Onboarding Archetype Voice Matrix (Bet 1 人格在场, 2026-07-31)
export {
  ONBOARDING_VOICE_STEP_IDS,
  ONBOARDING_VOICE_TABLES,
  getOnboardingVoiceLine,
} from './onboardingVoice.js';
export type { OnboardingVoiceStepId } from './onboardingVoice.js';

// 🟠 Orange Word Exceptions
export {
  ORANGE_WORDS,
  findOrangeWordViolations,
  registerException,
  getActiveExceptions,
  isExceptionFor,
} from './exceptions.js';
export type { OrangeWordEntry, RuleException } from './exceptions.js';

// 🎬 Flow Animation (双世界入口 + 生命周期) — owner-approved 2026-07-29
export {
  FLOW1_HOME_COPY,
  ARCHETYPE_SUBLINES,
  getArchetypeSubline,
  getFlow1H1Line2,
  FLOW1_ENTRY_COPY,
  EXPERIENCE_DETAIL_COPY,
  FLOW2_FALLBACKS,
  FLOW2_NODE_COPY,
  getFlow2HeroStatus,
  getFlow2HeroMeta,
  resolveFlow2NodeDescription,
  FLOW_SHELL_COPY,
  getIdentityChipLabel,
} from './flowAnimationCopy.js';
export type {
  FlowStepCopy,
  ExperienceDetailCopy,
  FlowLifecycleFacts,
  Flow2NodeCopy,
} from './flowAnimationCopy.js';
