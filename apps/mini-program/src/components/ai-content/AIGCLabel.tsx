import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import {
  type AIGCMeta,
  AIGC_LABEL_COPY,
  resolveAIGCLabelVariant,
  shouldShowAIGCLabel,
} from '@joyjoin/shared/api'
import { useAuth } from '../../hooks/useAuth'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import './AIGCLabel.scss'

export interface AIGCLabelProps {
  /** AIGC metadata from the AI service response. */
  meta?: AIGCMeta
  /** Optional override for the feature flag. When undefined, reads from auth. */
  enabled?: boolean
  /** Optional CSS class additions. */
  className?: string
  /** Optional inline style. */
  style?: React.CSSProperties
  /** When true, disables entrance animation. */
  reduceMotion?: boolean
}

/**
 * AIGCLabel — small, unobtrusive disclosure tag for AI-generated content.
 *
 * Renders only when the AIGC_LABELS_ENABLED feature flag is true and the
 * content meta indicates AI-generated content. Uses "AI 辅助生成" only when
 * meta.labelType is 'ai-assisted'.
 *
 * Copy rule: primary label is "AI 生成内容"; secondary label is allowed only
 * for AI-augmented user content.
 */
export default function AIGCLabel({
  meta,
  enabled,
  className = '',
  style,
  reduceMotion,
}: AIGCLabelProps) {
  const { user } = useAuth()
  const deviceTier = useDeviceTier()
  const isFlagEnabled = enabled ?? user?.features?.aigcLabelsEnabled ?? false

  const isVisible = useMemo(() => {
    if (!isFlagEnabled) return false
    return shouldShowAIGCLabel(meta)
  }, [isFlagEnabled, meta])

  const label = useMemo(() => {
    const variant = resolveAIGCLabelVariant(meta)
    return AIGC_LABEL_COPY[variant]
  }, [meta])

  const motionEnabled = useMemo(() => {
    if (reduceMotion) return false
    if (deviceTier.isDegradation) return false
    return !getSystemReducedMotion()
  }, [reduceMotion, deviceTier.isDegradation])

  if (!isVisible) return null

  const classes = [
    'aigc-label',
    motionEnabled ? 'aigc-label--motion' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <View className={classes} style={style} aria-label={label} role='note'>
      <Text className='aigc-label__text'>{label}</Text>
    </View>
  )
}
