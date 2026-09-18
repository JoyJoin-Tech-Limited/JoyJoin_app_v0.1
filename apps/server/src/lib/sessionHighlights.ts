/**
 * Session Highlights Extractor — Wave 3 Context Injector Phase 2
 * (sprint wave3-highlightsInjector, contract AC-04/AC-05).
 *
 * Pure, rule-based, synchronous extraction of aggregate session highlights
 * from social-icebreaker session state. NO LLM calls, NO async, NO imports
 * from AI modules — the extractor runs inside transitionPhase on the host
 * /advance critical path, so it must be cheap and deterministic.
 *
 * Signal reality (verified 2026-09-17, locked in the contract):
 * - quip_battle: most-upvoted quip — extractable PRE-CLEANUP ONLY
 *   (cleanupPhaseStateForNextPhase wipes quipBattleVotes/quipBattleResults).
 * - lie_detective: closest vote finish from lieDetectiveRevealHistory
 *   ({ round, correctRate }) — survives cleanup but is V2-only; V1 sessions
 *   (the current default) contribute nothing.
 * - warmup: topics actually discussed (no per-topic vote signal exists —
 *   documented degradation from the plan's "top-3 voted topics").
 * - micro_challenge / personality_dice: no vote/rating signal persists;
 *   these phases contribute nothing (absence is normal, not an error).
 *
 * Privacy canon (AC-05): the output contains NO userId, NO displayName, and
 * no archetype→player mapping. Quip answer text is included (sanitized per
 * verifier M5) because it was already public in-session at reveal; the
 * winner's name is never included.
 *
 * Storage format: state.highlights is a single string of sections joined
 * with '；'. Each section carries a fixed prefix label (金句/测谎/聊到) so a
 * later transition can parse the existing string back into sections for
 * per-section replace semantics (M3: replace-only-when-non-empty).
 */

import type { SocialSessionState } from '@shared/socialIcebreaker';

/** Hard cap on the assembled highlights body (contract AC-04). */
export const HIGHLIGHTS_MAX_CHARS = 300;

/** AITrace promptVersion recorded when extraction produced sections. */
export const HIGHLIGHTS_EXTRACTOR_PROMPT_VERSION = 'highlights-extractor-v1';

const QUIP_ANSWER_MAX_CHARS = 60;
const WARMUP_TOPIC_MAX_CHARS = 30;
const WARMUP_MAX_TOPICS = 3;
const WARMUP_SECTION_MAX_CHARS = 150;

/** Section labels — the parse anchors for merge replace semantics. */
const QUIP_PREFIX = '金句';
const LIE_PREFIX = '测谎';
const WARMUP_PREFIX = '聊到';

export interface SessionHighlightSections {
  quip?: string;
  lie?: string;
  warmup?: string;
}

/**
 * Verifier M5: sanitize user-authored text before it enters an LLM prompt
 * block — strip newlines, the prompt-structure brackets 【】 (breakout
 * vector), section delimiters and control characters so a quip can never
 * break out of the 【本场高光】 block or forge a section boundary.
 */
