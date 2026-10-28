import { describe, expect, it } from 'vitest';
import {
  deriveTablePersona,
  resolveTableAnchorsForPrompt,
  TABLE_ENERGY_HIGH_MIN_A,
  TABLE_ENERGY_HIGH_MIN_X,
  TABLE_ENERGY_LOW_MAX_X,
  TABLE_PERSONA_MIN_TRAIT_SAMPLES,
  type TablePersonaRoleResults,
  type TablePersonaRosterMember,
  type TablePersonaTraitScores,
} from '../lib/tablePersona';

/** Build a role-results map for the given user ids with identical traits. */
function traitsFor(
  userIds: string[],
  traits: TablePersonaTraitScores,
): TablePersonaRoleResults {
  return new Map(userIds.map((userId) => [userId, traits]));
}

function rosterOf(size: number, extra: Partial<TablePersonaRosterMember> = {}): TablePersonaRosterMember[] {
  return Array.from({ length: size }, (_, index) => ({
    userId: `user-${index}`,
    ...extra,
  }));
}

describe('tablePersona — energy band', () => {
  it('reads high when roster-average X clears the high floor and A is warm', () => {
    const roster = rosterOf(4);
    const persona = deriveTablePersona({
      roster,
      roleResults: traitsFor(['user-0', 'user-1', 'user-2'], {
        extraversion: TABLE_ENERGY_HIGH_MIN_X,
        affinity: TABLE_ENERGY_HIGH_MIN_A,
        emotionalStability: 60,
      }),
    });
    expect(persona.energy).toBe('high');
  });

  it('caps high X to mid when the roster-average A is cold', () => {
    const roster = rosterOf(4);
    const persona = deriveTablePersona({
      roster,
      roleResults: traitsFor(['user-0', 'user-1', 'user-2'], {
        extraversion: 88,
        affinity: TABLE_ENERGY_HIGH_MIN_A - 5,
        emotionalStability: 60,
      }),
    });
    expect(persona.energy).toBe('mid');
  });

  it('reads low below the low floor and mid in between', () => {
    const roster = rosterOf(3);
    const low = deriveTablePersona({
      roster,
      roleResults: traitsFor(['user-0', 'user-1', 'user-2'], {
        extraversion: TABLE_ENERGY_LOW_MAX_X - 1,
        affinity: 70,
        emotionalStability: 70,
      }),
    });
    const mid = deriveTablePersona({
      roster,
      roleResults: traitsFor(['user-0', 'user-1', 'user-2'], {
        extraversion: 60,
        affinity: 70,
        emotionalStability: 70,
      }),
    });
    expect(low.energy).toBe('low');
    expect(mid.energy).toBe('mid');
  });

  it('ignores a table whose trait coverage is thinner than the aggregate floor', () => {
    // Two scored members is not a table signal — fall back to archetypes.
    const roster = [
      { userId: 'user-0', primaryArchetype: 'turtle' },
      { userId: 'user-1', primaryArchetype: 'cat' },
    ];
    expect(TABLE_PERSONA_MIN_TRAIT_SAMPLES).toBeGreaterThan(2);
    const persona = deriveTablePersona({
      roster,
      roleResults: traitsFor(['user-0', 'user-1'], {
        extraversion: 95,
        affinity: 95,
        emotionalStability: 95,
      }),
    });
    // Archetype fallback (both low-energy archetypes) wins over the 2-sample trait read.
    expect(persona.energy).toBe('low');
  });

  it('falls back to archetype composition when no role results exist', () => {
    const quiet = deriveTablePersona({
      roster: [
        { userId: 'a', primaryArchetype: 'turtle' },
        { userId: 'b', archetype: '慢热龟' },
      ],
    });
    const lively = deriveTablePersona({
      roster: [
        { userId: 'a', primaryArchetype: 'corgi' },
        { userId: 'b', archetype: '社牛柯基' },
      ],
    });
    expect(quiet.energy).toBe('low');
    expect(lively.energy).toBe('high');
  });

  it('defaults to mid with no profile signal at all', () => {
    expect(deriveTablePersona({ roster: rosterOf(3) }).energy).toBe('mid');
    expect(deriveTablePersona({ roster: [] }).energy).toBe('mid');
  });
});

