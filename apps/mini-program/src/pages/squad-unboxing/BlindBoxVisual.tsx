import { View, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import type { BlindBoxVisualState } from './squadUnboxingViewModels'
import {
  BLIND_BOX_BODY_ASSET,
  BLIND_BOX_LID_ASSET,
  BLIND_BOX_INTERIOR_ASSET,
  BLIND_BOX_ALT,
} from '../../lib/mascot/blindBoxAssets'

export function BlindBoxVisual({
  state,
  shouldReduceMotion,
}: {
  state: BlindBoxVisualState
  shouldReduceMotion: boolean
}) {
  const [hasError, setHasError] = useState(false)
  const handleError = useCallback(() => setHasError(true), [])

  const isOpening = state === 'opening'
  const isOpen = state === 'open'
  const showInterior = isOpening || isOpen
  const showSparks = isOpening && !shouldReduceMotion

  return (
    <View
      className={[
        'squad-unboxing__blind-box-visual',
        `squad-unboxing__blind-box-visual--${state}`,
        shouldReduceMotion ? 'squad-unboxing__blind-box-visual--reduced' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* CSS fallback box — shown when CDN images fail to load */}
      {hasError && (
        <View className='squad-unboxing__blind-box-fallback'>
          <View className='squad-unboxing__blind-box-fallback-lid' />
          <View className='squad-unboxing__blind-box-fallback-body' />
        </View>
      )}

      {/* Aura — CSS procedural glow, always present */}
      <View className='squad-unboxing__blind-box-aura squad-unboxing__blind-box-aura--left' />
      <View className='squad-unboxing__blind-box-aura squad-unboxing__blind-box-aura--right' />

      {/* Sparks — CSS procedural particles, only when opening */}
      {showSparks ? (
        <>
          <View className='squad-unboxing__blind-box-spark squad-unboxing__blind-box-spark--1' />
          <View className='squad-unboxing__blind-box-spark squad-unboxing__blind-box-spark--2' />
          <View className='squad-unboxing__blind-box-spark squad-unboxing__blind-box-spark--3' />
        </>
      ) : null}

      {/* Body — Lovart illustrated base layer */}
      <Image
        className='squad-unboxing__blind-box-body-img'
        mode='aspectFit'
        src={BLIND_BOX_BODY_ASSET}
        ariaLabel={BLIND_BOX_ALT.body}
        lazyLoad={false}
        onError={handleError}
      />

      {/* Interior glow — Lovart illustrated glow, shown when opening/open */}
      {showInterior && !hasError ? (
        <Image
          className='squad-unboxing__blind-box-interior-img'
          mode='aspectFit'
          src={BLIND_BOX_INTERIOR_ASSET}
          ariaLabel={BLIND_BOX_ALT.interior}
          lazyLoad={false}
          onError={handleError}
        />
      ) : null}

      {/* Lid — Lovart illustrated lid, CSS-animated */}
      <Image
        className='squad-unboxing__blind-box-lid-img'
        mode='aspectFit'
        src={BLIND_BOX_LID_ASSET}
        ariaLabel={BLIND_BOX_ALT.lid}
        lazyLoad={false}
        onError={handleError}
      />

      {/* Shadow — CSS procedural ground shadow */}
      <View className='squad-unboxing__blind-box-shadow' />
    </View>
  )
}
