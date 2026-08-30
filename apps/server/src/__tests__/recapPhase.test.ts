import { describe, expect, it } from 'vitest';
import type {
  SocialSessionState,
  SocialSessionParticipantSummary,
  PersonalityDiceChallenge,
  PersonalityDiceChallengeGroup,
} from '@shared/socialIcebreaker';

// Inline PHASE_CONFIG because @shared subpath exports don't resolve at vitest runtime
const PHASE_CONFIG = {
  warmup: { emoji: '', name: '话题卡', nameEn: 'Topic Cards', gradient: 'from-amber-400 to-orange-400', bgGradient: 'from-amber-50 via-rose-50 to-purple-50', darkBgGradient: 'from-zinc-900 via-amber-950 to-zinc-900', pillColor: 'bg-amber-100/80 text-amber-700', timeoutMinutes: 20, minPlayersRequired: 2 },
  micro_challenge: { emoji: '', name: '挑战', nameEn: 'Challenge', gradient: 'from-cyan-400 to-blue-500', bgGradient: 'from-cyan-50 via-blue-50 to-indigo-50', darkBgGradient: 'from-cyan-950 via-blue-950 to-zinc-900', pillColor: 'bg-cyan-100/80 text-cyan-700', timeoutMinutes: 15, minPlayersRequired: 2 },
  lie_detective: { emoji: '', name: '侦探', nameEn: 'Lie Detective', gradient: 'from-purple-500 to-violet-600', bgGradient: 'from-slate-900 via-purple-950 to-slate-900', darkBgGradient: 'from-slate-900 via-purple-950 to-slate-900', pillColor: 'bg-purple-900/80 text-purple-300 border border-purple-700', timeoutMinutes: 25, minPlayersRequired: 3 },
  auction: { emoji: '', name: '拍卖', nameEn: 'Auction', gradient: 'from-amber-500 to-orange-600', bgGradient: 'from-yellow-50 via-orange-50 to-rose-50', darkBgGradient: 'from-yellow-950 via-orange-950 to-zinc-900', pillColor: 'bg-yellow-400 text-yellow-900 font-black', timeoutMinutes: 30, minPlayersRequired: 3 },
  personality_dice: { emoji: '', name: '骰子', nameEn: 'Personality Dice', gradient: 'from-pink-500 to-fuchsia-600', bgGradient: 'from-pink-50 via-fuchsia-50 to-purple-50', darkBgGradient: 'from-pink-950 via-fuchsia-950 to-zinc-900', pillColor: 'bg-pink-100/80 text-pink-700', timeoutMinutes: 15, minPlayersRequired: 2 },
  mini_script: { emoji: '', name: '迷你剧本杀', nameEn: 'Mini Script', gradient: 'from-indigo-500 to-slate-700', bgGradient: 'from-indigo-50 via-slate-50 to-violet-50', darkBgGradient: 'from-slate-950 via-indigo-950 to-zinc-900', pillColor: 'bg-indigo-100/80 text-indigo-700 border border-indigo-300', timeoutMinutes: 45, minPlayersRequired: 4 },
  quip_battle: { emoji: '', name: '机智对决', nameEn: 'Quip Battle', gradient: 'from-yellow-400 to-orange-500', bgGradient: 'from-yellow-50 via-orange-50 to-amber-50', darkBgGradient: 'from-yellow-950 via-orange-950 to-zinc-900', pillColor: 'bg-yellow-100/80 text-yellow-700', timeoutMinutes: 15, minPlayersRequired: 2 },
  undercover_word: { emoji: '', name: '谁是卧底', nameEn: 'Undercover Word', gradient: 'from-red-500 to-rose-600', bgGradient: 'from-red-50 via-rose-50 to-pink-50', darkBgGradient: 'from-red-950 via-rose-950 to-zinc-900', pillColor: 'bg-red-100/80 text-red-700', timeoutMinutes: 20, minPlayersRequired: 3 },
  group_mirror: { emoji: '', name: '群像镜像', nameEn: 'Group Mirror', gradient: 'from-teal-400 to-cyan-500', bgGradient: 'from-teal-50 via-cyan-50 to-sky-50', darkBgGradient: 'from-teal-950 via-cyan-950 to-zinc-900', pillColor: 'bg-teal-100/80 text-teal-700', timeoutMinutes: 12, minPlayersRequired: 2 },
  speed_friending: { emoji: '', name: '轮桌畅聊', nameEn: 'Speed Friending', gradient: 'from-green-400 to-emerald-500', bgGradient: 'from-green-50 via-emerald-50 to-teal-50', darkBgGradient: 'from-green-950 via-emerald-950 to-zinc-900', pillColor: 'bg-green-100/80 text-green-700', timeoutMinutes: 30, minPlayersRequired: 2 },
  recap: { emoji: '', name: '回顾', nameEn: 'Recap', gradient: 'from-violet-500 to-purple-600', bgGradient: 'from-violet-50 via-purple-50 to-fuchsia-50', darkBgGradient: 'from-violet-950 via-purple-950 to-zinc-900', pillColor: 'bg-violet-100/80 text-violet-700', timeoutMinutes: 5, minPlayersRequired: 1 },
};

