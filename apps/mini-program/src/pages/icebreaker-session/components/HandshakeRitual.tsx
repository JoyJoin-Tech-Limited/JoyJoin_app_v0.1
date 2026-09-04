import { useEffect, useRef, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import { localAsset } from '../../../lib/utils/cdnAssets'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import {
  GLANCE_L1_WORD_WAITING,
  RITUAL_BEATS,
  RITUAL_BEAT_STEP_MS,
  RITUAL_CTA_START,
  RITUAL_CTA_WAIT,
  RITUAL_WAITING_HINT,
  canOfferToastRitual,
  resolveHandshakeRitualKind,
  type HandshakeRitualKind,
} from '../viewModels/glanceStackModel'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import type { VibeId } from '../../../lib/vibeMapping'

export interface HandshakeRitualProps {
  isHost: boolean
  vibe?: VibeId
  tier?: TierMachineId
  /** Host's single touch — ends the ritual locally and starts the session's
   *  first content. The page fires the first Nudge (S1 grammar) alongside. */
  onStart: () => void
}

/**
 * S8 Handshake Bridge (spec §6, scene-split locked): the session opens with
 * something the group SAYS — one L1 word, one 悦仔 cameo, one host touch; no
 * reading demanded before the group has spoken. The cameo owns the waiting
 * moment and yields at the host tap (locked sequenced handoff): the beat
 * overlay carries no mascot.
 *
 * Ritual kinds: A 齐声倒数 (default) / B 碰杯 (host-selectable on glow/blaze)
 * / C 名字接龙 (深聊 vibe). The beat plays locally on the host device at tap;
 * other devices leave the ritual surface via the poll-observed start signal
 * (group-synchronized beats are S6 scope).
 */
export function HandshakeRitual({ isHost, vibe, tier, onStart }: HandshakeRitualProps) {
  const [hostPickedToast, setHostPickedToast] = useState(false)
  const [deferred, setDeferred] = useState(false)
  const [beatIndex, setBeatIndex] = useState<number | null>(null)
  const [cameoFailed, setCameoFailed] = useState(false)
  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const kind: HandshakeRitualKind = resolveHandshakeRitualKind({
    vibe,
    tier,
    hostSelectedToast: hostPickedToast,
  })
  const beats = RITUAL_BEATS[kind]

  // Beat sequencer: stepped text swaps, then hand off to the warmup flow.
  // All timers cleaned on unmount (page-stack discipline).
  useEffect(() => {
    if (beatIndex === null) return
    if (beatIndex >= beats.length) {
      onStart()
      return
    }
    beatTimerRef.current = setTimeout(() => {
      setBeatIndex((index) => (index === null ? null : index + 1))
    }, RITUAL_BEAT_STEP_MS)
    return () => {
      if (beatTimerRef.current) {
        clearTimeout(beatTimerRef.current)
        beatTimerRef.current = null
      }
    }
  }, [beatIndex, beats.length, onStart])

  const handleStart = () => {
    if (beatIndex !== null) return
    setBeatIndex(0)
  }

  if (beatIndex !== null && beatIndex < beats.length) {
    const beat = beats[beatIndex]
    const isFinalBeat = beatIndex === beats.length - 1
    return (
      <View
        className={`handshake-beat${isFinalBeat ? ' handshake-beat--final' : ''}`}
        catchMove
        role='status'
        aria-label={`齐声倒数：${beat}`}
      >
        <View className='handshake-beat__halo' aria-hidden />
        <View className='handshake-beat__content' key={beatIndex}>
          <Text className='handshake-beat__eyebrow'>一起倒数</Text>
          <Text className='handshake-beat__text'>{beat}</Text>
          <Text className='handshake-beat__label'>准备好，和新朋友说第一句话</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='handshake-ritual'>
      <Image
        className='handshake-ritual__cameo'
        src={cameoFailed ? localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp') : getXiaoyueExpressionAsset('matchWaiting')}
        mode='aspectFit'
        lazyLoad
        onError={() => setCameoFailed(true)}
      />
      <Text className='handshake-ritual__word'>{GLANCE_L1_WORD_WAITING}</Text>
      {!isHost || deferred ? (
        <Text className='handshake-ritual__hint'>{RITUAL_WAITING_HINT}</Text>
      ) : null}
      {isHost ? (
        <View className='handshake-ritual__actions'>
          {deferred ? (
            // 「再等等」defers to the quiet waiting state; the single-touch
            // start stays reachable as a quiet re-entry (never blocked).
            <Text className='handshake-ritual__alt' onClick={handleStart}>
              {RITUAL_CTA_START}
            </Text>
          ) : (
            <>
              <Button variant='primary' className='handshake-ritual__cta' onClick={handleStart}>
                {RITUAL_CTA_START}
              </Button>
              {canOfferToastRitual(tier) && kind !== 'name_relay' ? (
                <Text
                  className='handshake-ritual__alt'
                  onClick={() => setHostPickedToast((picked) => !picked)}
                >
                  {hostPickedToast ? '换成齐声倒数' : '换成碰杯开场'}
                </Text>
              ) : null}
              <Text className='handshake-ritual__ghost' onClick={() => setDeferred(true)}>
                {RITUAL_CTA_WAIT}
              </Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  )
}
