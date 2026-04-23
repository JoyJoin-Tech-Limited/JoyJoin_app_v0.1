#!/usr/bin/env node
/**
 * JoyJoin Skill Router — lightweight rule-based router (v1.0)
 *
 * Accepts an ask/task plus optional context (file paths, symbols) and returns:
 *   - primary skill
 *   - optional secondary skills
 *   - matched signals / reasons
 *   - confidence band (high | medium | low)
 *   - whether clarification is recommended
 *
 * Design principles:
 *   - Simple and explainable: every decision has a named reason
 *   - Observable: structured routing log emitted for every call
 *   - Anti-legacy guard: cross-cutting check before finalising result
 *   - No external dependencies: pure Node.js ESM
 *
 * Usage (programmatic):
 *   import { routeSkill } from './skill-router.mjs';
 *   const result = routeSkill({ ask: 'add a nextStep rule' });
 *   console.log(result);
 *
 * Usage (CLI):
 *   node scripts/skill-router.mjs "add a nextStep rule"
 *   node scripts/skill-router.mjs "add logging to /api/pool/register" --files "apps/server/src/routes/domains/pool.ts"
 */

import { LEGACY_SENTINELS, loadSkillDefinitions } from './skill-routing-metadata.mjs';

// ---------------------------------------------------------------------------
// Skill definitions with routing signals
// ---------------------------------------------------------------------------

/** @typedef {{ skill: string, when: string }} RelatedSkill */
/** @typedef {{ skill: string, primary_ownership: string, use_when: string[], do_not_use_when: string[], strong_triggers: string[], owned_files: string[], owned_paths: string[], owned_symbols: string[], related_skills: RelatedSkill[] }} SkillDef */

/** @type {SkillDef[]} */
export const SKILL_DEFINITIONS = /** @type {SkillDef[]} */ (loadSkillDefinitions());

// ---------------------------------------------------------------------------
// Anti-legacy guard
// ---------------------------------------------------------------------------

/**
 * Legacy patterns that must never appear in active-flow recommendations.
 * If any of these are detected in the ask, a canonical warning is added.
 */
export const LEGACY_PATTERNS = [
  { pattern: /\/guide\b/i, label: '/guide page (deprecated; active onboarding uses /onboarding/setup|extended|review)' },
  { pattern: /\bshared\/(?!src)/i, label: 'shared/ root import (use packages/shared/src/ instead)' },
  { pattern: /\bdirect.?messag/i, label: 'direct messaging (removed; use /connections)' },
  { pattern: /\b(圈子|chats)\b/i, label: '/chats or 圈子 surface (replaced by /connections)' },
  { pattern: /\b(hasCompletedRegistration|needsRegistration|registration_sessions|interestsTop)\b/i, label: 'legacy onboarding identifier' },
  { pattern: /\b(会员|VIP会员)\b/i, label: '会员/VIP会员 copy (replaced by 权益)' },
  ...LEGACY_SENTINELS.filter(({ label }) => label === '14-archetype V1/V2 system (replaced by 12-archetype V4)'),
  { pattern: /createDemoDataForUser/i, label: 'createDemoDataForUser (must be gated on NODE_ENV !== production)' },
];

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const STRONG_TRIGGER_SCORE = 10;
const USE_WHEN_SCORE = 3;
const OWNED_FILE_SCORE = 12;
const OWNED_PATH_SCORE = 6;
const OWNED_SYMBOL_SCORE = 7;
const MIN_SYMBOL_LENGTH_FOR_SUBSTRING_MATCH = 3;
const EXPLICIT_OVERRIDE_SIGNAL = 'explicit_override:plain_language_product_confusion:pm-sin-mapper';

const PRODUCT_CONFUSION_PRODUCT_CUES = [
  /\bdrop(?:ping)?\s*off\b/i,
  /\bfunnel\b/i,
  /\bsign[\s-]?up\b/i,
  /\bonboarding\b/i,
  /\bactivation\b/i,
  /\bconversion\b/i,
  /\bretention\b/i,
  /\badoption\b/i,
];

