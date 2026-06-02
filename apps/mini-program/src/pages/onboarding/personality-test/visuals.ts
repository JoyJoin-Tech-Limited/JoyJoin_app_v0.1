import { formatHSL, getArchetypeHSL } from '@shared/archetypeColors'
import { archetypeRegistry, type ArchetypeRecord } from '@shared/personality/archetypeRegistry'
import { cdnAsset } from '../../../lib/utils/cdnAssets'

export type {
  LegacyXiaoyueMood,
  XiaoyueExpressionId,
  XiaoyueMood,
} from '../../../lib/mascot/xiaoyueExpressions'
export {
  getXiaoyueAsset,
  getXiaoyueExpressionAsset,
  LEGACY_MOOD_TO_EXPRESSION,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
  PERSONALITY_TEST_QUESTION_EXPRESSION,
  XIAOYUE_ASSET_BY_EXPRESSION,
} from '../../../lib/mascot/xiaoyueExpressions'

export interface ArchetypeAssetPaths {
  webp: string
  png: string
}

// CDN base for cross-package consumers (login page, discover, icebreaker session).
export const ASSET_BASE_WEBP = cdnAsset('/assets/personality/archetypes')
export const ASSET_BASE_PNG = cdnAsset('/assets/personality/archetypes')

// Local base for onboarding-subpackage pages (personality-test results).
// Archetype WebPs are bundled in the onboarding subpackage to avoid CDN latency
// during the result reveal flow.
export const ASSET_BASE_WEBP_LOCAL = '/pages/onboarding/assets/archetypes'
export const ASSET_BASE_PNG_LOCAL = '/pages/onboarding/assets/archetypes'

/** Local spritesheet path — bundled in the preloaded onboarding subpackage.
 *  Use this for the slot animation so the spritesheet is guaranteed to match
 *  the local manifest (eliminates CDN staleness as a source of split-brain). */
export const ASSET_BASE_SPRITESHEET_LOCAL = '/pages/onboarding/assets/archetypes'

export const ARCHETYPE_ASSET_MAP: Record<string, ArchetypeAssetPaths> = {
  corgi:        { webp: `${ASSET_BASE_WEBP}/archetype-corgi.webp`,        png: `${ASSET_BASE_PNG}/archetype-corgi.png` },
  rooster:      { webp: `${ASSET_BASE_WEBP}/archetype-rooster.webp`,      png: `${ASSET_BASE_PNG}/archetype-rooster.png` },
  hamster_praise:{ webp: `${ASSET_BASE_WEBP}/archetype-hamster_praise.webp`,png: `${ASSET_BASE_PNG}/archetype-hamster_praise.png` },
  fox:          { webp: `${ASSET_BASE_WEBP}/archetype-fox.webp`,          png: `${ASSET_BASE_PNG}/archetype-fox.png` },
  dolphin_calm: { webp: `${ASSET_BASE_WEBP}/archetype-dolphin_calm.webp`, png: `${ASSET_BASE_PNG}/archetype-dolphin_calm.png` },
  spider:       { webp: `${ASSET_BASE_WEBP}/archetype-spider.webp`,       png: `${ASSET_BASE_PNG}/archetype-spider.png` },
  koala:        { webp: `${ASSET_BASE_WEBP}/archetype-koala.webp`,        png: `${ASSET_BASE_PNG}/archetype-koala.png` },
  octopus:      { webp: `${ASSET_BASE_WEBP}/archetype-octopus.webp`,      png: `${ASSET_BASE_PNG}/archetype-octopus.png` },
  owl:          { webp: `${ASSET_BASE_WEBP}/archetype-owl.webp`,          png: `${ASSET_BASE_PNG}/archetype-owl.png` },
  elephant:     { webp: `${ASSET_BASE_WEBP}/archetype-elephant.webp`,     png: `${ASSET_BASE_PNG}/archetype-elephant.png` },
  turtle:       { webp: `${ASSET_BASE_WEBP}/archetype-turtle.webp`,       png: `${ASSET_BASE_PNG}/archetype-turtle.png` },
  cat:          { webp: `${ASSET_BASE_WEBP}/archetype-cat.webp`,          png: `${ASSET_BASE_PNG}/archetype-cat.png` },
}

