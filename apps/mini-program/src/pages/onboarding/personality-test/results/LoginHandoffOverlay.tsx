import { Image, Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'
import { getRandomWhisper } from '../../../../lib/utils/loadingWhispers'

/** Whisper rotation cadence while the login handshake runs. */
const WHISPER_ROTATE_MS = 2400

interface LoginHandoffOverlayProps {
  archetypeName: string
}

/**
 * R2-7 "no dead air" login handoff (2026-08-18): while the anonymous→login
 * handshake runs (answer import + WeChat auth + nextStep routing), the user
 * sees this branded transition — celebrating Xiaoyue, an archetype teaser,
 * and rotating whispers — instead of a bare loading state. Reuses the shared
 * loading-whisper copy pool; no new animation system. The first whisper is
 * archetype-specific (the teaser); later ones rotate the generic pool.
 */
export default function LoginHandoffOverlay({ archetypeName }: LoginHandoffOverlayProps) {
  const [whisper, setWhisper] = useState(() => getRandomWhisper(archetypeName))

  useEffect(() => {
    const timer = setInterval(() => {
      setWhisper((prev) => {
        const next = getRandomWhisper()
        return next === prev ? getRandomWhisper() : next
      })
    }, WHISPER_ROTATE_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <View className='personality-results__handoff' role='status' aria-live='polite' aria-busy='true'>
      <Image
        className='personality-results__handoff-xiaoyue'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCelebrate)}
      />
      <Text className='personality-results__handoff-title'>「{archetypeName}」已被悦仔接住</Text>
      <Text className='personality-results__handoff-copy'>正在为你保存结果、开启匹配…</Text>
      <Text className='personality-results__handoff-whisper'>{whisper}</Text>
      <View className='personality-results__handoff-dots' aria-hidden='true'>
        <View className='personality-results__handoff-dot' />
        <View className='personality-results__handoff-dot' />
        <View className='personality-results__handoff-dot' />
      </View>
    </View>
  )
}
