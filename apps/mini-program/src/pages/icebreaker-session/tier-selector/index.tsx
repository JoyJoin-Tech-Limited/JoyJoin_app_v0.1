import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useAuth } from '../../../hooks/useAuth'
import { apiRequest } from '../../../lib/api/api'
import { TOAST_MEDIUM_MS } from '../../../lib/utils/uiConstants'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { getUserDisplayName } from '../icebreakerSessionModel'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { resolveTierDisplay, type TierMachineId } from '@shared/socialIcebreakerTierManifest'
import Button from '../../../components/ui/Button'
import { ResponsiveSpacer } from '../../../components/ui/ResponsiveSpacer'
import type { SocialStartResponse } from '../icebreakerSessionModel'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = 'lastTierVibe'

const TIER_OPTIONS: Array<{
  id: TierMachineId
  emoji: string
  duration: string
  gameCount: string
  description: string
}> = [
  {
    id: 'breeze',
    emoji: '🌬️',
    duration: '40min',
    gameCount: '2 个游戏',
    description: '轻松破冰，适合初次见面',
  },
  {
    id: 'glow',
    emoji: '🔥',
    duration: '60min',
    gameCount: '3 个游戏',
    description: '深度交流，默认推荐',
  },
  {
    id: 'blaze',
    emoji: '⚡',
    duration: '90min',
    gameCount: '5-6 个游戏',
    description: '全量体验，适合熟人群体',
  },
]

type VibeId = 'chat' | 'balanced' | 'game'

const VIBE_OPTIONS: Array<{
  id: VibeId
  display: string
  description: string
}> = [
  { id: 'chat', display: '聊天感', description: '更侧重互动和表达类环节' },
  { id: 'balanced', display: '混合感', description: '均衡搭配，默认推荐' },
  { id: 'game', display: '竞技感', description: '更侧重游戏和竞技类环节' },
]

const YUEZAI_REACTIONS: Record<TierMachineId, string> = {
  breeze: '轻松开始，慢慢熟络～',
  glow: '深度交流，畅聊无阻！',
  blaze: '全量体验，狂欢到底！',
}

interface StoredSelection {
  tier: TierMachineId
  vibe: VibeId
}

// ─── Component ────────────────────────────────────────────────────