const ARCHETYPE_SUMMARIES: Record<string, string> = {
  corgi: '你更容易在陌生局里先把气氛带热，让大家更快放松下来。',
  rooster: '你不是最吵的那个，但往往是让整桌节奏稳定下来的那个人。',
  hamster_praise: '你很会看见别人身上的亮点，关系会在你的真诚里自然升温。',
  fox: '你擅长把普通聊天拐到更有意思的方向，聊着聊着就有火花。',
  dolphin_calm: '你习惯先看气场再发力，一旦找到对的人，连接会很顺。',
  spider: '你更像局里的连接器，擅长把看起来不相干的人慢慢搭上线。',
  koala: '你会让人感觉被接住，适合把陌生感聊成熟悉感。',
  octopus: '你的脑洞和新鲜视角，会让一场局突然多出意料之外的惊喜。',
  owl: '你不一定先开口，但你说出来的话通常最有记忆点。',
  elephant: '你带来的稳定感很强，很多人会因为你在而更安心。',
  turtle: '你会先判断再靠近，一旦投入就很靠谱。',
  cat: '你看起来低调，但往往最知道什么人值得深聊。',
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

/** All archetype WebP asset URLs for bulk preloading. */
export function getAllArchetypeAssetUrls(): string[] {
  return Object.values(ARCHETYPE_ASSET_MAP).map((a) => a.webp)
}

/** Spritesheet CDN URL for cache priming via getImageInfo. */
export function getArchetypeSpritesheetUrl(): string {
  return `${ASSET_BASE_WEBP}/archetype-spritesheet.webp`
}

/** Local spritesheet path for direct rendering (bundled in onboarding subpackage).
 *  Returns the on-device path so the slot animation is immune to CDN staleness.
 *  The CDN path is still available via {@link getArchetypeSpritesheetCdnPath} as a fallback. */
export function getArchetypeSpritesheetLocalPath(): string {
  return `${ASSET_BASE_SPRITESHEET_LOCAL}/archetype-spritesheet.webp`
}

/** CDN fallback path used by CSS background-image fallback chain. */
export function getArchetypeSpritesheetCdnPath(): string {
  return `${ASSET_BASE_WEBP}/archetype-spritesheet.webp`
}

/** High-resolution static mascot images (480×480px) for non-animated display. */
const STATIC_MASCOT_BASE = cdnAsset('/assets/personality/xiaoyue')

export function getIntroStaticAsset(): string {
  return `${STATIC_MASCOT_BASE}/xiaoyue-intro-animated.webp`
}

export function getIntroStaticFallbackAsset(): string {
  return `${STATIC_MASCOT_BASE}/xiaoyue-intro-static.webp`
}

export function getArchetypeVisual(archetype: string | null | undefined): ArchetypeVisual {
  const record = archetype ? archetypeRegistry[archetype] : undefined
  const accent = formatHSL(getArchetypeHSL(archetype))
  const fallbackSummary = archetype ? ARCHETYPE_SUMMARIES[archetype] : undefined

  return {
    name: record?.name ?? archetype ?? '神秘原型',
    asset: archetype ? ARCHETYPE_ASSET_MAP[archetype]?.webp ?? '' : '',
    assetPng: archetype ? ARCHETYPE_ASSET_MAP[archetype]?.png ?? '' : '',
    accent,
    accentSoft: withAlpha(archetype, 0.12),
    accentBorder: withAlpha(archetype, 0.22),
    accentGlow: withAlpha(archetype, 0.26),
    accentSurface: `linear-gradient(145deg, ${withAlpha(archetype, 0.24)} 0%, rgba(255, 255, 255, 0.96) 82%)`,
    accentStrong: withAlpha(archetype, 0.86),
    summary: fallbackSummary ?? record?.narrative.description ?? '你的氛围已经有了清晰的轮廓。',
    nickname: record?.narrative.nickname ?? '',
    tagline: record?.narrative.tagline ?? '',
    description: record?.narrative.description ?? fallbackSummary ?? '你的氛围已经有了清晰的轮廓。',
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
