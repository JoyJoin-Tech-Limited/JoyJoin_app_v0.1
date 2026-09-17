import { useEffect, useRef, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { localAsset } from '../../../lib/utils/cdnAssets'
import {
  getXiaoyueExpressionAsset,
  type XiaoyueExpressionId,
} from '../../../lib/mascot/xiaoyueExpressions'
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
// Styles are @use'd by the page SCSS (index.scss) — a component-level SCSS
// import would be chunked into the page-invisible sub-common.wxss.

/**
 * WaitingBeat — shared emotional layer for every "等待主持人 / 等待其他玩家"
 * state in the icebreaker session. A breathing Xiaoyue cameo plus a slowly
 * rotating whisper line, so the highest-dwell state of the session is alive
 * instead of a static caption. The authoritative status line still lives in
 * PhaseHeroCard's status zone (one grammar); this component never repeats it.
 */

export type WaitingBeatVariant = 'host' | 'peers' | 'join'

const WHISPERS: Record<WaitingBeatVariant, readonly string[]> = {
  host: ['悦仔正在后台布置这一局', '好戏值得多等一小会儿', '主持人就位，马上开场'],
  peers: ['先深呼吸，热闹正在赶来', '等人齐了，这一刻才算完整', '每一位都值得期待'],
  join: ['这座城市正在向这里聚拢', '空位不会空太久的', '每一位新伙伴都让这桌更完整'],
}

const ROTATE_MS = 8000
const FADE_MS = 240

export interface WaitingBeatProps {
  variant?: WaitingBeatVariant
  /** Mascot expression for the cameo; defaults to the dedicated waiting pose. */
  expression?: XiaoyueExpressionId
  className?: string
}

export default function WaitingBeat({
  variant = 'host',
  expression = 'matchWaiting',
  className,
}: WaitingBeatProps) {
  const whispers = WHISPERS[variant]
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  const [whisperIndex, setWhisperIndex] = useState(0)
  const [whisperHidden, setWhisperHidden] = useState(false)
  const [mascotFailed, setMascotFailed] = useState(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (reduceMotion || whispers.length < 2) return undefined
    const interval = setInterval(() => {
      setWhisperHidden(true)
      fadeTimerRef.current = setTimeout(() => {
        setWhisperIndex((i) => (i + 1) % whispers.length)
        setWhisperHidden(false)
      }, FADE_MS)
    }, ROTATE_MS)
    return () => {
      clearInterval(interval)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [reduceMotion, whispers.length])

  return (
    <View className={`waiting-beat${className ? ` ${className}` : ''}`}>
      <Image
        src={
          mascotFailed
            ? localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp')
            : getXiaoyueExpressionAsset(expression)
        }
        mode='aspectFit'
        lazyLoad
        className={`waiting-beat__mascot${reduceMotion ? ' waiting-beat__mascot--rm' : ''}`}
        onError={() => setMascotFailed(true)}
      />
      <Text
        className={`waiting-beat__whisper${whisperHidden ? ' waiting-beat__whisper--hidden' : ''}`}
      >
        {whispers[whisperIndex]}
      </Text>
    </View>
  )
}
