import { z } from 'zod';
import type { MiniScriptGameModeConfig } from './miniscriptGameModes';

/** Canonical API values for POST /api/miniscript/generate */
export const MINI_SCRIPT_STYLES = [
  'western_court',
  'medieval',
  'ancient_chinese',
  'xianxia',
  'future_tech',
  'modern_urban',
  'republican_era',
] as const;

export type MiniScriptStyle = (typeof MINI_SCRIPT_STYLES)[number];

export const MINI_SCRIPT_GENRES = [
  'light_reasoning',
  'thriller_mystery',
  'romance',
  'absurd_comedy',
] as const;

export type MiniScriptGenre = (typeof MINI_SCRIPT_GENRES)[number];

export const miniScriptGenerateRequestSchema = z.object({
  socialSessionId: z.string().min(1),
  playerCount: z.number().int().min(4).max(6),
  style: z.enum(MINI_SCRIPT_STYLES),
  genres: z.array(z.enum(MINI_SCRIPT_GENRES)).min(1).max(8),
  lite: z.boolean().optional().default(false),
  /** Human-readable picker label, used only as bounded prompt context. */
  selectedLabel: z.string().trim().min(1).max(24).optional(),
});

export type MiniScriptGenerateRequest = z.infer<typeof miniScriptGenerateRequestSchema>;

export const MINI_SCRIPT_GENERATION_STAGES = [
  'queued',
  'generating',
  'validating',
  'fallback',
  'persisting',
  'complete',
  'failed',
] as const;

export type MiniScriptGenerationStage = (typeof MINI_SCRIPT_GENERATION_STAGES)[number];

export type MiniScriptGenerationStatus = {
  stage: MiniScriptGenerationStage;
  progress: number;
  startedAt: number;
  updatedAt: number;
  estimatedTotalMs: number;
  style?: MiniScriptStyle;
  genres?: MiniScriptGenre[];
  selectedLabel?: string;
};

export type MiniScriptLibraryItem = {
  id: string;
  source: 'catalog' | 'session';
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
  title: string;
  premise: string;
  playerCount: number;
  generatedAt?: number;
};

export type MiniScriptLibraryResponse = {
  scripts: MiniScriptLibraryItem[];
  generationStatus: MiniScriptGenerationStatus | null;
};

// ─── v2 Schema Components ─────────────────────────────────────────────────────

const miniScriptClueSchema = z.object({
  clueId: z.string().min(1).max(32),
  text: z.string().min(1).max(400),
  revealedInAct: z.number().int().min(1).max(5),
  implies: z.array(z.string().min(1).max(32)).optional(),
});

export type MiniScriptClue = z.infer<typeof miniScriptClueSchema>;

const miniScriptSolutionSchema = z.object({
  who: z.string().min(1).max(120),
  what: z.string().min(1).max(200),
  why: z.string().min(1).max(300),
  /** 1-based index into the framework's characters — stable even when extra
   *  players cause duplicated roles with a 「·新客」 suffix. */
  whoSlot: z.number().int().min(1).max(6).optional(),
  /** V2 P2 (additive): 0-based index into `motiveOptions` marking the true
   *  motive. Server-only — the solution never rides client payloads until
   *  reveal. When absent, the server falls back to exact-matching
   *  `solution.why` against `motiveOptions` (see resolveCorrectMotiveIndex). */
  motiveIndex: z.number().int().min(0).max(3).optional().catch(undefined),
});

export type MiniScriptSolution = z.infer<typeof miniScriptSolutionSchema>;

const miniScriptPlayerKnowledgeSchema = z.object({
  slotIndex: z.number().int().min(0).max(5),
  knownFacts: z.array(z.string().min(1).max(300)).min(1).max(6),
  secretAgenda: z.string().min(1).max(400),
  truthfulAlibi: z.string().min(1).max(400),
});

export type MiniScriptPlayerKnowledge = z.infer<typeof miniScriptPlayerKnowledgeSchema>;

const miniScriptRedHerringSchema = z.object({
  text: z.string().min(1).max(400),
  misleadingTarget: z.string().min(1).max(120).optional(),
});

export type MiniScriptRedHerring = z.infer<typeof miniScriptRedHerringSchema>;