// ─── helpers ──────────────────────────────────────────────────────────────────────

function recapDisplayNameByUserId(
  roster: SocialSessionParticipantSummary[],
  state: SocialSessionState,
  userId: string,
): string {
  const fromRoster = roster.find((p) => p.userId === userId)?.displayName;
  if (fromRoster) return fromRoster;
  if (userId === state.hostUserId) return state.hostDisplayName;
  const fromLie = state.lieDetectivePlayers?.find((p) => p.userId === userId)?.displayName;
  return fromLie || '某位参与者';
}

function buildLieDetectiveRecapHighlights(
  state: SocialSessionState,
  roster: SocialSessionParticipantSummary[],
  sessionLieMap: Map<string, Array<{ index: number; text: string; isLie: boolean }>>,
): string[] {
  const highlights: string[] = [];
  for (const vote of state.votes || []) {
    const stmts = sessionLieMap.get(vote.targetUserId);
    const lieStmt = stmts?.find((s) => s.isLie);
    if (!lieStmt || vote.guessedStatementIndex !== lieStmt.index) continue;
    const voterName = recapDisplayNameByUserId(roster, state, vote.voterId);
    const targetName = recapDisplayNameByUserId(roster, state, vote.targetUserId);
    highlights.push(`${voterName}猜对了${targetName}的谎言`);
  }
  return highlights.slice(0, 8);
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

function isEnabled(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

const PERSONALITY_DICE_CHOOSE_MODE_ENABLED = true;

function buildPersonalityDiceRecapLines(state: SocialSessionState): string[] {
  if (
    isEnabled(undefined, PERSONALITY_DICE_CHOOSE_MODE_ENABLED) &&
    state.personalityDiceChallengeGroups &&
    state.diceSelectedOption
  ) {
    return state.personalityDiceChallengeGroups.slice(0, 6).map((group) => {
      const chosenIdx = state.diceSelectedOption![group.userId];
      if (chosenIdx === undefined) {
        return `${group.displayName}：未选择挑战`;
      }
      const chosen = group.options[chosenIdx];
      if (!chosen) {
        return `${group.displayName}：未选择挑战`;
      }
      const title =
        chosen.challengeTitle.length > 48
          ? `${chosen.challengeTitle.slice(0, 47)}…`
          : chosen.challengeTitle;
      const diffLabel = DIFFICULTY_LABELS[chosen.difficulty] || chosen.difficulty;
      return `${group.displayName} 选择了${diffLabel}挑战：${title}`;
    });
  }

  const challenges = state.personalityDiceChallenges || [];
  return challenges.slice(0, 6).map((c) => {
    const title = c.challengeTitle.length > 48 ? `${c.challengeTitle.slice(0, 47)}…` : c.challengeTitle;
    return `${c.displayName}：${title}`;
  });
}

function buildMiniScriptRecapLine(
  state: SocialSessionState,
  roster: SocialSessionParticipantSummary[] = [],
): string | undefined {
  const premise = state.miniScriptFramework?.premise?.trim();
  if (!premise) return undefined;
  const premiseLine = premise.length > 220 ? `${premise.slice(0, 219)}…` : premise;
  const dualCorrect = (state.miniScriptRevealedPlayerResults ?? []).filter(
    (result) => result.round1Correct === true && result.round2Correct === true,
  );
  if (dualCorrect.length === 0) return premiseLine;
  const names = dualCorrect.map((result) => {
    const name = recapDisplayNameByUserId(roster, state, result.userId);
    return name.length > 12 ? `${name.slice(0, 11)}…` : name;
  });
  return `${premiseLine}\n本桌名侦探：${names.join('、')}——两轮全对，悦仔为你鼓掌。`;
}

function buildAuctionRecapLines(state: SocialSessionState): string[] {
  const lines = state.auctionRecapLines;
  if (!Array.isArray(lines) || lines.length === 0) return [];
  return lines.map((l) => (l.length > 120 ? `${l.slice(0, 119)}…` : l)).slice(0, 8);
}

function buildRecapParticipants(
  roster: SocialSessionParticipantSummary[],
  state: SocialSessionState,
): Array<{ displayName: string; archetype?: string }> {
  if (roster.length > 0) {
    return roster.map((p) => ({ displayName: p.displayName, archetype: p.archetype }));
  }
  const out: Array<{ displayName: string; archetype?: string }> = [];
  const seen = new Set<string>();
  if (state.hostDisplayName) {
    out.push({ displayName: state.hostDisplayName });
    seen.add(state.hostUserId);
  }
  for (const pl of state.lieDetectivePlayers || []) {
    if (!seen.has(pl.userId)) {
      out.push({ displayName: pl.displayName });
      seen.add(pl.userId);
    }
  }
  return out.length > 0 ? out : [{ displayName: '参与者' }];
}

// ─── fixtures ─────────────────────────────────────────────────────────────────────

function makeMinimalState(overrides?: Partial<SocialSessionState>): SocialSessionState {
  return {
    socialSessionId: 'social_test',
    icebreakerSessionId: 'test',
    currentPhase: 'recap',
    hostUserId: 'host-1',
    hostDisplayName: 'HostUser',
    playerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    ...overrides,
  } as SocialSessionState;
}

const ALICE: SocialSessionParticipantSummary = { userId: 'u1', displayName: 'Alice' };
const BOB: SocialSessionParticipantSummary = { userId: 'u2', displayName: 'Bob' };
const CHARLIE: SocialSessionParticipantSummary = { userId: 'u3', displayName: 'Charlie' };

// ─── tests ────────────────────────────────────────────────────────────────────────

describe('recapDisplayNameByUserId', () => {
  const roster = [ALICE, BOB];

  it('returns roster display name when found', () => {
    const state = makeMinimalState();
    expect(recapDisplayNameByUserId(roster, state, 'u1')).toBe('Alice');
  });

  it('falls back to host display name', () => {
    const state = makeMinimalState();
    expect(recapDisplayNameByUserId([], state, 'host-1')).toBe('HostUser');
  });

  it('falls back to lie detective player name', () => {
    const state = makeMinimalState({
      lieDetectivePlayers: [{ userId: 'ld1', displayName: 'Detective', statements: [] }],
    });
    expect(recapDisplayNameByUserId([], state, 'ld1')).toBe('Detective');
  });

  it('returns fallback when not found anywhere', () => {
    expect(recapDisplayNameByUserId([], makeMinimalState(), 'unknown')).toBe('某位参与者');
  });
});

describe('buildLieDetectiveRecapHighlights', () => {
  it('returns correct guess strings', () => {
    const state = makeMinimalState({
      votes: [
        { voterId: 'u1', targetUserId: 'u2', guessedStatementIndex: 1 },
      ],
    });
    const lieMap = new Map([
      ['u2', [
        { index: 1, text: 'I can fly', isLie: true },
        { index: 2, text: 'I like cats', isLie: false },
      ]],
    ]);
    const highlights = buildLieDetectiveRecapHighlights(state, [ALICE, BOB], lieMap);
    expect(highlights).toEqual(['Alice猜对了Bob的谎言']);
  });

  it('skips votes where guess index does not match lie index', () => {
    const state = makeMinimalState({
      votes: [
        { voterId: 'u1', targetUserId: 'u2', guessedStatementIndex: 0 },
      ],
    });
    const lieMap = new Map([
      ['u2', [
        { index: 1, text: 'I can fly', isLie: true },
      ]],
    ]);
    const highlights = buildLieDetectiveRecapHighlights(state, [ALICE, BOB], lieMap);
    expect(highlights).toHaveLength(0);
  });

  it('caps at 8 entries', () => {
    const votes = Array.from({ length: 10 }, (_, i) => ({
      voterId: 'u1',
      targetUserId: `u${i}`,
      guessedStatementIndex: 0,
    }));
    const lieMap = new Map<string, Array<{ index: number; text: string; isLie: boolean }>>();
    for (let i = 0; i < 10; i++) {
      lieMap.set(`u${i}`, [{ index: 0, text: `Lie ${i}`, isLie: true }]);
    }
    const state = makeMinimalState({ votes });
    const highlights = buildLieDetectiveRecapHighlights(state, [ALICE], lieMap);
    expect(highlights).toHaveLength(8);
  });

  it('handles empty votes', () => {
    const state = makeMinimalState({ votes: [] });
    const highlights = buildLieDetectiveRecapHighlights(state, [], new Map());
    expect(highlights).toEqual([]);
  });

  it('handles undefined votes', () => {
    const highlights = buildLieDetectiveRecapHighlights(
      makeMinimalState(),
      [],
      new Map(),
    );
    expect(highlights).toEqual([]);
  });

  it('handles empty sessionLieMap', () => {
    const state = makeMinimalState({
      votes: [{ voterId: 'u1', targetUserId: 'u2', guessedStatementIndex: 0 }],
    });
    const highlights = buildLieDetectiveRecapHighlights(state, [ALICE, BOB], new Map());
    expect(highlights).toEqual([]);
  });
});

describe('buildPersonalityDiceRecapLines', () => {
  it('extracts challenge titles from personality dice data (legacy mode)', () => {
    const state = makeMinimalState({
      personalityDiceChallenges: [
        {
          userId: 'u1', displayName: 'Alice', dominantTrait: 'E',
          challengeTitle: '模仿三种动物叫声', challengeBody: 'Body', challengeEmoji: '🎭', difficulty: 'medium',
        } as PersonalityDiceChallenge,
        {
          userId: 'u2', displayName: 'Bob', dominantTrait: 'A',
          challengeTitle: '30秒说完一段绕口令', challengeBody: 'Body', challengeEmoji: '🗣️', difficulty: 'hard',
        } as PersonalityDiceChallenge,
      ],
    });
    const lines = buildPersonalityDiceRecapLines(state);
    expect(lines).toEqual([
      'Alice：模仿三种动物叫声',
      'Bob：30秒说完一段绕口令',
    ]);
  });

  it('supports choose-mode with difficulty labels', () => {
    const state = makeMinimalState({
      personalityDiceChallengeGroups: [
        {
          userId: 'u1', displayName: 'Alice', dominantTrait: 'E',
          options: [
            { userId: 'u1', displayName: 'Alice', dominantTrait: 'E', challengeTitle: '跳一支舞', challengeBody: '', challengeEmoji: '', difficulty: 'easy' } as PersonalityDiceChallenge,
            { userId: 'u1', displayName: 'Alice', dominantTrait: 'E', challengeTitle: '模仿三种动物叫声', challengeBody: '', challengeEmoji: '', difficulty: 'medium' } as PersonalityDiceChallenge,
            { userId: 'u1', displayName: 'Alice', dominantTrait: 'E', challengeTitle: '30秒绕口令不换气', challengeBody: '', challengeEmoji: '', difficulty: 'hard' } as PersonalityDiceChallenge,
          ],
        } as PersonalityDiceChallengeGroup,
      ] as PersonalityDiceChallengeGroup[],
      diceSelectedOption: { u1: 1 },
    });
    const lines = buildPersonalityDiceRecapLines(state);
    expect(lines).toEqual(['Alice 选择了中等挑战：模仿三种动物叫声']);
  });

  it('handles choose-mode with no selection (unselected)', () => {
    const state = makeMinimalState({
      personalityDiceChallengeGroups: [
        {
          userId: 'u1', displayName: 'Alice', dominantTrait: 'E',
          options: [
            { userId: 'u1', displayName: 'Alice', dominantTrait: 'E', challengeTitle: '跳一支舞', challengeBody: '', challengeEmoji: '', difficulty: 'easy' } as PersonalityDiceChallenge,
          ],
        } as PersonalityDiceChallengeGroup,
      ] as PersonalityDiceChallengeGroup[],
      diceSelectedOption: {},
    });
    const lines = buildPersonalityDiceRecapLines(state);
    expect(lines).toEqual(['Alice：未选择挑战']);
  });

  it('handles choose-mode with invalid index', () => {
    const state = makeMinimalState({
      personalityDiceChallengeGroups: [
        {
          userId: 'u1', displayName: 'Alice', dominantTrait: 'E',
          options: [
            { userId: 'u1', displayName: 'Alice', dominantTrait: 'E', challengeTitle: '跳一支舞', challengeBody: '', challengeEmoji: '', difficulty: 'easy' } as PersonalityDiceChallenge,
          ],
        } as PersonalityDiceChallengeGroup,
      ] as PersonalityDiceChallengeGroup[],
      diceSelectedOption: { u1: 99 },
    });
    const lines = buildPersonalityDiceRecapLines(state);
    expect(lines).toEqual(['Alice：未选择挑战']);
  });

  it('max 6 lines', () => {
    const challenges = Array.from({ length: 8 }, (_, i) => ({
      userId: `u${i}`, displayName: `User${i}`, dominantTrait: 'E' as const,
      challengeTitle: `Challenge ${i}`, challengeBody: '', challengeEmoji: '', difficulty: 'easy' as const,
    })) as PersonalityDiceChallenge[];
    const state = makeMinimalState({ personalityDiceChallenges: challenges });
    expect(buildPersonalityDiceRecapLines(state)).toHaveLength(6);
  });

  it('truncates titles > 48 chars', () => {
    const longTitle = 'A'.repeat(60);
    const state = makeMinimalState({
      personalityDiceChallenges: [{
        userId: 'u1', displayName: 'Alice', dominantTrait: 'E',
        challengeTitle: longTitle, challengeBody: '', challengeEmoji: '', difficulty: 'medium',
      }] as PersonalityDiceChallenge[],
    });
    const lines = buildPersonalityDiceRecapLines(state);
    expect(lines[0]).toBe(`Alice：${'A'.repeat(47)}…`);
  });

  it('handles empty challenges', () => {
    const state = makeMinimalState({ personalityDiceChallenges: [] });
    expect(buildPersonalityDiceRecapLines(state)).toEqual([]);
  });
});

describe('buildMiniScriptRecapLine', () => {
  it('returns trimmed premise', () => {
    const state = makeMinimalState({
      miniScriptFramework: { premise: '  一群陌生人被困在古堡中  ' } as any,
    });
    expect(buildMiniScriptRecapLine(state)).toBe('一群陌生人被困在古堡中');
  });

  it('truncates > 220 chars', () => {
    const long = 'A'.repeat(250);
    const state = makeMinimalState({
      miniScriptFramework: { premise: long } as any,
    });
    const result = buildMiniScriptRecapLine(state);
    expect(result).toBe(`${'A'.repeat(219)}…`);
    expect(result!.length).toBe(220);
  });

  it('does not truncate <= 220 chars', () => {
    const text = 'Hello World';
    const state = makeMinimalState({
      miniScriptFramework: { premise: text } as any,
    });
    expect(buildMiniScriptRecapLine(state)).toBe(text);
  });

  it('returns undefined when no miniScriptFramework', () => {
    expect(buildMiniScriptRecapLine(makeMinimalState())).toBeUndefined();
  });

  it('returns undefined when premise is empty string', () => {
    const state = makeMinimalState({
      miniScriptFramework: { premise: '' } as any,
    });
    expect(buildMiniScriptRecapLine(state)).toBeUndefined();
  });

  it('returns undefined when premise is only whitespace', () => {
    const state = makeMinimalState({
      miniScriptFramework: { premise: '   ' } as any,
    });
    expect(buildMiniScriptRecapLine(state)).toBeUndefined();
  });

  // V2 P3 (Q15): 本桌名侦探 honor line
  it('appends the 本桌名侦探 honor line with display names for dual-correct players', () => {
    const state = makeMinimalState({
      miniScriptFramework: { premise: '茶水间的燕麦奶不见了。' } as any,
      miniScriptRevealedPlayerResults: [
        { userId: 'u1', round1Correct: true, round2Correct: true },
        { userId: 'u2', round1Correct: true, round2Correct: false },
        { userId: 'u3', round1Correct: true, round2Correct: true },
      ],
    });
    const line = buildMiniScriptRecapLine(state, [ALICE, BOB, CHARLIE]);
    expect(line).toBe('茶水间的燕麦奶不见了。\n本桌名侦探：Alice、Charlie——两轮全对，悦仔为你鼓掌。');
  });

  it('keeps the gentle base tone when nobody is dual-correct (no shaming)', () => {
    const state = makeMinimalState({
      miniScriptFramework: { premise: '茶水间的燕麦奶不见了。' } as any,
      miniScriptRevealedPlayerResults: [
        { userId: 'u1', round1Correct: true, round2Correct: false },
        { userId: 'u2', round1Correct: false, round2Correct: true },
      ],
    });
    expect(buildMiniScriptRecapLine(state, [ALICE, BOB])).toBe('茶水间的燕麦奶不见了。');
  });

  it('keeps the base tone when round 2 never ran (round2Correct absent)', () => {
    const state = makeMinimalState({
      miniScriptFramework: { premise: '茶水间的燕麦奶不见了。' } as any,
      miniScriptRevealedPlayerResults: [{ userId: 'u1', round1Correct: true }],
    });
    expect(buildMiniScriptRecapLine(state, [ALICE])).toBe('茶水间的燕麦奶不见了。');
  });

  it('honor line copy carries no emoji and no forbidden vocabulary', () => {
    const state = makeMinimalState({
      miniScriptFramework: { premise: '茶水间的燕麦奶不见了。' } as any,
      miniScriptRevealedPlayerResults: [{ userId: 'u1', round1Correct: true, round2Correct: true }],
    });
    const line = buildMiniScriptRecapLine(state, [ALICE])!;
    expect(line).not.toMatch(/真凶/);
    expect(line).not.toMatch(/匹配|社交|AI/);
    // No emoji (misc symbols, dingbats, emoticons, supplementary planes).
    expect(line).not.toMatch(/[☀-➿\u{1F000}-\u{1FAFF}]/u);
  });
});

describe('buildAuctionRecapLines', () => {
  it('extracts auction item titles from recap lines', () => {
    const state = makeMinimalState({
      auctionRecapLines: ['Alice拍下了「神秘盲盒」', 'Bob拍下了「限定勋章」'],
    });
    expect(buildAuctionRecapLines(state)).toEqual([
      'Alice拍下了「神秘盲盒」',
      'Bob拍下了「限定勋章」',
    ]);
  });

  it('max 8 lines', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `Lot ${i}`);
    const state = makeMinimalState({ auctionRecapLines: lines });
    expect(buildAuctionRecapLines(state)).toHaveLength(8);
  });

  it('truncates > 120 chars', () => {
    const longLine = 'Alice'.repeat(30);
    const state = makeMinimalState({ auctionRecapLines: [longLine] });
    const result = buildAuctionRecapLines(state);
    expect(result[0]).toBe(`${longLine.slice(0, 119)}…`);
    expect(result[0].length).toBe(120);
  });

  it('does not truncate <= 120 chars', () => {
    const normal = 'Alice拍下了「神秘盲盒」';
    const state = makeMinimalState({ auctionRecapLines: [normal] });
    expect(buildAuctionRecapLines(state)).toEqual([normal]);
  });

  it('handles empty array', () => {
    const state = makeMinimalState({ auctionRecapLines: [] });
    expect(buildAuctionRecapLines(state)).toEqual([]);
  });

  it('handles undefined auctionRecapLines', () => {
    expect(buildAuctionRecapLines(makeMinimalState())).toEqual([]);
  });
});