export default function TierSelectorPage() {
  const router = useRouter()
  const sessionId = router.params.sessionId ?? ''
  const eventId = router.params.eventId ?? ''
  const { user } = useAuth()
  const displayName = getUserDisplayName(user as Record<string, unknown> | undefined)

  const [selectedTier, setSelectedTier] = useState<TierMachineId>('glow')
  const [selectedVibe, setSelectedVibe] = useState<VibeId>('balanced')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fadeKey, setFadeKey] = useState(0)

  // Load persisted selection on mount
  useEffect(() => {
    try {
      const stored = Taro.getStorageSync<StoredSelection | undefined>(STORAGE_KEY)
      if (stored && stored.tier) {
        setSelectedTier(stored.tier)
      }
      if (stored && stored.vibe) {
        setSelectedVibe(stored.vibe)
      }
    } catch {
      // Storage read failure is non-fatal
    }
  }, [])

  // Trigger fade animation when tier changes
  const handleSelectTier = useCallback((tier: TierMachineId) => {
    setSelectedTier(tier)
    setFadeKey((k) => k + 1)
  }, [])

  const handleSelectVibe = useCallback((vibe: VibeId) => {
    setSelectedVibe(vibe)
  }, [])

  const isReady = useMemo(() => !!selectedTier, [selectedTier])

  const handleStart = useCallback(async () => {
    if (!isReady || isSubmitting) {
      return
    }

    if (!sessionId) {
      Taro.showToast({ title: '缺少会话信息', icon: 'none', duration: TOAST_MEDIUM_MS })
      return
    }

    setIsSubmitting(true)

    try {
      // Persist selection before API call
      Taro.setStorageSync(STORAGE_KEY, {
        tier: selectedTier,
        vibe: selectedVibe,
      } as StoredSelection)

      const response = await apiRequest<SocialStartResponse>({
        path: '/api/social-icebreaker/start',
        method: 'POST',
        data: {
          sessionId,
          displayName,
          eventType: '活动',
          eventTier: selectedTier,
          vibe: selectedVibe,
        },
      })

      Taro.navigateTo({
        url: `/pages/icebreaker-session/index?sessionId=${encodeURIComponent(sessionId)}&socialSessionId=${encodeURIComponent(response.socialSessionId)}`,
      })
    } catch {
      Taro.showToast({
        title: getErrorMessage('create-failed'),
        icon: 'none',
        duration: TOAST_MEDIUM_MS,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [isReady, isSubmitting, sessionId, displayName, selectedTier, selectedVibe])

  const yuezaiReaction = YUEZAI_REACTIONS[selectedTier]

  return (
    <View className='tier-selector'>
      {/* Header */}
      <View className='tier-selector__header'>
        <Text className='tier-selector__title'>选择环节类型</Text>
        <Text className='tier-selector__subtitle'>为今晚的活动定制破冰体验</Text>
      </View>

      {/* Tier Cards */}
      <View className='tier-selector__section'>
        <Text className='tier-selector__section-label'>环节时长</Text>
        <View className='tier-selector__tier-list'>
          {TIER_OPTIONS.map((option) => {
            const isActive = selectedTier === option.id
            return (
              <View
                key={option.id}
                className={`tier-selector__tier-card ${isActive ? 'tier-selector__tier-card--active' : ''}`}
                onClick={() => handleSelectTier(option.id)}
                hoverClass='tier-selector__tier-card--pressed'
                hoverStartTime={0}
                hoverStayTime={100}
              >
                <View className='tier-selector__tier-card-top'>
                  <Text className='tier-selector__tier-emoji'>{option.emoji}</Text>
                  {option.id === 'glow' && (
                    <Text className='tier-selector__tier-tag'>推荐</Text>
                  )}
                </View>
                <Text className='tier-selector__tier-name'>
                  {resolveTierDisplay(option.id, { glowVariant: 'default' })}
                </Text>
                <Text className='tier-selector__tier-meta'>
                  {option.duration} · {option.gameCount}
                </Text>
                <Text className='tier-selector__tier-desc'>{option.description}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* 悦仔 Mascot Line */}
      <View className='tier-selector__mascot' key={`mascot-${fadeKey}`}>
        <Image
          className='tier-selector__mascot-avatar'
          src={getXiaoyueExpressionAsset('coachGuide')}
          mode='aspectFit'
          lazyLoad
        />
        <Text className='tier-selector__mascot-text'>{yuezaiReaction}</Text>
      </View>

      {/* Vibe Chips */}
      <View className='tier-selector__section'>
        <Text className='tier-selector__section-label'>活动氛围</Text>
        <View className='tier-selector__vibe-row'>
          {VIBE_OPTIONS.map((option) => {
            const isActive = selectedVibe === option.id
            return (
              <View
                key={option.id}
                className={`tier-selector__vibe-chip ${isActive ? 'tier-selector__vibe-chip--active' : ''}`}
                onClick={() => handleSelectVibe(option.id)}
                hoverClass='tier-selector__vibe-chip--pressed'
                hoverStartTime={0}
                hoverStayTime={100}
              >
                <Text className='tier-selector__vchip-label'>{option.display}</Text>
                <Text className='tier-selector__vchip-desc'>{option.description}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <ResponsiveSpacer heightRpx={120} collapseBelow={700} />

      {/* CTA */}
      <View className='tier-selector__footer'>
        <Button
          variant='primary'
          className='tier-selector__cta'
          onClick={handleStart}
          disabled={!isReady || isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '正在生成环节安排…' : '开始环节'}
        </Button>
        {!isReady && (
          <Text className='tier-selector__cta-hint'>请先选择环节类型</Text>
        )}
      </View>
    </View>
  )
}