const PRODUCT_CONFUSION_CLARITY_CUES = [
  /\bconfus(?:e|ing|ion)\b/i,
  /\bunclear\b/i,
  /\bunnecessary\b/i,
  /\bwhat should(?: we)? change first\b/i,
  /\bwhat should(?: we)? simplify first\b/i,
];

const REALTIME_CUES = [
  /\bwebsocket\b/i,
  /\bsocket\b/i,
  /\breal[-\s]?time\b/i,
  /\blive updates?\b/i,
  /\bpub\/sub\b/i,
  /\bstream(?:ing)?\b/i,
];

/**
 * Apply deterministic route overrides for historically ambiguous asks.
 *
 * @param {string} ask
 * @returns {string | null}
 */
function detectPrimaryOverride(ask) {
  if (REALTIME_CUES.some(pattern => pattern.test(ask))) {
    return null;
  }

  const hasProductCue = PRODUCT_CONFUSION_PRODUCT_CUES.some(pattern => pattern.test(ask));
  const hasClarityCue = PRODUCT_CONFUSION_CLARITY_CUES.some(pattern => pattern.test(ask));

  if (hasProductCue && hasClarityCue) {
    return 'pm-sin-mapper';
  }

  return null;
}

/**
 * Normalise text to lowercase for matching.
 * @param {string} text
 * @returns {string}
 */
function normalise(text) {
  return text.toLowerCase();
}

/**
 * Escape regex special chars in a string.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match strong triggers in ask text while avoiding substring false positives
 * for short alphanumeric tokens (e.g., "ping" in "dropping").
 *
 * @param {string} text
 * @param {string} trigger
 * @returns {boolean}
 */
function askMatchesTrigger(text, trigger) {
  if (!trigger) return false;
  if (/^[a-z0-9]+$/.test(trigger) && trigger.length <= 4) {
    const tokenPattern = new RegExp(`\\b${escapeRegExp(trigger)}\\b`, 'i');
    return tokenPattern.test(text);
  }
  return text.includes(trigger);
}

/**
 * Match a symbol against a trigger without letting very short strings create
 * substring false positives.
 *
 * @param {string} symbol
 * @param {string} trigger
 * @returns {boolean}
 */
function symbolMatchesTrigger(symbol, trigger) {
  if (symbol === trigger) return true;
  if (symbol.length < MIN_SYMBOL_LENGTH_FOR_SUBSTRING_MATCH || trigger.length < MIN_SYMBOL_LENGTH_FOR_SUBSTRING_MATCH) {
    return false;
  }
  return symbol.includes(trigger);
}

/**
 * Score a single skill against the given inputs.
 *
 * @param {SkillDef} skill
 * @param {string} normAsk  — normalised ask text
 * @param {string[]} normFiles — normalised file paths
 * @param {string[]} normSymbols — normalised symbol names
 * @returns {{ score: number, signals: string[] }}
 */
