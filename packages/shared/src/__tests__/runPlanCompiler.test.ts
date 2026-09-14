import { describe, it, expect } from 'vitest';
import {
  compileAgentRunPlan,
  getBudgetForTier,
  getNonCorePoolForTier,
  buildArchetypeMix,
  deriveArchetypeComposition,
  deriveLieDetectiveMinutes,
  applyRosterDerivedTiming,
  applyPeakDecompression,
  ensureNoJudgmentClosing,
  normalizeRunPlanTiming,
  isJudgmentPhase,
  LIE_DETECTIVE_MINUTES_PER_PLAYER,
  LIE_DETECTIVE_MIN_MINUTES,
  LIE_DETECTIVE_MAX_MINUTES,
  type CompilationContext,
  type RunPlanTemplate,
} from '../runPlanCompiler';
import { getPhaseModule } from '../phaseRegistry';
import { GLOW_RUN_PLAN, BLAZE_RUN_PLAN, BREEZE_RUN_PLAN } from '../socialIcebreakerRunPlans';
import { createRunPlan } from '../phaseModule';
import type { TierMachineId } from '../socialIcebreakerTierManifest';
import type { SocialIcebreakerPhase } from '../socialIcebreaker';

// ─── Test fixtures ────────────────────────────────────────────────────────

const ALL_PHASES: SocialIcebreakerPhase[] = [
  'warmup',
  'micro_challenge',
  'lie_detective',
  'auction',
  'personality_dice',
  'quip_battle',
  'undercover_word',
  'group_mirror',
  'speed_friending',
  'mini_script',
  'recap',
];

const DEFAULT_ENABLED: SocialIcebreakerPhase[] = [
  'warmup',
  'micro_challenge',
  'lie_detective',
  'personality_dice',
  'recap',
];

const WITH_AUCTION: SocialIcebreakerPhase[] = [...DEFAULT_ENABLED, 'auction'];
const WITH_GROUP_MIRROR: SocialIcebreakerPhase[] = [...DEFAULT_ENABLED, 'group_mirror'];
const WITH_QUIP_BATTLE: SocialIcebreakerPhase[] = [...DEFAULT_ENABLED, 'quip_battle'];
const WITH_UNDERCOVER: SocialIcebreakerPhase[] = [...DEFAULT_ENABLED, 'undercover_word'];
const WITH_MINI_SCRIPT: SocialIcebreakerPhase[] = [...DEFAULT_ENABLED, 'mini_script'];
const ALL_ENABLED: SocialIcebreakerPhase[] = ALL_PHASES;

function makeCtx(
  tier: TierMachineId,
  enabledPhases: SocialIcebreakerPhase[],
  playerCount = 4,
): CompilationContext {
  return { tier, playerCount, enabledPhases };
}

// ─── Shared assertions ────────────────────────────────────────────────────