export function sanitizeHighlightText(text: string): string {
  return text
    // Control characters (incl. newlines) first.
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    // Prompt-structure brackets and section delimiters (space-replaced so
    // stripped segments never fuse into fake words; whitespace collapses below).
    .replace(/[【】「」；]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Most-upvoted quip: the winning answer of the highest-vote quip_battle
 * result. MUST be called on pre-cleanup state (results are wiped on phase
 * exit). Ties between prompts resolve to the first result (array order —
 * deterministic). Returns undefined when no usable signal exists.
 */
export function extractQuipBattleHighlight(
  state: SocialSessionState,
): string | undefined {
  const results = state.quipBattleResults;
  if (!Array.isArray(results) || results.length === 0) return undefined;

  let top: (typeof results)[number] | undefined;
  for (const result of results) {
    if (!result || typeof result.voteCount !== 'number' || result.voteCount <= 0) continue;
    if (!top || result.voteCount > top.voteCount) top = result;
  }
  if (!top) return undefined;

  const winningAnswer = top.answers?.find((a) => a.userId === top.winnerUserId);
  const answerText = sanitizeHighlightText(winningAnswer?.answerText ?? '');
  if (!answerText) return undefined;

  const clipped = answerText.slice(0, QUIP_ANSWER_MAX_CHARS);
  // Aggregate only: the vote count is fine, the winner's name is NOT (AC-05).
  return `${QUIP_PREFIX}「${clipped}」获${top.voteCount}票`;
}

/**
 * Closest vote finish: the lie_detective round whose correctRate is nearest
 * 0.5 (the most even split). Ties → lowest round number (contract AC-04).
 * V2-only source — lieDetectiveRevealHistory is written only in V2 mode, so
 * V1 sessions (current default) return undefined. Survives phase cleanup.
 */
export function extractLieDetectiveHighlight(
  state: SocialSessionState,
): string | undefined {
  const history = state.lieDetectiveRevealHistory;
  if (!Array.isArray(history) || history.length === 0) return undefined;

  let best: { round: number; correctRate: number } | undefined;
  for (const entry of history) {
    if (!entry || typeof entry.correctRate !== 'number') continue;
    if (!best) {
      best = entry;
      continue;
    }
    const distance = Math.abs(entry.correctRate - 0.5);
    const bestDistance = Math.abs(best.correctRate - 0.5);
    if (distance < bestDistance || (distance === bestDistance && entry.round < best.round)) {
      best = entry;
    }
  }
  if (!best) return undefined;

  return `${LIE_PREFIX}第${best.round}轮最胶着（正确率${Math.round(best.correctRate * 100)}%）`;
}

/**
 * Topics actually discussed (≤3): warmup has NO per-topic vote signal, so
 * the plan's "top-3 voted topics" degrades to the discussed slice
 * (contract AC-04 documented degradation). warmupTopics survives cleanup.
 */
export function extractWarmupHighlight(
  state: SocialSessionState,
): string | undefined {
  const topics = state.warmupTopics;
  if (!Array.isArray(topics) || topics.length === 0) return undefined;
  const currentIndex = state.currentTopicIndex;
  if (typeof currentIndex !== 'number' || currentIndex < 0) return undefined;

  const discussed = topics
    .slice(0, Math.min(currentIndex + 1, WARMUP_MAX_TOPICS * 2))
    .map((t) => sanitizeHighlightText(t?.question ?? '').slice(0, WARMUP_TOPIC_MAX_CHARS))
    .filter((q) => q.length > 0)
    .slice(0, WARMUP_MAX_TOPICS);
  if (discussed.length === 0) return undefined;

  // Bound the whole section: drop trailing topics (never mid-topic) until fit.
  const render = (qs: string[]) => `${WARMUP_PREFIX}${qs.map((q) => `「${q}」`).join('')}`;
  while (discussed.length > 1 && render(discussed).length > WARMUP_SECTION_MAX_CHARS) {
    discussed.pop();
  }
  const section = render(discussed);
  return section.length <= WARMUP_SECTION_MAX_CHARS ? section : undefined;
}

/** Parse a stored highlights string back into labeled sections. */
function parseSections(highlights: string): {
  sections: SessionHighlightSections;
  unknown: string[];
} {
  const sections: SessionHighlightSections = {};
  const unknown: string[] = [];
  for (const segment of highlights.split('；')) {
    const s = segment.trim();
    if (!s) continue;
    if (s.startsWith(QUIP_PREFIX)) sections.quip = s;
    else if (s.startsWith(LIE_PREFIX)) sections.lie = s;
    else if (s.startsWith(WARMUP_PREFIX)) sections.warmup = s;
    else unknown.push(s);
  }
  return { sections, unknown };
}

/**
 * Merge freshly extracted sections into the existing highlights string.
 *
 * Semantics (contract AC-04, verifier M3):
 * - Per-section REPLACE: a re-run phase overwrites its own section, never
 *   duplicates.
 * - REPLACE-ONLY-WHEN-NON-EMPTY: a section whose fresh extraction is
 *   empty/absent leaves existing content untouched — this makes the
 *   bonus-gate double-fire (extraction on the pause pass, then again after
 *   cleanup wiped quip data) and countCurrentPhaseCompleted===false
 *   re-entries lossless.
 * - Sections join with '；' in fixed priority order quip > lie > warmup
 *   (rationale: quip is the only signal carrying actual user words; the
 *   warmup section duplicates what recap already gets via topicsDiscussed).
 * - Hard cap HIGHLIGHTS_MAX_CHARS: lowest-priority sections are dropped
 *   first; a section is never truncated mid-section (extractors bound their
 *   own content instead).
 *
 * Returns undefined when the merged result is empty.
 */
export function mergeSessionHighlights(
  existing: string | undefined,
  incoming: SessionHighlightSections,
): string | undefined {
  const { sections, unknown } = parseSections(existing ?? '');
  if (incoming.quip) sections.quip = incoming.quip;
  if (incoming.lie) sections.lie = incoming.lie;
  if (incoming.warmup) sections.warmup = incoming.warmup;

  const ordered: string[] = [];
  if (sections.quip) ordered.push(sections.quip);
  if (sections.lie) ordered.push(sections.lie);
  if (sections.warmup) ordered.push(sections.warmup);
  ordered.push(...unknown);

  // Cap: drop lowest-priority (trailing) sections until the join fits.
  while (ordered.length > 1 && ordered.join('；').length > HIGHLIGHTS_MAX_CHARS) {
    ordered.pop();
  }
  if (ordered.length === 0) return undefined;
  const merged = ordered.join('；');
  return merged.length <= HIGHLIGHTS_MAX_CHARS ? merged : undefined;
}

/**
 * Convenience for transitionPhase: extract every section the just-left
 * phase can contribute. Only quip_battle / lie_detective / warmup carry
 * extractable signal; all other phases return an empty record.
 */
export function extractHighlightsForPhase(
  state: SocialSessionState,
  phase: SocialSessionState['currentPhase'],
): SessionHighlightSections {
  switch (phase) {
    case 'quip_battle':
      return { quip: extractQuipBattleHighlight(state) };
    case 'lie_detective':
      return { lie: extractLieDetectiveHighlight(state) };
    case 'warmup':
      return { warmup: extractWarmupHighlight(state) };
    default:
      return {};
  }
}