function scoreSkill(skill, normAsk, normFiles, normSymbols) {
  let score = 0;
  const signals = [];

  // Strong triggers (highest weight)
  for (const trigger of skill.strong_triggers) {
    const normTrigger = normalise(trigger);
    if (askMatchesTrigger(normAsk, normTrigger)) {
      score += STRONG_TRIGGER_SCORE;
      signals.push(`strong_trigger:ask:"${trigger}"`);
    }
    for (const f of normFiles) {
      if (f.includes(normTrigger)) {
        score += STRONG_TRIGGER_SCORE;
        signals.push(`strong_trigger:file:"${trigger}"`);
        break;
      }
    }
    for (const s of normSymbols) {
      if (symbolMatchesTrigger(s, normTrigger)) {
        score += STRONG_TRIGGER_SCORE;
        signals.push(`strong_trigger:symbol:"${trigger}"`);
        break;
      }
    }
  }

  // use_when phrases
  for (const phrase of skill.use_when) {
    const normPhrase = normalise(phrase);
    // Check partial word overlap (3+ consecutive words matching)
    const phraseWords = normPhrase.split(/\s+/).filter(w => w.length > 3);
    const matchCount = phraseWords.filter(w => normAsk.includes(w)).length;
    if (matchCount >= Math.max(2, Math.floor(phraseWords.length * 0.5))) {
      score += USE_WHEN_SCORE;
      signals.push(`use_when:"${phrase}"`);
    }
  }

  // Owned file patterns
  for (const pattern of skill.owned_files) {
    const normPattern = normalise(pattern);
    for (const f of normFiles) {
      if (f.startsWith(normPattern) || f.includes(normPattern.replace('/**', '').replace('/*', ''))) {
        score += OWNED_FILE_SCORE;
        signals.push(`owned_file:"${f}"`);
        break;
      }
    }
    if (normAsk.includes(normPattern.replace('/**', '').replace('/*', ''))) {
      score += OWNED_FILE_SCORE / 2;
      signals.push(`owned_file_in_ask:"${pattern}"`);
    }
  }

  // Owned paths
  for (const path of skill.owned_paths) {
    const normPath = normalise(path);
    if (normAsk.includes(normPath) || normFiles.some(f => f.includes(normPath.replace(/\/$/, '')))) {
      score += OWNED_PATH_SCORE;
      signals.push(`owned_path:"${path}"`);
    }
  }

  // Owned symbols
  for (const sym of skill.owned_symbols) {
    const normSym = normalise(sym);
    if (askMatchesTrigger(normAsk, normSym) || normSymbols.some(s => symbolMatchesTrigger(normalise(s), normSym))) {
      score += OWNED_SYMBOL_SCORE;
      signals.push(`owned_symbol:"${sym}"`);
    }
  }

  // Apply negative: do_not_use_when reduces score
  for (const exclusion of skill.do_not_use_when) {
    const normEx = normalise(exclusion);
    const exWords = normEx.split(/\s+/).filter(w => w.length > 3);
    const matchCount = exWords.filter(w => normAsk.includes(w)).length;
    if (matchCount >= Math.max(2, Math.floor(exWords.length * 0.6))) {
      score -= 5;
      signals.push(`do_not_use_when:"${exclusion}" (penalty -5)`);
    }
  }

  return { score: Math.max(0, score), signals };
}

// ---------------------------------------------------------------------------
// Confidence band
// ---------------------------------------------------------------------------

/**
 * @param {number} topScore
 * @param {number} secondScore
 * @returns {'high' | 'medium' | 'low'}
 */
