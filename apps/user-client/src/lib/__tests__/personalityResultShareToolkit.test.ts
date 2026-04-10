import { describe, expect, it } from 'vitest';
import { derivePersonalityShareToolkit } from '../personalityResultShareToolkit';

describe('derivePersonalityShareToolkit', () => {
  it('keeps structured server data when available', () => {
    const result = derivePersonalityShareToolkit({
      archetype: '开心柯基',
      secondaryArchetype: '太阳鸡',
      topArchetypes: [
        { archetype: '开心柯基', score: 82, confidence: 0.81 },
        { archetype: '太阳鸡', score: 75, confidence: 0.73 },
      ],
      headline: '你不是硬撑热闹，你是自然带热的人',
      shareLine: '我是开心柯基型，属于一进场就会慢慢把气氛带起来的那种。',
      stateLabel: '快热带动型',
      bestScene: '更适合6到8人的轻松热场局。',
      socialRole: '你更像开场加速器，能让大家更快同频。',
      blendLine: '虽然你身上也有一点太阳鸡的影子，但这次更稳定地落在开心柯基这边。',
      whyThisFits: '这次会落到开心柯基，主要因为你在真实社交里更容易呈现快热带动型这种存在感。',
      expressionTags: ['一上桌就熟得快', '热场但不压人', '适合多人热场'],
      shareVariants: {
        selfIntro: '我是开心柯基型，属于一进场就会慢慢把气氛带起来的那种。',
        friendCallout: '认识我的人应该会懂，我不是硬撑热闹，是会自然把场子带热。',
        socialInvite: '如果一起组局，我更适合6到8人的轻松热场局，会比较容易进入状态。',
      },
    });

    expect(result.expressionTags).toContain('热场但不压人');
    expect(result.shareVariants.socialInvite).toContain('轻松热场局');
  });

  it('builds blend-aware fallback copy when structured fields are missing', () => {
    const result = derivePersonalityShareToolkit({
      archetype: '沉思猫头鹰',
      secondaryArchetype: '灵感章鱼',
      topArchetypes: [
        { archetype: '沉思猫头鹰', score: 78, confidence: 0.68 },
        { archetype: '灵感章鱼', score: 74, confidence: 0.63 },
      ],
      headline: '你不是社交慢，你只是更擅长聊到点上',
      shareLine: '我是沉思猫头鹰型，看着安静，其实聊到点上会很能聊。',
      stateLabel: '慢热深聊型',
      bestScene: '更适合2到4人的小局、一对一深聊，或有明确主题的场景。',
      socialRole: '你更像深聊引线，话不一定多，但往往最有记忆点。',
    });

    expect(result.expressionTags).toContain('有点双原型感');
    expect(result.blendLine).toContain('灵感章鱼');
    expect(result.shareVariants.friendCallout).toContain('灵感章鱼');
  });

  it('falls back when tags or share variants are present but effectively empty', () => {
    const result = derivePersonalityShareToolkit({
      archetype: '开心柯基',
      secondaryArchetype: '太阳鸡',
      topArchetypes: [
        { archetype: '开心柯基', score: 82, confidence: 0.81 },
        { archetype: '太阳鸡', score: 75, confidence: 0.73 },
      ],
      headline: '你不是硬撑热闹，你是自然带热的人',
      shareLine: '我是开心柯基型，属于一进场就会慢慢把气氛带起来的那种。',
      stateLabel: '快热带动型',
      bestScene: '更适合6到8人的轻松热场局。',
      socialRole: '你更像开场加速器，能让大家更快同频。',
      expressionTags: ['  ', ''],
      shareVariants: {
        selfIntro: '   ',
        friendCallout: '',
        socialInvite: '如果一起组局，我更适合6到8人的轻松热场局，会比较容易进入状态。',
      },
    });

    expect(result.expressionTags.length).toBeGreaterThanOrEqual(3);
    expect(result.shareVariants.selfIntro).toContain('开心柯基');
    expect(result.shareVariants.friendCallout).toContain('认识我的人应该会懂');
    expect(result.shareVariants.socialInvite).toContain('轻松热场局');
  });
});
