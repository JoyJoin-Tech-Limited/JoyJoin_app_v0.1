import { Image, Text, View } from '@tarojs/components'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import Card from '../../../../components/ui/Card'
import {
  getArchetypeVisual,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'
import { ARCHETYPE_SEQUENCE, type SlotPhase } from './resultHelpers'
import ArchetypeSpritesheet from './ArchetypeSpritesheet'
import ArchetypeRevealStrip from './ArchetypeRevealStrip'
import ParticleBurst from '../../../../components/reveal/ParticleBurst'
import { haptics } from '../../../../lib/utils/haptics'
import type { DegradationTier } from '../../../../lib/utils/frameBudget'

/* ── constants ─────────────────────────────────────────────────────── */
const CARD_HEIGHT = 184 // rpx
const GAP = 16 // rpx — matches $spacing-sm
const STEP = CARD_HEIGHT + GAP // 200 rpx
const VIEWPORT_CARDS = 3
const VIEWPORT_HEIGHT = VIEWPORT_CARDS * STEP // 600 rpx
const CENTER_OFFSET = (VIEWPORT_HEIGHT - CARD_HEIGHT) / 2 // 208 rpx
const EXTENDED_COUNT = 24 // 2 cycles — enough for ~20 steps without snap
const SNAP_THRESHOLD = EXTENDED_COUNT - 8 // 16
const SNAP_BACK = ARCHETYPE_SEQUENCE.length // 12

interface SlotStageProps {
  reelIndex: number
  slotPhase: SlotPhase
  isSlowNetwork: boolean
  progress: number
  phaseText?: string
  /** Gates landed celebration effects (slice 5, 2026-07-19): full = flash + particles, reduced = flash only, minimal/emergency = CSS rings only. */
  celebrationTier?: DegradationTier
  /** Phase 3 (2026-08-01): rare-variant easter egg — highly typical match
   *  (典型 + high confidence) upgrades the land moment to the 闪光 treatment. */
  isRareVariant?: boolean
}

/* ── memoised card row (prevents 47 re-renders every tick) ─────────── */
interface SlotCardProps {
  archetype: string
  index: number
  displayIndex: number
  slotPhase: SlotPhase
  /** Gates the animated reveal strip on the landed card (full/reduced only). */
  celebrationTier: DegradationTier
}

const SlotCard = memo(function SlotCard({
  archetype,
  index,
  displayIndex,
  slotPhase,
  celebrationTier,
}: SlotCardProps) {
  const isActive = index === displayIndex
  const itemVisual = useMemo(() => getArchetypeVisual(archetype), [archetype])
  const isLanded = slotPhase === 'landed'
  const isSlowing = slotPhase === 'slowing'
  const isNearMiss = slotPhase === 'nearMiss'

  /* Phase 2b (2026-08-01): landed active card plays the animated reveal strip
     when the tier allows; minimal/emergency keep the static spritesheet. The
     strip component itself falls back to the static sheet when no strip asset
     exists for the archetype yet. */
  const useRevealStrip = isActive && isLanded
    && (celebrationTier === 'full' || celebrationTier === 'reduced')

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
      {useRevealStrip ? (
        <ArchetypeRevealStrip
          archetype={archetype}
          className='personality-results__slot-image'
          fallbackColor={itemVisual.accentSoft}
          playing
        />
      ) : (
        <ArchetypeSpritesheet
          archetype={archetype}
          className='personality-results__slot-image'
          fallbackColor={itemVisual.accentSoft}
        />
      )}
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
  if (prev.celebrationTier !== next.celebrationTier) return false
  return true
})

/* ── main component ────────────────────────────────────────────────── */
export default function SlotStage({
  reelIndex,
  slotPhase,
  isSlowNetwork,
  progress,
  phaseText,
  celebrationTier = 'full',
  isRareVariant = false,
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
  const progressScale = Math.min(100, Math.max(progress, 4)) / 100

  const isLanded = slotPhase === 'landed'
  const isAnticipation = slotPhase === 'anticipation'
  const showFlash = isLanded && (celebrationTier === 'full' || celebrationTier === 'reduced')
  const showBurst = isLanded && celebrationTier === 'full'

  /* Phase 2a (2026-08-01): CSS-only anticipation micro-motion + light-chase.
     Tier-gated to reduced-or-better (transforms/opacity only, compositor-safe);
     minimal/emergency and OS reduced-motion suppress via the class guards below. */
  const tierAllowsChoreography = celebrationTier === 'full' || celebrationTier === 'reduced'
  const showAnticipationMotion = isAnticipation && tierAllowsChoreography
  const showLightChase =
    (slotPhase === 'spinning' || slotPhase === 'holding' || slotPhase === 'slowing') &&
    tierAllowsChoreography

  const slotAriaLabel = isAnticipation
    ? '命格卡面即将开始转动'
    : isLanded
      ? `命格卡面已锁定：${ARCHETYPE_BY_ID[activeArchetype]?.nameCn ?? activeArchetype}`
      : slotPhase === 'spinning'
        ? '命格卡面正在转动中'
        : slotPhase === 'slowing'
          ? '命格卡面正在减速，即将锁定'
          : '命格卡面揭晓中'

  return (
    <View className='personality-results__immersive-shell' role='status' aria-live='polite' aria-label={slotAriaLabel}>
      <Text className='personality-results__immersive-eyebrow'>JoyJoin 原型揭晓</Text>
      <Text className='personality-results__immersive-title'>你的答案正在凝成命格卡</Text>
      <Text className='personality-results__immersive-copy'>
        你写下的每个选择，都在锁定真正属于你的那一张牌。
      </Text>

      {/* ── slot machine frame ── */}
      <View
        className={`personality-results__slot-frame${isAnticipation ? ' personality-results__slot-frame--anticipation' : ''}${isLanded ? ' personality-results__slot-frame--landed' : ''}${isLanded && isRareVariant ? ' personality-results__slot-frame--rare' : ''}`}
      >
        <View className='personality-results__slot-rail' />
        <View className='personality-results__slot-highlight' />

        {/* Phase 2a: light-chase comet orbiting the frame during spin/slow (tier-gated) */}
        {showLightChase && (
          <View className='personality-results__slot-chase' aria-hidden='true'>
            <View className='personality-results__slot-chase-orbit'>
              <View className='personality-results__slot-chase-comet' />
            </View>
          </View>
        )}

        {/* white flash on landed (storyboard Act 5, slice 5) */}
        {showFlash && <View className={`personality-results__slot-flash${isRareVariant ? ' personality-results__slot-flash--rare' : ''}`} />}

        {/* gold burst ring on landed */}
        {isLanded && <View className='personality-results__slot-gold-ring' />}

        {/* Phase 3 rare variant: 闪光 sparkle star overlay on landed */}
        {isLanded && isRareVariant && tierAllowsChoreography && (
          <View className='personality-results__slot-sparkle' aria-hidden='true'>
            <View className='personality-results__slot-sparkle-star' />
            <View className='personality-results__slot-sparkle-star personality-results__slot-sparkle-star--b' />
            <View className='personality-results__slot-sparkle-star personality-results__slot-sparkle-star--c' />
          </View>
        )}

        {/* scrolling viewport (shudder lives here — the track's inline translateY
            must stay the single transform authority on the track itself) */}
        <View
          className={`personality-results__slot-viewport${showAnticipationMotion ? ' personality-results__slot-viewport--shudder' : ''}`}
        >
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
                celebrationTier={celebrationTier}
              />
            ))}
          </View>
        </View>

        {/* particle burst on landed (storyboard Act 6, slice 5 — full tier only; ParticleBurst self-handles reduced-motion) */}
        {showBurst && (
          <View className='personality-results__slot-burst'>
            <ParticleBurst
              trigger={isLanded}
              type={isRareVariant ? 'coins' : 'confetti'}
              count={40}
              spotlightColor={slotFocusVisual.accent}
            />
          </View>
        )}

        {/* particle burst rings on landed (rare variant: all-gold rings) */}
        {isLanded && (
          <View className='personality-results__burst-rings'>
            <View className={`personality-results__burst-ring${isRareVariant ? ' personality-results__burst-ring--rare' : ''}`} />
            <View className='personality-results__burst-ring personality-results__burst-ring--gold' />
            <View className={`personality-results__burst-ring ${isRareVariant ? 'personality-results__burst-ring--rare-b' : 'personality-results__burst-ring--pink'}`} />
          </View>
        )}
      </View>

      {/* ── progress bar ── */}
      <View className='personality-results__progress-track'>
        <View
          className={`personality-results__progress-fill${isLanded ? ' personality-results__progress-fill--landed' : ''}`}
          style={{
            transform: `scaleX(${progressScale})`,
            transformOrigin: 'left center',
            background: isLanded ? '#facc15' : slotFocusVisual.accent,
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
              网络慢一点没关系，动画会一直播到结果出来~
            </Text>
          </View>
        </Card>
      ) : null}
    </View>
  )
}
