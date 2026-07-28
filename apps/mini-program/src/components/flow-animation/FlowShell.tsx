import type { PropsWithChildren } from 'react'
import { Button, Text, View } from '@tarojs/components'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import BrandLogo from '../ui/BrandLogo'

const FLOW_COMPANION_ARCHETYPES = [
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
type FlowCompanionArchetype = (typeof FLOW_COMPANION_ARCHETYPES)[number]
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

export function resolveFlowArchetypeBackgrounds(
  archetypeId?: string | null,
): FlowArchetypeBackgrounds | null {
  return FLOW_COMPANION_ARCHETYPES.includes(archetypeId as FlowCompanionArchetype)
    ? FLOW_ARCHETYPE_BACKGROUND_MAP[archetypeId as FlowCompanionArchetype]
    : null
}

interface FlowShellProps extends PropsWithChildren {
  title: string
  showGameBackground?: boolean
  archetypeId?: string | null
  onSkip: () => void
  actionLabel: string
  actionVisible: boolean
  onAction: () => void
}

export default function FlowShell({
  title,
  showGameBackground = false,
  archetypeId,
  onSkip,
  actionLabel,
  actionVisible,
  onAction,
  children,
}: FlowShellProps) {
  const personalizedArchetype = FLOW_COMPANION_ARCHETYPES.includes(
    archetypeId as FlowCompanionArchetype,
  )
    ? (archetypeId as FlowCompanionArchetype)
    : null
  return (
    <View
      className={`flow-shell ${showGameBackground && personalizedArchetype ? `flow-shell--personalized flow-shell--${personalizedArchetype}` : ''}`}
      ariaLabel={title}
    >
      {showGameBackground && personalizedArchetype && <View className={`flow-shell__game-bg flow-shell__game-bg--${personalizedArchetype}`}>
        <View className='flow-shell__route flow-shell__route--one' />
        <View className='flow-shell__route flow-shell__route--two' />
        <View className='flow-shell__map-node flow-shell__map-node--one' />
        <View className='flow-shell__map-node flow-shell__map-node--two' />
        <View className='flow-shell__map-node flow-shell__map-node--three' />
        <View className='flow-shell__mystery-tile'>
          <View className='flow-shell__mystery-lid' />
          <View className='flow-shell__mystery-ribbon' />
          <Text className='flow-shell__mystery-mark'>?</Text>
        </View>
        <View className='flow-shell__collectible flow-shell__collectible--one' />
        <View className='flow-shell__collectible flow-shell__collectible--two' />
        <View className='flow-shell__city'>
          <View className='flow-shell__building flow-shell__building--one' />
          <View className='flow-shell__building flow-shell__building--two' />
          <View className='flow-shell__building flow-shell__building--three' />
          <View className='flow-shell__building flow-shell__building--four' />
        </View>
      </View>}

      <View className='flow-shell__header'>
        <View className='flow-shell__identity'>
          <BrandLogo
            width={150}
            height={150}
            className='flow-shell__logo'
          />
          <Text className='flow-shell__brand'>JoyJoin</Text>
          <Text className='flow-shell__title'>{title}</Text>
        </View>
        <Button
          className='flow-shell__skip'
          hoverClass='flow-shell__skip--pressed'
          onClick={onSkip}
          ariaLabel='跳过流程介绍'
        >
          跳过
        </Button>
      </View>

      <View className='flow-shell__canvas'>
        {children}
      </View>

      <View className={`flow-shell__action ${actionVisible ? 'flow-shell__action--visible' : ''}`}>
        <Button
          className='flow-shell__primary'
          hoverClass='flow-shell__primary--pressed'
          disabled={!actionVisible}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </View>
    </View>
  )
}
