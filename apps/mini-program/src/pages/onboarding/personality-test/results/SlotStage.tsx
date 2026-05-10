import { Image, Text, View } from '@tarojs/components'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Card from '../../../../components/ui/Card'
import { COLOR_PRIMARY } from '../../../../lib/utils/uiConstants'
import {
  getArchetypeVisual,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'
import { ARCHETYPE_SEQUENCE, type SlotPhase } from './resultHelpers'
import ArchetypeSpritesheet from './ArchetypeSpritesheet'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { haptics } from '../../../../lib/utils/haptics'

/* ── constants ─────────────────────────────────────────────────────── */
const CARD_HEIGHT = 184 // rpx
const GAP = 16 // rpx — matches $spacing-sm
const STEP = CARD_HEIGHT + GAP // 200 rpx
const VIEWPORT_CARDS = 3
const VIEWPORT_HEIGHT = VIEWPORT_CARDS * STEP // 600 rpx
const CENTER_OFFSET = (VIEWPORT_HEIGHT - CARD_HEIGHT) / 2 // 208 rpx
const EXTENDED_COUNT = 48 // 4 full cycles — enough for ~40 steps without snap
const SNAP_THRESHOLD = EXTENDED_COUNT - 8 // 40
const SNAP_BACK = ARCHETYPE_SEQUENCE.length // 12

interface SlotStageProps {
  reelIndex: number
  slotPhase: SlotPhase
  isSlowNetwork: boolean
  progress: number
  phaseText?: string
}

/* ── memoised card row (prevents 47 re-renders every tick) ─────────── */
interface SlotCardProps {
  archetype: string
  index: number
  displayIndex: number
  slotPhase: SlotPhase
}

const SlotCard = memo(function SlotCard({
  archetype,
  index,
  displayIndex,
  slotPhase,
}: SlotCardProps) {
  const isActive = index === displayIndex
  const itemVisual = useMemo(() => getArchetypeVisual(archetype), [archetype])
  const isLanded = slotPhase === 'landed'
  const isSlowing = slotPhase === 'slowing'
  const isNearMiss = slotPhase === 'nearMiss'

  const activeStyle =
    isActive && (isLanded || isSlowing || isNearMiss)
      ? {
          background: itemVisual.accentSurface,
          borderColor: itemVisual.accentBorder,
          boxShadow: `0 18rpx 48rpx ${itemVisual.accentGlow}`,
        }
      : undefined

  return (
    <View
      key={`${archetype}-${index}`}
      className={`personality-results__slot-card personality-results__slot-card--${slotPhase}${isActive ? ' personality-results__slot-card--active' : ''}`}
      style={activeStyle}
    >
      <ArchetypeSpritesheet
        archetype={archetype}
        className='personality-results__slot-image'
      />
      <Text className='personality-results__slot-name'>
        {ARCHETYPE_BY_ID[archetype]?.nameCn ?? archetype}
      </Text>
    </View>
  )
}, (prev, next) => {
  /* skip re-render for non-active cards when only displayIndex changed */
  const wasActive = prev.index === prev.displayIndex
  const isActive = next.index === next.displayIndex
  if (wasActive !== isActive) return false
  if (prev.archetype !== next.archetype) return false
  if (prev.slotPhase !== next.slotPhase) return false
  return true
})

/* ── main component ────────────────────────────────────────────────── */
export default function SlotStage({
  reelIndex,
  slotPhase,
  isSlowNetwork,
  progress,
  phaseText,
}: SlotStageProps) {
  /* internal unbounded track position */
  const [displayIndex, setDisplayIndex] = useState(reelIndex)
  const [snapTick, setSnapTick] = useState(0)
  const prevReelRef = useRef(reelIndex)
  const prevPhaseRef = useRef<SlotPhase | ''>('')

  /* reset track when a fresh animation sequence starts */
  useEffect(() => {
    if (slotPhase === 'anticipation' && prevPhaseRef.current !== 'anticipation') {
      setDisplayIndex(reelIndex)
      prevReelRef.current = reelIndex
      setSnapTick(0)
    }
    prevPhaseRef.current = slotPhase
  }, [slotPhase, reelIndex])

  /* advance displayIndex as reelIndex changes */
  useEffect(() => {
    const moving =
      slotPhase === 'spinning' ||
      slotPhase === 'holding' ||
      slotPhase === 'slowing' ||
      slotPhase === 'nearMiss'
    if (!moving) return

    const prev = prevReelRef.current
    let diff = reelIndex - prev
    /* handle modulo wrap-around */
    if (diff < -6) diff += 12
    if (diff > 6) diff -= 12

    if (diff !== 0) {
      setDisplayIndex((current) => {
        const next = current + diff
        if (next >= SNAP_THRESHOLD) {
          /* snap back by one full cycle — invisible because cards repeat */
          setSnapTick((t) => t + 1)
          return next - SNAP_BACK
        }
        return next
      })
      prevReelRef.current = reelIndex
    }
  }, [reelIndex, slotPhase])

  /* re-enable CSS transition after a snap */
  useEffect(() => {
    if (snapTick > 0) {
      const t = setTimeout(() => setSnapTick(0), 50)
      return () => clearTimeout(t)
    }
  }, [snapTick])

  /* haptic feedback on land — single most emotional moment */
  useEffect(() => {
    if (slotPhase === 'landed') {
      haptics('slotLand')
    }
  }, [slotPhase])

  /* extended archetype list (4 cycles) */
  const extendedArchetypes = useMemo(
    () => Array.from({ length: EXTENDED_COUNT }, (_, i) => ARCHETYPE_SEQUENCE[i % 12]),
    [],
  )

  /* visual for the currently-centred archetype */
  const activeArchetype = extendedArchetypes[displayIndex] ?? ARCHETYPE_SEQUENCE[0]
  const slotFocusVisual = useMemo(() => getArchetypeVisual(activeArchetype), [activeArchetype])

  const translateY = CENTER_OFFSET - displayIndex * STEP
  const progressWidth = `${Math.min(100, Math.max(progress, 4))}%`

  const isLanded = slotPhase === 'landed'
  const isAnticipation = slotPhase === 'anticipation'

  return (
    <View className='personality-results__immersive-shell'>
      <Text className='personality-results__immersive-eyebrow'>JoyJoin 原型揭晓</Text>
      <Text className='personality-results__immersive-title'>你的社交卡面正在靠近</Text>
      <Text className='personality-results__immersive-copy'>
        先让命运转几圈，再锁定真正属于你的那一张牌。
      </Text>

      {/* ── slot machine frame ── */}
      <View
        className={`personality-results__slot-frame${isAnticipation ? ' personality-results__slot-frame--anticipation' : ''}${isLanded ? ' personality-results__slot-frame--landed' : ''}`}
      >
        <View className='personality-results__slot-rail' />
        <View className='personality-results__slot-highlight' />

        {/* gold burst ring on landed */}
        {isLanded && <View className='personality-results__slot-gold-ring' />}

        {/* scrolling viewport */}
        <View className='personality-results__slot-viewport'>
          <View
            className={`personality-results__slot-track personality-results__slot-track--${slotPhase}${snapTick > 0 ? ' personality-results__slot-track--snap' : ''}`}
            style={{ transform: `translateY(${translateY}rpx)` }}
          >
            {extendedArchetypes.map((archetype, index) => (
              <SlotCard
                key={`${archetype}-${index}`}
                archetype={archetype}
                index={index}
                displayIndex={displayIndex}
                slotPhase={slotPhase}
              />
            ))}
          </View>
        </View>

        {/* particle burst rings on landed */}
        {isLanded && (
          <View className='personality-results__burst-rings'>
            <View className='personality-results__burst-ring' />
            <View className='personality-results__burst-ring personality-results__burst-ring--gold' />
            <View className='personality-results__burst-ring personality-results__burst-ring--pink' />
          </View>
        )}
      </View>

      {/* ── progress bar ── */}
      <View className='personality-results__progress-track'>
        <View
          className={`personality-results__progress-fill${isLanded ? ' personality-results__progress-fill--landed' : ''}`}
          style={{
            width: progressWidth,
            background: isLanded ? '#facc15' : slotFocusVisual.accent || COLOR_PRIMARY,
          }}
        />
      </View>
      <Text className='personality-results__progress-copy'>
        {phaseText || '正在准备最终揭晓...'}
      </Text>

      {/* ── network holding card ── */}
      {(slotPhase === 'holding' || isSlowNetwork) ? (
        <Card className='personality-results__network-card'>
          <Image
            className='personality-results__network-xiaoyue'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.networkHolding)}
          />
          <View className='personality-results__network-copy'>
            <Text className='personality-results__network-title'>{`${DEFAULT_MASCOT_DISPLAY_NAME}还在等最后一条同步`}</Text>
            <Text className='personality-results__network-text'>
              网络有点慢也没关系，动画会继续转到结果真正到位为止。
            </Text>
          </View>
        </Card>
      ) : null}
    </View>
  )
}