describe('buildRecapParticipants', () => {
  it('uses roster when available', () => {
    const roster = [ALICE, BOB];
    const result = buildRecapParticipants(roster, makeMinimalState());
    expect(result).toEqual([
      { displayName: 'Alice' },
      { displayName: 'Bob' },
    ]);
  });

  it('includes archetype from roster', () => {
    const roster: SocialSessionParticipantSummary[] = [
      { userId: 'u1', displayName: 'Alice', archetype: '开心柯基' },
    ];
    const result = buildRecapParticipants(roster, makeMinimalState());
    expect(result).toEqual([{ displayName: 'Alice', archetype: '开心柯基' }]);
  });

  it('falls back to host display name', () => {
    const state = makeMinimalState({ hostDisplayName: 'HostUser' });
    const result = buildRecapParticipants([], state);
    expect(result).toEqual([{ displayName: 'HostUser' }]);
  });

  it('falls back to lie detective players (deduped with host)', () => {
    const state = makeMinimalState({
      hostDisplayName: 'HostUser',
      lieDetectivePlayers: [
        { userId: 'host-1', displayName: 'HostUser', statements: [] },
        { userId: 'ld1', displayName: 'Detective', statements: [] },
      ],
    });
    const result = buildRecapParticipants([], state);
    expect(result).toEqual([
      { displayName: 'HostUser' },
      { displayName: 'Detective' },
    ]);
  });

  it('returns default when nothing available', () => {
    const state = makeMinimalState({ hostDisplayName: '' });
    const result = buildRecapParticipants([], state);
    expect(result).toEqual([{ displayName: '参与者' }]);
  });
});

describe('PHASE_CONFIG constants validation', () => {
  it('every phase has minPlayersRequired >= 1', () => {
    for (const [key, config] of Object.entries(PHASE_CONFIG)) {
      expect(
        config.minPlayersRequired,
        `Phase "${key}" has minPlayersRequired ${config.minPlayersRequired} which should be >= 1`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('recap has timeoutMinutes >= 1', () => {
    expect(PHASE_CONFIG.recap.timeoutMinutes).toBeGreaterThanOrEqual(1);
  });

  it('all phases have timeoutMinutes >= 1', () => {
    for (const [key, config] of Object.entries(PHASE_CONFIG)) {
      expect(
        config.timeoutMinutes,
        `Phase "${key}" has timeoutMinutes ${config.timeoutMinutes} which should be >= 1`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('recap has minPlayersRequired of 1', () => {
    expect(PHASE_CONFIG.recap.minPlayersRequired).toBe(1);
  });
});