function confidenceBand(topScore, secondScore) {
  if (topScore === 0) return 'low';
  const gap = topScore - secondScore;
  if (topScore >= 20 && gap >= 10) return 'high';
  if (topScore >= 10) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Anti-legacy check
// ---------------------------------------------------------------------------

/**
 * @param {string} ask
 * @returns {{ triggered: boolean, warnings: string[] }}
 */
function antiLegacyCheck(ask) {
  const warnings = [];
  for (const { pattern, label } of LEGACY_PATTERNS) {
    if (pattern.test(ask)) {
      warnings.push(`LEGACY PATTERN DETECTED: ${label}`);
    }
  }
  return { triggered: warnings.length > 0, warnings };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {{ ask: string, files?: string[], symbols?: string[], emitLog?: boolean }} RouteInput
 *
 * @typedef {{
 *   primary_skill: string | null,
 *   secondary_skills: string[],
 *   matched_signals: string[],
 *   confidence: 'high' | 'medium' | 'low',
 *   clarification_recommended: boolean,
 *   anti_legacy: { triggered: boolean, warnings: string[] },
 *   scores: Array<{ skill: string, score: number, signals: string[] }>,
 *   routing_log: object,
 * }} RouteResult
 */

/**
 * Route an ask to the most appropriate JoyJoin skill(s).
 *
 * @param {RouteInput} input
 * @returns {RouteResult}
 */
export function routeSkill({ ask, files = [], symbols = [], emitLog = false }) {
  const normAsk = normalise(ask);
  const normFiles = files.map(normalise);
  const normSymbols = symbols.map(normalise);

  // Score all skills
  const scores = SKILL_DEFINITIONS.map(skill => {
    const { score, signals } = scoreSkill(skill, normAsk, normFiles, normSymbols);
    return { skill: skill.skill, score, signals };
  }).sort((a, b) => b.score - a.score);

  const top = scores[0];
  const scoreBySkill = new Map(scores.map(s => [s.skill, s]));
  const primaryOverride = detectPrimaryOverride(ask);

  // Primary skill (only if score > 0)
  const primary_skill = primaryOverride ?? (top.score > 0 ? top.skill : null);
  const primaryScore = primary_skill ? (scoreBySkill.get(primary_skill)?.score ?? 0) : 0;
  const secondaryCandidate = scores.find(s => primary_skill !== null && s.skill !== primary_skill);

  // Secondary skill: include if score is meaningful and not far below primary
  const secondary_skills = [];
  if (
    primary_skill &&
    secondaryCandidate &&
    secondaryCandidate.score > 0 &&
    secondaryCandidate.score >= Math.max(1, primaryScore * 0.4)
  ) {
    secondary_skills.push(secondaryCandidate.skill);
  }

  // Confidence
  const confidence = confidenceBand(primaryScore, secondaryCandidate?.score ?? 0);

  // Clarification recommended when low confidence or very close scores
  const clarification_recommended =
    confidence === 'low' ||
    (
      secondaryCandidate &&
      secondaryCandidate.score > 0 &&
      primaryScore > 0 &&
      primaryScore - secondaryCandidate.score < 5
    );

  // Matched signals (primary + secondary combined, deduplicated)
  const primarySignals = primary_skill ? (scoreBySkill.get(primary_skill)?.signals ?? []) : [];
  const secondarySignals = secondary_skills.length > 0 ? (secondaryCandidate?.signals ?? []) : [];
  const matched_signals = [
    ...primarySignals,
    ...secondarySignals,
    ...(primaryOverride ? [EXPLICIT_OVERRIDE_SIGNAL] : []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  // Anti-legacy guard
  const anti_legacy = antiLegacyCheck(ask);

  // Build routing log
  const routing_log = {
    ask,
    files,
    symbols,
    primary_skill,
    secondary_skills,
    confidence,
    clarification_recommended,
    anti_legacy,
    top_scores: scores.slice(0, 4).map(s => ({ skill: s.skill, score: s.score })),
    matched_signals,
    timestamp: new Date().toISOString(),
  };

  if (emitLog) {
    process.stdout.write(JSON.stringify(routing_log, null, 2) + '\n');
  }

  return {
    primary_skill,
    secondary_skills,
    matched_signals,
    confidence,
    clarification_recommended,
    anti_legacy,
    scores,
    routing_log,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] && process.argv[1].endsWith('skill-router.mjs')) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/skill-router.mjs "<ask>" [--files "path1,path2"] [--symbols "Sym1,Sym2"]');
    process.exit(1);
  }

  const ask = args[0];
  let files = [];
  let symbols = [];

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--files' && args[i + 1]) {
      files = args[++i].split(',').map(s => s.trim());
    } else if (args[i] === '--symbols' && args[i + 1]) {
      symbols = args[++i].split(',').map(s => s.trim());
    }
  }

  const result = routeSkill({ ask, files, symbols, emitLog: false });

  console.log('\n🎯 JoyJoin Skill Router\n');
  console.log(`Ask: "${ask}"`);
  if (files.length) console.log(`Files: ${files.join(', ')}`);
  if (symbols.length) console.log(`Symbols: ${symbols.join(', ')}`);
  console.log('');
  console.log(`Primary skill:  ${result.primary_skill ?? '(none — clarification needed)'}`);
  if (result.secondary_skills.length) {
    console.log(`Secondary:      ${result.secondary_skills.join(', ')}`);
  }
  console.log(`Confidence:     ${result.confidence}`);
  console.log(`Clarification:  ${result.clarification_recommended ? 'recommended' : 'not needed'}`);
  if (result.matched_signals.length) {
    console.log(`\nMatched signals (top 8):`);
    result.matched_signals.slice(0, 8).forEach(s => console.log(`  • ${s}`));
  }
  if (result.anti_legacy.triggered) {
    console.log('\n⚠️  Anti-legacy warnings:');
    result.anti_legacy.warnings.forEach(w => console.log(`  ⚠  ${w}`));
  }
  console.log('\nTop scores:');
  result.scores.slice(0, 5).forEach(s => console.log(`  ${s.skill.padEnd(42)} ${s.score}`));
  console.log('');
}
