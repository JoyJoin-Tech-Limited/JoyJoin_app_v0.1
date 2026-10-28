/**
 * TablePersona — deterministic, server-only, aggregate-only table profile.
 *
 * W1/W2 (see `docs/design/icebreaker-w1-w3-implementation-plan-20261027.md` §2
 * and §4): the LLM never reads raw roster profiles. It reads the small,
 * approved aggregate produced here — energy band, depth appetite, shared
 * anchors, and diversity *counts*.
 *
 * Hard rules (W3 boundary):
 * - no names, userIds, display names, bios, gender, exact age, city, or any
 *   per-person activity ever appear in the output;
 * - no individual ACOEXP score is exposed, only a roster average used to pick
 *   one of three coarse bands;
 * - aggregate bands are allowed to exist at all only when at least
 *   `TABLE_PERSONA_MIN_TRAIT_SAMPLES` members carry scores, so a "table"
 *   label can never mirror a single person;
 * - depth appetite exposes no counts and no individual preferences.
 *
 * Pure and deterministic: no DB access, no clock reads, no LLM, no writes.
 * Callers (route/AI service) own the roster load, the batch trait lookup, the
 * feature-flag gate, and fail-open behaviour.
 */

import { buildArchetypeMix, deriveArchetypeComposition } from '@shared/runPlanCompiler';
import { resolveRosterArchetype } from '@shared/personality/archetypeNames';
import {
  deriveTableRhythmAppetite,
  type TableRhythmAppetite,
} from '@shared/tableRhythm';
import {
  buildSharedInterestAnchors,
  type SharedInterestAnchor,
} from './icebreakerRosterSignals';

export type TableEnergy = 'low' | 'mid' | 'high';
export type TableDepthAppetite = TableRhythmAppetite;

/** Only counts leave this module — never the labels behind them. */
export interface TablePersonaDiversity {
  rosterSize: number;
  archetypeBuckets: number;
  industryBuckets: number;
  lifeStageBuckets: number;
}

export interface TablePersona {
  energy: TableEnergy;
  depthAppetite: TableDepthAppetite;
  anchors: SharedInterestAnchor[];
  diversity: TablePersonaDiversity;
}

/** Roster projection the persona may read. Structurally satisfied by `SocialSessionParticipantSummary`. */
export interface TablePersonaRosterMember {
  userId?: string;
  displayName?: string;
  /** Legacy Chinese archetype name (`users.archetype`). */
  archetype?: string | null;
  /** Canonical V4 archetype id (`users.primary_archetype`), preferred. */
  primaryArchetype?: string | null;
  interests?: string[];
  profile?: {
    industryLabel?: string | null;
    lifeStage?: string | null;
    tableVibePreference?: string | null;
  } | null;
}

/** Per-member ACOEXP slice. Values are 0–100 after repository normalization. */
export interface TablePersonaTraitScores {
  extraversion: number;
  affinity: number;
  emotionalStability: number;
}

export type TablePersonaRoleResults = ReadonlyMap<string, TablePersonaTraitScores>;

// ─── Documented thresholds ──────────────────────────────────────────────────

/**
 * Roster-average extraversion (`X`) bands. Simple, documented, and deliberately
 * coarse: the persona steers curation, it does not diagnose anyone.
 */
export const TABLE_ENERGY_LOW_MAX_X = 45;
export const TABLE_ENERGY_HIGH_MIN_X = 70;

/**
 * `high` is capped to `mid` when the roster-average affinity (`A`) is below
 * this floor — an energetic table is not automatically a warm/open one, and
 * prompts should not assume disclosure comfort from energy alone.
 */
export const TABLE_ENERGY_HIGH_MIN_A = 40;

/**
 * Minimum number of members with ACOEXP rows before the trait path is used.
 * Three members keeps the band from being a single person's score in disguise.
 */
export const TABLE_PERSONA_MIN_TRAIT_SAMPLES = 3;

/** Larger tables need a third of the table (min 3) behind an anchor. */
export const TABLE_PERSONA_LARGE_ROSTER = 6;
/** Anchor slot count; M3 prompts use at most 2 of them. */
export const TABLE_PERSONA_ANCHOR_LIMIT = 3;

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

