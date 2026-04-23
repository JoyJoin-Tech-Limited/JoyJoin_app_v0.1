import { View, Text, Image } from '@tarojs/components'
import { useCallback, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { getXiaoyueExpressionAsset } from '../lib/xiaoyueExpressions'
import './XiaoyueOverlay.scss'

/** Contextual copy for each screen where Xiaoyue should appear. */
export const XIAOYUE_CONTEXT_REGISTRY: Record<string, { copy: string; expression: 'coachGuide' | 'neutralInformation' | 'homeWelcome' | 'matchSuccess' }> = {
  discover: {
    copy: '今晚有好几个饭局正在报名，看看有没有你感兴趣的？',
    expression: 'coachGuide',
  },
  'event-detail': {
    copy: '这场活动的氛围和你很搭哦，要不要报名试试？',
    expression: 'coachGuide',
  },
  profile: {
    copy: '你的社交护照越来越丰富了，继续探索吧！',
    expression: 'matchSuccess',
  },
  events: {
    copy: '期待你的下一次活动回顾~',
    expression: 'neutralInformation',
  },
  connections: {
    copy: '这些都是和你聊得来的朋友，保持联系哦',
    expression: 'coachGuide',
  },
  rewards: {
    copy: '你积累的每一份成长，都会在这里发光。',
    expression: 'coachGuide',
  },
  'edit-profile': {
    copy: '随时更新你的资料，匹配会更精准哦。',
    expression: 'coachGuide',
  },
  invite: {
    copy: '邀请好友加入，双方都有惊喜奖励！',
    expression: 'homeWelcome',
  },
  'pool-registration': {
    copy: '填得越详细，匹配到的人越对味~',
    expression: 'coachGuide',
  },
  'matching-status': {
    copy: '匹配正在进行中，很快就能揭晓你的桌友了！',
    expression: 'coachGuide',
  },
  'squad-unboxing': {
    copy: '准备好揭晓你的桌友了吗？',
    expression: 'homeWelcome',
  },
  'event-coordination': {
    copy: '活动当天的注意事项，都帮你整理好了。',
    expression: 'neutralInformation',
  },
  'event-feedback': {
    copy: '你的反馈能帮助我们做得更好，谢谢！',
    expression: 'coachGuide',
  },
  'payment-verification': {
    copy: '支付结果马上就能确认了，稍等一下~',
    expression: 'neutralInformation',
  },
  'blind-box-payment': {
    copy: '选择适合你的方案，开启更多社交可能。',
    expression: 'coachGuide',
  },
}

interface XiaoyueOverlayProps {
  /** Screen context key — maps to contextual copy in registry */
  context: string
  /** Position on screen */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline'
  /** When to show the overlay */
  trigger?: 'on-mount' | 'on-scroll' | 'manual'
  /** Delay before showing (ms) */
  showDelayMs?: number
  /** Auto-hide after (ms, 0 = no auto-hide) */
  autoHideMs?: number
  /** Called when user dismisses */
  onDismiss?: () => void
  className?: string
}

/**
 * XiaoyueOverlay — floating mascot coaching bubble for any screen.
 *
 * Features:
 * - Contextual copy based on screen name
 * - Dismissible with tap
 * - Auto-show with delay
 * - Auto-hide optional
 * - Multiple positions
 * - Entrance/exit animations
 */
export default function XiaoyueOverlay({
  context,
  position = 'bottom-right',
  trigger = 'on-mount',
  showDelayMs = 800,
  autoHideMs = 0,
  onDismiss,
  className = '',
}: XiaoyueOverlayProps) {
  const [visible, setVisible] = useState(trigger === 'manual')
  const [dismissed, setDismissed] = useState(false)

  const config = XIAOYUE_CONTEXT_REGISTRY[context]
  if (!config) {
    return null
  }

  useEffect(() => {
    if (trigger !== 'on-mount') return
    const timer = setTimeout(() => {
      setVisible(true)
    }, showDelayMs)
    return () => clearTimeout(timer)
  }, [trigger, showDelayMs])

  useEffect(() => {
    if (!visible || autoHideMs <= 0) return
    const timer = setTimeout(() => {
      handleDismiss()
    }, autoHideMs)
    return () => clearTimeout(timer)
  }, [visible, autoHideMs])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    setVisible(false)
    onDismiss?.()
    // Persist dismissal in storage so it doesn't show again this session
    try {
      const key = `xiaoyue_dismissed_${context}`
      Taro.setStorageSync(key, Date.now())
    } catch {
      // ignore
    }
  }, [context, onDismiss])

  if (dismissed || !visible) {
    return null
  }

  return (
    <View
      className={`xiaoyue-overlay xiaoyue-overlay--${position} ${className}`}
      onClick={handleDismiss}
    >
      <View className='xiaoyue-overlay__bubble'>
        <Image
          className='xiaoyue-overlay__avatar'
          src={getXiaoyueExpressionAsset(config.expression)}
          mode='aspectFit'
        />
        <View className='xiaoyue-overlay__text-wrap'>
          <Text className='xiaoyue-overlay__copy'>{config.copy}</Text>
        </View>
        <View className='xiaoyue-overlay__dismiss-hint'>
          <Text className='xiaoyue-overlay__dismiss-icon'>✕</Text>
        </View>
      </View>
    </View>
  )
}

/** Check if user dismissed this context recently (within 24h). */
export function wasXiaoyueDismissedRecently(context: string): boolean {
  try {
    const key = `xiaoyue_dismissed_${context}`
    const timestamp = Taro.getStorageSync(key) as number
    if (!timestamp) return false
    const hoursSince = (Date.now() - timestamp) / (1000 * 60 * 60)
    return hoursSince < 24
  } catch {
    return false
  }
}