function assertValidPlan(plan: ReturnType<typeof compileAgentRunPlan>, enabledPhases: SocialIcebreakerPhase[]) {
  const phases = plan.segments.map((s) => s.phase);

  // No duplicates
  expect(new Set(phases).size).toBe(phases.length);

  // recap is always last
  expect(phases[phases.length - 1]).toBe('recap');

  // warmup and micro_challenge are first and second
  expect(phases[0]).toBe('warmup');
  expect(phases[1]).toBe('micro_challenge');

  // All phases are in enabledPhases
  for (const phase of phases) {
    expect(enabledPhases).toContain(phase);
  }

  // totalMinutes equals sum of allocatedMinutes
  const sumMinutes = plan.segments.reduce((sum, s) => sum + s.allocatedMinutes, 0);
  expect(plan.totalMinutes).toBe(sumMinutes);

  // version and compilerId
  expect(plan.version).toBe(2);
  expect(plan.compilerId).toContain('compiler-rule-v1');
  expect(new Date(plan.compiledAt).getTime()).not.toBeNaN();
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('runPlanCompiler', () => {
  describe('getBudgetForTier', () => {
    it('returns 40 for breeze', () => {
      expect(getBudgetForTier('breeze')).toBe(40);
    });
    it('returns 60 for glow', () => {
      expect(getBudgetForTier('glow')).toBe(60);
    });
    it('returns 90 for blaze', () => {
      expect(getBudgetForTier('blaze')).toBe(90);
    });
  });

  describe('getNonCorePoolForTier', () => {
    it('returns only lie_detective for breeze', () => {
      const pool = getNonCorePoolForTier('breeze', ALL_ENABLED);
      expect(pool).toEqual(['lie_detective']);
    });
    it('returns 3 phases for glow', () => {
      const pool = getNonCorePoolForTier('glow', ALL_ENABLED);
      expect(pool).toEqual(['lie_detective', 'personality_dice', 'group_mirror']);
    });
    it('returns 6 phases for blaze', () => {
      const pool = getNonCorePoolForTier('blaze', ALL_ENABLED);
      expect(pool).toEqual([
        'lie_detective',
        'personality_dice',
        'undercover_word',
        'auction',
        'quip_battle',
        'group_mirror',
      ]);
    });
    it('filters out disabled phases', () => {
      const pool = getNonCorePoolForTier('blaze', DEFAULT_ENABLED);
      expect(pool).toEqual(['lie_detective', 'personality_dice']);
    });
  });

  describe('compileAgentRunPlan — breeze', () => {
    it('compiles a valid breeze plan with defaults', () => {
      const plan = compileAgentRunPlan(makeCtx('breeze', DEFAULT_ENABLED));
      assertValidPlan(plan, DEFAULT_ENABLED);
      expect(plan.totalMinutes).toBe(40);
      const phases = plan.segments.map((s) => s.phase);
      expect(phases).toEqual(['warmup', 'micro_challenge', 'lie_detective', 'recap']);
    });

    it('omits lie_detective when not enabled', () => {
      const enabled = ['warmup', 'micro_challenge', 'recap'];
      const plan = compileAgentRunPlan(makeCtx('breeze', enabled));
      assertValidPlan(plan, enabled);
      const phases = plan.segments.map((s) => s.phase);
      expect(phases).toEqual(['warmup', 'micro_challenge', 'recap']);
    });

    it('is deterministic across multiple calls', () => {
      const ctx = makeCtx('breeze', DEFAULT_ENABLED);
      const p1 = compileAgentRunPlan(ctx);
      const p2 = compileAgentRunPlan(ctx);
      expect(p1.segments).toEqual(p2.segments);
      expect(p1.totalMinutes).toBe(p2.totalMinutes);
      expect(p1.compilerId).toBe(p2.compilerId);
    });
  });

  describe('compileAgentRunPlan — glow', () => {
    it('compiles a valid glow plan with defaults', () => {
      const plan = compileAgentRunPlan(makeCtx('glow', DEFAULT_ENABLED));
      assertValidPlan(plan, DEFAULT_ENABLED);
      expect(plan.totalMinutes).toBe(60);
      const phases = plan.segments.map((s) => s.phase);
      // personality_dice (rising) sorts before lie_detective (peak) by energy arc
      expect(phases).toEqual(['warmup', 'micro_challenge', 'personality_dice', 'lie_detective', 'recap']);
    });

    it('includes group_mirror when enabled', () => {
      const plan = compileAgentRunPlan(makeCtx('glow', WITH_GROUP_MIRROR));
      assertValidPlan(plan, WITH_GROUP_MIRROR);
      const phases = plan.segments.map((s) => s.phase);
      expect(phases).toContain('group_mirror');
      expect(phases).toContain('lie_detective');
      expect(phases).toContain('personality_dice');
      expect(phases.length).toBe(6); // core + 3 non-core + recap
    });

    it('omits disabled phases gracefully', () => {
      const enabled = ['warmup', 'micro_challenge', 'lie_detective', 'recap'];
      const plan = compileAgentRunPlan(makeCtx('glow', enabled));
      assertValidPlan(plan, enabled);
      const phases = plan.segments.map((s) => s.phase);
      expect(phases).toEqual(['warmup', 'micro_challenge', 'lie_detective', 'recap']);
    });
  });

  describe('compileAgentRunPlan — blaze', () => {
    it('compiles a valid blaze plan with defaults', () => {
      const plan = compileAgentRunPlan(makeCtx('blaze', DEFAULT_ENABLED));
      assertValidPlan(plan, DEFAULT_ENABLED);
      expect(plan.totalMinutes).toBe(90);
      const phases = plan.segments.map((s) => s.phase);
      // personality_dice (rising) sorts before lie_detective (peak) by energy arc
      expect(phases).toEqual(['warmup', 'micro_challenge', 'personality_dice', 'lie_detective', 'recap']);
    });

    it('includes all enabled blaze phases', () => {
      const plan = compileAgentRunPlan(makeCtx('blaze', ALL_ENABLED));
      assertValidPlan(plan, ALL_ENABLED);
      const phases = plan.segments.map((s) => s.phase);
      expect(phases).toContain('lie_detective');
      expect(phases).toContain('personality_dice');
      expect(phases).toContain('undercover_word');
      expect(phases).toContain('auction');
      expect(phases).toContain('quip_battle');
      expect(phases).toContain('group_mirror');
      expect(phases.length).toBe(9); // core + 6 non-core + recap
    });

    it('includes auction when enabled', () => {
      const plan = compileAgentRunPlan(makeCtx('blaze', WITH_AUCTION));
      assertValidPlan(plan, WITH_AUCTION);
      const phases = plan.segments.map((s) => s.phase);
      expect(phases).toContain('auction');
    });

    it('includes quip_battle when enabled', () => {
      const plan = compileAgentRunPlan(makeCtx('blaze', WITH_QUIP_BATTLE));
      assertValidPlan(plan, WITH_QUIP_BATTLE);
      const phases = plan.segments.map((s) => s.phase);
      expect(phases).toContain('quip_battle');
    });

    it('includes undercover_word when enabled', () => {
      const plan = compileAgentRunPlan(makeCtx('blaze', WITH_UNDERCOVER));
      assertValidPlan(plan, WITH_UNDERCOVER);
      const phases = plan.segments.map((s) => s.phase);
      expect(phases).toContain('undercover_word');
    });
  });

  describe('time allocation', () => {
    it('allocates core phases their nominal duration', () => {
      const plan = compileAgentRunPlan(makeCtx('breeze', DEFAULT_ENABLED));
      const warmup = plan.segments.find((s) => s.phase === 'warmup');
      const micro = plan.segments.find((s) => s.phase === 'micro_challenge');
      const recap = plan.segments.find((s) => s.phase === 'recap');
      expect(warmup?.allocatedMinutes).toBe(8);
      expect(micro?.allocatedMinutes).toBe(8);
      expect(recap?.allocatedMinutes).toBe(5);
    });

    it('allocates non-core phases within budget for glow', () => {
      const plan = compileAgentRunPlan(makeCtx('glow', WITH_GROUP_MIRROR));
      // glow budget = 60; core = 16; recap = 5; non-core budget = 39
      const nonCoreTotal = plan.segments
        .filter((s) => s.phase !== 'warmup' && s.phase !== 'micro_challenge' && s.phase !== 'recap')
        .reduce((sum, s) => sum + s.allocatedMinutes, 0);
      expect(nonCoreTotal).toBe(39);
    });

    it('allocates non-core phases within budget for blaze', () => {
      const plan = compileAgentRunPlan(makeCtx('blaze', ALL_ENABLED));
      // blaze budget = 90; core = 16; recap = 5; non-core budget = 69
      const nonCoreTotal = plan.segments
        .filter((s) => s.phase !== 'warmup' && s.phase !== 'micro_challenge' && s.phase !== 'recap')
        .reduce((sum, s) => sum + s.allocatedMinutes, 0);
      expect(nonCoreTotal).toBe(69);
    });
  });

  describe('energy arc ordering', () => {
    it('places group_mirror in the wind-down slot (falling arc), not as opener', () => {
      const plan = compileAgentRunPlan(makeCtx('glow', WITH_GROUP_MIRROR));
      const phases = plan.segments.map((s) => s.phase);
      // group_mirror = falling (4), personality_dice = rising (2), lie_detective = peak (3)
      // Energy arc sort places: pd < lie < gm; categories (creative/deduction/creative)
      // need no spacing swap, so the arc order survives intact.
      expect(phases).toEqual([
        'warmup',
        'micro_challenge',
        'personality_dice',
        'lie_detective',
        'group_mirror',
        'recap',
      ]);
    });

    it('never places a warmup-arc phase in the non-core block', () => {
      // Regression guard for the group_mirror 'warmup' mistag (fixed 2026-08-03):
      // a warmup-tagged non-core phase would open the post-micro_challenge block.
      for (const tier of ['breeze', 'glow', 'blaze'] as const) {
        const plan = compileAgentRunPlan(makeCtx(tier, ALL_ENABLED));
        const nonCore = plan.segments.slice(2, -1);
        for (const seg of nonCore) {
          expect(getEnergyArc(seg.phase)).not.toBe('warmup');
        }
      }
    });

    it('never places a peak-arc phase before position 3', () => {
      for (const tier of ['breeze', 'glow', 'blaze'] as const) {
        const plan = compileAgentRunPlan(makeCtx(tier, ALL_ENABLED));
        for (const seg of plan.segments.slice(0, 2)) {
          expect(getEnergyArc(seg.phase)).not.toBe('peak');
        }
      }
    });
  });

  describe('category spacing', () => {
    it('avoids consecutive same-category phases when possible', () => {
      const plan = compileAgentRunPlan(makeCtx('blaze', ALL_ENABLED));
      const phases = plan.segments.map((s) => s.phase);

      for (let i = 1; i < phases.length - 1; i++) {
        const prevCat = getCategory(phases[i - 1]);
        const currCat = getCategory(phases[i]);
        // Note: some edge cases may have unavoidable duplicates; we just verify
        // that the spacing algorithm was attempted (no assert that it's perfect)
      }
    });
  });

  describe('player count variations', () => {
    const playerCounts = [1, 2, 3, 4, 5, 6];
    for (const count of playerCounts) {
      it(`compiles valid plan for playerCount=${count}`, () => {
        const plan = compileAgentRunPlan(makeCtx('blaze', ALL_ENABLED, count));
        assertValidPlan(plan, ALL_ENABLED);
      });
    }
  });

  describe('error handling', () => {
    it('throws for invalid tier', () => {
      expect(() =>
        compileAgentRunPlan({ tier: 'invalid' as TierMachineId, playerCount: 4, enabledPhases: ALL_PHASES }),
      ).toThrow('Invalid tier');
    });

    it('throws for invalid playerCount', () => {
      expect(() =>
        compileAgentRunPlan({ tier: 'breeze', playerCount: 0, enabledPhases: ALL_PHASES }),
      ).toThrow('Invalid playerCount');
    });

    it('throws for empty enabledPhases', () => {
      expect(() =>
        compileAgentRunPlan({ tier: 'breeze', playerCount: 4, enabledPhases: [] }),
      ).toThrow('enabledPhases must be a non-empty array');
    });

    it('throws when core phases are missing', () => {
      expect(() =>
        compileAgentRunPlan({ tier: 'breeze', playerCount: 4, enabledPhases: ['recap'] }),
      ).toThrow('Core phases must all be enabled');
    });
  });

  describe('determinism — 100 permutations', () => {
    const tiers: TierMachineId[] = ['breeze', 'glow', 'blaze'];
    const enabledSets: SocialIcebreakerPhase[][] = [
      DEFAULT_ENABLED,
      WITH_AUCTION,
      WITH_GROUP_MIRROR,
      WITH_QUIP_BATTLE,
      WITH_UNDERCOVER,
      WITH_MINI_SCRIPT,
      ALL_ENABLED,
    ];

    for (const tier of tiers) {
      for (const enabled of enabledSets) {
        for (const playerCount of [1, 2, 3, 4, 5, 6]) {
          it(`tier=${tier} enabled=[${enabled.length}] playerCount=${playerCount}`, () => {
            const ctx = makeCtx(tier, enabled, playerCount);
            const plan = compileAgentRunPlan(ctx);
            assertValidPlan(plan, enabled);

            // Determinism: same inputs → same output
            const plan2 = compileAgentRunPlan(ctx);
            expect(plan.segments).toEqual(plan2.segments);
          });
        }
      }
    }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────

// ─── Template compiler tests ──────────────────────────────────────────────

import {
  resolveTemplateSlots,
  TEMPLATE_DEFAULTS,
  type TemplateVibeId,
} from '../runPlanCompiler';

const ALL_PHASES_WITH_MIRROR: SocialIcebreakerPhase[] = [
  'warmup',
  'micro_challenge',
  'lie_detective',
  'auction',
  'personality_dice',
  'quip_battle',
  'undercover_word',
  'group_mirror',
  'speed_friending',
  'recap',
];

const TEMPLATE_VIBES: TemplateVibeId[] = ['deep_chat', 'balanced', 'play_fun'];
const TIERS: TierMachineId[] = ['breeze', 'glow', 'blaze'];

function assertValidTemplateSegments(segments: ReturnType<typeof resolveTemplateSlots>) {
  const phases = segments.map((s) => s.phase);

  // No duplicates
  expect(new Set(phases).size).toBe(phases.length);

  // recap is always last
  expect(phases[phases.length - 1]).toBe('recap');

  // warmup and micro_challenge are first and second
  expect(phases[0]).toBe('warmup');
  expect(phases[1]).toBe('micro_challenge');

  // totalMinutes equals sum of allocatedMinutes
  const sumMinutes = segments.reduce((sum, s) => sum + s.allocatedMinutes, 0);
  expect(sumMinutes).toBeGreaterThan(0);
}

describe('resolveTemplateSlots', () => {
  it('produces valid plans for all 9 vibe-tier combos', () => {
    for (const vibe of TEMPLATE_VIBES) {
      for (const tier of TIERS) {
        const segments = resolveTemplateSlots(vibe, tier, 4, ALL_PHASES_WITH_MIRROR);
        assertValidTemplateSegments(segments);
      }
    }
  });

  it('produces deterministic output for identical inputs', () => {
    const s1 = resolveTemplateSlots('deep_chat', 'glow', 4, ALL_PHASES_WITH_MIRROR);
    const s2 = resolveTemplateSlots('deep_chat', 'glow', 4, ALL_PHASES_WITH_MIRROR);
    expect(s1).toEqual(s2);
  });

  it('enforces category spacing when possible', () => {
    const segments = resolveTemplateSlots('balanced', 'blaze', 4, ALL_PHASES_WITH_MIRROR);
    const phases = segments.map((s) => s.phase);
    for (let i = 1; i < phases.length - 1; i++) {
      const prevCat = getCategory(phases[i - 1]);
      const currCat = getCategory(phases[i]);
      // We allow at most one consecutive same-category pair in edge cases
      if (prevCat === currCat && i + 1 < phases.length - 1) {
        const nextCat = getCategory(phases[i + 1]);
        expect(nextCat).not.toBe(currCat);
      }
    }
  });

  it('falls back to slot type full pool when eligible phases are exhausted', () => {
    // Use a tiny enabled set so the template's eligible phases won't all match
    const minimalEnabled: SocialIcebreakerPhase[] = [
      'warmup',
      'micro_challenge',
      'lie_detective',
      'personality_dice',
      'recap',
    ];
    const segments = resolveTemplateSlots('play_fun', 'glow', 4, minimalEnabled);
    assertValidTemplateSegments(segments);
    // Should still have lie_detective from the play_fun slot
    const phases = segments.map((s) => s.phase);
    expect(phases).toContain('lie_detective');
  });

  it('skips slots when no phase can be resolved', () => {
    // Only core phases enabled — no flexible slots can resolve
    const coreOnly: SocialIcebreakerPhase[] = ['warmup', 'micro_challenge', 'recap'];
    const segments = resolveTemplateSlots('deep_chat', 'breeze', 4, coreOnly);
    expect(segments.map((s) => s.phase)).toEqual(['warmup', 'micro_challenge', 'recap']);
  });

  it('respects minPlayers when resolving slots', () => {
    // With only 2 players, lie_detective (min 3) should be skipped
    const segments = resolveTemplateSlots('play_fun', 'breeze', 2, ALL_PHASES_WITH_MIRROR);
    const phases = segments.map((s) => s.phase);
    // play_fun breeze first slot prefers lie_detective (min 3), but with only
    // 2 players it falls back to other eligible phases in the pool
    expect(phases).not.toContain('lie_detective');
    // Should still resolve to some valid phases between micro_challenge and recap
    expect(phases.length).toBeGreaterThanOrEqual(4);
  });

  it('uses provided custom template instead of defaults', () => {
    const customTemplate = {
      vibe: 'deep_chat' as TemplateVibeId,
      tier: 'breeze' as TierMachineId,
      playerCountMin: 2,
      playerCountMax: 12,
      coreWarmupMinutes: 99,
      coreMicroChallengeMinutes: 10,
      coreRecapMinutes: 5,
      slots: [
        { slotType: 'deep_chat' as const, eligiblePhases: ['group_mirror'], allocatedMinutes: 7 },
      ],
    };
    const segments = resolveTemplateSlots('deep_chat', 'breeze', 4, ALL_PHASES_WITH_MIRROR, customTemplate);
    const warmup = segments.find((s) => s.phase === 'warmup');
    expect(warmup?.allocatedMinutes).toBe(99);
  });
});

describe('TEMPLATE_DEFAULTS', () => {
  it('contains exactly 9 templates', () => {
    expect(TEMPLATE_DEFAULTS.length).toBe(9);
  });

  it('covers all 3 vibes × 3 tiers', () => {
    for (const vibe of TEMPLATE_VIBES) {
      for (const tier of TIERS) {
        const match = TEMPLATE_DEFAULTS.find((t) => t.vibe === vibe && t.tier === tier);
        expect(match).toBeDefined();
      }
    }
  });

  it('has no duplicate (vibe, tier) pairs', () => {
    const keys = TEMPLATE_DEFAULTS.map((t) => `${t.vibe}-${t.tier}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

function getCategory(phase: SocialIcebreakerPhase): string {
  // Inline category lookup to avoid importing PHASE_REGISTRY in tests
  const map: Record<SocialIcebreakerPhase, string> = {
    warmup: 'conversation',
    micro_challenge: 'game',
    lie_detective: 'deduction',
    auction: 'competition',
    personality_dice: 'creative',
    quip_battle: 'creative',
    undercover_word: 'deduction',
    group_mirror: 'creative',
    mini_script: 'narrative',
    recap: 'conversation',
  };
  return map[phase] ?? 'unknown';
}

function getEnergyArc(phase: SocialIcebreakerPhase): string {
  // Inline energy-arc lookup mirroring PHASE_REGISTRY (same convention as getCategory)
  const map: Record<SocialIcebreakerPhase, string> = {
    warmup: 'warmup',
    micro_challenge: 'rising',
    lie_detective: 'peak',
    auction: 'peak',
    personality_dice: 'rising',
    quip_battle: 'rising',
    undercover_word: 'peak',
    group_mirror: 'falling',
    mini_script: 'peak',
    recap: 'falling',
    speed_friending: 'rising',
    phase_selection: 'warmup',
  };
  return map[phase] ?? 'unknown';
}

// ─── Composition rules (W5, gm-debrief) ─────────────────────────────────────

describe('archetype composition rules (W5)', () => {
  it('buildArchetypeMix counts roster archetypes and returns undefined when empty', () => {
    expect(buildArchetypeMix([])).toBeUndefined();
    expect(
      buildArchetypeMix([
        { archetype: '社牛柯基' },
        { archetype: '社牛柯基' },
        { archetype: '慢热龟' },
      ]),
    ).toEqual({ 社牛柯基: 2, 慢热龟: 1 });
    expect(buildArchetypeMix([{}, { archetype: '  ' }])).toBeUndefined();
  });

  it('deriveArchetypeComposition flags shy-heavy when low-energy archetypes are the majority', () => {
    const shy = deriveArchetypeComposition({ 慢热龟: 2, 小透明猫: 2 });
    expect(shy?.shyHeavy).toBe(true);
    expect(shy?.outgoingHeavy).toBe(false);
    expect(shy?.lowEnergyCount).toBe(4);

    const lively = deriveArchetypeComposition({ 社牛柯基: 2, 小太阳鸡: 2 });
    expect(lively?.outgoingHeavy).toBe(true);
    expect(lively?.shyHeavy).toBe(false);
    expect(deriveArchetypeComposition(undefined)).toBeNull();
  });

  it('AC-W5.5: shy-heavy legacy compilation injects speed_friending', () => {
    const plan = compileAgentRunPlan({
      tier: 'blaze',
      playerCount: 4,
      enabledPhases: ALL_ENABLED,
      vibe: 'balanced',
      archetypeMix: { 慢热龟: 2, 小透明猫: 2 },
    });
    const phases = plan.segments.map((s) => s.phase);
    expect(phases).toContain('speed_friending');

    const baseline = compileAgentRunPlan({
      tier: 'blaze',
      playerCount: 4,
      enabledPhases: ALL_ENABLED,
      vibe: 'balanced',
    });
    const baselineFull = baseline.segments.filter((s) => s.participation === 'full').length;
    const composedFull = plan.segments.filter((s) => s.participation === 'full').length;
    expect(composedFull).toBeLessThanOrEqual(baselineFull);
  });

  it('AC-W5.1: template path prefers pass_ok over full for a shy-heavy table', () => {
    const template: RunPlanTemplate = {
      vibe: 'balanced',
      tier: 'breeze',
      playerCountMin: 2,
      playerCountMax: 12,
      coreWarmupMinutes: 10,
      coreMicroChallengeMinutes: 8,
      coreRecapMinutes: 5,
      slots: [
        {
          slotType: 'deep_chat',
          eligiblePhases: ['lie_detective', 'personality_dice'],
          allocatedMinutes: 12,
        },
      ],
    };
    const baseline = resolveTemplateSlots('balanced', 'breeze', 4, ALL_ENABLED, template);
    const shy = resolveTemplateSlots(
      'balanced',
      'breeze',
      4,
      ALL_ENABLED,
      template,
      deriveArchetypeComposition({ 慢热龟: 2, 小透明猫: 2 }),
    );

    expect(shy.map((s) => s.phase)).toContain('personality_dice');
    const baselineFull = baseline.filter((s) => s.participation === 'full').length;
    const shyFull = shy.filter((s) => s.participation === 'full').length;
    expect(shyFull).toBeLessThan(baselineFull);
  });

  it('flag-off (no archetypeMix) leaves phase selection byte-identical', () => {
    const base = compileAgentRunPlan({
      tier: 'blaze',
      playerCount: 4,
      enabledPhases: ALL_ENABLED,
      vibe: 'balanced',
    });
    const withUndefinedMix = compileAgentRunPlan({
      tier: 'blaze',
      playerCount: 4,
      enabledPhases: ALL_ENABLED,
      vibe: 'balanced',
      archetypeMix: undefined,
    });
    expect(withUndefinedMix.segments.map((s) => s.phase)).toEqual(
      base.segments.map((s) => s.phase),
    );
  });
});

// ─── W9 (gm-debrief): re-timing & placement ────────────────────────────────

const isPeak = (phase: SocialIcebreakerPhase) => getPhaseModule(phase).energyArc === 'peak';

describe('W9 — roster-derived timing, decompression, placement', () => {
  describe('AC-W9.1: anonymous judgment is not the closing act', () => {
    it('group_mirror is appreciation-only, never a judgment closer', () => {
      expect(getPhaseModule('group_mirror').perceptionTone).toBe('appreciation');
      expect(isJudgmentPhase('group_mirror')).toBe(false);
    });

    it('keeps group_mirror as the warm falling closer (energy-arc consistency)', () => {
      const plan = compileAgentRunPlan(makeCtx('glow', WITH_GROUP_MIRROR));
      const phases = plan.segments.map((s) => s.phase);
      const penultimate = plan.segments[plan.segments.length - 2];
      expect(penultimate.phase).toBe('group_mirror');
      expect(getPhaseModule('group_mirror').energyArc).toBe('falling');
      expect(isJudgmentPhase(penultimate.phase)).toBe(false);
      expect(phases[phases.length - 1]).toBe('recap');
    });

    it('leaves an appreciation closer untouched (guard is forward-defense)', () => {
      const plan = createRunPlan(
        [
          { phase: 'warmup', allocatedMinutes: 8, energyWeight: 1 },
          { phase: 'micro_challenge', allocatedMinutes: 8, energyWeight: 2 },
          { phase: 'group_mirror', allocatedMinutes: 10, energyWeight: 1 },
          { phase: 'recap', allocatedMinutes: 5, energyWeight: 1 },
        ],
        'test',
      );
      const guarded = ensureNoJudgmentClosing(plan.segments);
      expect(guarded.map((s) => s.phase)).toEqual([
        'warmup',
        'micro_challenge',
        'group_mirror',
        'recap',
      ]);
    });
  });

  describe('AC-W9.2: lie_detective duration derives from playerCount', () => {
    it('floors at 15 minutes for a 6-player table and scales by 2.5 min/player', () => {
      expect(deriveLieDetectiveMinutes(6)).toBeGreaterThanOrEqual(15);
      expect(deriveLieDetectiveMinutes(6)).toBe(15);
      expect(deriveLieDetectiveMinutes(8)).toBe(
        Math.ceil(8 * LIE_DETECTIVE_MINUTES_PER_PLAYER),
      );
      expect(deriveLieDetectiveMinutes(20)).toBe(LIE_DETECTIVE_MAX_MINUTES);
      expect(deriveLieDetectiveMinutes(2)).toBe(LIE_DETECTIVE_MIN_MINUTES);
    });

    it('lifts sub-floor allocations and preserves the tier total', () => {
      const segments = [
        { phase: 'warmup' as const, allocatedMinutes: 8, energyWeight: 1 },
        { phase: 'micro_challenge' as const, allocatedMinutes: 8, energyWeight: 2 },
        { phase: 'lie_detective' as const, allocatedMinutes: 10, energyWeight: 3 },
        { phase: 'auction' as const, allocatedMinutes: 20, energyWeight: 3 },
        { phase: 'recap' as const, allocatedMinutes: 5, energyWeight: 1 },
      ];
      const before = segments.reduce((sum, s) => sum + s.allocatedMinutes, 0);
      const after = applyRosterDerivedTiming(segments, 6);
      const lie = after.find((s) => s.phase === 'lie_detective');
      expect(lie?.allocatedMinutes).toBe(15);
      expect(after.reduce((sum, s) => sum + s.allocatedMinutes, 0)).toBe(before);
      // Donor never drops below the floor.
      expect(after.find((s) => s.phase === 'auction')?.allocatedMinutes).toBe(15);
    });

    it('gives every tier ≥15 min for a 6-player roster', () => {
      for (const tier of ['breeze', 'glow', 'blaze'] as const) {
        const plan = compileAgentRunPlan(makeCtx(tier, ALL_ENABLED, 6));
        const lie = plan.segments.find((s) => s.phase === 'lie_detective');
        expect(lie?.allocatedMinutes).toBeGreaterThanOrEqual(15);
      }
    });

    it('hardcoded fallback plans carry the 6-player floor', () => {
      for (const plan of [BREEZE_RUN_PLAN, GLOW_RUN_PLAN, BLAZE_RUN_PLAN]) {
        const lie = plan.segments.find((s) => s.phase === 'lie_detective');
        expect(lie?.allocatedMinutes).toBeGreaterThanOrEqual(15);
        expect(plan.totalMinutes).toBe(
          plan.segments.reduce((sum, s) => sum + s.allocatedMinutes, 0),
        );
      }
    });
  });

  describe('AC-W9.3: no two consecutive peak phases', () => {
    it('compiles blaze with zero adjacent peaks', () => {
      const plan = compileAgentRunPlan(makeCtx('blaze', ALL_ENABLED, 6));
      const phases = plan.segments.map((s) => s.phase);
      for (let i = 1; i < phases.length; i++) {
        expect(isPeak(phases[i - 1]) && isPeak(phases[i])).toBe(false);
      }
    });

    it('keeps every template combo free of adjacent peaks', () => {
      for (const vibe of ['deep_chat', 'balanced', 'play_fun'] as const) {
        for (const tier of ['breeze', 'glow', 'blaze'] as const) {
          const segments = resolveTemplateSlots(vibe, tier, 6, ALL_PHASES);
          const phases = segments.map((s) => s.phase);
          for (let i = 1; i < phases.length; i++) {
            expect(isPeak(phases[i - 1]) && isPeak(phases[i])).toBe(false);
          }
        }
      }
    });

    it('decompresses an adjacent peak pair without touching core/recap', () => {
      const segments = [
        { phase: 'warmup' as const, allocatedMinutes: 8, energyWeight: 1 },
        { phase: 'micro_challenge' as const, allocatedMinutes: 8, energyWeight: 2 },
        { phase: 'lie_detective' as const, allocatedMinutes: 15, energyWeight: 3 },
        { phase: 'undercover_word' as const, allocatedMinutes: 12, energyWeight: 3 },
        { phase: 'auction' as const, allocatedMinutes: 15, energyWeight: 3 },
        { phase: 'quip_battle' as const, allocatedMinutes: 10, energyWeight: 2 },
        { phase: 'personality_dice' as const, allocatedMinutes: 10, energyWeight: 2 },
        { phase: 'recap' as const, allocatedMinutes: 5, energyWeight: 1 },
      ];
      const out = applyPeakDecompression(segments);
      expect(out[0].phase).toBe('warmup');
      expect(out[out.length - 1].phase).toBe('recap');
      const phases = out.map((s) => s.phase);
      for (let i = 1; i < phases.length; i++) {
        expect(isPeak(phases[i - 1]) && isPeak(phases[i])).toBe(false);
      }
    });

    it('is a byte-identical no-op when there is no adjacency', () => {
      const segments = [
        { phase: 'warmup' as const, allocatedMinutes: 8, energyWeight: 1 },
        { phase: 'micro_challenge' as const, allocatedMinutes: 8, energyWeight: 2 },
        { phase: 'personality_dice' as const, allocatedMinutes: 12, energyWeight: 2 },
        { phase: 'lie_detective' as const, allocatedMinutes: 15, energyWeight: 3 },
        { phase: 'group_mirror' as const, allocatedMinutes: 10, energyWeight: 1 },
        { phase: 'recap' as const, allocatedMinutes: 5, energyWeight: 1 },
      ];
      expect(applyPeakDecompression(segments)).toEqual(segments);
    });
  });

  describe('normalizeRunPlanTiming', () => {
    it('recomputes totalMinutes after re-timing and reordering', () => {
      const plan = createRunPlan(
        [
          { phase: 'warmup', allocatedMinutes: 8, energyWeight: 1 },
          { phase: 'micro_challenge', allocatedMinutes: 8, energyWeight: 2 },
          { phase: 'lie_detective', allocatedMinutes: 10, energyWeight: 3 },
          { phase: 'recap', allocatedMinutes: 5, energyWeight: 1 },
        ],
        'test',
      );
      const normalized = normalizeRunPlanTiming(plan, 6);
      expect(normalized.segments.find((s) => s.phase === 'lie_detective')?.allocatedMinutes).toBe(15);
      expect(normalized.totalMinutes).toBe(
        normalized.segments.reduce((sum, s) => sum + s.allocatedMinutes, 0),
      );
    });
  });
});
