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
  dragProgress,
}: {
  state: BlindBoxVisualState
  shouldReduceMotion: boolean
  dragProgress?: number
}) {
  const [hasError, setHasError] = useState(false)
  const handleError = useCallback(() => setHasError(true), [])

  const isOpening = state === 'opening'
  const isOpen = state === 'open'
  const showInterior = isOpening || isOpen
  const showSparks = isOpening && !shouldReduceMotion

  const isDragging = typeof dragProgress === 'number'
  const progress = isDragging ? Math.max(0, Math.min(1, dragProgress)) : 0

  const dragStyle = (base: Record<string, string | number> = {}): Record<string, string | number> | undefined => {
    if (!isDragging) return undefined
    return { ...base, transition: 'none' }
  }

  const lidStyle = dragStyle({
    transform: `translate3d(-50%, ${-82 * progress}rpx, 0) rotate(${-8 * progress}deg)`,
    opacity: progress > 0.85 ? 1 - (progress - 0.85) * 2 : 1,
  })

  const interiorStyle = dragStyle({
    opacity: progress,
  })

  const bodyStyle = dragStyle({
    transform: `translate3d(-50%, ${6 * progress}rpx, 0) scale(${1 + 0.02 * progress})`,
  })

  const auraStyle = dragStyle({
    opacity: 0.34 + 0.08 * progress,
    transform: `scale(${0.94 + 0.11 * progress})`,
  })

  const shadowStyle = dragStyle({
    transform: `translateX(-50%) scale(${1 - 0.1 * progress})`,
    opacity: 0.6 - 0.1 * progress,
  })

  return (
    <View
      className={[
        'squad-unboxing__blind-box-visual',
        `squad-unboxing__blind-box-visual--${state}`,
        shouldReduceMotion ? 'squad-unboxing__blind-box-visual--reduced' : '',
        isDragging ? 'squad-unboxing__blind-box-visual--dragging' : '',
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
      <View className='squad-unboxing__blind-box-aura squad-unboxing__blind-box-aura--left' style={auraStyle} />
      <View className='squad-unboxing__blind-box-aura squad-unboxing__blind-box-aura--right' style={auraStyle} />

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
        style={bodyStyle}
      />

      {/* Interior glow — Lovart illustrated glow, shown when opening/open */}
      {(showInterior || isDragging) && !hasError ? (
        <Image
          className='squad-unboxing__blind-box-interior-img'
          mode='aspectFit'
          src={BLIND_BOX_INTERIOR_ASSET}
          ariaLabel={BLIND_BOX_ALT.interior}
          lazyLoad={false}
          onError={handleError}
          style={interiorStyle}
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
        style={lidStyle}
      />

      {/* Shadow — CSS procedural ground shadow */}
      <View className='squad-unboxing__blind-box-shadow' style={shadowStyle} />
    </View>
  )
}
