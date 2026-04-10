import { describe, expect, it } from 'vitest';
import { deriveSocialSnapshot, parseAnalysisResponse, type ArchetypeAnalysisInput } from '../xiaoyueAnalysisService';

const baseInput: ArchetypeAnalysisInput = {
  archetype: '开心柯基',
  confidence: 0.9,
  traitScores: {
    affinity: 0.74,
    openness: 0.58,
    conscientiousness: 0.46,
    emotionalStability: 0.62,
    extraversion: 0.84,
    positivity: 0.86,
  },
};

describe('xiaoyueAnalysisService', () => {
  it('derives a high-energy social snapshot from trait scores', () => {
    const snapshot = deriveSocialSnapshot(baseInput);

    expect(snapshot.stateLabel).toBe('快热带动型');
    expect(snapshot.socialRole).toContain('开场加速器');
    expect(snapshot.bestScene).toContain('6到8人');
  });

  it('parses structured model output and keeps derived state label', () => {
    const parsed = parseAnalysisResponse(
      JSON.stringify({
        headline: '你不是硬撑热闹，你是自然带热的人',
        analysis: '你进到陌生局里，通常会比自己想的更快把气氛带松。别人先记住的不是你有多吵，而是你让场子更好接近。你更适合有接话空间的小局。下次先抛一个轻松问题，再接住第一个回应你的人。',
        socialRole: '你更像开场加速器，能让大家更快同频。',
        bestScene: '更适合6到8人的轻松热场局。',
        microAction: '下次先抛一个轻松问题，再接住第一个回应你的人。',
        shareLine: '我是开心柯基型，属于一进场就会慢慢把气氛带起来的那种。',
      }),
      baseInput
    );

    expect(parsed.headline).toContain('自然带热');
    expect(parsed.stateLabel).toBe('快热带动型');
    expect(parsed.microAction).toContain('轻松问题');
  });

  it('falls back to confidence-aware copy when model output is invalid', () => {
    const fallback = parseAnalysisResponse('not-json', {
      ...baseInput,
      archetype: '沉思猫头鹰',
      confidence: 0.45,
      traitScores: {
        affinity: 0.6,
        openness: 0.76,
        conscientiousness: 0.65,
        emotionalStability: 0.58,
        extraversion: 0.32,
        positivity: 0.54,
      },
    });

    expect(fallback.stateLabel).toBe('慢热深聊型');
    expect(fallback.analysis).toContain('交界');
    expect(fallback.shareLine).toContain('沉思猫头鹰');
  });
});
