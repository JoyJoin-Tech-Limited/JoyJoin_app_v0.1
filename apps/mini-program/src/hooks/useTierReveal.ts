import { useState, useEffect, useRef, useMemo } from 'react'
import type { SocialTopicPromptTiers } from '@shared/socialIcebreaker'

/** Compute stagger delay based on text length and punctuation (reading-time heuristic). */
function computeTierDelay(text: string | undefined): number {
  const safeText = text ?? ''
  const base = 500
  const charTime = Math.min(safeText.length * 25, 500)
  const punctBonus =
    (safeText.match(/[。！？]/g) || []).length * 200 +
    (safeText.match(/[，]/g) || []).length * 120
  return base + charTime + punctBonus
}

interface TierRevealResult {
  revealedCount: number
  tiers: Array<{ key: 'opener' | 'followUp' | 'reflection'; label: string; text: string }>
}

/**
 * useTierReveal — staggered block reveal for 3-tier prompt cycling.
 *
 * Design note: TypewriterText is character-by-character for a single inline string.
 * This pattern needs labeled block-level reveals (开场/深入/反思) with reading-time
 * delays between whole tiers. Therefore we keep a dedicated hook rather than
 * forcing TypewriterText into a mismatched UX.
 */
export function useTierReveal(
  promptTiers: SocialTopicPromptTiers,
  reduceMotion: boolean
): TierRevealResult {
  const [revealedCount, setRevealedCount] = useState(reduceMotion ? 3 : 0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const tiers = useMemo(
    () => [
      { key: 'opener' as const, label: '开场', text: promptTiers.opener },
      { key: 'followUp' as const, label: '深入', text: promptTiers.followUp },
      { key: 'reflection' as const, label: '反思', text: promptTiers.reflection },
    ],
    [promptTiers]
  )

  useEffect(() => {
    if (reduceMotion) {
      setRevealedCount(3)
      return
    }

    let count = 0
    setRevealedCount(0)

    const revealNext = () => {
      count += 1
      setRevealedCount(count)
      if (count < 3) {
        const prevText = tiers[count - 1]?.text ?? ''
        const delay = computeTierDelay(prevText)
        timerRef.current = setTimeout(revealNext, delay)
      }
    }

    timerRef.current = setTimeout(revealNext, 300)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
    }
  }, [promptTiers, reduceMotion, tiers])

  return { revealedCount, tiers }
}
