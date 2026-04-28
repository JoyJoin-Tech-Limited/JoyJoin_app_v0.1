import { z } from 'zod';
import type { MiniScriptGenre } from './miniscriptStoryFramework';
import { MINI_SCRIPT_GENRES } from './miniscriptStoryFramework';

// ═══════════════════════════════════════════════════════════════════════════════
// MiniScript Game Mode Configuration
// ═══════════════════════════════════════════════════════════════════════════════
// Each genre defines mechanical rules that shape generation, validation,
// and gameplay. Multi-select merges configs deterministically.

export const miniScriptGameModeConfigSchema = z.object({
  genreKeys: z.array(z.enum(MINI_SCRIPT_GENRES)).min(1),
  clueCountRange: z.tuple([z.number().int().min(2).max(4), z.number().int().min(3).max(8)]),
  hasRedHerrings: z.boolean(),
  hasHiddenAgendas: z.boolean(),
  votingStyle: z.enum(['accusation', 'consensus', 'none']),
  winCondition: z.enum(['solve_mystery', 'find_traitor', 'match_pairs', 'laugh_track']),
  targetPlayMinutes: z.number().int().min(5).max(30),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  promptTemplateKey: z.string().min(1),
  validationTemplateKey: z.string().min(1),
});

export type MiniScriptGameModeConfig = z.infer<typeof miniScriptGameModeConfigSchema>;

// ─── Per-Genre Canonical Configs ──────────────────────────────────────────────

export const GAME_MODE_CONFIGS: Record<MiniScriptGenre, MiniScriptGameModeConfig> = {
  light_reasoning: {
    genreKeys: ['light_reasoning'],
    clueCountRange: [3, 4],
    hasRedHerrings: false,
    hasHiddenAgendas: false,
    votingStyle: 'consensus',
    winCondition: 'solve_mystery',
    targetPlayMinutes: 12,
    difficulty: 'easy',
    promptTemplateKey: 'light-reasoning-v1',
    validationTemplateKey: 'light-reasoning-validation-v1',
  },
  thriller_mystery: {
    genreKeys: ['thriller_mystery'],
    clueCountRange: [5, 7],
    hasRedHerrings: true,
    hasHiddenAgendas: true,
    votingStyle: 'accusation',
    winCondition: 'find_traitor',
    targetPlayMinutes: 18,
    difficulty: 'hard',
    promptTemplateKey: 'thriller-mystery-v1',
    validationTemplateKey: 'thriller-mystery-validation-v1',
  },
  romance: {
    genreKeys: ['romance'],
    clueCountRange: [3, 5],
    hasRedHerrings: false,
    hasHiddenAgendas: true,
    votingStyle: 'consensus',
    winCondition: 'match_pairs',
    targetPlayMinutes: 14,
    difficulty: 'easy',
    promptTemplateKey: 'romance-v1',
    validationTemplateKey: 'romance-validation-v1',
  },
  absurd_comedy: {
    genreKeys: ['absurd_comedy'],
    clueCountRange: [2, 4],
    hasRedHerrings: true,
    hasHiddenAgendas: false,
    votingStyle: 'none',
    winCondition: 'laugh_track',
    targetPlayMinutes: 10,
    difficulty: 'easy',
    promptTemplateKey: 'absurd-comedy-v1',
    validationTemplateKey: 'absurd-comedy-validation-v1',
  },
};

// ─── Config Merging ───────────────────────────────────────────────────────────

/**
 * Merge multiple genre configs deterministically.
 * Rules:
 *   - clueCountRange: sum of mins, sum of maxs (capped at [2, 8])
 *   - hasRedHerrings / hasHiddenAgendas: OR (union)
 *   - votingStyle: if any selects 'accusation', use that; else 'consensus'; else 'none'
 *   - winCondition: if all same, use it; else fallback to 'solve_mystery'
 *   - targetPlayMinutes: average (rounded up)
 *   - difficulty: highest (hard > medium > easy)
 *   - promptTemplateKey / validationTemplateKey: from the hardest genre
 */
export function mergeGameModeConfigs(genres: MiniScriptGenre[]): MiniScriptGameModeConfig {
  if (genres.length === 0) {
    throw new Error('mergeGameModeConfigs: at least one genre required');
  }
  if (genres.length === 1) {
    return GAME_MODE_CONFIGS[genres[0]];
  }

  const configs = genres.map((g) => GAME_MODE_CONFIGS[g]);

  const minClues = Math.min(2, configs.reduce((sum, c) => sum + c.clueCountRange[0], 0));
  const maxClues = Math.min(8, configs.reduce((sum, c) => sum + c.clueCountRange[1], 0));

  const votingPriority: Record<string, number> = { accusation: 3, consensus: 2, none: 1 };
  const sortedByVoting = [...configs].sort((a, b) => votingPriority[b.votingStyle] - votingPriority[a.votingStyle]);

  const difficultyPriority: Record<string, number> = { hard: 3, medium: 2, easy: 1 };
  const sortedByDifficulty = [...configs].sort((a, b) => difficultyPriority[b.difficulty] - difficultyPriority[a.difficulty]);
  const hardest = sortedByDifficulty[0];

  const winConditions = new Set(configs.map((c) => c.winCondition));
  const mergedWinCondition = winConditions.size === 1 ? configs[0].winCondition : 'solve_mystery';

  const avgPlayMinutes = Math.ceil(
    configs.reduce((sum, c) => sum + c.targetPlayMinutes, 0) / configs.length
  );

  return {
    genreKeys: genres,
    clueCountRange: [Math.max(2, minClues), Math.max(3, maxClues)],
    hasRedHerrings: configs.some((c) => c.hasRedHerrings),
    hasHiddenAgendas: configs.some((c) => c.hasHiddenAgendas),
    votingStyle: sortedByVoting[0].votingStyle,
    winCondition: mergedWinCondition,
    targetPlayMinutes: Math.min(30, Math.max(5, avgPlayMinutes)),
    difficulty: hardest.difficulty,
    promptTemplateKey: hardest.promptTemplateKey,
    validationTemplateKey: hardest.validationTemplateKey,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getGameModeConfig(genres: MiniScriptGenre[]): MiniScriptGameModeConfig {
  const unique = Array.from(new Set(genres));
  return mergeGameModeConfigs(unique);
}

export function describeWinCondition(wc: MiniScriptGameModeConfig['winCondition']): string {
  switch (wc) {
    case 'solve_mystery':
      return '解开谜团';
    case 'find_traitor':
      return '找出内鬼';
    case 'match_pairs':
      return '配对成功';
    case 'laugh_track':
      return '笑到最后';
  }
}

export function describeVotingStyle(vs: MiniScriptGameModeConfig['votingStyle']): string {
  switch (vs) {
    case 'accusation':
      return '指控投票';
    case 'consensus':
      return '共识表决';
    case 'none':
      return '自由演绎';
  }
}
