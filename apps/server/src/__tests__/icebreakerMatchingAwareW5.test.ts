/**
 * W5 (gm-debrief) — Feed matching into the flow.
 *
 * Covers:
 * - AC-W5.2: shared-interest hooks (helper + warmup prompt wiring lives in
 *   socialIcebreakerWarmupVibe.test.ts).
 * - AC-W5.3: micro-challenge selector actually reacts to mood + energy arc,
 *   and the production transition path passes roster + mood + energyArc.
 * - AC-W5.4: mini-script roster weaving (prompt + fallback, no 来客A).
 * - AC-W5.6: production flag-off call args are byte-identical to pre-W5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectMicroChallenges } from '@joyjoin/shared';
import { getGameModeConfig } from '@shared/miniscriptGameModes';
import {
  buildSharedInterestHooks,
  inferMicroChallengeEnergyArc,
  buildRosterTraitLines,
  buildRosterCharacterTraits,
} from '../lib/icebreakerRosterSignals';
import { buildMiniScriptGenerationPrompt } from '../ai/miniscriptPrompts';
import { buildMiniScriptFrameworkUserMessage } from '../ai/socialIcebreakerPrompts';

// ─── Production-path mocks (transitionPhase → generateMicroChallenges) ───────

const {
  updateSessionMock,
  listParticipantsMock,
  savePhaseMetricMock,
  loadSessionLieTruthsMock,
  generateMicroChallengesMock,
  generateRecapSummaryMock,
  getSessionWithExpiryMock,
  getFeatureFlagMock,
  emitSocialGroupBeatMock,
} = vi.hoisted(() => ({
  updateSessionMock: vi.fn(async () => {}),
  listParticipantsMock: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  savePhaseMetricMock: vi.fn(async () => {}),
  loadSessionLieTruthsMock: vi.fn(async () => new Map()),
  generateMicroChallengesMock: vi.fn(async (_params: Record<string, unknown>) => ({
    data: [
      {
        id: 'mc-1',
        title: '互相问3个问题',
        description: '每人准备3个能真正了解对方的问题，轮流问。',
        durationSeconds: 180,
        completionCTA: '我完成了',
      },
    ],
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  })),
  generateRecapSummaryMock: vi.fn(async () => ({
    data: { headline: 'h', closingLine: 'c', moments: [] },
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  })),
  getSessionWithExpiryMock: vi.fn(async () => ({ state: null, expired: false })),
  getFeatureFlagMock: vi.fn(async (_key: string, _fallback?: boolean): Promise<boolean> => false),
  emitSocialGroupBeatMock: vi.fn(async () => {}),
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  updateSession: updateSessionMock,
  listParticipants: listParticipantsMock,
  savePhaseMetric: savePhaseMetricMock,
  loadSessionLieTruths: loadSessionLieTruthsMock,
  getSessionWithExpiry: getSessionWithExpiryMock,
  getParticipant: vi.fn(async () => null),
  setLieTruths: vi.fn(async () => {}),
  getLieTruths: vi.fn(async () => null),
}));

vi.mock('../socialIcebreakerAIService', () => ({
  generateMicroChallenges: generateMicroChallengesMock,
  generateRecapSummary: generateRecapSummaryMock,
  buildLieDetectiveV2RecapData: vi.fn(() => ({ aiWinRate: 0, hardestRound: 0, fooledEveryone: 0 })),
}));

vi.mock('../services/socialIcebreakerBotService', () => ({
  seedSingleTestBotsWarmupReady: vi.fn(() => {}),
}));

vi.mock('../lib/isSingleTestMode', () => ({
  isSingleTestMode: vi.fn(() => false),
}));

vi.mock('../lib/medalCuration', () => ({
  curateMedals: vi.fn(() => []),
}));

vi.mock('../lib/contextInjector', () => ({
  buildArchetypeContext: vi.fn(() => ({ mixText: '' })),
}));

vi.mock('../services/customModeService', () => ({
  isCustomMode: vi.fn(() => false),
  computeSelectablePhases: vi.fn(() => []),
  generatePhaseSelectionId: vi.fn(() => 'psel_test'),
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: getFeatureFlagMock,
}));

vi.mock('../lib/socialGroupBeats', () => ({
  emitSocialGroupBeat: emitSocialGroupBeatMock,
}));

const { transitionPhase } = await import('../routes/socialIcebreakerHelpers');
import type { SocialSessionState } from '@shared/socialIcebreaker';

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_test',
    icebreakerSessionId: 'icebreaker_test',
    currentPhase: 'warmup',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now() - 60_000,
    sessionStartedAt: Date.now() - 600_000,
    completedPhases: [],
    selectedMood: 'relaxed',
    ...overrides,
  } as SocialSessionState;
}

const SHY_ROSTER = [
  { userId: 'u1', displayName: '小满', archetype: '慢热龟', interests: ['咖啡', '徒步'] },
  { userId: 'u2', displayName: '阿禾', archetype: '小透明猫', interests: ['咖啡', '摄影'] },
  { userId: 'u3', displayName: '林深', archetype: '慢热龟', interests: ['徒步', '阅读'] },
  { userId: 'u4', displayName: '一诺', archetype: '树洞考拉', interests: ['咖啡'] },
];

beforeEach(() => {
  vi.clearAllMocks();
  generateMicroChallengesMock.mockResolvedValue({
    data: [
      {
        id: 'mc-1',
        title: '互相问3个问题',
        description: '每人准备3个能真正了解对方的问题，轮流问。',
        durationSeconds: 180,
        completionCTA: '我完成了',
      },
    ],
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  });
  listParticipantsMock.mockResolvedValue(SHY_ROSTER);
});

// ─── AC-W5.2 helpers ─────────────────────────────────────────────────────────

describe('W5 roster signals — shared-interest hooks', () => {
  it('returns labels shared by ≥2 members (heat-ordered), deduped', () => {
    const hooks = buildSharedInterestHooks([
      { displayName: 'A', interests: ['咖啡', '徒步'] },
      { displayName: 'B', interests: ['咖啡', '摄影'] },
      { displayName: 'C', interests: ['咖啡', '徒步'] },
    ]);
    expect(hooks).toEqual(['咖啡', '徒步']);
  });

  it('honours minMembers and returns [] without shared labels', () => {
    const roster = [
      { displayName: 'A', interests: ['咖啡'] },
      { displayName: 'B', interests: ['咖啡'] },
      { displayName: 'C', interests: ['摄影'] },
    ];
    expect(buildSharedInterestHooks(roster, { minMembers: 3 })).toEqual([]);
    expect(buildSharedInterestHooks([])).toEqual([]);
  });
});

// ─── AC-W5.3 micro-challenge selection ───────────────────────────────────────

describe('W5 micro-challenge selection (AC-W5.3)', () => {
  it('selection actually varies with mood + energy arc (machinery is live)', () => {
    const calmParams = { participantCount: 6, scene: 'both' as const, mood: 'emotional' as const, energyArc: 'start' as const, count: 3 };
    const livelyParams = { participantCount: 6, scene: 'both' as const, mood: 'funny' as const, energyArc: 'peak' as const, count: 3 };

    // Across a seed sweep, the contextual boost must change at least one
    // selection — proof `scoreTemplate`/`inferTargetEnergy` are on the path.
    const differingSeeds: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      const seed = `w5-seed-${i}`;
      const calm = selectMicroChallenges({ ...calmParams, seed }).map((c) => c.id);
      const lively = selectMicroChallenges({ ...livelyParams, seed }).map((c) => c.id);
      if (calm.join(',') !== lively.join(',')) differingSeeds.push(seed);
    }
    expect(differingSeeds.length).toBeGreaterThan(0);

    // Deterministic: the same contextual inputs always select the same set.
    const seed = 'w5-fixed-seed';
    const first = selectMicroChallenges({ ...calmParams, seed }).map((c) => c.id);
    const second = selectMicroChallenges({ ...calmParams, seed }).map((c) => c.id);
    expect(second).toEqual(first);
  });

  it('a quiet table (energyArc start) never selects a high-energy challenge', () => {
    const HIGH_ENERGY_IDS = [
      'c3-bad-startup',
      'c4-hum-song',
      'c9-telephone-drawing',
      'c12-three-facts',
    ];
    for (let i = 0; i < 30; i += 1) {
      const picked = selectMicroChallenges({
        participantCount: 6,
        seed: `quiet-${i}`,
        scene: 'both',
        mood: 'emotional',
        energyArc: 'start',
        count: 3,
      }).map((c) => c.id);
      for (const id of picked) {
        expect(HIGH_ENERGY_IDS).not.toContain(id);
      }
    }
  });

  it('inferMicroChallengeEnergyArc targets low energy for a quiet table', () => {
    expect(
      inferMicroChallengeEnergyArc({
        roster: [{ archetype: '慢热龟' }, { archetype: '小透明猫' }],
        mood: 'life',
      }),
    ).toBe('start');
    expect(
      inferMicroChallengeEnergyArc({
        roster: [{ archetype: '社牛柯基' }, { archetype: '小太阳鸡' }],
        mood: 'funny',
      }),
    ).toBe('build');
    expect(inferMicroChallengeEnergyArc({ mood: 'relaxed' })).toBe('start');
  });

  it('production transitionPhase passes roster + mood + energyArc when the flag is on', async () => {
    getFeatureFlagMock.mockImplementation(
      async (key: string) => key === 'icebreakerMatchingAwareEnabled',
    );

    await transitionPhase({
      state: makeState({ selectedMood: 'relaxed' }),
      socialSessionId: 'social_test',
      trigger: 'host_tap',
      targetPhase: 'micro_challenge',
    });

    expect(generateMicroChallengesMock).toHaveBeenCalledTimes(1);
    const arg = generateMicroChallengesMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.roster).toEqual(
      expect.arrayContaining([expect.objectContaining({ archetype: '慢热龟', interests: ['咖啡', '徒步'] })]),
    );
    expect(arg.mood).toBe('relaxed');
    expect(arg.energyArc).toBe('start');
  });

  it('production transitionPhase omits roster/mood/energyArc when the flag is off (AC-W5.6)', async () => {
    getFeatureFlagMock.mockResolvedValue(false);

    await transitionPhase({
      state: makeState({ selectedMood: 'relaxed' }),
      socialSessionId: 'social_test',
      trigger: 'host_tap',
      targetPhase: 'micro_challenge',
    });

    const arg = generateMicroChallengesMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.roster).toBeUndefined();
    expect(arg.mood).toBeUndefined();
    expect(arg.energyArc).toBeUndefined();
  });
});

// ─── AC-W5.4 mini-script roster ──────────────────────────────────────────────

describe('W5 mini-script roster weaving (AC-W5.4)', () => {
  const config = getGameModeConfig(['light_reasoning']);

  it('buildMiniScriptGenerationPrompt includes roster names + interests and forbids 来客A', () => {
    const { system, user } = buildMiniScriptGenerationPrompt({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
      config,
      roster: SHY_ROSTER,
    });
    const text = `${system}\n${user}`;
    expect(text).toContain('【本组玩家】');
    expect(text).toContain('小满');
    expect(text).toContain('慢热龟');
    expect(text).toContain('咖啡');
    expect(text).toContain('禁止使用「来客A」');
  });

  it('buildMiniScriptGenerationPrompt omits the roster block when no roster is given', () => {
    const { system, user } = buildMiniScriptGenerationPrompt({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
      config,
    });
    expect(`${system}\n${user}`).not.toContain('【本组玩家】');
  });

  it('secondary framework prompt includes roster traits', () => {
    const message = buildMiniScriptFrameworkUserMessage({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
      roster: SHY_ROSTER,
    });
    expect(message).toContain('小满');
    expect(message).toContain('咖啡');
    expect(message).toContain('来客A'); // only inside the "never use" instruction
  });

  it('buildRosterTraitLines renders one line per member with name + interest', () => {
    const lines = buildRosterTraitLines(SHY_ROSTER);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('小满');
    expect(lines[0]).toContain('咖啡');
  });

  it('buildRosterCharacterTraits gives every slot a real name + trait and cycles a short roster', () => {
    const traits = buildRosterCharacterTraits(SHY_ROSTER, 4)!;
    expect(traits).toHaveLength(4);
    expect(traits[0]!.roleLabel).toBe('小满');
    expect(traits[0]!.sinHook).toContain('咖啡');

    // Defensive: fewer members than slots still leaves zero trait-less slots.
    const clamped = buildRosterCharacterTraits(SHY_ROSTER.slice(0, 2), 6)!;
    expect(clamped).toHaveLength(6);
    expect(clamped.every((t) => t.roleLabel.length > 0)).toBe(true);

    // No named member → callers keep their curated characters.
    expect(buildRosterCharacterTraits([], 4)).toBeNull();
    expect(buildRosterCharacterTraits([{ archetype: '慢热龟' }], 4)).toBeNull();
  });

  it('production fallback weaves ≥1 real roster trait per character on LLM failure (AC-W5.4)', async () => {
    const previous = process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
    getFeatureFlagMock.mockImplementation(
      async (key: string) => key === 'icebreakerMatchingAwareEnabled',
    );
    try {
      const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
      const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
        playerCount: 4,
        style: 'modern_urban',
        genres: ['light_reasoning'],
        roster: SHY_ROSTER,
      });

      expect(meta.fallbackUsed).toBe(true);
      expect(meta.catalogUsed).toBe(true);
      expect(framework.characters).toHaveLength(4);

      framework.characters.forEach((character, i) => {
        const member = SHY_ROSTER[i]!;
        // A real roster trait is guaranteed: the slot's roleLabel IS the player.
        expect(character.roleLabel).toBe(member.displayName);
        const traitText = [
          character.roleLabel,
          character.sinHook,
          character.alibi,
          character.secret,
        ].join(' ');
        const realTraits = [...(member.interests ?? []), member.archetype].filter(
          (t): t is string => typeof t === 'string' && t.length > 0,
        );
        expect(realTraits.length).toBeGreaterThan(0);
        expect(realTraits.some((trait) => traitText.includes(trait))).toBe(true);
      });

      const payload = JSON.stringify(framework);
      for (const placeholder of ['来客A', '来客B', '来客C']) {
        expect(payload).not.toContain(placeholder);
      }
    } finally {
      if (previous === undefined) delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
      else process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = previous;
    }
  });

  it('production fallback stays roster-blind when the W5 flag is off (AC-W5.6)', async () => {
    const previous = process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
    getFeatureFlagMock.mockResolvedValue(false);
    try {
      const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
      const { framework } = await generateMiniScriptFrameworkWithMeta({
        playerCount: 4,
        style: 'modern_urban',
        genres: ['light_reasoning'],
        roster: SHY_ROSTER,
      });
      const rosterNames = new Set(SHY_ROSTER.map((m) => m.displayName));
      for (const character of framework.characters) {
        expect(rosterNames.has(character.roleLabel)).toBe(false);
      }
    } finally {
      if (previous === undefined) delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
      else process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = previous;
    }
  });
});
