import { describe, it, expect } from 'vitest';
import type { IcebreakerRunPlan, PhaseSegment } from '@shared/phaseModule';
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import {
  MICRO_CHALLENGE_RHYTHM_BONUS_MAX_MINUTES,
  TABLE_RHYTHM_SHIFT_MINUTES,
  WARMUP_RHYTHM_MAX_MINUTES,
  WARMUP_RHYTHM_MIN_MINUTES,
  applyTableRhythm,
  classifyTableVibePreference,
  deriveTableRhythmAppetite,
} from '@shared/tableRhythm';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makePlan(segments: Array<[SocialIcebreakerPhase, number]>): IcebreakerRunPlan {
  const built: PhaseSegment[] = segments.map(([phase, allocatedMinutes]) => ({
    phase,
    allocatedMinutes,
    energyWeight: 1,
  }));
  return {
    version: 2,
    segments: built,
    totalMinutes: built.reduce((sum, segment) => sum + segment.allocatedMinutes, 0),
    compiledAt: '2026-10-28T00:00:00.000Z',
    compilerId: 'test-rhythm',
  };
}

function minutesOf(plan: IcebreakerRunPlan, phase: SocialIcebreakerPhase): number {
  const segment = plan.segments.find((s) => s.phase === phase);
  if (!segment) throw new Error(`missing phase ${phase}`);
  return segment.allocatedMinutes;
}

function phasesOf(plan: IcebreakerRunPlan): SocialIcebreakerPhase[] {
  return plan.segments.map((s) => s.phase);
}

function rosterWith(values: Array<string | null | undefined>) {
  return values.map((value) => ({
    profile: value === undefined ? null : { tableVibePreference: value },
  }));
}

// ─── Preference classification ───────────────────────────────────────────────

describe('classifyTableVibePreference', () => {
  it('maps the active Chinese Match Compass values', () => {
    expect(classifyTableVibePreference('轻松聊天')).toBe('light');
    expect(classifyTableVibePreference('深度交流')).toBe('deep');
    expect(classifyTableVibePreference('游戏互动')).toBe('light');
    expect(classifyTableVibePreference('不限')).toBe('mixed');
  });

  it('maps legacy machine values from pre-Match-Compass profiles', () => {
    expect(classifyTableVibePreference('light_fun')).toBe('light');
    expect(classifyTableVibePreference('natural_chat')).toBe('light');
    expect(classifyTableVibePreference('deep_talk')).toBe('deep');
  });

  it('normalizes whitespace/casing and returns null for unknown values', () => {
    expect(classifyTableVibePreference('  DEEP_TALK ')).toBe('deep');
    expect(classifyTableVibePreference('随便')).toBeNull();
    expect(classifyTableVibePreference('')).toBeNull();
    expect(classifyTableVibePreference(null)).toBeNull();
    expect(classifyTableVibePreference(undefined)).toBeNull();
  });
});

// ─── Aggregation ─────────────────────────────────────────────────────────────

describe('deriveTableRhythmAppetite', () => {
  it('returns mixed for an empty roster or missing profiles', () => {
    expect(deriveTableRhythmAppetite()).toBe('mixed');
    expect(deriveTableRhythmAppetite([])).toBe('mixed');
    expect(deriveTableRhythmAppetite([{}, {}, {}])).toBe('mixed');
    expect(
      deriveTableRhythmAppetite([{ profile: null }, { profile: { tableVibePreference: null } }]),
    ).toBe('mixed');
  });

  it('returns mixed when every member is explicitly neutral', () => {
    expect(
      deriveTableRhythmAppetite(rosterWith(['不限', '不限', 'natural_chat', '不限'])),
    ).toBe('mixed');
  });

  it('needs a strict majority of the whole roster', () => {
    // 4 of 6 deep => deep
    expect(
      deriveTableRhythmAppetite(rosterWith(['深度交流', '深度交流', '深度交流', '深度交流', '不限', null])),
    ).toBe('deep');
    // 3 of 6 deep is a tie with the neutral half => mixed
    expect(
      deriveTableRhythmAppetite(rosterWith(['深度交流', '深度交流', '深度交流', null, null, null])),
    ).toBe('mixed');
    // 2 of 4 deep => mixed
    expect(
      deriveTableRhythmAppetite(rosterWith(['深度交流', '深度交流', '轻松聊天', '轻松聊天'])),
    ).toBe('mixed');
  });

  it('requires at least two matching members (one person never steers the table)', () => {
    expect(deriveTableRhythmAppetite(rosterWith(['深度交流']))).toBe('mixed');
    expect(deriveTableRhythmAppetite(rosterWith(['深度交流', '深度交流']))).toBe('deep');
  });

  it('resolves light tables and ignores unknown values', () => {
    expect(
      deriveTableRhythmAppetite(rosterWith(['轻松聊天', '游戏互动', 'light_fun', null, null])),
    ).toBe('light');
    expect(
      deriveTableRhythmAppetite(rosterWith(['轻松聊天', '随便', '不入流', '不限', '不限', null])),
    ).toBe('mixed');
  });
});

