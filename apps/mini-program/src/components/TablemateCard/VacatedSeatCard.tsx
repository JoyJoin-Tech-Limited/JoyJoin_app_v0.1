import { Text, View } from '@tarojs/components'

// Styles are owned by consuming page SCSS (@use './_vacated-seat.scss') so the
// rules co-compile into each surface's page WXSS — same subpackage
// style-splitting discipline as TablemateCard (see
// scripts/verify-subpackage-styles.mjs).

export interface VacatedSeatCardProps {
  reduceMotion?: boolean
}

/**
 * Neutral 「排桌中…」 placeholder for a seat vacated post-reveal (Phase 0
 * 安心补位). Rendered at list level next to TablemateCard in the 桌友 card
 * row/deck where the exited member's card used to be — it carries NO exiter
 * identity (no name, no persona art, no avatar), only the waiting-seat visual
 * language. TablemateCard itself has no seat concept and stays untouched.
 */
export default function VacatedSeatCard({ reduceMotion = false }: VacatedSeatCardProps) {
  return (
    <View
      className={`vacated-seat-card${reduceMotion ? ' vacated-seat-card--reduce-motion' : ''}`}
      aria-label='空出的席位，正在排桌中'
    >
      <View className='vacated-seat-card__core'>
        <Text className='vacated-seat-card__mark'>+</Text>
      </View>
      <Text className='vacated-seat-card__label'>排桌中…</Text>
    </View>
  )
}
