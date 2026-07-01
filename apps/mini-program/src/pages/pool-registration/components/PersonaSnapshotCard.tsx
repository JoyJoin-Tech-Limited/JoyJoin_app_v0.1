import { View, Text, Image } from '@tarojs/components'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import type { PoolPersonaSnapshotResponse } from '@shared/api'
import { haptics } from '../../../lib/utils/haptics'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
import { getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import { POOL_PERSONA_ASSETS, getParticleSrc } from './poolPersonaAssets'
import { usePersonaSnapshotAnimation } from './usePersonaSnapshotAnimation'
import PersonaSnapshotSheet from './PersonaSnapshotSheet'
import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'
import type { PoolEventType } from '../flowConfig'
import './PersonaSnapshotCard.scss'

interface PersonaSnapshotCardProps {
  poolId: string
  eventType: PoolEventType
  snapshot?: PoolPersonaSnapshotResponse | null
  isLoading: boolean
  userArchetype?: string | null
  visible: boolean
}

export default function PersonaSnapshotCard({
  poolId,
  eventType,
  snapshot,
  isLoading,
  userArchetype,
  visible,
}: PersonaSnapshotCardProps) {
  const deviceTier = useDeviceTier()
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])
  const [imageAttempt, setImageAttempt] = useState({ base: 0, texture: 0, paw: 0 })
  const [particleAttempts, setParticleAttempts] = useState<Record<number, number>>({})
  const [showSheet, setShowSheet] = useState(false)

  const returnStorageKey = useMemo(() => `jj_pool_persona_return_${poolId}`, [poolId])

  const isReturnView = useMemo(() => {
    try {
      const raw = Taro.getStorageSync(returnStorageKey)
      if (!raw) return false
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      const ts = typeof parsed?.ts === 'number' ? parsed.ts : null
      if (!ts) return false
      if (Date.now() - ts > 7 * 24 * 60 * 60 * 1000) {
        Taro.removeStorageSync(returnStorageKey)
        return false
      }
      return true
    } catch {
      return false
    }
  }, [returnStorageKey])

  // Mark this pool as visited so future entries within 7 days get the compressed animation.
  useEffect(() => {
    try {
      Taro.setStorageSync(returnStorageKey, JSON.stringify({ ts: Date.now() }))
    } catch {
      // non-blocking
    }
  }, [returnStorageKey])

  const { phase, particles, stateBandCopy, stateBandSubcopy, ctaReady } =
    usePersonaSnapshotAnimation({
      snapshot,
      reduceMotion: reduceMotion || deviceTier.isDegradation,
      isReturnView,
    })

  const accentColor = useMemo(() => {
    if (userArchetype) {
      try {
        return getContrastSafeArchetypeColor(userArchetype)
      } catch {
        // fall through
      }
    }
    return '#8B5CF6'
  }, [userArchetype])

  const primaryArchetype = useMemo(() => {
    if (!snapshot) return null
    return snapshot.dimensions.find((d) => d.key === 'archetype')?.clusters[0]?.label ?? null
  }, [snapshot])

  const handleBaseError = useCallback(() => {
    setImageAttempt((prev) => ({ ...prev, base: prev.base + 1 }))
  }, [])

  const handleTextureError = useCallback(() => {
    setImageAttempt((prev) => ({ ...prev, texture: prev.texture + 1 }))
  }, [])

  const handlePawError = useCallback(() => {
    setImageAttempt((prev) => ({ ...prev, paw: prev.paw + 1 }))
  }, [])

  const handleExpand = useCallback(() => {
    if (!snapshot || !ctaReady) return
    haptics('light')
    setShowSheet(true)
    discoverAnalytics.track('persona_snapshot_expand_sheet', poolId, {
      stateBand: snapshot.stateBand,
      totalRegistrants: snapshot.totalRegistrants,
    })
  }, [snapshot, ctaReady, poolId])

  const handleDimensionTap = useCallback(
    (key: string) => {
      discoverAnalytics.track('persona_snapshot_dimension_tap', poolId, {
        dimension: key,
        stateBand: snapshot?.stateBand,
      })
    },
    [poolId, snapshot?.stateBand]
  )

  if (!visible || isLoading || !snapshot) {
    return null
  }

  const baseSrc =
    imageAttempt.base === 0
      ? POOL_PERSONA_ASSETS.base.webp
      : imageAttempt.base === 1
        ? POOL_PERSONA_ASSETS.base.png
        : POOL_PERSONA_ASSETS.base.subpackage

  const textureSrc =
    imageAttempt.texture === 0
      ? POOL_PERSONA_ASSETS.clusterTexture.webp
      : imageAttempt.texture === 1
        ? POOL_PERSONA_ASSETS.clusterTexture.png
        : POOL_PERSONA_ASSETS.clusterTexture.subpackage

  const pawSrc =
    imageAttempt.paw === 0
      ? POOL_PERSONA_ASSETS.pawNudge.webp
      : imageAttempt.paw === 1
        ? POOL_PERSONA_ASSETS.pawNudge.png
        : POOL_PERSONA_ASSETS.pawNudge.subpackage

  return (
    <>
      <View
        className={[
          'persona-snapshot-card',
          `persona-snapshot-card--${phase}`,
          deviceTier.isDegradation ? 'persona-snapshot-card--low-end' : '',
          reduceMotion ? 'persona-snapshot-card--reduce-motion' : '',
          ctaReady ? 'persona-snapshot-card--ready' : '',
        ].join(' ')}
        onClick={handleExpand}
        hoverClass='persona-snapshot-card--active'
        role='button'
        aria-label={`${stateBandCopy}，${stateBandSubcopy}`}
      >
        <Image
          className='persona-snapshot-card__base'
          src={baseSrc}
          mode='widthFix'
          lazyLoad={false}
          onError={handleBaseError}
        />

        <Image
          className='persona-snapshot-card__texture'
          src={textureSrc}
          mode='aspectFill'
          lazyLoad={false}
          onError={handleTextureError}
        />

        <View className='persona-snapshot-card__particles' aria-hidden='true'>
          {particles.map((particle) => {
            const attempt = particleAttempts[particle.id] ?? 0
            const src =
              attempt === 0
                ? getParticleSrc(particle.colorKey, 'cdn')
                : getParticleSrc(particle.colorKey, 'subpackage')
            const isChaos = phase === 'chaos'
            const isResolve = phase === 'resolve'
            const x = isChaos ? particle.startX : particle.endX
            const y = isChaos ? particle.startY : particle.endY
            const opacity = isResolve ? 0.85 : 0.65
            const scale = isResolve ? 1 : isChaos ? 0.6 : 0.85
            const rotation = isChaos ? particle.rotation : 0

            return (
              <Image
                key={particle.id}
                className='persona-snapshot-card__particle'
                src={src}
                mode='aspectFit'
                lazyLoad={false}
                style={{
                  width: `${particle.sizeRpx}rpx`,
                  height: `${particle.sizeRpx}rpx`,
                  opacity,
                  transform: `translate(${x}rpx, ${y}rpx) rotate(${rotation}deg) scale(${scale})`,
                  transitionDelay: `${particle.delayMs}ms`,
                  zIndex: particles.length - particle.id,
                }}
                onError={() => {
                  setParticleAttempts((prev) => ({
                    ...prev,
                    [particle.id]: (prev[particle.id] ?? 0) + 1,
                  }))
                }}
              />
            )
          })}
        </View>

        <Image
          className='persona-snapshot-card__paw'
          src={pawSrc}
          mode='heightFix'
          lazyLoad={false}
          onError={handlePawError}
        />

        <View className='persona-snapshot-card__content'>
          <View className='persona-snapshot-card__topline'>
            <Text className='persona-snapshot-card__badge'>算法分拣中</Text>
            {primaryArchetype ? (
              <View className='persona-snapshot-card__primary-head'>
                <ArchetypeHead archetype={primaryArchetype} size={28} variant='grid' />
              </View>
            ) : null}
          </View>

          <Text className='persona-snapshot-card__headline'>{stateBandCopy}</Text>
          <Text className='persona-snapshot-card__subheadline'>{stateBandSubcopy}</Text>

          <View className='persona-snapshot-card__dimension-pills' role='list'>
            {snapshot.dimensions
              .filter((d) => d.disclosed)
              .slice(0, 3)
              .map((dimension) => (
                <View
                  key={dimension.key}
                  className='persona-snapshot-card__pill'
                  role='listitem'
                  hoverClass='persona-snapshot-card__pill--active'
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDimensionTap(dimension.key)
                  }}
                  style={{ borderColor: accentColor }}
                >
                  <Text className='persona-snapshot-card__pill-label'>{dimension.label}</Text>
                  <Text className='persona-snapshot-card__pill-value' style={{ color: accentColor }}>
                    {dimension.clusters[0]?.label}
                  </Text>
                </View>
              ))}
          </View>

          <View className='persona-snapshot-card__footer'>
            <Text className='persona-snapshot-card__count'>
              {snapshot.totalRegistrants} 位伙伴已报名
            </Text>
            <Text className='persona-snapshot-card__cta'>{ctaReady ? '点击查看详情' : '画像生成中…'}</Text>
          </View>
        </View>
      </View>

      {showSheet && snapshot ? (
        <PersonaSnapshotSheet
          snapshot={snapshot}
          eventType={eventType}
          onClose={() => setShowSheet(false)}
        />
      ) : null}
    </>
  )
}
