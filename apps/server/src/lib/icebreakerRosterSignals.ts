/**
 * Icebreaker roster signals (W5, gm-debrief).
 *
 * Pure, deterministic helpers that turn a matched roster into prompt-ready
 * signals. Kept out of the AI service so prompt builders and callers can be
 * unit-tested without provider credentials.
 *
 * These signals are ENRICHMENT ONLY. They never feed deterministic scoring —
 * the `user_interest_signals` boundary is respected (this file reads plain
 * `interests` labels, not the AI-derived signal table).
 */

import {
  buildArchetypeMix,
  deriveArchetypeComposition,
} from '@shared/runPlanCompiler';
import { INTEREST_TAXONOMY, type InterestDefinition } from '@shared/interests';

export interface RosterSignalMember {
  displayName?: string;
  archetype?: string | null;
  /** Canonical V4 archetype id; preferred over the legacy display-name column. */
  primaryArchetype?: string | null;
  interests?: string[];
}

export interface SharedInterestAnchor {
  label: string;
  coverage: number;
  macroCategory: InterestDefinition['macroCategory'];
  /** Generic politeness labels are de-prioritised but never discarded. */
  generic: boolean;
}

/** Labels that almost everyone can claim; they make weak social anchors. */
const GENERIC_INTEREST_LABELS = new Set([
  '咖啡',
  '旅行',
  '电影',
  '美食',
  '健身',
]);

const INTEREST_BY_ALIAS = new Map<string, InterestDefinition>();
for (const definition of INTEREST_TAXONOMY) {
  for (const alias of [definition.label, ...(definition.synonyms ?? [])]) {
    const key = alias.trim().toLowerCase();
    if (key) INTEREST_BY_ALIAS.set(key, definition);
  }
}

function resolveInterestDefinition(raw: string): InterestDefinition | undefined {
  return INTEREST_BY_ALIAS.get(raw.trim().toLowerCase());
}

/**
 * Shared-interest anchors: canonical labels declared by at least `minMembers`
 * distinct members. Selection is coverage-aware, taxonomy-normalised, and
 * category-diverse:
 *
 * 1. synonyms/aliases collapse to one canonical label (咖啡 vs 咖啡馆);
 * 2. generic politeness labels (咖啡/旅行/电影/美食/健身) sort after specific
 *    labels even when their raw coverage is higher;
 * 3. the first pass takes at most one label per macroCategory, then fills the
 *    remaining slots by coverage. This keeps a three-anchor prompt from
 *    becoming three food labels.
 *
 * Coverage is returned for safety checks but is never shown to participants.
 * Pure and deterministic; no per-member identity escapes this function.
 */
export function buildSharedInterestAnchors(
  roster: ReadonlyArray<RosterSignalMember>,
  options: { minMembers?: number; limit?: number } = {},
): SharedInterestAnchor[] {
  const minMembers = options.minMembers ?? 2;
  const limit = options.limit ?? 3;
  if (!roster || roster.length === 0 || limit <= 0) return [];

  const countByLabel = new Map<string, { definition?: InterestDefinition; members: Set<number> }>();
  roster.forEach((member, memberIndex) => {
    const seen = new Set<string>();
    for (const raw of member.interests ?? []) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const definition = resolveInterestDefinition(trimmed);
      const label = definition?.label ?? trimmed;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = countByLabel.get(key) ?? { definition, members: new Set<number>() };
      existing.members.add(memberIndex);
      countByLabel.set(key, existing);
    }
  });

  const anchors: SharedInterestAnchor[] = Array.from(countByLabel.entries())
    .filter(([, value]) => value.members.size >= minMembers)
    .map(([key, value]) => {
      const label = value.definition?.label ?? key;
      return {
        label,
        coverage: value.members.size,
        macroCategory: value.definition?.macroCategory ?? 'life',
        generic: GENERIC_INTEREST_LABELS.has(label),
      };
    })
    .sort((a, b) => {
      if (a.generic !== b.generic) return a.generic ? 1 : -1;
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      if (a.macroCategory !== b.macroCategory) return a.macroCategory.localeCompare(b.macroCategory);
      return a.label.localeCompare(b.label);
    });

  const selected: SharedInterestAnchor[] = [];
  const usedCategories = new Set<string>();
  for (const anchor of anchors) {
    if (selected.length >= limit) break;
    if (usedCategories.has(anchor.macroCategory)) continue;
    selected.push(anchor);
    usedCategories.add(anchor.macroCategory);
  }
  for (const anchor of anchors) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.label === anchor.label)) selected.push(anchor);
  }
  return selected;
}

