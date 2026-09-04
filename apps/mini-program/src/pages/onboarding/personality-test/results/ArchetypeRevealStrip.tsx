import { Image, View } from '@tarojs/components'
import { memo, useEffect, useRef, useState } from 'react'
import stripManifest from '../../assets/archetype-strips/reveal-strips-manifest.json'
import { cdnAsset } from '../../../../lib/utils/cdnAssets'
import { logWarn } from '../../../../lib/utils/logger'
import ArchetypeSpritesheet from './ArchetypeSpritesheet'

/* ── manifest plumbing ─────────────────────────────────────────────── */

const CDN_BASE = cdnAsset('/assets/personality/archetype-strips')
const LOCAL_BASE = '/pages/onboarding/assets/archetype-strips'

interface RevealStripMeta {
  sheet: string
  frameCount: number
  frameWidth: number
  frameHeight: number
  duration: number
  loop: boolean
  oneShot: boolean
}

function getRevealStripMeta(archetype: string): RevealStripMeta | null {
  const meta = (stripManifest.states as Record<string, RevealStripMeta>)[archetype]
  return meta ?? null
}

/**
 * CDN URL of the landed archetype's reveal strip — used by the results flow
 * to lazily prefetch the sheet as soon as the slot target is known (the only
 * strip ever fetched; zero upfront package/network cost for the other 11).
 * Returns null when no strip exists for the archetype yet.
 */
export function getRevealStripPreloadUrl(archetype: string): string | null {
  const meta = getRevealStripMeta(archetype)
  return meta ? `${CDN_BASE}/${meta.sheet}` : null
}

/* ── component ─────────────────────────────────────────────────────── */

interface ArchetypeRevealStripProps {
  archetype: string
  size?: string
  className?: string
  /** Frames advance only while true; holds the first frame otherwise. */
  playing?: boolean
  fallbackColor?: string
}

/**
 * Phase 2b (2026-08-01): per-archetype animated reveal strip (K3-generated
 * 6–9 frame celebration loop) shown at slot land time instead of the static
 * WebP. Consumed through a JS-driven frame-stepping pattern — CSS @keyframes
 * stepping is unreliable in WeChat.
 *
 * FALLBACK CHAIN (mirrors existing rules):
 *   1. CDN strip sheet (lazy, only the landed archetype's strip fetched)
 *   2. Local bundled strip sheet
 *   3. Static ArchetypeSpritesheet (the split-brain-immune authority)
 *   4. Accent circle (inside ArchetypeSpritesheet)
 *
 * When the manifest has no entry for the archetype (strips not generated
 * yet), the component renders the static spritesheet immediately — this is
 * the default production state until K3 strip assets land on CDN.
 *
 * Tier gating is the caller's job: minimal/emergency never mount this
 * component and keep the static card.
 */
function ArchetypeRevealStrip({
  archetype,
  size = '132rpx',
  className = '',
  playing = true,
  fallbackColor,
}: ArchetypeRevealStripProps) {
  const meta = getRevealStripMeta(archetype)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [src, setSrc] = useState(() => (meta ? `${CDN_BASE}/${meta.sheet}` : ''))
  const [stripFailed, setStripFailed] = useState(false)
  const [localFailed, setLocalFailed] = useState(false)
  const playingRef = useRef(playing)

  useEffect(() => { playingRef.current = playing }, [playing])

  /* reset when the archetype changes */
  useEffect(() => {
    setCurrentFrame(0)
    setStripFailed(false)
    setLocalFailed(false)
    setSrc(meta ? `${CDN_BASE}/${meta.sheet}` : '')
  }, [archetype, meta?.sheet])

  /* JS-driven frame stepping — setInterval, same rationale as the mascot
     animator: CSS keyframes stepping is unreliable in the WeChat runtime. */
  useEffect(() => {
    if (!meta || meta.frameCount <= 1) return
    const frameDuration = Math.max(40, meta.duration / meta.frameCount)
    let frame = 0
    const timer = setInterval(() => {
      if (!playingRef.current) return
      frame += 1
      if (frame >= meta.frameCount) {
        if (meta.loop) {
          frame = 0
        } else {
          clearInterval(timer)
          return
        }
      }
      setCurrentFrame(frame)
    }, frameDuration)
    return () => clearInterval(timer)
  }, [meta?.sheet, meta?.frameCount, meta?.duration, meta?.loop])

  /* No strip for this archetype yet, or every strip source failed —
     degrade to the static spritesheet (the shipped default today). */
  if (!meta || localFailed) {
    return (
      <ArchetypeSpritesheet
        archetype={archetype}
        size={size}
        className={className}
        fallbackColor={fallbackColor}
      />
    )
  }

  const handleImageError = () => {
    if (!stripFailed) {
      logWarn('[ArchetypeRevealStrip] CDN strip failed, trying local fallback', {
        archetype,
        sheet: meta.sheet,
      })
      setStripFailed(true)
      setSrc(`${LOCAL_BASE}/${meta.sheet}`)
    } else {
      logWarn('[ArchetypeRevealStrip] local strip failed, falling back to static spritesheet', {
        archetype,
        sheet: meta.sheet,
      })
      setLocalFailed(true)
    }
  }

  const padding = stripManifest.frame.padding
  const sizeNum = parseInt(size, 10) || 132
  const scale = sizeNum / meta.frameWidth
  const stride = meta.frameWidth + padding * 2
  const sheetWidth = meta.frameCount * stride
  const sheetHeight = meta.frameHeight + padding * 2
  const imgW = Math.round(sheetWidth * scale)
  const imgH = Math.round(sheetHeight * scale)
  const translateX = Math.round(-(currentFrame * stride + padding) * scale)
  const translateY = Math.round(-padding * scale)

  return (
    <View
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <Image
        src={src}
        mode='aspectFill'
        style={{
          width: `${imgW}rpx`,
          height: `${imgH}rpx`,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate3d(${translateX}rpx, ${translateY}rpx, 0)`,
          willChange: 'transform',
        }}
        onError={handleImageError}
      />
    </View>
  )
}

export default memo(ArchetypeRevealStrip)