describe('tablePersona — depth appetite', () => {
  it('reads deep only on a strict majority of 深度交流', () => {
    const deep = deriveTablePersona({
      roster: [
        { profile: { tableVibePreference: '深度交流' } },
        { profile: { tableVibePreference: '深度交流' } },
        { profile: { tableVibePreference: '轻松聊天' } },
      ],
    });
    expect(deep.depthAppetite).toBe('deep');
  });

  it('normalizes legacy vibe ids (deep_talk / natural_chat / light_fun)', () => {
    expect(
      deriveTablePersona({
        roster: [
          { profile: { tableVibePreference: 'deep_talk' } },
          { profile: { tableVibePreference: 'deep_talk' } },
          { profile: { tableVibePreference: 'natural_chat' } },
        ],
      }).depthAppetite,
    ).toBe('deep');

    expect(
      deriveTablePersona({
        roster: [
          { profile: { tableVibePreference: 'light_fun' } },
          { profile: { tableVibePreference: 'natural_chat' } },
          { profile: { tableVibePreference: 'deep_talk' } },
        ],
      }).depthAppetite,
    ).toBe('light');
  });

  it('reads light when 游戏互动 + 轻松聊天 dominate', () => {
    expect(
      deriveTablePersona({
        roster: [
          { profile: { tableVibePreference: '游戏互动' } },
          { profile: { tableVibePreference: '游戏互动' } },
          { profile: { tableVibePreference: '不限' } },
        ],
      }).depthAppetite,
    ).toBe('light');
  });

  it('treats 不限 as no preference and missing/unknown data as mixed', () => {
    expect(
      deriveTablePersona({
        roster: [
          { profile: { tableVibePreference: '不限' } },
          { profile: { tableVibePreference: '不限' } },
        ],
      }).depthAppetite,
    ).toBe('mixed');

    expect(deriveTablePersona({ roster: rosterOf(4) }).depthAppetite).toBe('mixed');
    expect(
      deriveTablePersona({
        roster: [
          { profile: { tableVibePreference: '深度交流' } },
          { profile: { tableVibePreference: '游戏互动' } },
        ],
      }).depthAppetite,
    ).toBe('mixed');
  });

  it('is a tie-breaker-free exact majority: 2 of 4 is not a majority', () => {
    expect(
      deriveTablePersona({
        roster: [
          { profile: { tableVibePreference: '深度交流' } },
          { profile: { tableVibePreference: '深度交流' } },
          { profile: { tableVibePreference: '轻松聊天' } },
          { profile: { tableVibePreference: '游戏互动' } },
        ],
      }).depthAppetite,
    ).toBe('mixed');
  });
});

describe('tablePersona — shared-interest anchors', () => {
  it('requires three supporters on a table of six', () => {
    const uniqueInterests = ['陶艺', '潜水', '徒步', '摄影', '拼图', '骑行'];
    const twoSupporters = Array.from({ length: 6 }, (_, index) => ({
      userId: `user-${index}`,
      interests: index < 2 ? ['攀岩'] : [uniqueInterests[index]],
    }));
    // Two of six is below the large-roster floor (3): no anchor.
    expect(deriveTablePersona({ roster: twoSupporters }).anchors).toEqual([]);

    const threeSupporters = twoSupporters.map((member, index) =>
      index < 3 ? { ...member, interests: ['攀岩'] } : member,
    );
    const anchors = deriveTablePersona({ roster: threeSupporters }).anchors;
    expect(anchors.map((anchor) => anchor.label)).toEqual(['攀岩']);
  });

  it('accepts two supporters below the large-roster threshold', () => {
    const roster = [
      { interests: ['攀岩'] },
      { interests: ['攀岩'] },
      { interests: ['露营'] },
      { interests: ['露营'] },
      { interests: ['读书'] },
    ];
    const labels = deriveTablePersona({ roster }).anchors.map((anchor) => anchor.label);
    expect(labels).toContain('攀岩');
    expect(labels.length).toBeLessThanOrEqual(3);
  });

  it('keeps coverage server-side and caps prompt anchors at two', () => {
    const persona = deriveTablePersona({
      roster: [
        { interests: ['攀岩', '露营', '手冲咖啡', '爵士乐'] },
        { interests: ['攀岩', '露营', '手冲咖啡', '爵士乐'] },
      ],
    });
    expect(persona.anchors.length).toBeGreaterThan(2);
    expect(persona.anchors[0].coverage).toBe(2);

    const promptAnchors = resolveTableAnchorsForPrompt(persona);
    expect(promptAnchors).toHaveLength(2);
    expect(resolveTableAnchorsForPrompt(persona, 3)).toHaveLength(3);
    expect(resolveTableAnchorsForPrompt(null)).toEqual([]);
    expect(resolveTableAnchorsForPrompt(persona, 0)).toEqual([]);
  });
});

