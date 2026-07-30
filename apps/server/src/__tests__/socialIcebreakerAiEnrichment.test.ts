import { afterEach, describe, expect, it } from 'vitest';
import type {
  MomentHighlightsPanel,
  XiaoyueAdaptiveSuggestion,
} from '@shared/socialIcebreaker';
import {
  generateAdaptiveGameSuggestion,
  generateMomentHighlights,
  normalizeMomentHighlightsPayload,
} from '../socialIcebreakerAIService';

const originalDeepseekKey = process.env.DEEPSEEK_API_KEY;
const originalMinimaxKey = process.env.MINIMAX_API_KEY;

afterEach(() => {
  process.env.DEEPSEEK_API_KEY = originalDeepseekKey;
  process.env.MINIMAX_API_KEY = originalMinimaxKey;
});

describe('Social Icebreaker AI enrichment fallbacks', () => {
  it('rejects highlight panels whose evidence IDs are not server-grounded', () => {
    const result = normalizeMomentHighlightsPayload({
      headline: '今晚高光',
      overview: '这是一段足够长而且完全基于真实证据的总览，用来说明本局已经发生的参与、成员选择、共同合作与难忘片段，不会虚构任何成员表现。',
      highlights: [
        { aspect: 'participation', title: '积极参与', evidenceIds: [99], narrative: '这是一段长度充足、但是故意引用了不存在证据编号的解释文字。' },
        { aspect: 'popularity', title: '成员印象', evidenceIds: [99], narrative: '这是一段长度充足、但是故意引用了不存在证据编号的解释文字。' },
        { aspect: 'collaboration', title: '一起完成', evidenceIds: [99], narrative: '这是一段长度充足、但是故意引用了不存在证据编号的解释文字。' },
      ],
      closingLine: '每一次回应都算数。',
    }, ['小林留下了3次参与动作']);

    expect(result).toBeNull();
  });

  it('rejects a mixed valid and fabricated evidence ID instead of silently filtering it', () => {
    const result = normalizeMomentHighlightsPayload({
      headline: '今晚高光',
      overview: '这是一段足够长而且完全基于真实证据的总览，用来说明本局已经发生的参与、成员选择、共同合作与难忘片段，不会虚构任何成员表现。',
      highlights: [
        { aspect: 'participation', title: '积极参与', evidenceIds: [0, 99], narrative: '这是一段长度充足、混入伪造证据编号、因此必须整体拒绝的解释文字。' },
        { aspect: 'popularity', title: '成员印象', evidenceIds: [0], narrative: '这是一段长度充足、只解释服务器已有事实、不增加任何新数据的文字。' },
        { aspect: 'collaboration', title: '一起完成', evidenceIds: [0], narrative: '这是一段长度充足、只解释服务器已有事实、不增加任何新数据的文字。' },
      ],
      closingLine: '每一次回应都算数。',
    }, ['小林留下了3次参与动作']);

    expect(result).toBeNull();
  });

  it('derives displayed evidence from server facts instead of model-authored text', () => {
    const result = normalizeMomentHighlightsPayload({
      headline: '今晚高光',
      overview: '这是一段足够长而且完全基于真实证据的总览，用来说明本局已经发生的参与、成员选择、共同合作与难忘片段，不会虚构任何成员表现。',
      highlights: [
        { aspect: 'participation', title: '积极参与', evidenceIds: [0], evidence: '伪造证据', narrative: '这是一段长度充足、只解释已有参与记录并且不增加新事实的文字内容。' },
        { aspect: 'popularity', title: '成员印象', evidenceIds: [1], evidence: '伪造证据', narrative: '这是一段长度充足、只解释已有成员选择记录且不增加新事实的文字。' },
        { aspect: 'collaboration', title: '一起完成', evidenceIds: [2], evidence: '伪造证据', narrative: '这是一段长度充足、只解释已有合作完成记录且不增加新事实的文字。' },
      ],
      closingLine: '每一次回应都算数。',
    }, ['小林留下了3次参与动作', '阿海被选中2次', '全组完成了挑战']);

    expect(result?.highlights.map((item) => item.evidence)).toEqual([
      '小林留下了3次参与动作',
      '阿海被选中2次',
      '全组完成了挑战',
    ]);
  });

  it('returns a typed current-game suggestion with observable fallback metadata', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.MINIMAX_API_KEY;
    const fallback: XiaoyueAdaptiveSuggestion = {
      type: 'keep_going',
      message: '先让每个人说一句当前感受。',
      actionableHint: '从主持人开始，依次邀请一位成员。',
      basedOnSignals: {
        phaseElapsedMinutes: 3,
        activeRate: 0.5,
        completionRate: 0.25,
        avgVibe: 2,
        playerCount: 4,
        pulseCheckCount: 2,
      },
      generatedAt: new Date().toISOString(),
    };

    const result = await generateAdaptiveGameSuggestion({
      phase: 'micro_challenge',
      phaseLabel: '微挑战',
      playerCount: 4,
      signals: fallback.basedOnSignals,
      fallback,
      currentGameFacts: ['已完成成员数：1'],
    });

    expect(result.data).toEqual(fallback);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.promptVersion).toBe('social-adaptive-suggestion-v2');
  });

  it('returns an elaborate text panel fallback when the provider is unavailable', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.MINIMAX_API_KEY;
    const fallback: MomentHighlightsPanel = {
      headline: '中途收尾，也留下了这些高光',
      overview: '这是一段只根据已发生互动整理的详细总览。',
      highlights: [
        { aspect: 'participation', title: '积极参与', evidence: '小林参与3次', narrative: '小林持续回应。' },
        { aspect: 'popularity', title: '成员印象', evidence: '阿海被选中2次', narrative: '阿海被成员记住。' },
        { aspect: 'collaboration', title: '一起完成', evidence: '全组完成挑战', narrative: '大家接住了彼此。' },
      ],
      closingLine: '每一次回应都算数。',
    };

    const result = await generateMomentHighlights({
      playerCount: 4,
      completedPhases: ['warmup'],
      interruptedAtPhase: 'micro_challenge',
      evidence: ['小林参与3次', '阿海被选中2次'],
      fallback,
    });

    expect(result.data).toEqual(fallback);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.promptVersion).toBe('social-moment-highlights-v2');
  });
});
