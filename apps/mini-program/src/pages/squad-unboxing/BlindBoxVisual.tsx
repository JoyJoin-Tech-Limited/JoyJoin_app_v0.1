import { View, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import type { BlindBoxVisualState } from './squadUnboxingViewModels'
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
