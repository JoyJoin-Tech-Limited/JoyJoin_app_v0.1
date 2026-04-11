export interface PersonalityTopArchetypeCandidate {
  archetype: string;
  score: number;
  confidence?: number;
}

export interface PersonalityShareVariants {
  selfIntro: string;
  friendCallout: string;
  socialInvite: string;
}

export interface PersonalityShareToolkitInput {
  archetype: string;
  secondaryArchetype?: string | null;
  topArchetypes?: PersonalityTopArchetypeCandidate[] | null;
  headline: string;
  shareLine: string;
  stateLabel: string;
  bestScene: string;
  socialRole: string;
  blendLine?: string | null;
  whyThisFits?: string | null;
  expressionTags?: string[] | null;
  shareVariants?: Partial<PersonalityShareVariants> | null;
}

export interface PersonalityShareToolkitData {
  blendLine: string;
  whyThisFits: string;
  expressionTags: string[];
  shareVariants: PersonalityShareVariants;
}

function trimSentence(text: string): string {
  return text.replace(/[。！!？?]+$/g, '').trim();
}

function formatSentence(text: string): string {
  const trimmed = trimSentence(text);
  return trimmed ? `${trimmed}。` : '';
}

function getSecondaryArchetype(input: PersonalityShareToolkitInput): string | null {
  if (input.secondaryArchetype) return input.secondaryArchetype;
  return input.topArchetypes?.find((item) => item.archetype !== input.archetype)?.archetype ?? null;
}

function isBlendMatch(input: PersonalityShareToolkitInput): boolean {
  const ranked = [...(input.topArchetypes ?? [])].sort((a, b) => b.score - a.score);
  if (ranked.length >= 2) {
    return ranked[0].score - ranked[1].score <= 8;
  }

  return !!getSecondaryArchetype(input);
}

function deriveSceneTag(bestScene: string): string {
  if (/2到4人|一对一|深聊|咖啡|散步/.test(bestScene)) return '适合小局深聊';
  if (/6到8人|热场/.test(bestScene)) return '适合多人热场';
  if (/主题|探索感|交换想法/.test(bestScene)) return '主题局更出彩';
  if (/留白|不吵/.test(bestScene)) return '低耗社交更舒服';
  return '越相处越有戏';
}

function buildFallbackExpressionTags(input: PersonalityShareToolkitInput): string[] {
  const tagsByState: Record<string, string[]> = {
    快热带动型: ['一上桌就熟得快', '热场但不压人'],
    稳场推进型: ['不抢戏但稳全场', '靠谱感很强'],
    熟了更有火花型: ['第一眼温和型', '熟了会越来越有戏'],
    灵感破冰型: ['聊天自带新鲜感', '靠点子破冰'],
    慢热深聊型: ['慢热但不冷场', '聊到点上停不下'],
    低耗观察型: ['先观察再发力', '低耗但会看人'],
    局内升温型: ['越相处越有戏', '关系会慢慢热起来'],
  };

  const tags = [...(tagsByState[input.stateLabel] ?? ['社交有自己的节奏', '相处久了更舒服'])];
  tags.push(deriveSceneTag(input.bestScene));
  tags.push(isBlendMatch(input) ? '有点双原型感' : `${input.archetype}气质`);
  return Array.from(new Set(tags)).slice(0, 4);
}

function buildFallbackBlendLine(input: PersonalityShareToolkitInput): string {
  const secondary = getSecondaryArchetype(input);
  if (!secondary || secondary === input.archetype) {
    return formatSentence(`这次更清楚落在${input.archetype}这边，你给人的第一感受会是${input.stateLabel}`);
  }

  if (isBlendMatch(input)) {
    return formatSentence(`你底色更像${input.archetype}，但熟起来或遇到对频的话题时，会露出一点${secondary}那一面`);
  }

  return formatSentence(`虽然你身上也有一点${secondary}的影子，但这次更稳定地落在${input.archetype}这边`);
}

function buildFallbackWhyThisFits(input: PersonalityShareToolkitInput): string {
  const secondary = getSecondaryArchetype(input);
  const suffix =
    secondary && secondary !== input.archetype
      ? isBlendMatch(input)
        ? `你身上也带一点${secondary}的感觉，所以不是单一一种路数。`
        : `虽然也有一点${secondary}的影子，但没有盖过主底色。`
      : '';

  return `${formatSentence(`这次会落到${input.archetype}，主要因为你在真实社交里更容易呈现${input.stateLabel}这种存在感`)}${suffix}`.trim();
}

function buildFallbackShareVariants(input: PersonalityShareToolkitInput): PersonalityShareVariants {
  const secondary = getSecondaryArchetype(input);
  const bestScene = trimSentence(input.bestScene).replace(/^更适合/, '');

  return {
    selfIntro: input.shareLine,
    friendCallout:
      secondary && secondary !== input.archetype && isBlendMatch(input)
        ? formatSentence(`认识我的人应该会懂，我平时更像${input.archetype}，熟起来会露出一点${secondary}那面`)
        : formatSentence(`认识我的人应该会懂，${trimSentence(input.headline)}`),
    socialInvite: formatSentence(`如果一起组局，我更适合${bestScene}，会比较容易进入状态`),
  };
}

export function derivePersonalityShareToolkit(
  input: PersonalityShareToolkitInput,
): PersonalityShareToolkitData {
  const expressionTags = input.expressionTags?.filter(
    (tag): tag is string => typeof tag === 'string' && tag.trim().length > 0,
  );
  const fallbackShareVariants = buildFallbackShareVariants(input);

  return {
    blendLine: input.blendLine?.trim() || buildFallbackBlendLine(input),
    whyThisFits: input.whyThisFits?.trim() || buildFallbackWhyThisFits(input),
    expressionTags:
      expressionTags && expressionTags.length > 0
        ? expressionTags
        : buildFallbackExpressionTags(input),
    shareVariants: {
      selfIntro: input.shareVariants?.selfIntro?.trim() || fallbackShareVariants.selfIntro,
      friendCallout: input.shareVariants?.friendCallout?.trim() || fallbackShareVariants.friendCallout,
      socialInvite: input.shareVariants?.socialInvite?.trim() || fallbackShareVariants.socialInvite,
    },
  };
}