function finiteTrait(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function canonicalArchetypeKey(member: TablePersonaRosterMember): string | undefined {
  return (
    resolveRosterArchetype(member.primaryArchetype, member.archetype) ??
    member.primaryArchetype?.trim() ??
    member.archetype?.trim() ??
    undefined
  );
}

/** Energy from roster-average `X`, tempered by `A`.
 * Returns `undefined` when there are too few scored members to speak for a table.
 */
function deriveEnergyFromTraits(
  roster: ReadonlyArray<TablePersonaRosterMember>,
  roleResults: TablePersonaRoleResults,
): TableEnergy | undefined {
  const extraversions: number[] = [];
  const affinities: number[] = [];
  for (const member of roster) {
    if (!member.userId) continue;
    const traits = roleResults.get(member.userId);
    if (!traits) continue;
    const extraversion = finiteTrait(traits.extraversion);
    if (extraversion === undefined) continue;
    extraversions.push(Math.min(100, Math.max(0, extraversion)));
    const affinity = finiteTrait(traits.affinity);
    if (affinity !== undefined) affinities.push(Math.min(100, Math.max(0, affinity)));
  }

  if (extraversions.length < TABLE_PERSONA_MIN_TRAIT_SAMPLES) return undefined;
  const avgX = mean(extraversions);
  if (avgX === undefined) return undefined;
  const avgA = affinities.length >= TABLE_PERSONA_MIN_TRAIT_SAMPLES ? mean(affinities) : undefined;

  if (avgX >= TABLE_ENERGY_HIGH_MIN_X) {
    if (avgA !== undefined && avgA < TABLE_ENERGY_HIGH_MIN_A) return 'mid';
    return 'high';
  }
  if (avgX < TABLE_ENERGY_LOW_MAX_X) return 'low';
  return 'mid';
}

/**
 * Energy from archetype composition — the pre-ACOEXP path and the fallback
 * whenever trait coverage is too thin. Uses the same `shyHeavy`/`outgoingHeavy`
 * rules the run-plan compiler already trusts, so both paths agree in spirit.
 */
function deriveEnergyFromArchetypes(
  roster: ReadonlyArray<TablePersonaRosterMember>,
): TableEnergy {
  const composition = deriveArchetypeComposition(buildArchetypeMix(roster));
  if (!composition) return 'mid';
  if (composition.shyHeavy) return 'low';
  if (composition.outgoingHeavy) return 'high';
  return 'mid';
}

function countDistinctArchetypes(roster: ReadonlyArray<TablePersonaRosterMember>): number {
  const seen = new Set<string>();
  for (const member of roster) {
    const key = canonicalArchetypeKey(member);
    if (key) seen.add(key);
  }
  return seen.size;
}

function countDistinctProfileField(
  roster: ReadonlyArray<TablePersonaRosterMember>,
  pick: (profile: NonNullable<TablePersonaRosterMember['profile']>) => string | null | undefined,
): number {
  const seen = new Set<string>();
  for (const member of roster) {
    const profile = member.profile;
    if (!profile) continue;
    const value = pick(profile);
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) seen.add(trimmed);
  }
  return seen.size;
}

/**
 * Derive the table persona.
 *
 * `roleResults` is optional enrichment: absent, empty, or thin (fewer than
 * `TABLE_PERSONA_MIN_TRAIT_SAMPLES` scored members) simply falls back to the
 * archetype-composition path. There is no error mode — the caller never has to
 * branch on it, and nothing here can fail a session.
 */
export function deriveTablePersona(params: {
  roster: ReadonlyArray<TablePersonaRosterMember>;
  roleResults?: TablePersonaRoleResults | null;
}): TablePersona {
  const roster = params.roster ?? [];
  const rosterSize = roster.length;

  const energy =
    (params.roleResults && params.roleResults.size > 0
      ? deriveEnergyFromTraits(roster, params.roleResults)
      : undefined) ?? deriveEnergyFromArchetypes(roster);

  const anchors = buildSharedInterestAnchors(roster, {
    minMembers: rosterSize >= TABLE_PERSONA_LARGE_ROSTER ? 3 : 2,
    limit: TABLE_PERSONA_ANCHOR_LIMIT,
  });

  return {
    energy,
    depthAppetite: deriveTableRhythmAppetite(roster),
    anchors,
    diversity: {
      rosterSize,
      archetypeBuckets: countDistinctArchetypes(roster),
      industryBuckets: countDistinctProfileField(roster, (profile) => profile.industryLabel),
      lifeStageBuckets: countDistinctProfileField(roster, (profile) => profile.lifeStage),
    },
  };
}

/**
 * Prompt-facing anchor labels: at most `limit` (default 2), trimmed, deduped.
 * Coverage stays server-side — a participant must never learn how many people
 * share an interest.
 */
export function resolveTableAnchorsForPrompt(
  persona: TablePersona | null | undefined,
  limit: number = 2,
): string[] {
  if (!persona || limit <= 0) return [];
  const labels: string[] = [];
  for (const anchor of persona.anchors) {
    const label = typeof anchor.label === 'string' ? anchor.label.trim() : '';
    if (!label) continue;
    if (labels.includes(label)) continue;
    labels.push(label);
    if (labels.length >= limit) break;
  }
  return labels;
}
