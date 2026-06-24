import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { resolveTierDisplay, type TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { useAuth } from '../../../hooks/useAuth'
import { apiRequest } from '../../../lib/api/api'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { localAsset } from '../../../lib/utils/cdnAssets'
import { TOAST_MEDIUM_MS } from '../../../lib/utils/uiConstants'
import { getUserDisplayName } from '../icebreakerSessionModel'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { TIER_VIBE_BACKDROPS } from '../../../lib/ceremonyHeroes'
import { VibeId, VIBE_TO_API } from '../../../lib/vibeMapping'
import Button from '../../../components/ui/Button'

import { useResetOnShow } from '../../../hooks/useResetOnShow'
import type { SocialStartResponse } from '../icebreakerSessionModel'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = 'lastTierVibe'

export const CUSTOM_TIER_ID: TierMachineId = 'custom'

export const TIER_OPTIONS: Array<{
  id: TierMachineId
  duration: string
  gameCount: string
  description: string
}> = [
  {
    id: 'breeze',
    duration: '40min',
    gameCount: '2 个游戏',
    description: '轻松破冰，适合初次见面',
  },
  {
    id: 'glow',
    duration: '60min',
    gameCount: '3 个游戏',
    description: '深度交流，默认推荐',
  },
  {
    id: 'blaze',
    duration: '90min',
    gameCount: '5-6 个游戏',
    description: '全量体验，适合熟人群体',
  },
]

export const VIBE_OPTIONS: Array<{
  id: VibeId
  display: string
  hint: string
  description: string
}> = [
  { id: 'deep_chat', display: '深聊', hint: '对话为主', description: '深度连接，沉浸交流' },
  { id: 'balanced', display: '均衡', hint: '灵活混搭', description: '均衡搭配，默认推荐' },
  { id: 'play_fun', display: '暢玩', hint: '游戏为主', description: '活力互动，轻松畅玩' },
]

export type TierPresetId = 'easy-start' | 'deep-chat' | 'play-fun'

export interface TierPreset {
  id: TierPresetId
  tier: TierMachineId
  vibe: VibeId
  title: string
  subtitle: string
  duration: string
  gameCount: string
  description: string
  recommended?: boolean
  /** Visual token for future Lovart icon asset.
   *  Replace the placeholder circle with `<Image src={localAsset(`/assets/icons/tier-preset-${iconToken}.webp`)} />`
   *  once the Lovart icons are commissioned.
   */
  iconToken: 'sparkle' | 'heart' | 'controller'
}

/** Opinionated tier+vibe presets. Reduces the 3×3 grid to 3 human intentions. */
export const TIER_PRESETS: TierPreset[] = [
  {
    id: 'easy-start',
    tier: 'breeze',
    vibe: 'balanced',
    title: '轻松破冰',
    subtitle: '对话为主 · 适合初次见面',
    duration: '40min',
    gameCount: '2 个游戏',
    description: '从轻快小游戏开始，慢慢熟络',
    iconToken: 'sparkle',
  },
  {
    id: 'deep-chat',
    tier: 'glow',
    vibe: 'deep_chat',
    title: '深度畅聊',
    subtitle: '沉浸交流 · 默认推荐',
    duration: '60min',
    gameCount: '3 个游戏',
    description: '更多走心话题，聊到停不下来',
    recommended: true,
    iconToken: 'heart',
  },
  {
    id: 'play-fun',
    tier: 'blaze',
    vibe: 'play_fun',
    title: '游戏狂欢',
    subtitle: '活力互动 · 适合熟人群体',
    duration: '90min',
    gameCount: '5-6 个游戏',
    description: '全量游戏环节，玩得过瘾',
    iconToken: 'controller',
  },
]

const YUEZAI_REACTIONS: Record<TierMachineId, Record<VibeId, string>> = {
  breeze: {
    deep_chat: '轻松开始，慢慢聊～',
    balanced: '轻松开始，慢慢熟络～',
    play_fun: '轻松开始，玩得开心～',
  },
  glow: {
    deep_chat: '深度交流，畅聊无阻！',
    balanced: '深度交流，畅聊无阻！',
    play_fun: '深度体验，玩得尽兴！',
  },
  blaze: {
    deep_chat: '全量体验，聊到心底！',
    balanced: '全量体验，狂欢到底！',
    play_fun: '全量体验，狂欢到底！',
  },
  custom: {
    deep_chat: '自定义节奏，由你主导～',
    balanced: '自定义节奏，由你主导～',
    play_fun: '自定义节奏，由你主导～',
  },
}

interface StoredSelection {
  tier: TierMachineId
  vibe: VibeId
}

// ─── Component ────────────────────────────────────────────────────

export default function TierSelectorPage() {
  const router = useRouter()
  const sessionId = router.params.sessionId ?? ''
  const { user } = useAuth()
  const displayName = getUserDisplayName(user as Record<string, unknown> | undefined)

  const [selectedTier, setSelectedTier] = useState<TierMachineId>('glow')
  const [selectedVibe, setSelectedVibe] = useState<VibeId>('balanced')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fadeKey, setFadeKey] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const runPlanTemplatesEnabled = user?.features?.runPlanTemplatesEnabled ?? false
  const customModeEnabled = user?.features?.socialIcebreakerCustomModeEnabled ?? true

  // Reset transient flags on swipe-back / foreground
  useResetOnShow(setIsSubmitting)

  // Load persisted selection on mount
  useEffect(() => {
    try {
      const stored = Taro.getStorageSync<StoredSelection | undefined>(STORAGE_KEY)
      if (stored && stored.tier) {
        setSelectedTier(stored.tier)
      }
      if (stored && stored.vibe) {
        const validVibes = VIBE_OPTIONS.map((v) => v.id)
        setSelectedVibe(validVibes.includes(stored.vibe) ? stored.vibe : 'balanced')
      }
    } catch {
      // Storage read failure is non-fatal
    }
  }, [])

  // Force vibe to balanced when run-plan template flag is off
  useEffect(() => {
    if (!runPlanTemplatesEnabled) {
      setSelectedVibe('balanced')
      setShowAdvanced(false)
    }
  }, [runPlanTemplatesEnabled])

  // Trigger fade animation when tier or vibe changes
  const handleSelectCombo = useCallback((tier: TierMachineId, vibe: VibeId) => {
    setSelectedTier(tier)
    setSelectedVibe(runPlanTemplatesEnabled && tier !== 'custom' ? vibe : 'balanced')
    setFadeKey((k) => k + 1)
  }, [runPlanTemplatesEnabled])

  const handleSelectPreset = useCallback((preset: TierPreset) => {
    setSelectedTier(preset.tier)
    setSelectedVibe(preset.vibe)
    setFadeKey((k) => k + 1)
    socialIcebreakerAnalytics.track('preset_selected', sessionId, undefined, undefined, {
      presetId: preset.id,
      tier: preset.tier,
      vibe: preset.vibe,
    })
  }, [sessionId])

  const handleToggleAdvanced = useCallback(() => {
    setShowAdvanced((prev) => {
      const next = !prev
      if (next) {
        socialIcebreakerAnalytics.track('advanced_mode_opened', sessionId)
      }
      return next
    })
  }, [sessionId])

  const handleStart = useCallback(async () => {
    if (isSubmitting) {
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

      if (selectedTier === 'custom') {
        socialIcebreakerAnalytics.track('custom_mode_selected', undefined, sessionId)
      }

      const response = await apiRequest<SocialStartResponse>({
        path: '/api/social-icebreaker/start',
        method: 'POST',
        data: {
          sessionId,
          displayName,
          eventType: '活动',
          eventTier: selectedTier,
          vibe: selectedTier === 'custom' ? undefined : VIBE_TO_API[selectedVibe],
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
  }, [isSubmitting, sessionId, displayName, selectedTier, selectedVibe])

  const yuezaiReaction = selectedTier === 'custom'
    ? '这一局，你来搭～'
    : YUEZAI_REACTIONS[selectedTier][selectedVibe]

  return (
    <View className='tier-selector'>
      {/* Header */}
      <View className='tier-selector__header'>
        <Text className='tier-selector__title'>选择环节类型</Text>
        <Text className='tier-selector__subtitle'>为今晚的活动定制破冰体验</Text>
      </View>

      {/* Tier Presets */}
      <View className='tier-selector__section'>
        <Text className='tier-selector__section-label'>
          {runPlanTemplatesEnabled ? '选一个开场节奏' : '环节时长'}
        </Text>
        <View className='tier-selector__preset-list'>
          {TIER_PRESETS.map((preset) => {
            const isActive = selectedTier === preset.tier && selectedVibe === preset.vibe
            return (
              <View
                key={preset.id}
                className={`tier-selector__preset-card ${isActive ? 'tier-selector__preset-card--active' : ''}`}
                onClick={() => handleSelectPreset(preset)}
                hoverClass='tier-selector__preset-card--pressed'
                hoverStartTime={0}
                hoverStayTime={200}
              >
                <View className='tier-selector__preset-icon'>
                  {/* Lovart icon placeholder — replace with Image once assets are ready */}
                  <View className={`tier-selector__preset-icon-dot tier-selector__preset-icon-dot--${preset.iconToken}`} />
                </View>
                <View className='tier-selector__preset-body'>
                  <View className='tier-selector__preset-header'>
                    <Text className='tier-selector__preset-title'>{preset.title}</Text>
                    {preset.recommended && (
                      <Text className='tier-selector__preset-badge'>推荐</Text>
                    )}
                  </View>
                  <Text className='tier-selector__preset-subtitle'>{preset.subtitle}</Text>
                  <View className='tier-selector__preset-meta'>
                    <Text className='tier-selector__preset-meta-item'>{preset.duration}</Text>
                    <Text className='tier-selector__preset-meta-item'>{preset.gameCount}</Text>
                  </View>
                  <Text className='tier-selector__preset-description'>{preset.description}</Text>
                </View>
                {isActive && (
                  <View className='tier-selector__preset-check'>
                    <Text className='tier-selector__preset-check-icon'>✓</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>

        {runPlanTemplatesEnabled && (
          <View
            className='tier-selector__advanced-toggle'
            onClick={handleToggleAdvanced}
            hoverClass='tier-selector__advanced-toggle--pressed'
            hoverStartTime={0}
            hoverStayTime={100}
          >
            <Text className='tier-selector__advanced-toggle-text'>
              {showAdvanced ? '收起自定义' : '自定义时长 / 氛围'}
            </Text>
            <Text className={`tier-selector__advanced-toggle-arrow ${showAdvanced ? 'tier-selector__advanced-toggle-arrow--up' : ''}`}>⌄</Text>
          </View>
        )}

        {showAdvanced && runPlanTemplatesEnabled && (
          <View className='tier-selector__advanced-grid'>
            {/* Header row */}
            <View className='tier-selector__grid-row tier-selector__grid-row--header'>
              <View className='tier-selector__grid-corner' />
              {VIBE_OPTIONS.map((vibe) => (
                <View key={vibe.id} className='tier-selector__grid-col-header'>
                  <Text className='tier-selector__grid-col-name'>{vibe.display}</Text>
                  <Text className='tier-selector__grid-col-hint'>{vibe.hint}</Text>
                </View>
              ))}
            </View>

            {/* Rows: one per tier */}
            {TIER_OPTIONS.map((tier) => (
              <View key={tier.id} className='tier-selector__grid-row'>
                <View className='tier-selector__grid-row-header'>
                  <Text className='tier-selector__grid-row-name'>
                    {resolveTierDisplay(tier.id, { glowVariant: 'default' })}
                  </Text>
                  <Text className='tier-selector__grid-row-meta'>
                    {tier.duration} · {tier.gameCount}
                  </Text>
                </View>

                {VIBE_OPTIONS.map((vibe) => {
                  const isActive = selectedTier === tier.id && selectedVibe === vibe.id
                  return (
                    <View
                      key={vibe.id}
                      className={`tier-selector__grid-cell ${isActive ? 'tier-selector__grid-cell--active' : ''}`}
                      onClick={() => handleSelectCombo(tier.id, vibe.id)}
                      hoverClass='tier-selector__grid-cell--pressed'
                      hoverStartTime={0}
                      hoverStayTime={200}
                    >
                      {isActive && (
                        <View className='tier-selector__grid-cell-check'>
                          <Text className='tier-selector__grid-cell-check-icon'>✓</Text>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Custom mode card */}
      {customModeEnabled && (
        <View className='tier-selector__section'>
          <View
            className={`tier-selector__custom-card ${selectedTier === 'custom' ? 'tier-selector__custom-card--active' : ''}`}
            onClick={() => handleSelectCombo('custom', 'balanced')}
            hoverClass='tier-selector__custom-card--pressed'
            hoverStartTime={0}
            hoverStayTime={200}
          >
            <Image
              className='tier-selector__custom-card-icon'
              src={localAsset('/assets/icons/custom-tier-icon.webp')}
              mode='aspectFit'
              lazyLoad
            />
            <View className='tier-selector__custom-card-body'>
              <View className='tier-selector__custom-card-header'>
                <Text className='tier-selector__custom-card-title'>自由局</Text>
                <Text className='tier-selector__custom-card-badge'>自由定制</Text>
              </View>
              <Text className='tier-selector__custom-card-tagline'>想玩哪个，由你决定</Text>
              <Text className='tier-selector__custom-card-meta'>时长由你决定 · 环节自由组合</Text>
            </View>
            {selectedTier === 'custom' && (
              <View className='tier-selector__custom-card-check'>
                <Text className='tier-selector__custom-card-check-icon'>✓</Text>
              </View>
            )}
            <View className='tier-selector__custom-card-sparkle tier-selector__custom-card-sparkle--1' />
            <View className='tier-selector__custom-card-sparkle tier-selector__custom-card-sparkle--2' />
          </View>
        </View>
      )}

      {/* Tier Vibe Backdrop — Batch C ceremony hero for the selected tier */}
      <View className='tier-selector__preview' key={`preview-${fadeKey}`} aria-hidden>
        <Image
          className='tier-selector__preview-image'
          src={TIER_VIBE_BACKDROPS[selectedTier]}
          mode='aspectFit'
          lazyLoad
        />
        <Text className='tier-selector__preview-label'>
          {resolveTierDisplay(selectedTier, { glowVariant: 'default' })} · 氛围预览
        </Text>
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

      <View className='tier-selector__filler' />

      {/* CTA */}
      <View className='tier-selector__footer'>
        <Button
          variant='primary'
          className='tier-selector__cta'
          onClick={handleStart}
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '正在生成环节安排…' : '开始环节'}
        </Button>
      </View>
    </View>
  )
}
