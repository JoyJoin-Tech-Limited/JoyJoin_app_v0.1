import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './IdentityReveal.scss'

function prefersReducedMotion(): boolean {
  try {
    const info = Taro.getSystemInfoSync()
    if ((info as any).reduceMotion) return true
  } catch {
    // ignore
  }
  return false
}

const REDUCED_MOTION = prefersReducedMotion()

export interface IdentityRevealProps {
  /** The identity text to reveal (e.g. "卧底", "平民") */
  identity: string
  /** Optional label above identity (e.g. "你的身份是") */
  label?: string
  /** Whether the identity is currently revealed */
  revealed: boolean
  /** Spotlight tint color (default: brand primary) */
  spotlightColor?: string
  /** Override reduced-motion detection for testing */
  reducedMotion?: boolean
}

/**
 * IdentityReveal — dramatic "who is X" spotlight unveil.
 *
 * Used in undercover_word, auction, group_mirror.
 * Dark overlay with radial-gradient spotlight + identity text scale pop.
 * Reduced motion: static fade-in at 50% overlay opacity.
 */
export default function IdentityReveal({
  identity,
  label = '你的身份是',
  revealed,
  spotlightColor = '#8B5CF6',
  reducedMotion,
}: IdentityRevealProps) {
  const isReduced = reducedMotion ?? REDUCED_MOTION
  return (
    <View
      className={`reveal-identity-reveal${revealed ? ' reveal-identity-reveal--revealed' : ''}${isReduced ? ' reveal-identity-reveal--reduced' : ''}`}
    >
      {/* Dark overlay with expanding radial spotlight */}
      <View
        className='reveal-identity-reveal__overlay'
        style={{
          background: revealed
            ? `radial-gradient(circle at 50% 50%, transparent 0%, transparent 30%, rgba(0,0,0,0.72) 70%)`
            : `radial-gradient(circle at 50% 50%, ${spotlightColor}33 0%, rgba(0,0,0,0.72) 60%)`,
        }}
      />

      {/* Content container */}
      <View className='reveal-identity-reveal__content'>
        {label && (
          <Text className='reveal-identity-reveal__label'>{label}</Text>
        )}
        <Text
          className='reveal-identity-reveal__identity'
          style={{ color: spotlightColor }}
        >
          {identity}
        </Text>
      </View>
    </View>
  )
}
