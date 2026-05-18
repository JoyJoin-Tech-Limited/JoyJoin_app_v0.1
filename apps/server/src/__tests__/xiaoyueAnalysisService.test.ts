import { describe, expect, it } from 'vitest';
import { deriveSocialSnapshot, parseAnalysisResponse, type ArchetypeAnalysisInput } from '../xiaoyueAnalysisService';

const baseInput: ArchetypeAnalysisInput = {
  archetype: 'corgi',
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
        shareLine: '我是corgi型，属于一进场就会慢慢把气氛带起来的那种。',
        whyThisFits: '这次会落到corgi，主要是因为你的外向性和正能量更突出，放进真实社交场里会变成一种快热带动型的存在感。',
        blendLine: '虽然你身上也有一点rooster的影子，但这次更稳定地落在corgi这边。',
        expressionTags: ['一上桌就熟得快', '热场但不压人', '适合多人热场'],
        shareVariants: {
          selfIntro: '我是corgi型，属于一进场就会慢慢把气氛带起来的那种。',
          friendCallout: '认识我的人应该会懂，我不是硬撑热闹，是会自然把场子带热。',
          socialInvite: '如果一起组局，我更适合6到8人的轻松热场局，会比较容易进入状态。',
        },
      }),
      baseInput
    );

    expect(parsed.headline).toContain('自然带热');
    expect(parsed.stateLabel).toBe('快热带动型');
    expect(parsed.microAction).toContain('轻松问题');
    expect(parsed.expressionTags).toContain('热场但不压人');
    expect(parsed.shareVariants.socialInvite).toContain('轻松热场局');
  });

  it('falls back to confidence-aware copy when model output is invalid', () => {
    const fallback = parseAnalysisResponse('not-json', {
      ...baseInput,
      archetype: 'owl',
      secondaryArchetype: 'octopus',
      topArchetypes: [
        { archetype: 'owl', score: 78, confidence: 0.68 },
        { archetype: 'octopus', score: 74, confidence: 0.63 },
      ],
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
    expect(fallback.shareLine).toContain('猫头鹰');
    expect(fallback.expressionTags.length).toBeGreaterThanOrEqual(3);
    expect(fallback.blendLine).toContain('章鱼');
    expect(fallback.shareVariants.friendCallout).toContain('章鱼');
  });

  it('falls back when structured output violates prompt length constraints', () => {
    const fallback = parseAnalysisResponse(
      JSON.stringify({
        headline: '太短了',
        analysis: '你进到陌生局里，通常会比自己想的更快把气氛带松。别人先记住的不是你有多吵，而是你让场子更好接近。你更适合有接话空间的小局。下次先抛一个轻松问题，再接住第一个回应你的人。',
        socialRole: '你更像开场加速器，能让大家更快同频。',
        bestScene: '更适合6到8人的轻松热场局。',
        microAction: '下次先抛一个轻松问题，再接住第一个回应你的人。',
        shareLine: '我是corgi型，属于一进场就会慢慢把气氛带起来的那种。',
        whyThisFits: '这次会落到corgi，主要是因为你的外向性和正能量更突出，放进真实社交场里会变成一种快热带动型的存在感。',
        blendLine: '虽然你身上也有一点rooster的影子，但这次更稳定地落在corgi这边。',
        expressionTags: ['一上桌就熟得快', '热场但不压人', '这是一个超过八个字的标签'],
        shareVariants: {
          selfIntro: '我是corgi型，属于一进场就会慢慢把气氛带起来的那种。',
          friendCallout: '认识我的人应该会懂，我不是硬撑热闹，是会自然把场子带热。',
          socialInvite: '如果一起组局，我更适合6到8人的轻松热场局，会比较容易进入状态。',
        },
      }),
      baseInput,
    );

    expect(fallback.headline).toBe('你不是硬撑热闹，你是自然带热的人');
    expect(fallback.expressionTags.length).toBeGreaterThanOrEqual(3);
    expect(fallback.expressionTags.length).toBeLessThanOrEqual(4);
    expect(fallback.expressionTags.every((tag) => tag.length <= 8)).toBe(true);
  });
});
