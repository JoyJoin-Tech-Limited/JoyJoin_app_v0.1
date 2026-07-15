import { Image, Text, View } from '@tarojs/components'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import MissingArchetypePlaceholder from '../../components/mascot/MissingArchetypePlaceholder'
import { haptics } from '../../lib/utils/haptics'
import { buildDeckPillAriaLabel, type DeckPillStripItem, type DeckPillStripModel } from './squadUnboxingViewModels'

/**
 * "Pocket the deck" floating pill (sprint-contract.squad-unboxing-pocket-deck-20260715).
 *
 * Rendered at the PAGE ROOT (position: fixed — CSS sticky is WeChat-fragile
 * inside <ScrollView>). Shows the pocketed deck as a mini strip: face-up
 * members render avatar/archetype minis, face-down members render card-back
 * chips (spoiler gating), the 最佳拍档 keeps its gold tint ring, and overflow
 * rosters collapse into a +N chip.
 *
 * Re-fan is reversible two ways (AC-04): a pull-down drag scoped to the pill
 * (vertical threshold, catchMove during the drag so it never collides with
 * WeChat pull-to-refresh) and a plain tap (accessible fallback).
 */

/**
 * Vertical pull distance (px) that triggers the re-fan. Touch coordinates
 * are px (not rpx); 48px ≈ 96rpx on a 2× device — a deliberate grab, not an
 * accidental brush.
 */
const PULL_DOWN_THRESHOLD_PX = 48

/** Mini avatar / card-back chip inside the pill strip. Owns its image-error fallback. */
function DeckPillMini({ item }: { item: DeckPillStripItem }) {
  const { member, faceUp, isBestPartner, isCurrentUser } = item
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [member.avatarUrl, member.archetype])

  const archetypeId = member.archetype ? resolveArchetype(member.archetype)?.id ?? null : null
  const archetypeUrl = archetypeId ? ARCHETYPE_ASSET_MAP[archetypeId]?.webp : undefined
  const imageUrl = member.avatarUrl ?? archetypeUrl
  const name = member.displayName || '匿名'

  const className = [
    'squad-unboxing__deck-pill-mini',
    isBestPartner ? 'squad-unboxing__deck-pill-mini--best-partner' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Spoiler gating (AC-03): face-down members render a mini card-back chip —
  // never an avatar, never a name.
  if (!faceUp) {
    return (
      <View className={`${className} squad-unboxing__deck-pill-mini--back`} aria-hidden='true'>
        <Image
          className='squad-unboxing__deck-pill-mini-back-logo'
          src='/assets/joyjoin-logo-tab.png'
          mode='aspectFit'
          lazyLoad={false}
          aria-hidden='true'
        />
      </View>
    )
  }

  const ariaLabel = [name, isCurrentUser ? '我' : '', isBestPartner ? '最佳拍档' : '']
    .filter(Boolean)
    .join('，')

  return (
    <View className={className} aria-label={ariaLabel}>
      {imageUrl && !imageFailed ? (
        <Image
          className='squad-unboxing__deck-pill-mini-img'
          src={imageUrl}
          mode='aspectFill'
          lazyLoad={false}
          onError={() => setImageFailed(true)}
          aria-hidden='true'
        />
      ) : (
        <MissingArchetypePlaceholder size={56} className='squad-unboxing__deck-pill-mini-placeholder' />
      )}
    </View>
  )
}

export interface DeckCollapsePillProps {
  /** Strip model from buildDeckPillStripModel (cap-5 + overflow + total). */
  model: DeckPillStripModel
  /** Chemistry tint modifier class (getDeckPillChemistryClass). */
  chemistryClassName: string
  /** Unfold phase: the pill fades/scales out while the deck re-fans. */
  leaving: boolean
  reduceMotion: boolean
  isDegradation: boolean
  /** Fired by BOTH the pull-down drag and the tap fallback. */
  onReopen: () => void
}

export default function DeckCollapsePill({
  model,
  chemistryClassName,
  leaving,
  reduceMotion,
  isDegradation,
  onReopen,
}: DeckCollapsePillProps) {
  const instant = reduceMotion || isDegradation
  const touchRef = useRef<{ startY: number; startX: number; maxDy: number } | null>(null)
  const [dragDy, setDragDy] = useState<number | null>(null)
  const isDragging = dragDy !== null

  const handleTouchStart = useCallback(
    (event: any) => {
      if (leaving) return
      const touch = event.touches?.[0]
      if (!touch) return
      touchRef.current = { startY: touch.clientY, startX: touch.clientX, maxDy: 0 }
      setDragDy(0)
    },
    [leaving],
  )

  const handleTouchMove = useCallback(
    (event: any) => {
      const start = touchRef.current
      if (!start || leaving) return
      const touch = event.touches?.[0]
      if (!touch) return
      const dy = touch.clientY - start.startY
      const dx = touch.clientX - start.startX
      // Vertical-intent recognizer: horizontal scrolling must not arm the pull.
      if (dy > 0 && dy > Math.abs(dx) * 0.6) {
        start.maxDy = Math.max(start.maxDy, dy)
        // Cap the visual follow so the pill never chases the finger off-screen.
        setDragDy(Math.min(dy, PULL_DOWN_THRESHOLD_PX * 1.6))
      }
    },
    [leaving],
  )

  const handleTouchEnd = useCallback(() => {
    const start = touchRef.current
    touchRef.current = null
    setDragDy(null)
    if (!start || leaving) return
    if (start.maxDy >= PULL_DOWN_THRESHOLD_PX) {
      if (!instant) haptics('light')
      onReopen()
    }
  }, [leaving, instant, onReopen])

  const handleTap = useCallback(() => {
    if (leaving) return
    haptics('light')
    onReopen()
  }, [leaving, onReopen])

  const className = [
    'squad-unboxing__deck-pill',
    chemistryClassName,
    leaving ? 'squad-unboxing__deck-pill--leaving' : '',
    instant ? 'squad-unboxing__deck-pill--instant' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Drag feedback: follow the finger with px precision (inline px is safe —
  // the H5 postcss rule covers inline rpx/deg, not px). While dragging, the
  // transition is pinned to 0ms so the pill tracks 1:1; release re-enables
  // the spring-back transition. translateX(-50%) is part of the resting pose
  // and must be restated inline whenever a transform is set.
  const dragStyle =
    dragDy !== null
      ? { transform: `translateX(-50%) translateY(${dragDy}px)`, transitionDuration: '0ms' }
      : undefined

  return (
    <View
      className={className}
      style={dragStyle}
      catchMove={isDragging}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
      hoverClass='squad-unboxing__deck-pill--pressed'
      role='button'
      aria-label={buildDeckPillAriaLabel(model.totalCount)}
    >
      <View className='squad-unboxing__deck-pill-strip'>
        {model.items.map((item) => (
          <DeckPillMini key={item.member.userId} item={item} />
        ))}
        {model.overflowCount > 0 ? (
          <View className='squad-unboxing__deck-pill-overflow' aria-hidden='true'>
            <Text className='squad-unboxing__deck-pill-overflow-text'>+{model.overflowCount}</Text>
          </View>
        ) : null}
      </View>
      {/* Pull-down affordance: a small chevron cueing the drag gesture. */}
      <View className='squad-unboxing__deck-pill-chevron' aria-hidden='true' />
    </View>
  )
}
