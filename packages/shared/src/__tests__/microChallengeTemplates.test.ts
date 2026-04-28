/**
 * Unit tests for the deterministic micro-challenge template selector.
 */

import { describe, it, expect } from 'vitest';
import {
  MICRO_CHALLENGE_TEMPLATES,
  selectMicroChallenges,
  createSeededRandom,
  applyWowModifier,
  type MicroChallengeTemplate,
} from '../microChallengeTemplates';

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const rand1 = createSeededRandom('session-123');
    const rand2 = createSeededRandom('session-123');
    for (let i = 0; i < 10; i++) {
      expect(rand1()).toBe(rand2());
    }
  });

  it('produces different sequences for different seeds', () => {
    const rand1 = createSeededRandom('session-a');
    const rand2 = createSeededRandom('session-b');
    const v1 = rand1();
    const v2 = rand2();
    expect(v1).not.toBe(v2);
  });

  it('produces values in [0, 1)', () => {
    const rand = createSeededRandom('test');
    for (let i = 0; i < 100; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('selectMicroChallenges', () => {
  it('returns exactly 3 challenges by default', () => {
    const result = selectMicroChallenges({
      participantCount: 6,
      seed: 'test-1',
    });
    expect(result).toHaveLength(3);
  });

  it('returns the requested count', () => {
    const result = selectMicroChallenges({
      participantCount: 6,
      seed: 'test-2',
      count: 2,
    });
    expect(result).toHaveLength(2);
  });

  it('returns deterministic results for the same seed', () => {
    const params = { participantCount: 5, seed: 'stable-seed' };
    const r1 = selectMicroChallenges(params);
    const r2 = selectMicroChallenges(params);
    expect(r1.map((c) => c.id)).toEqual(r2.map((c) => c.id));
  });

  it('filters out completed IDs', () => {
    const first = selectMicroChallenges({
      participantCount: 6,
      seed: 'filter-test',
    });
    const second = selectMicroChallenges({
      participantCount: 6,
      seed: 'filter-test',
      completedIds: [first[0].id],
    });
    expect(second.map((c) => c.id)).not.toContain(first[0].id);
  });

  it('filters by player count', () => {
    // c7-birthday-line requires 4+ players
    const result = selectMicroChallenges({
      participantCount: 3,
      seed: 'small-group',
    });
    expect(result.every((c) => c.id !== 'c7-birthday-line')).toBe(true);
  });

  it('filters by scene', () => {
    // c4-hum-song is bar-only
    const barResult = selectMicroChallenges({
      participantCount: 6,
      seed: 'scene-test',
      scene: 'bar',
    });
    expect(barResult.some((c) => c.id === 'c4-hum-song')).toBe(true);

    const dinnerResult = selectMicroChallenges({
      participantCount: 6,
      seed: 'scene-test',
      scene: 'dinner',
    });
    expect(dinnerResult.every((c) => c.id !== 'c4-hum-song')).toBe(true);
  });

  it('includes mood-matching templates when mood is specified', () => {
    // With a fixed seed, verify that at least one funny-friendly template is selected when mood=funny
    const result = selectMicroChallenges({
      participantCount: 6,
      seed: 'mood-boost-test',
      mood: 'funny',
    });

    const funnyTemplateIds = MICRO_CHALLENGE_TEMPLATES.filter((t) =>
      t.moodFit.includes('funny')
    ).map((t) => t.id);

    const hasFunnyMatch = result.some((c) => funnyTemplateIds.includes(c.id));
    expect(hasFunnyMatch).toBe(true);
  });

  it('throws when no templates match player count', () => {
    expect(() =>
      selectMicroChallenges({
        participantCount: 100,
        seed: 'impossible',
      })
    ).toThrow('No micro-challenge templates available');
  });

  it('never returns duplicate templates', () => {
    const result = selectMicroChallenges({
      participantCount: 6,
      seed: 'uniq-test',
      count: 5,
    });
    const ids = result.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('applyWowModifier', () => {
  it('returns a valid MicroChallenge shape', () => {
    const template: MicroChallengeTemplate = {
      id: 't1',
      title: 'Test',
      description: 'Original desc',
      durationSeconds: 60,
      completionCTA: 'Done',
      visualHint: '✨',
      category: 'quick',
      scene: 'both',
      minPlayers: 2,
      maxPlayers: 8,
      energyLevel: 'low',
      moodFit: ['relaxed'],
      baseWeight: 1,
      altCTAs: ['Finished!', 'All set!'],
      altDescriptions: ['Alt desc'],
    };

    const rand = createSeededRandom('wow');
    const result = applyWowModifier(template, rand);
    expect(result.id).toBe('t1');
    expect(result.title).toBe('Test');
    expect(result.durationSeconds).toBe(60);
    expect(result.completionCTA).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('may use alternative CTA when alts exist', () => {
    const template: MicroChallengeTemplate = {
      id: 't1',
      title: 'Test',
      description: 'Original desc',
      durationSeconds: 60,
      completionCTA: 'Done',
      visualHint: '✨',
      category: 'quick',
      scene: 'both',
      minPlayers: 2,
      maxPlayers: 8,
      energyLevel: 'low',
      moodFit: ['relaxed'],
      baseWeight: 1,
      altCTAs: ['AltCTA'],
    };

    // Force random to be < 0.3 to trigger alt usage
    let callCount = 0;
    const fakeRand = () => {
      callCount++;
      return callCount === 1 ? 0.1 : 0.5;
    };

    const result = applyWowModifier(template, fakeRand);
    expect(result.completionCTA).toBe('AltCTA');
  });
});
