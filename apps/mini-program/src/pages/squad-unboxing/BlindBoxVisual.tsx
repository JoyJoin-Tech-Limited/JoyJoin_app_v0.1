import { View, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import type { BlindBoxVisualState } from './squadUnboxingViewModels'
import BrandLogo from '../../components/ui/BrandLogo'
import {
  BLIND_BOX_BODY_ASSET,
  BLIND_BOX_ALT,
} from '../../lib/mascot/blindBoxAssets'

export function BlindBoxVisual({
  state,
}: {
  state: BlindBoxVisualState
}) {
  const [hasError, setHasError] = useState(false)
  const handleError = useCallback(() => setHasError(true), [])

  const isOpening = state === 'opening'
  const isOpen = state === 'open'
  const showInterior = isOpening || isOpen

  return (
    <View
      className={[
        'squad-unboxing__blind-box-visual',
        `squad-unboxing__blind-box-visual--${state}`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasError && (
        <View className='squad-unboxing__blind-box-fallback'>
          <View className='squad-unboxing__blind-box-fallback-body' />
        </View>
      )}

      <View className='squad-unboxing__blind-box-aura squad-unboxing__blind-box-aura--left' />
      <View className='squad-unboxing__blind-box-aura squad-unboxing__blind-box-aura--right' />

      {isOpening ? (
        <>
          <View className='squad-unboxing__blind-box-spark squad-unboxing__blind-box-spark--1' />
          <View className='squad-unboxing__blind-box-spark squad-unboxing__blind-box-spark--2' />
          <View className='squad-unboxing__blind-box-spark squad-unboxing__blind-box-spark--3' />
        </>
      ) : null}

      {/* Interior: a CSS premium card-back stack that rises from the box as the
          lid opens — the fan's design language (brand gradient, foil edge,
          logo mark), replacing the old golden-glow illustration so the whole
          打开礼盒 → 卡牌飞出 → 落位成扇 reads as one continuous story. */}
      {showInterior && !hasError ? (
        <View className='squad-unboxing__blind-box-stack' aria-hidden='true'>
          <View className='squad-unboxing__blind-box-stack-card squad-unboxing__blind-box-stack-card--3'>
            <View className='squad-unboxing__blind-box-stack-card-foil' />
          </View>
          <View className='squad-unboxing__blind-box-stack-card squad-unboxing__blind-box-stack-card--2'>
            <View className='squad-unboxing__blind-box-stack-card-foil' />
          </View>
          <View className='squad-unboxing__blind-box-stack-card squad-unboxing__blind-box-stack-card--1'>
            <View className='squad-unboxing__blind-box-stack-card-foil' />
            <View className='squad-unboxing__blind-box-stack-card-logo'>
              <BrandLogo size='sm' ariaLabel='' />
            </View>
          </View>
        </View>
      ) : null}

      <Image
        className='squad-unboxing__blind-box-body-img'
        mode='aspectFit'
        src={BLIND_BOX_BODY_ASSET}
        ariaLabel={BLIND_BOX_ALT.body}
        lazyLoad={false}
        onError={handleError}
      />

      <View className='squad-unboxing__blind-box-shadow' />
    </View>
  )
}
