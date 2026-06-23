import { View, Image, Text } from '@tarojs/components'
import { useState, useMemo } from 'react'
import { cdnAsset, useCdnFirstSrc } from '@/lib/utils/cdnAssets'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import ArchetypeHead from '../ArchetypeHead'
import './index.scss'

export type XiaoyueEmptyStateEmotion =
  | 'coaching'
  | 'celebration'
  | 'waiting'
  | 'reassure'
  | 'curious'
  | 'events'

export interface XiaoyueEmptyStateProps {
  emotion: XiaoyueEmptyStateEmotion
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  size?: 'sm' | 'md' | 'lg'
  /** Disable the infinite mascot breathe animation (e.g. on degradation-tier devices). */
  disableBreathe?: boolean
  /** Disable halo blur for performance on degradation-tier devices. */
  disableBlur?: boolean
  /** Explicit reduced-motion override. CSS media query is the primary guard. */
  motionReduced?: boolean
  /** Show a small celebration badge on the mascot (e.g. feedback-complete). */
  showCelebrationBadge?: boolean
  /** Render the user's archetype head badge and halo for identity-rich empty states. */
  archetypeId?: string | null
  /** Use the archetype head icon as the main visual instead of the Xiaoyue mascot. */
  archetypeAsMainVisual?: boolean
}

const SIZE_MAP = { sm: 160, md: 200, lg: 240 }

const EMOTION_MAP: Record<XiaoyueEmptyStateEmotion, string> = {
  coaching: 'xiaoyue-coach-guide',
  celebration: 'xiaoyue-match-success',
  waiting: 'xiaoyue-match-waiting',
  reassure: 'xiaoyue-opt-out-reassure',
  curious: 'xiaoyue-connections-empty',
  events: 'xiaoyue-events-empty',
}

function classNames(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export default function XiaoyueEmptyState({
  emotion,
  title,
  subtitle,
  actionLabel,
  onAction,
  disabled = false,
  loading = false,
  loadingLabel,
  size = 'md',
  disableBreathe = false,
  disableBlur = false,
  motionReduced = false,
  showCelebrationBadge = false,
  archetypeId,
  archetypeAsMainVisual = false,
}: XiaoyueEmptyStateProps) {
  const [imgError, setImgError] = useState(false)
  const celebrationIcon = useCdnFirstSrc('/assets/icons/ui/icon-check.webp')
  const dim = SIZE_MAP[size]
  const hasArchetypeBadge = Boolean(archetypeId)
  const showArchetypeMain = archetypeAsMainVisual && hasArchetypeBadge
  const archetypeName = archetypeId ? ARCHETYPE_BY_ID[archetypeId]?.nameCn ?? archetypeId : undefined
  const isActionDisabled = disabled || loading
  const mascotClass = classNames(
    'xiaoyue-empty-state__mascot',
    disableBreathe && 'xiaoyue-empty-state__mascot--no-breathe',
    motionReduced && 'xiaoyue-empty-state__mascot--reduced',
    showCelebrationBadge && 'xiaoyue-empty-state__mascot--celebrate',
    showArchetypeMain && 'xiaoyue-empty-state__mascot--archetype-main'
  )

  const archetypeTokens = useMemo(() => getArchetypeTokens(archetypeId), [archetypeId])
  const haloStyle = useMemo(() => {
    const background = archetypeId
      ? archetypeTokens.background
      : '#F5F0FF' // brand-primary tint fallback
    const surface = archetypeId
      ? archetypeTokens.surface
      : '#EDE9FE' // brand-primary-light fallback
    return {
      background: `radial-gradient(circle, ${background} 0%, ${surface} 70%, transparent 100%)`,
      filter: disableBlur ? 'none' : undefined,
      opacity: disableBlur ? 0.5 : undefined,
    }
  }, [archetypeId, archetypeTokens, disableBlur])

  return (
    <View className={classNames('xiaoyue-empty-state', showCelebrationBadge && 'xiaoyue-empty-state--celebration')}>
      <View
        className={classNames(
          'xiaoyue-empty-state__mascot-wrap',
          hasArchetypeBadge && 'xiaoyue-empty-state__mascot-wrap--has-archetype'
        )}
      >
        <View
          className={classNames(
            'xiaoyue-empty-state__archetype-halo',
            disableBlur && 'xiaoyue-empty-state__archetype-halo--no-blur'
          )}
          style={haloStyle}
          aria-hidden='true'
        />
        {showArchetypeMain ? (
          <View
            className={mascotClass}
            style={{ width: `${dim}rpx`, height: `${dim}rpx` }}
            role='img'
            aria-label={archetypeName ? `${archetypeName}头像` : '原型头像'}
          >
            <ArchetypeHead archetype={archetypeId} size={dim} />
          </View>
        ) : !imgError ? (
          <Image
            className={mascotClass}
            src={cdnAsset(`/assets/personality/xiaoyue/${EMOTION_MAP[emotion]}.webp`)}
            style={{ width: `${dim}rpx`, height: `${dim}rpx` }}
            mode='aspectFit'
            lazyLoad={false}
            aria-label='悦仔'
            onError={() => setImgError(true)}
          />
        ) : (
          <View
            className='xiaoyue-empty-state__mascot-fallback'
            style={{ width: `${dim}rpx`, height: `${dim}rpx`, '--fallback-size': `${dim * 0.35}rpx` } as React.CSSProperties}
            aria-label='悦仔 mascot'
          >
            <Text className='xiaoyue-empty-state__mascot-fallback-text'>
              悦
            </Text>
          </View>
        )}
        {showCelebrationBadge && (
          <View className='xiaoyue-empty-state__mascot-badge' aria-label='完成'>
            <Image
              className='xiaoyue-empty-state__mascot-badge-icon'
              src={celebrationIcon.src}
              mode='aspectFit'
              onError={celebrationIcon.onError}
            />
          </View>
        )}
        {hasArchetypeBadge && !showArchetypeMain && (
          <View className='xiaoyue-empty-state__archetype-badge' aria-hidden='true'>
            <ArchetypeHead archetype={archetypeId} size={76} fallback='none' />
          </View>
        )}
      </View>
      <Text className='xiaoyue-empty-state__title'>{title}</Text>
      {subtitle && <Text className='xiaoyue-empty-state__subtitle'>{subtitle}</Text>}
      {actionLabel && onAction && (
        <View
          className={classNames(
            'xiaoyue-empty-state__action',
            isActionDisabled && 'xiaoyue-empty-state__action--disabled'
          )}
          hoverClass='xiaoyue-empty-state__action--active'
          hoverStayTime={100}
          onClick={isActionDisabled ? undefined : onAction}
          role='button'
          aria-label={loading && loadingLabel ? loadingLabel : actionLabel}
          aria-disabled={isActionDisabled}
        >
          {loading && <View className='xiaoyue-empty-state__action-spinner' aria-hidden='true' />}
          <Text className='xiaoyue-empty-state__action-text'>
            {loading && loadingLabel ? loadingLabel : actionLabel}
          </Text>
        </View>
      )}
    </View>
  )
}
