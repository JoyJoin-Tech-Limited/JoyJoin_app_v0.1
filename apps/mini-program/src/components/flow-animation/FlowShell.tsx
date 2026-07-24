import type { PropsWithChildren } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
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

interface FlowShellProps extends PropsWithChildren {
  title: string
  showGameBackground?: boolean
  onSkip: () => void
  actionLabel: string
  actionVisible: boolean
  onAction: () => void
}

export default function FlowShell({
  title,
  showGameBackground = false,
  onSkip,
  actionLabel,
  actionVisible,
  onAction,
  children,
}: FlowShellProps) {
  return (
    <View className='flow-shell' ariaLabel={title}>
      {showGameBackground && <View className='flow-shell__game-bg'>
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
        <View className='flow-shell__companions'>
          {FLOW_COMPANION_ARCHETYPES.map((archetype, index) => (
            <View
              key={archetype}
              className={`flow-shell__companion flow-shell__companion--${index + 1}`}
            >
              <Image
                className='flow-shell__companion-image'
                src={`/assets/icons/archetype/archetype-${archetype}-head.webp`}
                mode='aspectFit'
                lazyLoad={false}
              />
            </View>
          ))}
        </View>
        <View className='flow-shell__city'>
          <View className='flow-shell__building flow-shell__building--one' />
          <View className='flow-shell__building flow-shell__building--two' />
          <View className='flow-shell__building flow-shell__building--three' />
          <View className='flow-shell__building flow-shell__building--four' />
        </View>
      </View>}

      <View className='flow-shell__header'>
        <View className='flow-shell__identity'>
          <BrandLogo width={42} height={42} className='flow-shell__logo' />
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