const miniScriptDeductionChainSchema = z.object({
  stepNumber: z.number().int().min(1).max(10),
  fromClues: z.array(z.string().min(1).max(32)).min(1),
  conclusion: z.string().min(1).max(400),
});

export type MiniScriptDeductionChain = z.infer<typeof miniScriptDeductionChainSchema>;

// ─── Character & Act (preserved from v1) ──────────────────────────────────────

export const miniScriptCharacterSchema = z.object({
  slotIndex: z.number().int().min(0).max(5),
  roleLabel: z.string().min(1).max(80),
  sinHook: z.string().min(1).max(400),
  alibi: z.string().min(1).max(500),
  secret: z.string().min(1).max(500),
});

export type MiniScriptCharacter = z.infer<typeof miniScriptCharacterSchema>;

export type MiniScriptCharacterPublic = Omit<MiniScriptCharacter, 'secret'>;

/**
 * Evidence item surfaced with an act (V2 P1 additive). `evidenceReactions`
 * is SERVER-ONLY — per-role reaction text (roleSlot → text) revealed when the
 * evidence is presented to that role; stripped at every client boundary.
 * Target reaction length 30–60 chars (prompt + offline critic); 120 hard cap.
 */
const miniScriptEvidenceReactionTextSchema = z.string().min(1).max(120);

export const miniScriptEvidenceSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(24),
  description: z.string().min(1).max(200),
  iconKey: z.string().min(1).max(32),
  evidenceReactions: z
    .record(z.string().regex(/^[1-6]$/), miniScriptEvidenceReactionTextSchema)
    .optional()
    .catch(undefined),
});

export type MiniScriptEvidence = z.infer<typeof miniScriptEvidenceSchema>;

export type MiniScriptEvidencePublic = Omit<MiniScriptEvidence, 'evidenceReactions'>;

const miniScriptActSchema = z.object({
  actNumber: z.number().int().min(1).max(5),
  title: z.string().min(1).max(120),
  beats: z.array(z.string().min(1).max(400)).min(1).max(12),
  /** Suspense hook that ends this act — players must want to continue. ≤80 chars. */
  cliffhanger: z.string().min(1).max(80).optional(),
  /** ≤2 evidence items per act. Optional so pre-V2-P1 frameworks still parse;
   *  an invalid LLM-supplied value is dropped instead of failing the parse. */
  evidence: z.array(miniScriptEvidenceSchema).max(2).optional().catch(undefined),
});

export type MiniScriptAct = z.infer<typeof miniScriptActSchema>;

export type MiniScriptActPublic = Omit<MiniScriptAct, 'evidence'> & {
  evidence?: MiniScriptEvidencePublic[];
};

/**
 * Short Chinese chip labels for the consensus vote (what happened / why).
 * Optional on the framework; an invalid LLM-supplied value is dropped
 * (`catch(undefined)`) instead of rejecting the whole framework parse.
 */
const miniScriptVoteOptionsSchema = z.object({
  what: z.array(z.string().trim().min(1).max(12)).min(3).max(4),
  why: z.array(z.string().trim().min(1).max(12)).min(3).max(4),
});

export type MiniScriptVoteOptions = z.infer<typeof miniScriptVoteOptionsSchema>;

/** Display-title convention: ≤12 Chinese chars. Schema bound is looser (24)
 * so an over-long LLM title can be derived-from-premise instead of failing parse. */
export const MINISCRIPT_TITLE_MAX_CHARS = 12;

// ─── v2 Story Framework ───────────────────────────────────────────────────────

