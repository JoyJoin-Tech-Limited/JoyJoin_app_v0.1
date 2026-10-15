import { View, Text } from '@tarojs/components'

export interface InsightShareEntryProps {
  /** AC-01 visibility matrix result — renders nothing when false. */
  visible: boolean
  /** Generation in flight: disabled + busy indicator. */
  isGenerating: boolean
  /** Reduced-motion: kills the busy indicator's pulse. */
  reduceMotion?: boolean
  onPress: () => void
  className?: string
}

/**
 * InsightShareEntry — quiet 「存下这张卡」 entry for the insight share poster
 * (sprint insight-share-poster, AC-01). Zero reward/incentive wording; the
 * tap is a plain action, not a conversion nudge.
 *
 * No hooks in this component, so the early return is safe.
 * Styling note (subpackage trap): no SCSS side-effect import — the page SCSS
 * `@use`s `InsightShareEntry.scss`.
 */
export default function InsightShareEntry({
  visible,
  isGenerating,
  reduceMotion = false,
  onPress,
  className = '',
}: InsightShareEntryProps) {
  if (!visible) {
    return null
  }

  const rootClass = [
    'insight-share-entry',
    reduceMotion ? 'insight-share-entry--reduced-motion' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={rootClass}>
      <View
        className={`insight-share-entry__button${isGenerating ? ' insight-share-entry__button--busy' : ''}`}
        onClick={isGenerating ? undefined : onPress}
        hoverClass={isGenerating ? undefined : 'insight-share-entry__button--pressed'}
        role='button'
        aria-disabled={isGenerating}
        aria-label={isGenerating ? '正在生成卡片' : '存下这张卡'}
      >
        <Text className='insight-share-entry__text'>
          {isGenerating ? '正在生成…' : '存下这张卡'}
        </Text>
      </View>
    </View>
  )
}