// ─── deep ────────────────────────────────────────────────────────────────────

describe('applyTableRhythm — deep', () => {
  it('raises warmup by 5 and funds it from the preferred donor, total preserved', () => {
    const plan = makePlan([
      ['warmup', 8],
      ['micro_challenge', 8],
      ['personality_dice', 12],
      ['group_mirror', 12],
      ['recap', 5],
    ]);
    const result = applyTableRhythm(plan, 'deep');

    expect(result).not.toBe(plan);
    expect(minutesOf(result, 'warmup')).toBe(8 + TABLE_RHYTHM_SHIFT_MINUTES);
    expect(minutesOf(result, 'group_mirror')).toBe(12 - TABLE_RHYTHM_SHIFT_MINUTES);
    expect(minutesOf(result, 'micro_challenge')).toBe(8);
    expect(minutesOf(result, 'recap')).toBe(5);
    expect(result.totalMinutes).toBe(plan.totalMinutes);
    expect(phasesOf(result)).toEqual(phasesOf(plan));
  });

  it('prefers group_mirror over a larger non-preferred phase', () => {
    const plan = makePlan([
      ['warmup', 8],
      ['micro_challenge', 8],
      ['group_mirror', 12],
      ['quip_battle', 18],
      ['recap', 5],
    ]);
    const result = applyTableRhythm(plan, 'deep');
    expect(minutesOf(result, 'group_mirror')).toBe(7);
    expect(minutesOf(result, 'quip_battle')).toBe(18);
  });

  it('respects the 25-minute warmup cap (partial shift keeps the total exact)', () => {
    const plan = makePlan([
      ['warmup', 22],
      ['micro_challenge', 8],
      ['group_mirror', 12],
      ['recap', 5],
    ]);
    const result = applyTableRhythm(plan, 'deep');

    expect(WARMUP_RHYTHM_MAX_MINUTES).toBe(25);
    expect(minutesOf(result, 'warmup')).toBe(WARMUP_RHYTHM_MAX_MINUTES);
    expect(minutesOf(result, 'group_mirror')).toBe(12 - 3);
    expect(result.totalMinutes).toBe(plan.totalMinutes);
  });

  it('is a no-op once warmup already sits at the cap', () => {
    const plan = makePlan([
      ['warmup', WARMUP_RHYTHM_MAX_MINUTES],
      ['micro_challenge', 8],
      ['group_mirror', 12],
      ['recap', 5],
    ]);
    expect(applyTableRhythm(plan, 'deep')).toBe(plan);
  });

  it('is a no-op when no eligible donor can fund the shift', () => {
    // lie_detective carries the roster-derived W9 floor and mini_script is
    // reconciled separately, so neither may fund a rhythm shift.
    const plan = makePlan([
      ['warmup', 8],
      ['micro_challenge', 8],
      ['lie_detective', 20],
      ['recap', 5],
    ]);
    expect(applyTableRhythm(plan, 'deep')).toBe(plan);
  });

  it('does not shrink a donor below the 4-minute non-core floor', () => {
    const plan = makePlan([
      ['warmup', 8],
      ['micro_challenge', 8],
      ['group_mirror', 5],
      ['recap', 5],
    ]);
    expect(applyTableRhythm(plan, 'deep')).toBe(plan);
  });

  it('keeps a breeze-sized reflection slot intact rather than leaving a 2-minute stub', () => {
    // breeze × deep_chat: warmup 18, micro 10, the only non-core beat is a
    // 7-minute group_mirror. Funding 5 minutes would leave 2 — no-op instead.
    const plan = makePlan([
      ['warmup', 18],
      ['micro_challenge', 10],
      ['group_mirror', 7],
      ['recap', 5],
    ]);
    expect(applyTableRhythm(plan, 'deep')).toBe(plan);
  });

  it('falls back to the largest eligible non-core phase', () => {
    const plan = makePlan([
      ['warmup', 8],
      ['micro_challenge', 8],
      ['personality_dice', 12],
      ['undercover_word', 15],
      ['recap', 5],
    ]);
    const result = applyTableRhythm(plan, 'deep');
    expect(minutesOf(result, 'undercover_word')).toBe(10);
    expect(minutesOf(result, 'personality_dice')).toBe(12);
    expect(result.totalMinutes).toBe(plan.totalMinutes);
  });

  it('keeps recap last and never creates or drops a phase', () => {
    const plan = makePlan([
      ['warmup', 10],
      ['micro_challenge', 8],
      ['auction', 17],
      ['quip_battle', 17],
      ['group_mirror', 10],
      ['recap', 5],
    ]);
    const result = applyTableRhythm(plan, 'deep');
    expect(phasesOf(result)).toEqual(phasesOf(plan));
    expect(result.segments[result.segments.length - 1].phase).toBe('recap');
    expect(result.segments).toHaveLength(plan.segments.length);
  });
});

// ─── light ───────────────────────────────────────────────────────────────────