export const miniScriptStoryFrameworkSchema = z.object({
  schemaVersion: z.literal(2),
  style: z.enum(MINI_SCRIPT_STYLES),
  genres: z.array(z.enum(MINI_SCRIPT_GENRES)).min(1),
  gameModeConfig: z.object({
    clueCountRange: z.tuple([z.number(), z.number()]),
    hasRedHerrings: z.boolean(),
    hasHiddenAgendas: z.boolean(),
    votingStyle: z.enum(['accusation', 'consensus', 'none']),
    winCondition: z.enum(['solve_mystery', 'find_traitor', 'match_pairs', 'laugh_track']),
    targetPlayMinutes: z.number(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
  }).optional(),
  /** Short evocative Chinese title (≤12 chars by convention). Optional so v2
   * data written before titles existed still parses; server derives one when absent. */
  title: z.string().trim().min(1).max(24).optional().catch(undefined),
  premise: z.string().min(1).max(2000),
  characters: z.array(miniScriptCharacterSchema).min(4).max(6),
  act_flow: z.array(miniScriptActSchema).min(2).max(4),
  ending: z.object({
    resolutionSummary: z.string().min(1).max(800),
    confessionMechanic: z.string().min(1).max(400),
  }),
  // v2 additions
  clues: z.array(miniScriptClueSchema).min(2).max(8),
  solution: miniScriptSolutionSchema,
  playerKnowledge: z.array(miniScriptPlayerKnowledgeSchema).min(4).max(6),
  redHerrings: z.array(miniScriptRedHerringSchema).optional(),
  deductionChain: z.array(miniScriptDeductionChainSchema).optional(),
  /** Chip labels for the structured vote; safe to show all players pre-vote. */
  voteOptions: miniScriptVoteOptionsSchema.optional().catch(undefined),
  /** Public motive candidates for the two-step reveal (3–4 strings). The
   *  correct motive stays server-only inside `solution.why`; options carry no
   *  correctness marker. Optional so pre-V2-P1 frameworks still parse. */
  motiveOptions: z
    .array(z.string().trim().min(1).max(40))
    .min(3)
    .max(4)
    .optional()
    .catch(undefined),
});

export type MiniScriptStoryFramework = z.infer<typeof miniScriptStoryFrameworkSchema>;

/** Public-safe framework stripped of all server-only secrets. */
export type MiniScriptStoryFrameworkPublic = Omit<
  MiniScriptStoryFramework,
  'clues' | 'solution' | 'playerKnowledge' | 'redHerrings' | 'deductionChain' | 'characters' | 'act_flow'
> & {
  characters: MiniScriptCharacterPublic[];
  act_flow: MiniScriptActPublic[];
};

// ─── Vote Schema ──────────────────────────────────────────────────────────────

/**
 * Structured vote: `suspectRoleSlot` (1-based index into the framework's
 * characters) is the tally key. Legacy free-text `who` is still accepted for
 * one release so stale clients do not 400 — the server best-effort maps it to
 * a role slot via exact roleLabel match and otherwise counts the ballot toward
 * participation only. `what`/`why` remain optional free-text color.
 */
export const miniScriptVoteSchema = z.object({
  // Range is validated server-side against the framework's role count so all
  // bad slots surface one domain error (INVALID_SUSPECT_SLOT), not a split
  // between transport and domain validation.
  suspectRoleSlot: z.number().int().optional(),
  who: z.string().min(1).max(120).optional(),
  what: z.string().min(1).max(200).optional(),
  why: z.string().min(1).max(300).optional(),
  /** V2 P2 (additive): which vote round this ballot belongs to. Defaults to
   *  round 1 (suspect). Round 2 (motive) requires the host to have opened it
   *  via POST /api/miniscript/open-motive-vote. */
  voteRound: z.union([z.literal(1), z.literal(2)]).optional(),
  /** V2 P2: 0-based index into the framework's public `motiveOptions`. Only
   *  meaningful for round-2 ballots; range-checked server-side. */
  motiveChoice: z.number().int().min(0).max(3).optional(),
});

export type MiniScriptVoteInput = z.infer<typeof miniScriptVoteSchema>;

// ─── Title Helpers ────────────────────────────────────────────────────────────

/**
 * Derive a display title from a premise: first clause (split on Chinese
 * punctuation), capped at `maxChars` with an ellipsis when truncated — never a
 * bare mid-sentence cut.
 */
export function deriveMiniScriptTitleFromPremise(
  premise: string,
  maxChars = MINISCRIPT_TITLE_MAX_CHARS,
): string {
  const firstClause = premise
    .split(/[，。！？；]/)
    .map((clause) => clause.trim())
    .find((clause) => clause.length > 0);
  if (!firstClause) return '今晚的神秘故事';
  return firstClause.length > maxChars ? `${firstClause.slice(0, maxChars)}…` : firstClause;
}

/**
 * Resolve the framework title: keep an explicit title when it respects the
 * ≤12-char convention; otherwise derive one from the premise.
 */
export function resolveMiniScriptTitle(title: string | undefined, premise: string): string {
  const explicit = title?.trim();
  if (explicit && explicit.length <= MINISCRIPT_TITLE_MAX_CHARS) return explicit;
  return deriveMiniScriptTitleFromPremise(premise, MINISCRIPT_TITLE_MAX_CHARS);
}

// ─── Vote Progress (structured vote + quorum reveal) ─────────────────────────

/**
 * V2 P2: resolve the server-only correct motive index for a framework.
 * Resolution chain (sprint contract AC-04):
 *   1. `solution.motiveIndex` when the schema carries a valid index;
 *   2. exact match of `solution.why` against `motiveOptions`;
 *   3. resolution failure → null, and the framework is treated as having no
 *      round 2 (degrades to the single-step vote).
 * The result is a 0-based index into `motiveOptions` — the same indexing the
 * client uses for `motiveChoice`.
 */
export function resolveCorrectMotiveIndex(params: {
  motiveOptions?: string[];
  solutionWhy?: string;
  solutionMotiveIndex?: number;
}): number | null {
  const { motiveOptions, solutionWhy, solutionMotiveIndex } = params;
  if (!motiveOptions || motiveOptions.length === 0) return null;
  if (
    typeof solutionMotiveIndex === 'number' &&
    Number.isInteger(solutionMotiveIndex) &&
    solutionMotiveIndex >= 0 &&
    solutionMotiveIndex < motiveOptions.length
  ) {
    return solutionMotiveIndex;
  }
  if (solutionWhy) {
    const exactIdx = motiveOptions.findIndex((option) => option === solutionWhy);
    if (exactIdx >= 0) return exactIdx;
  }
  return null;
}

/** Escape hatch: the host may reveal once the vote has been open this long. */
export const MINISCRIPT_VOTE_MIN_OPEN_MS = 90_000;

export type MiniScriptVoteProgress = {
  votedCount: number;
  totalAssigned: number;
  quorum: number;
  canReveal: boolean;
  /** Epoch ms when the vote phase opened (final act revealed). */
  voteOpenedAt?: number;
  /** Ballots per 1-based role slot; sorted by count desc, then slot asc. */
  tally: Array<{ roleSlot: number; count: number }>;
};

/** quorum = max(2, ceil(totalAssigned * 2/3)); 0 when nobody is assigned. */
export function computeMiniScriptQuorum(totalAssigned: number): number {
  if (totalAssigned <= 0) return 0;
  return Math.max(2, Math.ceil((totalAssigned * 2) / 3));
}

export function computeMiniScriptVoteProgress(params: {
  votes: Array<{ userId: string; suspectRoleSlot?: number }>;
  totalAssigned: number;
  voteOpenedAt?: number;
  now?: number;
}): MiniScriptVoteProgress {
  const now = params.now ?? Date.now();
  const votedCount = new Set(params.votes.map((vote) => vote.userId)).size;
  const quorum = computeMiniScriptQuorum(params.totalAssigned);
  const tallyMap = new Map<number, number>();
  for (const vote of params.votes) {
    if (typeof vote.suspectRoleSlot === 'number') {
      tallyMap.set(vote.suspectRoleSlot, (tallyMap.get(vote.suspectRoleSlot) ?? 0) + 1);
    }
  }
  const tally = Array.from(tallyMap.entries())
    .map(([roleSlot, count]) => ({ roleSlot, count }))
    .sort((a, b) => b.count - a.count || a.roleSlot - b.roleSlot);
  const quorumMet = params.totalAssigned > 0 && votedCount >= quorum;
  const openLongEnough =
    params.voteOpenedAt !== undefined && now - params.voteOpenedAt >= MINISCRIPT_VOTE_MIN_OPEN_MS;
  return {
    votedCount,
    totalAssigned: params.totalAssigned,
    quorum,
    canReveal: quorumMet || openLongEnough,
    voteOpenedAt: params.voteOpenedAt,
    tally,
  };
}

// ─── v1 Legacy Schema (for migration) ─────────────────────────────────────────

const miniScriptCharacterSchemaV1 = z.object({
  slotIndex: z.number().int().min(0).max(5),
  roleLabel: z.string().min(1).max(80),
  sinHook: z.string().min(1).max(400),
  alibi: z.string().min(1).max(500),
  secret: z.string().min(1).max(500),
});

const miniScriptActSchemaV1 = z.object({
  actNumber: z.number().int().min(1).max(5),
  title: z.string().min(1).max(120),
  beats: z.array(z.string().min(1).max(400)).min(1).max(12),
  cliffhanger: z.string().min(1).max(80).optional(),
});

const miniScriptStoryFrameworkSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  style: z.enum(MINI_SCRIPT_STYLES),
  genres: z.array(z.enum(MINI_SCRIPT_GENRES)).min(1),
  premise: z.string().min(1).max(2000),
  characters: z.array(miniScriptCharacterSchemaV1).min(4).max(6),
  act_flow: z.array(miniScriptActSchemaV1).min(2).max(4),
  ending: z.object({
    resolutionSummary: z.string().min(1).max(800),
    confessionMechanic: z.string().min(1).max(400),
  }),
});

