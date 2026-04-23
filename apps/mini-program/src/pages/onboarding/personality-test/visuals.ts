import { formatHSL, getArchetypeHSL } from '@shared/archetypeColors'
import { archetypeRegistry, type ArchetypeRecord } from '@shared/personality/archetypeRegistry'

export type {
  LegacyXiaoyueMood,
  XiaoyueExpressionId,
  XiaoyueMood,
} from '../../../lib/xiaoyueExpressions'
export {
  getXiaoyueAsset,
  getXiaoyueExpressionAsset,
  LEGACY_MOOD_TO_EXPRESSION,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
  PERSONALITY_TEST_QUESTION_EXPRESSION,
  XIAOYUE_ASSET_BY_EXPRESSION,
} from '../../../lib/xiaoyueExpressions'

export interface ArchetypeAssetPaths {
  webp: string
  png: string
}

const ARCHETYPE_ASSET_MAP: Record<string, ArchetypeAssetPaths> = {
  开心柯基: { webp: '/assets/personality/archetypes/archetype-corgi.webp', png: '/pages/onboarding/assets/archetypes/archetype-corgi.png' },
  太阳鸡: { webp: '/assets/personality/archetypes/archetype-rooster.webp', png: '/pages/onboarding/assets/archetypes/archetype-rooster.png' },
  夸夸豚: { webp: '/assets/personality/archetypes/archetype-praise-dolphin.webp', png: '/pages/onboarding/assets/archetypes/archetype-praise-dolphin.png' },
  机智狐: { webp: '/assets/personality/archetypes/archetype-fox.webp', png: '/pages/onboarding/assets/archetypes/archetype-fox.png' },
  淡定海豚: { webp: '/assets/personality/archetypes/archetype-calm-dolphin.webp', png: '/pages/onboarding/assets/archetypes/archetype-calm-dolphin.png' },
  织网蛛: { webp: '/assets/personality/archetypes/archetype-spider.webp', png: '/pages/onboarding/assets/archetypes/archetype-spider.png' },
  暖心熊: { webp: '/assets/personality/archetypes/archetype-bear.webp', png: '/pages/onboarding/assets/archetypes/archetype-bear.png' },
  灵感章鱼: { webp: '/assets/personality/archetypes/archetype-octopus.webp', png: '/pages/onboarding/assets/archetypes/archetype-octopus.png' },
  沉思猫头鹰: { webp: '/assets/personality/archetypes/archetype-owl.webp', png: '/pages/onboarding/assets/archetypes/archetype-owl.png' },
  定心大象: { webp: '/assets/personality/archetypes/archetype-elephant.webp', png: '/pages/onboarding/assets/archetypes/archetype-elephant.png' },
  稳如龟: { webp: '/assets/personality/archetypes/archetype-turtle.webp', png: '/pages/onboarding/assets/archetypes/archetype-turtle.png' },
  隐身猫: { webp: '/assets/personality/archetypes/archetype-cat.webp', png: '/pages/onboarding/assets/archetypes/archetype-cat.png' },
}

const ARCHETYPE_SUMMARIES: Record<string, string> = {
  开心柯基: '你更容易在陌生局里先把气氛带热，让大家更快放松下来。',
  太阳鸡: '你不是最吵的那个，但往往是让整桌节奏稳定下来的那个人。',
  夸夸豚: '你很会看见别人身上的亮点，关系会在你的真诚里自然升温。',
  机智狐: '你擅长把普通聊天拐到更有意思的方向，聊着聊着就有火花。',
  淡定海豚: '你习惯先看气场再发力，一旦找到对的人，连接会很顺。',
  织网蛛: '你更像局里的连接器，擅长把看起来不相干的人慢慢搭上线。',
  暖心熊: '你会让人感觉被接住，适合把陌生感聊成熟悉感。',
  灵感章鱼: '你的脑洞和新鲜视角，会让一场局突然多出意料之外的惊喜。',
  沉思猫头鹰: '你不一定先开口，但你说出来的话通常最有记忆点。',
  定心大象: '你带来的稳定感很强，很多人会因为你在而更安心。',
  稳如龟: '你会先判断再靠近，一旦投入就很靠谱。',
  隐身猫: '你看起来低调，但往往最知道什么人值得深聊。',
}

function withAlpha(archetype: string | null | undefined, alpha: number): string {
  const hsl = getArchetypeHSL(archetype)
  return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${alpha})`
}

export interface ArchetypeVisual {
  name: string
  asset: string
  assetPng: string
  accent: string
  accentSoft: string
  accentBorder: string
  accentGlow: string
  accentSurface: string
  accentStrong: string
  summary: string
  nickname: string
  tagline: string
  description: string
  epicDescription: string
  styleQuote: string
  coreContribution: string
  traits: string[]
  hiddenStrength: string
  counterIntuitive: string
  rarityPercentage: number | null
  record?: ArchetypeRecord
}

export function getArchetypeVisual(archetype: string | null | undefined): ArchetypeVisual {
  const record = archetype ? archetypeRegistry[archetype] : undefined
  const accent = formatHSL(getArchetypeHSL(archetype))
  const fallbackSummary = archetype ? ARCHETYPE_SUMMARIES[archetype] : undefined

  return {
    name: archetype ?? '神秘原型',
    asset: archetype ? ARCHETYPE_ASSET_MAP[archetype]?.webp ?? '' : '',
    assetPng: archetype ? ARCHETYPE_ASSET_MAP[archetype]?.png ?? '' : '',
    accent,
    accentSoft: withAlpha(archetype, 0.12),
    accentBorder: withAlpha(archetype, 0.22),
    accentGlow: withAlpha(archetype, 0.26),
    accentSurface: `linear-gradient(145deg, ${withAlpha(archetype, 0.24)} 0%, rgba(255, 255, 255, 0.96) 82%)`,
    accentStrong: withAlpha(archetype, 0.86),
    summary: fallbackSummary ?? record?.narrative.description ?? '你的社交氛围已经有了清晰的轮廓。',
    nickname: record?.narrative.nickname ?? '',
    tagline: record?.narrative.tagline ?? '',
    description: record?.narrative.description ?? fallbackSummary ?? '你的社交氛围已经有了清晰的轮廓。',
    epicDescription: record?.narrative.epicDescription ?? '',
    styleQuote: record?.narrative.styleQuote ?? '',
    coreContribution: record?.narrative.coreContributions ?? '',
    traits: Array.isArray(record?.narrative.traits) ? record.narrative.traits : [],
    hiddenStrength: record?.insights.hiddenStrength ?? '',
    counterIntuitive: record?.insights.counterIntuitive ?? '',
    rarityPercentage: typeof record?.insights.rarityPercentage === 'number' ? record.insights.rarityPercentage : null,
    record,
  }
}
