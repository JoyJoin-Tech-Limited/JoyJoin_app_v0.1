import { cdnAsset } from './cdnAssets'

const FLOW_BANNER_ARCHETYPES = [
  'corgi',
  'rooster',
  'hamster_praise',
  'fox',
  'dolphin_calm',
  'spider',
  'koala',
  'octopus',
  'owl',
  'elephant',
  'turtle',
  'cat',
] as const

export { FLOW_BANNER_ARCHETYPES }

export type FlowCompanionArchetype = (typeof FLOW_BANNER_ARCHETYPES)[number]

export interface FlowArchetypeBackgrounds {
  event: string
  street: string
}

const makeBackgrounds = (archetype: FlowCompanionArchetype): FlowArchetypeBackgrounds => ({
  event: cdnAsset(`/assets/lovart/flow-archetype-backgrounds/flow-banner-event-${archetype}-v2.webp`),
  street: cdnAsset(`/assets/lovart/flow-archetype-backgrounds/flow-banner-street-${archetype}-v2.webp`),
})

const FLOW_ARCHETYPE_BACKGROUND_MAP: Record<FlowCompanionArchetype, FlowArchetypeBackgrounds> = {
  corgi: makeBackgrounds('corgi'),
  rooster: makeBackgrounds('rooster'),
  hamster_praise: makeBackgrounds('hamster_praise'),
  fox: makeBackgrounds('fox'),
  dolphin_calm: makeBackgrounds('dolphin_calm'),
  spider: makeBackgrounds('spider'),
  koala: makeBackgrounds('koala'),
  octopus: makeBackgrounds('octopus'),
  owl: makeBackgrounds('owl'),
  elephant: makeBackgrounds('elephant'),
  turtle: makeBackgrounds('turtle'),
  cat: makeBackgrounds('cat'),
}

export function isFlowCompanionArchetype(archetypeId?: string | null): archetypeId is FlowCompanionArchetype {
  return FLOW_BANNER_ARCHETYPES.includes(archetypeId as FlowCompanionArchetype)
}

export function resolveFlowArchetypeBackgrounds(
  archetypeId?: string | null,
): FlowArchetypeBackgrounds | null {
  return isFlowCompanionArchetype(archetypeId) ? FLOW_ARCHETYPE_BACKGROUND_MAP[archetypeId] : null
}

/** Both banner URLs for one archetype, for preloading during a known-archetype window. */
export function getFlowBannerPreloadUrls(archetypeId?: string | null): string[] {
  const backgrounds = resolveFlowArchetypeBackgrounds(archetypeId)
  return backgrounds ? [backgrounds.event, backgrounds.street] : []
}