/** Prompt-facing labels only; coverage stays server-side. */
export function buildSharedInterestHooks(
  roster: ReadonlyArray<RosterSignalMember>,
  options: { minMembers?: number; limit?: number } = {},
): string[] {
  return buildSharedInterestAnchors(roster, options).map((anchor) => anchor.label);
}

export type MicroChallengeEnergyArc = 'start' | 'build' | 'peak' | 'winddown';

/**
 * Deterministic energy-arc hint for micro-challenge selection (AC-W5.3).
 *
 * Micro-challenge is the second phase (early), so the default target is
 * `build` (medium). A quiet table — low-energy archetype majority, or a
 * host-selected relaxed/emotional mood — is targeted LOW (`start`) so a calm
 * table is never handed a high-energy challenge. `peak`/`winddown` are not
 * emitted for micro-challenge today but remain valid selector inputs.
 */
export function inferMicroChallengeEnergyArc(params: {
  roster?: ReadonlyArray<RosterSignalMember>;
  mood?: 'relaxed' | 'funny' | 'life' | 'emotional';
}): MicroChallengeEnergyArc {
  const composition = deriveArchetypeComposition(buildArchetypeMix(params.roster ?? []));
  const calmMood = params.mood === 'relaxed' || params.mood === 'emotional';
  if (composition?.shyHeavy || calmMood) return 'start';
  return 'build';
}

/**
 * Render one prompt line per roster member (name + archetype + top interest)
 * so MiniScript characters can weave at least one real trait. Returns [] when
 * no member has any identifying signal.
 */
export function buildRosterTraitLines(
  roster: ReadonlyArray<RosterSignalMember>,
  options: { maxInterestsPerMember?: number } = {},
): string[] {
  const maxInterests = options.maxInterestsPerMember ?? 2;
  if (!roster || roster.length === 0) return [];

  const lines: string[] = [];
  for (const member of roster) {
    const name = member.displayName?.trim();
    const archetype = member.archetype?.trim();
    const interests = (member.interests ?? [])
      .filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
      .map((i) => i.trim())
      .slice(0, maxInterests);
    if (!name && !archetype && interests.length === 0) continue;

    const parts: string[] = [];
    if (archetype) parts.push(archetype);
    if (interests.length > 0) parts.push(`兴趣：${interests.join('、')}`);
    lines.push(`${name ?? '成员'}${parts.length > 0 ? `（${parts.join('；')}）` : ''}`);
  }
  return lines;
}

/** Per-slot character traits woven from a real matched player. */
export interface RosterCharacterTrait {
  roleLabel: string;
  sinHook: string;
  alibi: string;
  secret: string;
}

/**
 * W5 (AC-W5.4) — deterministic roster → character weaving for the mini-script
 * **fallback** path. The live prompt path weaves roster traits via
 * `buildMiniScriptGenerationPrompt`; this is the failure-path twin and the
 * single source of truth for "≥1 real trait per character".
 *
 * Guarantees one real trait per slot whenever `roster` has ≥1 named member:
 * `roleLabel` is always the player's real display name (interest/archetype are
 * additive). Returns `null` when no member carries a display name so callers
 * keep their curated catalog characters untouched.
 *
 * Members are cycled when `slotCount` exceeds the roster length so a defensive
 * short roster can never leave a slot trait-less.
 */
export function buildRosterCharacterTraits(
  roster: ReadonlyArray<RosterSignalMember>,
  slotCount: number,
): RosterCharacterTrait[] | null {
  if (slotCount <= 0) return null;
  const members = (roster ?? []).filter(
    (m): m is RosterSignalMember & { displayName: string } =>
      typeof m.displayName === 'string' && m.displayName.trim().length > 0,
  );
  if (members.length === 0) return null;

  return Array.from({ length: slotCount }, (_, slot) => {
    const member = members[slot % members.length]!;
    const name = member.displayName.trim();
    const interests = (member.interests ?? [])
      .filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
      .map((i) => i.trim());
    const topInterest = interests[0];
    const secondInterest = interests[1];
    const archetype = member.archetype?.trim();
    return {
      roleLabel: name,
      sinHook: topInterest
        ? `一聊到「${topInterest}」就停不下来`
        : archetype
          ? `带着「${archetype}」的劲儿`
          : '热情但有点健忘',
      alibi: archetype
        ? `用「${archetype}」的方式观察着每一个人`
        : '整场都在场，但只记得模糊的细节',
      secret: secondInterest ? `其实还偷偷喜欢${secondInterest}` : '其实有点紧张',
    };
  });
}
