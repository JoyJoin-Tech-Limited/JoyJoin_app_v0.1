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
  REVIEW_BLOCKED_VOCAB,
  findBannedWord,
  findReviewBlockedVocab,
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
export {
  getErrorMessage,
  getErrorForSurface,
  validateAllErrorTones,
  ONBOARDING_ERROR_STAGE_COPY,
} from './errorBaselines.js';

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
  FLOW1_ENTRY_COPY,
  FLOW2_FALLBACKS,
  FLOW2_NODE_COPY,
  getFlow2HeroStatus,
  getFlow2HeroMeta,
  resolveFlow2NodeDescription,
  FLOW_SHELL_COPY,
  getIdentityChipLabel,
} from './flowAnimationCopy.js';
export type {
  FlowLifecycleFacts,
  Flow2NodeCopy,
} from './flowAnimationCopy.js';

// 🧾 Pool registration value strip (费用包含) — PM + commercialization approved 2026-08-31
export {
  POOL_INCLUSION_TILES,
} from './poolRegistrationInclusionsCopy.js';
export type {
  PoolInclusionTileId,
  PoolInclusionIcon,
  PoolInclusionTileCopy,
} from './poolRegistrationInclusionsCopy.js';

// 🐾 Entry-card insight v2 rule fallback (server-only consumer, 2026-10-14)
export {
  MIN_TAGLINE_LINE_CHARS,
  MAX_TAGLINE_LINE_CHARS,
  MAX_ANSWER_SLOT_CHARS,
  OBSERVATION_INTEREST_TEMPLATES,
  ARCHETYPE_OBSERVATION_LINES,
  ARCHETYPE_RULE_TEMPLATES,
  sanitizeSlotValue,
  renderRuleTemplate,
} from './profileTaglineRuleTemplates.js';
export type {
  TaglineTemplateSlots,
  RuleTemplateRole,
  TaglineTemplateRole,
  RuleTemplate,
} from './profileTaglineRuleTemplates.js';

// 🧊 Icebreaker session Wave 2 terms (sprint icebreaker-uiux-wave2, AC-15)
export {
  QUIP_INSPIRATION_CHIPS,
  QUIP_CHIP_ROW_LABEL,
  QUIP_CHIP_REPLACE_CONFIRM_TEXT,
  QUIP_CHIP_REPLACE_CONFIRM_OK,
  QUIP_CHIP_REPLACE_CONFIRM_CANCEL,
  pickQuipInspirationChips,
} from './quipInspirationChips.js';
export type {
  QuipInspirationChip,
  QuipChipFamily,
} from './quipInspirationChips.js';
export {
  formatIcePhaseProgress,
  formatIcePhaseProgressLoose,
  ICE_PHASE_MAP_ARROW,
  ICE_WAITING_FOR_HOST_LINE,
  ICE_HOST_MENU_PILL_LABEL,
  ICE_HOST_MENU_CHANGE_TIER,
  formatIceModeCaption,
  formatIceOpeningPackButton,
  ICE_AIGC_REASON_OPENING_PACK,
  ICE_TOOL_BADGE_MINI_SCRIPT,
  formatIceAuctionLotPosition,
  ICE_AUCTION_CLOSE_LOT,
  ICE_MICRO_TAP_HINT,
  formatIceLieFooledLine,
  ICE_HOST_PHASE_PROMPT_PREFIX,
  getIceHostPhasePrompt,
  ICE_PHASE_ONE_LINE_RULE_PREFIX,
  getIcePhaseOneLineRule,
} from './icebreakerSession.js';
