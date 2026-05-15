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

// 🟠 Orange Word Exceptions
export {
  ORANGE_WORDS,
  findOrangeWordViolations,
  registerException,
  getActiveExceptions,
  isExceptionFor,
} from './exceptions.js';
export type { OrangeWordEntry, RuleException } from './exceptions.js';
