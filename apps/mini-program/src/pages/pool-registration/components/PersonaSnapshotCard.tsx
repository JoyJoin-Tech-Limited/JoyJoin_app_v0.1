import { View, Text, Image } from '@tarojs/components'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PoolPersonaSnapshotResponse } from '@shared/api'
import { haptics } from '../../../lib/utils/haptics'
import { getContrastSafeArchetypeColor, getArchetypeHSL, formatHSLAsRGBA } from '@shared/archetypeColors'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import MissingArchetypePlaceholder from '../../../components/mascot/MissingArchetypePlaceholder'
import { POOL_PERSONA_ASSETS, getParticleSrc } from './poolPersonaAssets'
import { usePersonaSnapshotAnimation } from './usePersonaSnapshotAnimation'
import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'
import './PersonaSnapshotCard.scss'

interface PersonaSnapshotCardProps {
  poolId: string
  snapshot?: PoolPersonaSnapshotResponse | null
  isLoading: boolean
  hasError?: boolean
  onRetry?: () => void
  userArchetype?: string | null
  visible: boolean
  reduceMotion: boolean
  isDegradation: boolean
  onDimensionTap?: (key: string) => void
}

export default function PersonaSnapshotCard({
  poolId,
  snapshot,
  isLoading,
  hasError,
  onRetry,
  userArchetype,
  visible,
  reduceMotion,
  isDegradation,
  onDimensionTap,
}: PersonaSnapshotCardProps) {
  const hasTrackedUserArchetypeImpressionRef = useRef(false)
  const [particleAttempts, setParticleAttempts] = useState<Record<number, number>>({})

  const shouldDisableMotion = reduceMotion || isDegradation

  const {
    phase,
    particles,
    staticMoundParticles,
    stateBandCopy,
    stateBandSubcopy,
    pileCaption,
    ctaReady,
    dropDurationMs,
  } = usePersonaSnapshotAnimation({
    poolId,
    snapshot,
    userArchetype,
    reduceMotion: shouldDisableMotion,
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

  const accentSoftBg = useMemo(() => {
    const hsl = getArchetypeHSL(userArchetype)
    return formatHSLAsRGBA(hsl, 0.08)
  }, [userArchetype])

  const userArchetypeDisplay = useMemo(() => {
    if (!userArchetype) return null
    const resolved = resolveArchetype(userArchetype)
    return resolved?.nameCn ?? null
  }, [userArchetype])

  useEffect(() => {
    if (!visible || !userArchetype || hasTrackedUserArchetypeImpressionRef.current) return
    hasTrackedUserArchetypeImpressionRef.current = true
    discoverAnalytics.track('persona_snapshot_user_archetype_impression', poolId, {
      archetype: userArchetype,
      hasSnapshot: !!snapshot,
    })
  }, [visible, userArchetype, poolId, snapshot])

  const handleDimensionTap = useCallback(
    (key: string) => {
      if (!snapshot || !ctaReady) return
      haptics('light')
      onDimensionTap?.(key)
    },
    [snapshot, ctaReady, onDimensionTap],
  )

  const handleRetry = useCallback(
    (e: unknown) => {
      ;(e as { stopPropagation?: () => void }).stopPropagation?.()
      haptics('light')
      onRetry?.()
    },
    [onRetry],
  )

  const disclosedDimensions = useMemo(() => {
    if (!snapshot) return []
    return snapshot.dimensions.filter((d) => d.disclosed).slice(0, 3)
  }, [snapshot])

  const renderParticleImage = useCallback(
    (particle: { id: number; colorKey: string; tint?: string; sizeRpx: number; delayMs: number }, dropped: boolean) => {
      const attempt = particleAttempts[particle.id] ?? 0
      const src = attempt === 0 ? getParticleSrc('purple', 'cdn') : getParticleSrc('purple', 'subpackage')
      return (
        <Image
          key={particle.id}
          className={[
            'persona-snapshot-card__particle',
            dropped ? 'persona-snapshot-card__particle--dropped' : '',
          ].join(' ')}
          src={src}
          mode='aspectFit'
          lazyLoad={false}
          style={{
            width: `${particle.sizeRpx}rpx`,
            height: `${particle.sizeRpx}rpx`,
            animationDelay: `${particle.delayMs}ms`,
            animationDuration: `${dropDurationMs}ms`,
            ...(particle.tint ? { filter: `drop-shadow(0 0 0 ${particle.tint})` } : {}),
          }}
          onError={() => {
            setParticleAttempts((prev) => ({
              ...prev,
              [particle.id]: (prev[particle.id] ?? 0) + 1,
            }))
          }}
        />
      )
    },
    [dropDurationMs, particleAttempts],
  )

  if (!visible) {
    return null
  }

  if (isLoading) {
    return (
      <View className='persona-snapshot-card persona-snapshot-card--loading'>
        <View className='persona-snapshot-card__row'>
          <View className='persona-snapshot-card__avatar-column'>
            <View className='persona-snapshot-card__avatar-ring persona-snapshot-card__avatar-ring--skeleton' />
            <View className='persona-snapshot-card__skeleton-text persona-snapshot-card__skeleton-text--short' />
          </View>
          <View className='persona-snapshot-card__content-column'>
            <View className='persona-snapshot-card__skeleton-badge' />
            <View className='persona-snapshot-card__skeleton-text persona-snapshot-card__skeleton-text--medium' />
            <View className='persona-snapshot-card__skeleton-text persona-snapshot-card__skeleton-text--long' />
            <View className='persona-snapshot-card__dimension-pills'>
              <View className='persona-snapshot-card__pill persona-snapshot-card__pill--skeleton' />
              <View className='persona-snapshot-card__pill persona-snapshot-card__pill--skeleton' />
            </View>
            <View className='persona-snapshot-card__footer'>
              <View className='persona-snapshot-card__skeleton-text persona-snapshot-card__skeleton-text--short' />
              <View className='persona-snapshot-card__skeleton-text persona-snapshot-card__skeleton-text--tiny' />
            </View>
          </View>
        </View>
      </View>
    )
  }

  if (hasError) {
    return (
      <View
        className='persona-snapshot-card persona-snapshot-card--error'
        onClick={handleRetry}
        hoverClass='persona-snapshot-card--error-active'
        role='button'
        aria-label='画像加载失败，点击重试'
      >
        <View className='persona-snapshot-card__error-row'>
          <Image
            className='persona-snapshot-card__error-icon'
            src={POOL_PERSONA_ASSETS.pawNudge.webp}
            mode='aspectFit'
            lazyLoad={false}
            onError={() => {
              // Fallback handled by keeping the text label visible.
            }}
          />
          <View className='persona-snapshot-card__error-copy'>
            <Text className='persona-snapshot-card__error-title'>画像加载失败</Text>
            <Text className='persona-snapshot-card__error-hint'>点击重试</Text>
          </View>
        </View>
      </View>
    )
  }

  const totalRegistrants = snapshot?.totalRegistrants ?? 0
  const showStaticMound = shouldDisableMotion || staticMoundParticles.length > 0
  const showAnimatedParticles = !shouldDisableMotion && particles.length > 0

  return (
    <View
      className={[
        'persona-snapshot-card',
        `persona-snapshot-card--${phase}`,
        shouldDisableMotion ? 'persona-snapshot-card--reduce-motion' : '',
        ctaReady ? 'persona-snapshot-card--ready' : '',
      ].join(' ')}
    >
      <View className='persona-snapshot-card__row'>
        <View className='persona-snapshot-card__avatar-column'>
          <View
            className='persona-snapshot-card__avatar-ring'
            style={{ borderColor: accentColor, backgroundColor: accentSoftBg }}
          >
            {userArchetype ? (
              <ArchetypeHead archetype={userArchetype} size={112} variant='grid' />
            ) : (
              <MissingArchetypePlaceholder size={112} />
            )}
          </View>
          <Text className='persona-snapshot-card__avatar-label' style={{ color: accentColor }}>
            你的原型
          </Text>
          {userArchetypeDisplay ? (
            <Text className='persona-snapshot-card__avatar-name'>{userArchetypeDisplay}</Text>
          ) : null}
        </View>

        <View className='persona-snapshot-card__content-column'>
          <View className='persona-snapshot-card__topline'>
            <Text className='persona-snapshot-card__badge'>已报名伙伴画像</Text>
          </View>

          <Text className='persona-snapshot-card__headline'>{stateBandCopy}</Text>
          <Text className='persona-snapshot-card__subheadline'>{stateBandSubcopy}</Text>

          {disclosedDimensions.length > 0 ? (
            <View className='persona-snapshot-card__dimension-pills' role='list'>
              {disclosedDimensions.map((dimension) => (
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
                  aria-label={`${dimension.label}：${dimension.clusters[0]?.label}`}
                >
                  <Text className='persona-snapshot-card__pill-label'>{dimension.label}</Text>
                  <Text className='persona-snapshot-card__pill-value' style={{ color: accentColor }}>
                    {dimension.clusters[0]?.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View className='persona-snapshot-card__footer'>
            <Text className='persona-snapshot-card__count'>
              {totalRegistrants > 0 ? `${totalRegistrants} 位伙伴已报名` : '等你加入'}
            </Text>
            <Text className='persona-snapshot-card__cta'>
              {ctaReady ? '查看完整画像' : '画像生成中…'}
            </Text>
          </View>
        </View>
      </View>

      {<View className='persona-snapshot-card__pile-caption' aria-live='polite'>
        <Text className='persona-snapshot-card__pile-caption-text'>{pileCaption}</Text>
      </View>}

      {showAnimatedParticles ? (
        <View className='persona-snapshot-card__particles' aria-hidden='true'>
          {particles.map((particle) => (
            <View
              key={particle.id}
              className='persona-snapshot-card__particle-wrap'
              style={{
                width: `${particle.sizeRpx}rpx`,
                height: `${particle.sizeRpx}rpx`,
                left: `${particle.xPercent}%`,
                top: `${particle.yPercent}%`,
                transform: `rotate(${particle.rotation}deg)`,
              }}
            >
              {renderParticleImage(particle, phase === 'ready')}
            </View>
          ))}
        </View>
      ) : null}

      {showStaticMound ? (
        <View className='persona-snapshot-card__particles persona-snapshot-card__particles--static' aria-hidden='true'>
          {staticMoundParticles.map((particle) => (
            <View
              key={`static-${particle.id}`}
              className='persona-snapshot-card__particle-wrap persona-snapshot-card__particle-wrap--static'
              style={{
                width: `${particle.sizeRpx}rpx`,
                height: `${particle.sizeRpx}rpx`,
                left: `${particle.xPercent}%`,
                top: `${particle.yPercent}%`,
                transform: `rotate(${particle.rotation}deg)`,
              }}
            >
              <Image
                className='persona-snapshot-card__particle persona-snapshot-card__particle--static'
                src={getParticleSrc('purple', 'cdn')}
                mode='aspectFit'
                lazyLoad={false}
                style={{
                  width: `${particle.sizeRpx}rpx`,
                  height: `${particle.sizeRpx}rpx`,
                  ...(particle.tint ? { filter: `drop-shadow(0 0 0 ${particle.tint})` } : {}),
                }}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