describe('applyTableRhythm — light', () => {
  it('lowers warmup by 5 and hands it to micro_challenge, total preserved', () => {
    const plan = makePlan([
      ['warmup', 18],
      ['micro_challenge', 8],
      ['personality_dice', 12],
      ['group_mirror', 10],
      ['recap', 5],
    ]);
    const result = applyTableRhythm(plan, 'light');

    expect(result).not.toBe(plan);
    expect(minutesOf(result, 'warmup')).toBe(13);
    expect(minutesOf(result, 'micro_challenge')).toBe(13);
    expect(minutesOf(result, 'group_mirror')).toBe(10);
    expect(result.totalMinutes).toBe(plan.totalMinutes);
    expect(phasesOf(result)).toEqual(phasesOf(plan));
  });

  it('never grows micro_challenge by more than the +5 cap', () => {
    const plan = makePlan([
      ['warmup', 20],
      ['micro_challenge', 8],
      ['group_mirror', 10],
      ['recap', 5],
    ]);
    const result = applyTableRhythm(plan, 'light');
    const gain = minutesOf(result, 'micro_challenge') - 8;
    expect(gain).toBeLessThanOrEqual(MICRO_CHALLENGE_RHYTHM_BONUS_MAX_MINUTES);
    expect(gain).toBe(5);
  });

  it('respects the 10-minute warmup floor (no-op at the floor)', () => {
    const plan = makePlan([
      ['warmup', WARMUP_RHYTHM_MIN_MINUTES],
      ['micro_challenge', 8],
      ['group_mirror', 10],
      ['recap', 5],
    ]);
    expect(applyTableRhythm(plan, 'light')).toBe(plan);
  });

  it('clamps the shift to the remaining headroom above the floor', () => {
    const plan = makePlan([
      ['warmup', 12],
      ['micro_challenge', 8],
      ['group_mirror', 10],
      ['recap', 5],
    ]);
    const result = applyTableRhythm(plan, 'light');

    expect(minutesOf(result, 'warmup')).toBe(WARMUP_RHYTHM_MIN_MINUTES);
    expect(minutesOf(result, 'micro_challenge')).toBe(10);
    expect(result.totalMinutes).toBe(plan.totalMinutes);
  });

  it('hands the minutes to the next interactive phase when micro_challenge is absent', () => {
    const plan = makePlan([
      ['warmup', 18],
      ['group_mirror', 10],
      ['recap', 5],
    ]);
    const result = applyTableRhythm(plan, 'light');
    expect(minutesOf(result, 'group_mirror')).toBe(15);
    expect(result.totalMinutes).toBe(plan.totalMinutes);
  });

  it('never hands minutes to recap or the mini_script bonus', () => {
    const plan = makePlan([
      ['warmup', 18],
      ['mini_script', 25],
      ['recap', 5],
    ]);
    expect(applyTableRhythm(plan, 'light')).toBe(plan);
  });

  it('is a no-op when there is no recipient at all', () => {
    const plan = makePlan([
      ['warmup', 18],
      ['recap', 5],
    ]);
    expect(applyTableRhythm(plan, 'light')).toBe(plan);
  });
});

// ─── mixed / determinism ─────────────────────────────────────────────────────

describe('applyTableRhythm — mixed and determinism', () => {
  const plan = makePlan([
    ['warmup', 18],
    ['micro_challenge', 8],
    ['group_mirror', 12],
    ['recap', 5],
  ]);

  it('returns the same reference for mixed or unknown appetites', () => {
    expect(applyTableRhythm(plan, 'mixed')).toBe(plan);
    expect(applyTableRhythm(plan, undefined)).toBe(plan);
    expect(applyTableRhythm(plan, null)).toBe(plan);
    expect(applyTableRhythm(plan, 'unknown' as never)).toBe(plan);
  });

  it('is deterministic across repeated calls', () => {
    const first = applyTableRhythm(plan, 'deep');
    const second = applyTableRhythm(plan, 'deep');
    expect(second).toEqual(first);
    expect(applyTableRhythm(plan, 'light')).toEqual(applyTableRhythm(plan, 'light'));
  });

  it('keeps totalMinutes equal to the segment sum after any adjustment', () => {
    for (const appetite of ['deep', 'light'] as const) {
      const result = applyTableRhythm(plan, appetite);
      const sum = result.segments.reduce((total, s) => total + s.allocatedMinutes, 0);
      expect(result.totalMinutes).toBe(sum);
      expect(result.totalMinutes).toBe(plan.totalMinutes);
    }
  });

  it('never mutates the input plan', () => {
    const before = JSON.parse(JSON.stringify(plan)) as IcebreakerRunPlan;
    applyTableRhythm(plan, 'deep');
    applyTableRhythm(plan, 'light');
    expect(plan).toEqual(before);
  });

  it('does not throw when a plan carries a phase missing from the registry', () => {
    const plan = makePlan([
      ['warmup', 18],
      ['recap', 5],
    ]);
    plan.segments.splice(1, 0, {
      phase: 'bogus_phase' as never,
      allocatedMinutes: 10,
      energyWeight: 1,
    });
    expect(() => applyTableRhythm(plan, 'light')).not.toThrow();
    expect(() => applyTableRhythm(plan, 'deep')).not.toThrow();
  });
});