export type MiniScriptStoryFrameworkV1 = z.infer<typeof miniScriptStoryFrameworkSchemaV1>;

// ─── Migration: v1 → v2 ───────────────────────────────────────────────────────

/**
 * Migrate a v1 framework to v2 by generating deterministic defaults for new fields.
 * Used when loading legacy session state or cached frameworks.
 */
export function migrateMiniScriptFrameworkV1ToV2(v1: MiniScriptStoryFrameworkV1): MiniScriptStoryFramework {
  // Generate deterministic placeholder clues from act_flow beats
  const clues: MiniScriptClue[] = v1.act_flow.flatMap((act, actIdx) =>
    act.beats.slice(0, 2).map((beat, beatIdx) => ({
      clueId: `c${actIdx}_${beatIdx}`,
      text: beat,
      revealedInAct: act.actNumber,
      implies: actIdx < v1.act_flow.length - 1 ? [`c${actIdx + 1}_0`] : undefined,
    }))
  ).slice(0, 4);

  // Ensure at least 2 clues
  while (clues.length < 2) {
    clues.push({
      clueId: `c${clues.length}`,
      text: '还有更多细节等待发现…',
      revealedInAct: 1,
    });
  }

  const solution: MiniScriptSolution = {
    who: v1.characters[0]?.roleLabel ?? '未知角色',
    what: v1.ending.resolutionSummary.slice(0, 60),
    why: '真相藏在细节之中',
  };

  const playerKnowledge: MiniScriptPlayerKnowledge[] = v1.characters.map((c) => ({
    slotIndex: c.slotIndex,
    knownFacts: [`我是${c.roleLabel}`, c.alibi],
    secretAgenda: c.secret,
    truthfulAlibi: c.alibi,
  }));

  return {
    schemaVersion: 2,
    style: v1.style,
    genres: v1.genres,
    premise: v1.premise,
    characters: v1.characters,
    act_flow: v1.act_flow,
    ending: v1.ending,
    clues,
    solution,
    playerKnowledge,
    // No redHerrings or deductionChain for migrated legacy data
  };
}

// ─── Parse / Validate ─────────────────────────────────────────────────────────

export function parseMiniScriptStoryFramework(data: unknown): MiniScriptStoryFramework {
  // Try v2 first
  const v2Result = miniScriptStoryFrameworkSchema.safeParse(data);
  if (v2Result.success) return v2Result.data;

  // Fallback: try v1 and migrate
  const v1Result = miniScriptStoryFrameworkSchemaV1.safeParse(data);
  if (v1Result.success) {
    return migrateMiniScriptFrameworkV1ToV2(v1Result.data);
  }

  throw new Error(
    `Invalid MiniScriptStoryFramework: neither v1 nor v2 schema matched. v2 error: ${v2Result.error.message}; v1 error: ${v1Result.error?.message ?? 'N/A'}`
  );
}

/**
 * Safe parse that returns null instead of throwing.
 */
export function safeParseMiniScriptStoryFramework(data: unknown): MiniScriptStoryFramework | null {
  try {
    return parseMiniScriptStoryFramework(data);
  } catch {
    return null;
  }
}
