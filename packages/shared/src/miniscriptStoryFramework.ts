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

const miniScriptActSchema = z.object({
  actNumber: z.number().int().min(1).max(5),
  title: z.string().min(1).max(120),
  beats: z.array(z.string().min(1).max(400)).min(1).max(12),
  /** Suspense hook that ends this act — players must want to continue. ≤80 chars. */
  cliffhanger: z.string().min(1).max(80).optional(),
});

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
});

export type MiniScriptStoryFramework = z.infer<typeof miniScriptStoryFrameworkSchema>;

/** Public-safe framework stripped of all server-only secrets. */
export type MiniScriptStoryFrameworkPublic = Omit<
  MiniScriptStoryFramework,
  'clues' | 'solution' | 'playerKnowledge' | 'redHerrings' | 'deductionChain' | 'characters'
> & {
  characters: MiniScriptCharacterPublic[];
};

// ─── Vote Schema ──────────────────────────────────────────────────────────────

export const miniScriptVoteSchema = z.object({
  who: z.string().min(1).max(120),
  what: z.string().min(1).max(200),
  why: z.string().min(1).max(300),
});

export type MiniScriptVoteInput = z.infer<typeof miniScriptVoteSchema>;

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
