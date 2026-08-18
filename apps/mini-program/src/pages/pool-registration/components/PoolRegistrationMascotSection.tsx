import { Image, Text, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import XiaoyueSpriteAnimator, { type XiaoyueSpriteState } from '../../../components/mascot/XiaoyueSpriteAnimator'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { MASCOT_SIZE } from '../../../lib/mascot/mascotSizes'
import { cdnAsset } from '../../../lib/utils/cdnAssets'

/**
 * Reduced-motion portrait fallback per step base state (CDN-primary; the
 * section hides the mascot wrap entirely if the portrait cannot load).
 *
 * Lovart Xiaoyue portrait set v1 (2026-08-05): coach / curious / listening.
 * Masters live in `assets-source/lovart/xiaoyue-portraits/`; shipped WebP in
 * `src/assets/personality/xiaoyue/`.
 */
const PORTRAIT_URL_BY_SPRITE_STATE: Partial<Record<XiaoyueSpriteState, string>> = {
  coach: cdnAsset('/assets/personality/xiaoyue/lovart-mascot-xiaoyue-coach-20260805-v1.webp'),
  curious: cdnAsset('/assets/personality/xiaoyue/lovart-mascot-xiaoyue-curious-20260805-v1.webp'),
  listening: cdnAsset('/assets/personality/xiaoyue/lovart-mascot-xiaoyue-listening-20260805-v1.webp'),
}

const BUBBLE_SWAP_OUT_MS = 120
const NOD_HOLD_MS = 600
const ENTRY_MS = 300

export interface PoolRegistrationMascotSectionProps {
  /** Active step (1 = budget, 2 = intent + collapsed details section) */
  step: number
  /** Per-step base sprite state (coach / curious / listening) */
  spriteState: XiaoyueSpriteState
  /** Bubble text — intro line or (while reacting) the reaction line */
  bubbleContent: string
  /** True while the one-shot nod reaction is playing */
  reacting: boolean
  visible?: boolean
  reduceMotion?: boolean
  /** Fired when the nod reaction completes (or the reduced-motion hold ends) */
  onNodComplete?: () => void
}

/**
 * PoolRegistrationMascotSection — the single 悦仔 mascot row shown directly
 * above Steps 1–2 content: mascot-left (160rpx animated sprite) + speech
 * bubble-right (max 520rpx, radius 24rpx, left tail).
 *
 * The section owns its sprite-state machine:
 * - Step enter (forward nav): one-shot mascot pop + bubble rise; back nav
 *   restores the previous step's base state with no entry replay.
 * - Selection reaction: parent sets `reacting` → one-shot `nod` (manifest
 *   duration ~900ms) + bubble swap (old out 120ms, new in 160ms); the nod's
 *   onComplete clears the reaction.
 * - Idle: breathing only (translateY 0 → -4rpx, 2.4s alternate), transform /
 *   opacity only.
 * - Reduced / degraded motion: static portrait expressions (180rpx), no
 *   breathing, no entry or swap animation — content swaps still happen.
 */
export default function PoolRegistrationMascotSection({
  step,
  spriteState,
  bubbleContent,
  reacting,
  visible = true,
  reduceMotion = false,
  onNodComplete,
}: PoolRegistrationMascotSectionProps) {
  const { isDegradation } = useDeviceTier()
  const motionDisabled = reduceMotion || isDegradation

  const onNodCompleteRef = useRef(onNodComplete)
  useEffect(() => {
    onNodCompleteRef.current = onNodComplete
  }, [onNodComplete])

  // Entry tone: forward step navigation plays a one-shot pop + rise; back
  // navigation restores the previous state without replaying entry motion.
  const prevStepRef = useRef<number | null>(null)
  const entryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [entryTone, setEntryTone] = useState<'enter' | 'restore' | null>(null)

  useEffect(() => {
    const forward = prevStepRef.current === null || step > prevStepRef.current
    prevStepRef.current = step
    if (!visible || motionDisabled || !forward) {
      setEntryTone(null)
      return
    }
    setEntryTone('enter')
    if (entryTimerRef.current) clearTimeout(entryTimerRef.current)
    entryTimerRef.current = setTimeout(() => setEntryTone(null), ENTRY_MS)
    return () => {
      if (entryTimerRef.current) clearTimeout(entryTimerRef.current)
    }
  }, [step, visible, motionDisabled])

  // Bubble swap: old content fades out (120ms), new content pops in (160ms).
  // Last-write-wins — a rapid content change cancels the pending swap.
  const displayedContentRef = useRef(bubbleContent)
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [displayedContent, setDisplayedContent] = useState(bubbleContent)
  const [bubblePhase, setBubblePhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    if (bubbleContent === displayedContentRef.current) return
    displayedContentRef.current = bubbleContent
    if (motionDisabled) {
      setDisplayedContent(bubbleContent)
      setBubblePhase('in')
      return
    }
    setBubblePhase('out')
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current)
    swapTimerRef.current = setTimeout(() => {
      setDisplayedContent(bubbleContent)
      setBubblePhase('in')
    }, BUBBLE_SWAP_OUT_MS)
    return () => {
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current)
    }
  }, [bubbleContent, motionDisabled])

  // Reduced / degraded motion: no nod animation — hold the reaction bubble
  // briefly so it stays readable, then signal completion so the parent can
  // restore the intro line. Mirrors XiaoyueSpriteAnimator's own motion gate.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!reacting || !motionDisabled) return
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => onNodCompleteRef.current?.(), NOD_HOLD_MS)
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [reacting, motionDisabled])

  const [portraitFailed, setPortraitFailed] = useState(false)
  useEffect(() => {
    setPortraitFailed(false)
  }, [spriteState])

  const effectiveSpriteState: XiaoyueSpriteState = reacting && !motionDisabled ? 'nod' : spriteState
  const portraitUrl = PORTRAIT_URL_BY_SPRITE_STATE[spriteState] ?? PORTRAIT_URL_BY_SPRITE_STATE.coach ?? ''

  const rootClass = [
    'pool-reg-mascot',
    visible ? '' : 'pool-reg-mascot--hidden',
    entryTone === 'enter' ? 'pool-reg-mascot--enter' : '',
    // Kill the breathing wrapper in reduced/degraded motion — the CSS media
    // query alone is unreliable in the WeChat runtime (2026-08-05 audit P0-1).
    motionDisabled ? 'pool-reg-mascot--motion-off' : '',
    portraitFailed ? 'pool-reg-mascot--no-mascot' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={rootClass}>
      <View className={['pool-reg-mascot__mascot-wrap', portraitFailed ? 'pool-reg-mascot__mascot-wrap--collapsed' : ''].filter(Boolean).join(' ')} aria-hidden='true'>
        {motionDisabled ? (
          portraitFailed ? null : (
            <Image
              className='pool-reg-mascot__portrait'
              mode='aspectFit'
              src={portraitUrl}
              onError={() => setPortraitFailed(true)}
            />
          )
        ) : (
          <XiaoyueSpriteAnimator
            state={effectiveSpriteState}
            size={MASCOT_SIZE.md}
            autoPlay={visible}
            onComplete={() => onNodCompleteRef.current?.()}
          />
        )}
      </View>
      <View
        className={[
          'pool-reg-mascot__bubble',
          'pool-reg-mascot__bubble--tail',
          bubblePhase === 'out' ? 'pool-reg-mascot__bubble--out' : '',
          entryTone === 'enter' ? 'pool-reg-mascot__bubble--enter' : '',
          portraitFailed ? 'pool-reg-mascot__bubble--full' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role='status'
        aria-live='polite'
        aria-atomic='true'
      >
        <Text key={displayedContent} className='pool-reg-mascot__bubble-text'>
          {displayedContent}
        </Text>
      </View>
    </View>
  )
}
