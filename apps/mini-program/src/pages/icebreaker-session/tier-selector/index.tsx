import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { resolveTierDisplay, type TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { useAuth } from '../../../hooks/useAuth'
import { apiRequest } from '../../../lib/api/api'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { logError } from '../../../lib/utils/logger'
import { TOAST_MEDIUM_MS } from '../../../lib/utils/uiConstants'
import { haptics } from '../../../lib/utils/haptics'
import { getUserDisplayName, getIcebreakerPageErrorText } from '../icebreakerSessionModel'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { VIBE_TO_API, type VibeId } from '../../../lib/vibeMapping'
import { TIER_PRESETS, TIER_CARD_BACKGROUNDS, type TierPreset } from '../tierPresets'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'

import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
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
    description: '轻松开场，让大家慢慢熟络',
  },
  {
    id: 'glow',
    duration: '60min',
    gameCount: '3 个游戏',
    description: '深度交流，适合想要走心的晚上',
  },
  {
    id: 'blaze',
    duration: '90min',
    gameCount: '5-6 个游戏',
    description: '全量体验，适合熟到能互损的朋友',
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

const YUEZAI_REACTIONS: Record<TierMachineId, Record<VibeId, string>> = {
  breeze: {
    deep_chat: '先轻后深，是个聪明的节奏～',
    balanced: '轻松开场，大家很快就能放下拘谨～',
    play_fun: '从 playful 开始，气氛会升得很快！',
  },
  glow: {
    deep_chat: '这个深度刚刚好，适合今晚的大家。',
    balanced: '经典组合，稳妥又有惊喜。',
    play_fun: '有深度也有游戏，大家会玩得很尽兴。',
  },
  blaze: {
    deep_chat: '全量深聊，适合已经熟悉的朋友们。',
    balanced: '狂欢局开场，今晚记忆点会很足。',
    play_fun: '游戏拉满，适合熟到能互损的大家！',
  },
  custom: {
    deep_chat: '这一局你来搭，全场节奏听你指挥～',
    balanced: '这一局你来搭，全场节奏听你指挥～',
    play_fun: '这一局你来搭，全场节奏听你指挥～',
  },
}

// ─── Start-session retry policy ─────────────────────────────────────
// POST /api/social-icebreaker/start must feel immediate. Surface one clear
// failure instead of holding users through repeated long retries; the backend
// now keeps non-essential generation work off the critical path.
const START_MAX_ATTEMPTS = 1
const START_RETRY_DELAYS_MS: number[] = []
const START_REQUEST_TIMEOUT_MS = 12000

function isRetriableStartError(err: unknown): boolean {
  if (err === null || err === undefined) return true
  const e = err as { statusCode?: number; isTransportError?: boolean }
  if (e.isTransportError) return true
  if (typeof e.statusCode !== 'number') return true
  if (e.statusCode >= 500 && e.statusCode < 600) return true
  if (e.statusCode === 408 || e.statusCode === 429) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      clearTimeout(timer)
      resolve()
    }, ms)
  })
}

/** Extract the server-issued machine code (e.g. NOT_MEMBER_OF_GROUP) from an
 *  ApiError thrown by apiRequest. The access layer returns { code } in the body. */
function extractStartErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined
  const data = (err as { data?: unknown }).data
  if (data && typeof data === 'object') {
    const code = (data as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

/** Map a start-session failure to a warm, actionable toast. The generic
 *  "创建没成功，再试试" is the fallback; auth/membership/expiry get specific copy
 *  so the user (and support) can tell what actually happened. */
function getStartFailureToast(err: unknown): string {
  const code = extractStartErrorCode(err)
  const statusCode = (err as { statusCode?: number } | undefined)?.statusCode
  const isTransport = (err as { isTransportError?: boolean } | undefined)?.isTransportError === true

  if (isTransport) return '网络开小差了，检查网络后再试试'
  if (code === 'GROUP_EXPIRED' || code === 'EVENT_EXPIRED' || statusCode === 410) {
    return '这场破冰已经结束了，看看别的局吧'
  }
  if (code === 'NOT_MEMBER_OF_GROUP' || code === 'NOT_MEMBER_OF_EVENT' || statusCode === 403) {
    return '需要先加入这场局，才能开始破冰哦'
  }
  if (code === 'SESSION_NOT_FOUND' || statusCode === 404) {
    return '没找到这场破冰，返回上一页重试'
  }
  if (statusCode === 401) return '登录状态失效了，重新进入试试'
  // A 5xx means the server itself failed — blame the service, not the network.
  if (typeof statusCode === 'number' && statusCode >= 500) return getErrorMessage('server')
  return getErrorMessage('create-failed')
}

/** A small celebration line for the preview area — makes the choice feel seen. */
function getPreviewAffirmation(tier: TierMachineId, vibe: VibeId): string {
  if (tier === 'custom') return '自定义节奏，全场听你安排'
  if (tier === 'breeze') {
    if (vibe === 'play_fun') return '轻松 playful，最不容易冷场'
    if (vibe === 'deep_chat') return '先轻后深，聪明的打开方式'
    return '轻松开场，适合初次见面的大家'
  }
  if (tier === 'glow') {
    if (vibe === 'play_fun') return '有聊有玩，稳妥又有惊喜'
    if (vibe === 'deep_chat') return '经典深度局，适合今晚的大家'
    return '经典组合，怎么选都不出错'
  }
  // blaze
  if (vibe === 'play_fun') return '游戏拉满，适合熟到能互损的朋友'
  if (vibe === 'deep_chat') return '全量深聊，今晚记忆点会很足'
  return '狂欢到底，适合想要尽兴的晚上'
}

interface StoredSelection {
  tier: TierMachineId
  vibe: VibeId
}

// ─── Component ────────────────────────────────────────────────────

export default function TierSelectorPage() {
  const router = useRouter()
  const sessionId = router.params.sessionId ?? ''
  // Motion gating: CSS @media (prefers-reduced-motion: reduce) + JS-driven class both disable animations.
  const { shouldReduceMotion } = useMiniRevealMotion(router.params as Record<string, string | undefined>)
  const { user } = useAuth()
  const displayName = getUserDisplayName(user as Record<string, unknown> | undefined)

  // Default to the recommended preset so the UI shows a clear initial selection.
  const recommendedPreset = TIER_PRESETS.find((p) => p.recommended) ?? TIER_PRESETS[1]
  const [selectedTier, setSelectedTier] = useState<TierMachineId>(recommendedPreset?.tier ?? 'glow')
  const [selectedVibe, setSelectedVibe] = useState<VibeId>(recommendedPreset?.vibe ?? 'balanced')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fadeKey, setFadeKey] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)

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

  // Reset to a visible tier if custom mode is disabled while custom was selected
  useEffect(() => {
    if (!customModeEnabled && selectedTier === 'custom') {
      setSelectedTier('glow')
      setSelectedVibe('balanced')
    }
  }, [customModeEnabled, selectedTier])

  // Trigger fade animation when tier or vibe changes
  const handleSelectCombo = useCallback((tier: TierMachineId, vibe: VibeId) => {
    setSelectedTier(tier)
    const nextVibe = tier !== 'custom' ? vibe : 'balanced'
    setSelectedVibe(nextVibe)
    setFadeKey((k) => k + 1)
    if (!shouldReduceMotion) haptics('light')
    socialIcebreakerAnalytics.track('combo_selected', sessionId, undefined, undefined, {
      tier,
      vibe: nextVibe,
      source: tier === 'custom' ? 'custom_card' : 'grid',
    })
  }, [shouldReduceMotion, sessionId])

  const handleSelectPreset = useCallback((preset: TierPreset) => {
    setSelectedTier(preset.tier)
    setSelectedVibe(preset.vibe)
    setFadeKey((k) => k + 1)
    if (!shouldReduceMotion) haptics('light')
    socialIcebreakerAnalytics.track('preset_selected', sessionId, undefined, undefined, {
      presetId: preset.id,
      tier: preset.tier,
      vibe: preset.vibe,
    })
  }, [sessionId, shouldReduceMotion])

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
      // Surface offline early so the user gets immediate feedback instead of
      // waiting through the retry loop.
      try {
        const { networkType } = await Taro.getNetworkType()
        if (networkType === 'none') {
          Taro.showToast({
            title: '网络开小差了，请检查网络连接',
            icon: 'none',
            duration: TOAST_MEDIUM_MS,
          })
          return
        }
      } catch {
        // Ignore network-type probe failures; the request timeout will catch
        // truly offline environments.
      }

      // Persist selection before API call
      Taro.setStorageSync(STORAGE_KEY, {
        tier: selectedTier,
        vibe: selectedVibe,
      } as StoredSelection)

      if (selectedTier === 'custom') {
        socialIcebreakerAnalytics.track('custom_mode_selected', undefined, sessionId)
      }

      let lastErr: unknown
      for (let attempt = 0; attempt < START_MAX_ATTEMPTS; attempt++) {
        try {
          const response = await apiRequest<SocialStartResponse>({
            path: '/api/social-icebreaker/start',
            method: 'POST',
            timeout: START_REQUEST_TIMEOUT_MS,
            data: {
              sessionId,
              displayName,
              eventType: '活动',
              eventTier: selectedTier,
              vibe: selectedTier === 'custom' ? undefined : VIBE_TO_API[selectedVibe],
            },
          })

          Taro.redirectTo({
            url: `/pages/icebreaker-session/index?sessionId=${encodeURIComponent(sessionId)}&socialSessionId=${encodeURIComponent(response.socialSessionId)}`,
          })
          return
        } catch (err) {
          lastErr = err
          const shouldRetry =
            isRetriableStartError(err) && attempt < START_MAX_ATTEMPTS - 1
          if (!shouldRetry) break
          await sleep(START_RETRY_DELAYS_MS[attempt] ?? 0)
        }
      }

      logError('tier-selector:start-session-failed', {
        sessionId,
        selectedTier,
        selectedVibe,
        statusCode: (lastErr as { statusCode?: number })?.statusCode,
        code: extractStartErrorCode(lastErr),
        message: lastErr instanceof Error ? lastErr.message : String(lastErr),
        isTransportError: (lastErr as { isTransportError?: boolean })?.isTransportError === true,
      })
      Taro.showToast({
        title: getStartFailureToast(lastErr),
        icon: 'none',
        duration: TOAST_MEDIUM_MS,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, sessionId, displayName, selectedTier, selectedVibe])

  const yuezaiReaction = YUEZAI_REACTIONS[selectedTier][selectedVibe]

  return (
    <View className={`tier-selector ${shouldReduceMotion ? 'tier-selector--reduce-motion' : ''}`}>
      {/* Scrollable content region — keeps the page itself from scrolling
          (no onPageScroll) while every card stays reachable on short phones. */}
      <ScrollView className='tier-selector__scroll' scrollY enhanced showScrollbar={false}>
      {/* Header */}
      <View className='tier-selector__header'>
        <Text className='tier-selector__title'>
          {displayName ? `${displayName}，你来定今晚的调调` : '为今晚的大家，选个开场节奏'}
        </Text>
        <Text className='tier-selector__subtitle'>环节对了，大家很快就能熟络起来</Text>
      </View>

      {/* Tier selection surface */}
      <View className='tier-selector__section'>
        <Text className='tier-selector__section-label'>由你决定今晚的节奏</Text>

        <View className='tier-selector__preset-list'>
              {TIER_PRESETS.map((preset) => {
                const isActive = selectedTier === preset.tier && selectedVibe === preset.vibe
                return (
                  <View
                    key={preset.id}
                    className={`tier-selector__preset-card tier-selector__preset-card--${preset.tier} ${isActive ? 'tier-selector__preset-card--active' : ''}`}
                    onClick={() => handleSelectPreset(preset)}
                    hoverClass='tier-selector__preset-card--pressed'
                    hoverStartTime={0}
                    hoverStayTime={200}
                    aria-label={`${preset.title}，${preset.subtitle}，${preset.duration}，${preset.gameCount}`}
                    role='button'
                    aria-pressed={isActive}
                  >
                    {/* Decorative side illustration — Oracle-card style blending */}
                    <Image
                      className='tier-selector__preset-bg'
                      src={TIER_CARD_BACKGROUNDS[preset.tier]}
                      mode='scaleToFill'
                      aria-hidden
                    />

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
                        <JoyJoinIcon emoji='✓' size={24} />
                      </View>
                    )}
                  </View>
                )
              })}
            </View>

            <View
              className='tier-selector__advanced-toggle'
              onClick={handleToggleAdvanced}
              hoverClass='tier-selector__advanced-toggle--pressed'
              hoverStartTime={0}
              hoverStayTime={100}
              aria-label={showAdvanced ? '收起自定义选项' : '展开自定义时长和氛围选项'}
              role='button'
              aria-expanded={showAdvanced}
              aria-controls='tier-advanced-grid'
            >
              <Text className='tier-selector__advanced-toggle-text'>
                {showAdvanced ? '收起自定义' : '自定义时长 / 氛围'}
              </Text>
              <View className={`tier-selector__advanced-toggle-arrow ${showAdvanced ? 'tier-selector__advanced-toggle-arrow--up' : ''}`} />
            </View>

            {showAdvanced && (
              <View id='tier-advanced-grid' className='tier-selector__advanced-grid'>
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
                          aria-label={`${resolveTierDisplay(tier.id, { glowVariant: 'default' })} · ${vibe.display}`}
                          role='button'
                          aria-pressed={isActive}
                        >
                          {isActive && (
                            <View className='tier-selector__grid-cell-check'>
                              <JoyJoinIcon emoji='✓' size={20} />
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
            aria-label='自由局，时长和环节由你决定'
            role='button'
            aria-pressed={selectedTier === 'custom'}
          >
            {/* Decorative side illustration — Oracle-card style blending */}
            <Image
              className='tier-selector__custom-bg'
              src={TIER_CARD_BACKGROUNDS.custom}
              mode='scaleToFill'
              aria-hidden
            />

            <View className='tier-selector__custom-card-body'>
              <View className='tier-selector__custom-card-header'>
                <Text className='tier-selector__custom-card-title'>自由局</Text>
                <Text className='tier-selector__custom-card-badge'>自由定制</Text>
              </View>
              <Text className='tier-selector__custom-card-tagline'>全场节奏，由你导演</Text>
              <Text className='tier-selector__custom-card-meta'>时长和环节，都听你的</Text>
            </View>
            {selectedTier === 'custom' && (
              <View className='tier-selector__custom-card-check'>
                <JoyJoinIcon emoji='✓' size={24} />
              </View>
            )}
            <View className='tier-selector__custom-card-sparkle tier-selector__custom-card-sparkle--1' />
            <View className='tier-selector__custom-card-sparkle tier-selector__custom-card-sparkle--2' />
          </View>
        </View>
      )}

      {/* Tier card background preview for the selected tier */}
      <View className='tier-selector__preview' key={`preview-${fadeKey}`} aria-hidden>
        <View className='tier-selector__preview-frame'>
          <Image
            className='tier-selector__preview-frame-image'
            src={TIER_CARD_BACKGROUNDS[selectedTier]}
            mode='scaleToFill'
          />
        </View>
        <Text className='tier-selector__preview-label'>
          {resolveTierDisplay(selectedTier, { glowVariant: 'default' })} · 这就是今晚的氛围
        </Text>
        <Text className='tier-selector__preview-affirmation'>
          {getPreviewAffirmation(selectedTier, selectedVibe)}
        </Text>
      </View>

      {/* 悦仔 Mascot Line */}
      <View className='tier-selector__mascot' aria-live='polite'>
        <Image
          className='tier-selector__mascot-avatar'
          src={getXiaoyueExpressionAsset('coachGuide')}
          mode='aspectFit'
        />
        <View className='tier-selector__mascot-text-wrap' key={`mascot-text-${fadeKey}`}>
          <Text className='tier-selector__mascot-text'>{yuezaiReaction}</Text>
        </View>
      </View>

      </ScrollView>

      {/* CTA — pinned bottom bar, a flex sibling of the ScrollView */}
      <View className='tier-selector__footer'>
        <Button
          variant='primary'
          className='tier-selector__cta'
          onClick={handleStart}
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '正在为大家生成环节安排…' : '就这个了，开始环节'}
        </Button>
      </View>
    </View>
  )
}