describe('tablePersona — diversity counts', () => {
  it('counts distinct canonical archetypes / industries / life stages and never labels them', () => {
    const persona = deriveTablePersona({
      roster: [
        { primaryArchetype: 'corgi', profile: { industryLabel: '互联网', lifeStage: '职场新人' } },
        // Legacy Chinese name resolves to the same canonical archetype bucket.
        { archetype: '社牛柯基', profile: { industryLabel: '互联网', lifeStage: '职场中坚' } },
        { primaryArchetype: 'turtle', profile: { industryLabel: '金融', lifeStage: '职场中坚' } },
      ],
    });
    expect(persona.diversity).toEqual({
      rosterSize: 3,
      archetypeBuckets: 2,
      industryBuckets: 2,
      lifeStageBuckets: 2,
    });
  });

  it('counts 0 buckets for a roster without profile data', () => {
    expect(deriveTablePersona({ roster: rosterOf(2) }).diversity).toEqual({
      rosterSize: 2,
      archetypeBuckets: 0,
      industryBuckets: 0,
      lifeStageBuckets: 0,
    });
  });
});

describe('tablePersona — W3 privacy boundary', () => {
  it('leaks no identity, demographic, or per-person signal into the output', () => {
    const roster: TablePersonaRosterMember[] = [
      {
        userId: 'user-secret-1',
        displayName: '小心心',
        primaryArchetype: 'corgi',
        interests: ['攀岩', '露营'],
        profile: {
          industryLabel: '互联网',
          lifeStage: '职场新人',
          tableVibePreference: '深度交流',
          // Extra keys a real roster projection may carry — none may survive.
          bio: '我的秘密日记',
          gender: '女性',
          age: 27,
          city: '深圳',
        } as TablePersonaRosterMember['profile'],
      },
      {
        userId: 'user-secret-2',
        displayName: '阿朗',
        primaryArchetype: 'turtle',
        interests: ['攀岩', '露营'],
        profile: {
          industryLabel: '金融',
          lifeStage: '职场中坚',
          tableVibePreference: '深度交流',
        },
      },
    ];

    const persona = deriveTablePersona({
      roster,
      roleResults: traitsFor(['user-secret-1', 'user-secret-2'], {
        extraversion: 80,
        affinity: 80,
        emotionalStability: 80,
      }),
    });

    expect(Object.keys(persona).sort()).toEqual([
      'anchors',
      'depthAppetite',
      'diversity',
      'energy',
    ]);

    const serialized = JSON.stringify(persona);
    for (const forbidden of [
      'user-secret-1',
      'user-secret-2',
      '小心心',
      '阿朗',
      '我的秘密日记',
      '女性',
      '深圳',
      '27',
      'userId',
      'displayName',
      'bio',
      'gender',
      'tableVibePreference',
      'extraversion',
      'affinity',
      'emotionalStability',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('exposes no individual preference counts for depth appetite', () => {
    const persona = deriveTablePersona({
      roster: [
        { profile: { tableVibePreference: '深度交流' } },
        { profile: { tableVibePreference: '深度交流' } },
        { profile: { tableVibePreference: '深度交流' } },
      ],
    });
    expect(persona.depthAppetite).toBe('deep');
    // Only the four declared persona keys — no support counts, no per-person entries.
    expect(Object.keys(persona)).not.toContain('depthSupporters');
    expect(JSON.stringify(persona)).not.toContain('tableVibePreference');
  });

  it('is deterministic: identical input yields identical output', () => {
    const roster = [
      { userId: 'a', primaryArchetype: 'corgi', interests: ['攀岩'], profile: { tableVibePreference: '深度交流' } },
      { userId: 'b', primaryArchetype: 'turtle', interests: ['攀岩'], profile: { tableVibePreference: '轻松聊天' } },
    ];
    const roleResults = traitsFor(['a', 'b'], {
      extraversion: 70,
      affinity: 70,
      emotionalStability: 70,
    });
    expect(deriveTablePersona({ roster, roleResults })).toEqual(
      deriveTablePersona({ roster, roleResults }),
    );
  });
});
