import type { PropsWithChildren } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
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
const FLOW_ARCHETYPE_BACKGROUND_MAP: Record<FlowCompanionArchetype, string> = {
  corgi: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-corgi-v3.webp'),
  rooster: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-rooster-v1.webp'),
  hamster_praise: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-hamster_praise-v1.webp'),
  fox: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-fox-v1.webp'),
  dolphin_calm: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-dolphin_calm-v1.webp'),
  spider: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-spider-v1.webp'),
  koala: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-koala-v1.webp'),
  octopus: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-octopus-v1.webp'),
  owl: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-owl-v1.webp'),
  elephant: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-elephant-v1.webp'),
  turtle: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-turtle-v1.webp'),
  cat: cdnAsset('/assets/lovart/flow-archetype-backgrounds/flow-bg-cat-v1.webp'),
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
  const personalizedBackground = personalizedArchetype
    ? FLOW_ARCHETYPE_BACKGROUND_MAP[personalizedArchetype]
    : null

  return (
    <View
      className={`flow-shell ${showGameBackground && personalizedArchetype ? `flow-shell--personalized flow-shell--${personalizedArchetype}` : ''}`}
      ariaLabel={title}
    >
      {showGameBackground && personalizedArchetype && <View className={`flow-shell__game-bg flow-shell__game-bg--${personalizedArchetype}`}>
        {personalizedBackground && (
          <Image
            className='flow-shell__archetype-background'
            src={personalizedBackground}
            mode='aspectFill'
            lazyLoad={false}
          />
        )}
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
        {!personalizedBackground && <View className='flow-shell__companions'>
          <View className={`flow-shell__companion flow-shell__companion--${personalizedArchetype}`}>
            <View className='flow-shell__companion-world'>
              <View className='flow-shell__companion-motif flow-shell__companion-motif--one' />
              <View className='flow-shell__companion-motif flow-shell__companion-motif--two' />
              <View className='flow-shell__companion-motif flow-shell__companion-motif--three' />
            </View>
            <Image
              className='flow-shell__companion-image'
              src={`/assets/icons/archetype/archetype-${personalizedArchetype}-head.webp`}
              mode='aspectFit'
              lazyLoad={false}
            />
          </View>
        </View>}
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
