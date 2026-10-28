import { describe, expect, it } from 'vitest';
import {
  buildGenericEventActivityGuide,
  buildSessionActivityGuide,
  getSessionActivityGuideRoleAt,
  selectSessionActivityGuideWindow,
  SESSION_ACTIVITY_GUIDE_FALLBACK_LINE,
} from './eventActivityGuide';
import { findReviewBlockedVocab } from './terms';

describe('buildGenericEventActivityGuide', () => {
  it('returns four deterministic, explicitly approximate broad steps', () => {
    const first = buildGenericEventActivityGuide();
    const second = buildGenericEventActivityGuide();
    expect(first).toEqual(second);
    expect(first.steps).not.toBe(second.steps);
    expect(first.steps.map((step) => step.text)).toEqual([
      '到场入座，不用准备自我介绍',
      '话题卡暖场，想跳过也可以',
      '跟着卡面走，不用提前准备',
      '一起回顾，不用轮流发言',
    ]);
    expect(first.approximateNote).toContain('大致安排');
    expect(first).not.toHaveProperty('total');
    expect(JSON.stringify(first)).not.toContain('free_chat');
  });

  it('keeps all visible guidance clear of review-blocked vocabulary', () => {
    const eventGuide = buildGenericEventActivityGuide();
    const sessionFallback = SESSION_ACTIVITY_GUIDE_FALLBACK_LINE;
    expect(findReviewBlockedVocab(JSON.stringify(eventGuide))).toBeNull();
    expect(findReviewBlockedVocab(sessionFallback)).toBeNull();
  });
});

describe('buildSessionActivityGuide', () => {
  it('waiting shows current + known next + final only', () => {
    const guide = buildSessionActivityGuide({
      currentPhase: 'waiting',
      planState: 'planned',
      orderedPhases: ['warmup', 'micro_challenge', 'lie_detective', 'recap'],
    });
    expect(guide.kind).toBe('planned');
    expect(guide.items.map((item) => [item.phase, item.role])).toEqual([
      ['waiting', 'current'],
      ['warmup', 'next'],
      ['recap', 'final'],
    ]);
    expect(guide).not.toHaveProperty('total');
    expect(JSON.stringify(guide)).not.toContain('free_chat');
  });

  it('uses the real current phase, immediate next and final after earlier phases', () => {
    const guide = buildSessionActivityGuide({
      currentPhase: 'micro_challenge',
      planState: 'planned',
      orderedPhases: ['warmup', 'micro_challenge', 'lie_detective', 'recap'],
    });
    expect(guide.items.map((item) => [item.phase, item.role])).toEqual([
      ['micro_challenge', 'current'],
      ['lie_detective', 'next'],
      ['recap', 'final'],
    ]);
  });

  it('does not duplicate next and final when they are the same phase', () => {
    const guide = buildSessionActivityGuide({
      currentPhase: 'warmup',
      planState: 'planned',
      orderedPhases: ['warmup', 'recap'],
    });
    expect(guide.items.map((item) => [item.phase, item.role])).toEqual([
      ['warmup', 'current'],
      ['recap', 'final'],
    ]);
  });

  it.each(['empty', 'custom', 'offline'] as const)(
    '%s falls back to one honest line without inventing next or total',
    (planState) => {
      const guide = buildSessionActivityGuide({
        currentPhase: 'waiting',
        planState,
        orderedPhases: ['warmup', 'micro_challenge', 'recap'],
      });
      expect(guide).toEqual({
        kind: 'generic',
        title: '现在和接下来',
        items: [],
        fallbackLine: '有下一环时，跟着卡面走就好，不用提前准备',
      });
      expect(guide).not.toHaveProperty('total');
    },
  );

  it('unknown current phases also degrade instead of guessing', () => {
    const guide = buildSessionActivityGuide({
      currentPhase: 'unknown_phase',
      planState: 'planned',
      orderedPhases: ['warmup', 'recap'],
    });
    expect(guide.kind).toBe('generic');
    expect(guide.items).toEqual([]);
  });
});

describe('session guide window helpers', () => {
  it('hard-caps an older full-chain caller to current/next/final', () => {
    const items = [
      { key: 'waiting', current: true },
      { key: 'warmup', current: false },
      { key: 'lie_detective', current: false },
      { key: 'recap', current: false },
    ];
    expect(selectSessionActivityGuideWindow(items).map((item) => item.key)).toEqual([
      'waiting',
      'warmup',
      'recap',
    ]);
  });

  it('labels a two-item window as current/final, not current/next', () => {
    expect(getSessionActivityGuideRoleAt(0, 2)).toBe('current');
    expect(getSessionActivityGuideRoleAt(1, 2)).toBe('final');
  });
});
