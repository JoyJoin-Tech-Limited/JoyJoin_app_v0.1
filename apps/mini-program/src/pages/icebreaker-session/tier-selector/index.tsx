import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { TIER_RUN_PLANS } from '@shared/socialIcebreakerRunPlans'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { useAuth } from '../../../hooks/useAuth'
import { apiRequest } from '../../../lib/api/api'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { logError } from '../../../lib/utils/logger'
import { TOAST_MEDIUM_MS } from '../../../lib/utils/uiConstants'
import { haptics } from '../../../lib/utils/haptics'
import { getUserDisplayName } from '../icebreakerSessionModel'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { VIBE_TO_API, type VibeId } from '../../../lib/vibeMapping'
import { TIER_PRESETS, TIER_CARD_BACKGROUNDS, type TierPreset } from '../tierPresets'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'

import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import type { SocialStartResponse } from '../icebreakerSessionModel'
import { PhaseHeaderIcon } from '../phaseUtils'
import {
  CUSTOM_GAME_OPTIONS,
  getCustomSelectionMinutes,
  toggleCustomGameSelection,
  type CustomGamePhase,
} from './customGameSelection'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = 'lastTierVibe'

/** Preview-flow display names — fuller than the in-session getPhaseLabel
 *  short labels (挑战/拍卖) so the sequence reads as a plan, not a ticker. */
const PREVIEW_PHASE_LABELS: Record<string, string> = {
  warmup: '话题卡',
  micro_challenge: '默契挑战',
  lie_detective: '谎言侦探',
  personality_dice: '人格骰子',
  auction: '心动拍卖',
  speed_friending: '轮桌畅聊',
  quip_battle: '机智对决',
  undercover_word: '谁是卧底',
  group_mirror: '群像镜像',
  mini_script: '迷你剧本杀',
  recap: '回顾',
}

/** Nominal display length of the mini_script bonus segment (mirrors the
 *  server's MINI_SCRIPT_BONUS_MINUTES). The segment is funded out of the other
 *  rows, so the tier total stays constant and this figure is an approximation. */
const MINI_SCRIPT_PREVIEW_MINUTES = 25

/** One line of the preview itinerary. */
interface PreviewFlowRow {
  key: string
  label: string
  minutes: number
  /** 1–3 dots from the run-plan energyWeight; absent when the row has no data. */
  energy?: number
  /** Opening/closing/bonus marker. 开场/收尾 are preset-tier anchors; 加映 marks
   *  the flag-gated mini_script bonus row (funded out of the other rows, hence
   *  the listed minutes deliberately do not sum to the tier total). */
  purpose?: '开场' | '收尾' | '加映'
}

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
    description: '游戏管够，不爱说话也能玩得开',
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
  { id: 'play_fun', display: '畅玩', hint: '游戏为主', description: '活力互动，轻松畅玩' },
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
    play_fun: '游戏一个接一个，气氛会一路走高！',
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
  if (code === 'CUSTOM_GAMES_REQUIRED') return '至少选择一个游戏哦'
  if (code === 'CUSTOM_GAME_UNAVAILABLE') return '有游戏暂未开放，换一个试试'
  if (statusCode === 401) return '登录状态失效了，重新进入试试'
  // A 5xx means the server itself failed — blame the service, not the network.
  if (typeof statusCode === 'number' && statusCode >= 500) return getErrorMessage('server')
  return getErrorMessage('create-failed')
}

/** Editorial affirmation for the preview card. Deliberately factual — the
 *  earlier ad-register lines (一定/尽兴/最) were cut in the 2026-10-16 polish
 *  pass; the card states what the evening is, it does not sell it. */
const PREVIEW_AFFIRMATIONS: Record<'breeze' | 'glow' | 'blaze', Record<VibeId, string>> = {
  breeze: {
    deep_chat: '从轻松开始，往深里走',
    balanced: '先轻松起来，慢慢就聊开了',
    play_fun: '先玩起来，谁都不会僵着',
  },
  glow: {
    deep_chat: '今晚以聊为主，慢一点更好',
    balanced: '一半在聊，一半在玩',
    play_fun: '有聊有玩，稳里带点惊喜',
  },
  blaze: {
    deep_chat: '聊得深，也玩得开',
    balanced: '全程都有事做，不会冷场',
    play_fun: '先玩起来，话自然就多了',
  },
}

function getPreviewAffirmation(tier: TierMachineId, vibe: VibeId): string {
  if (tier === 'custom') return '按你排的顺序来，今晚听你的'
  return PREVIEW_AFFIRMATIONS[tier][vibe]
}

interface StoredSelection {
  tier: TierMachineId
  vibe: VibeId
  selectedPhases?: CustomGamePhase[]
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
  const [selectedPhases, setSelectedPhases] = useState<CustomGamePhase[]>([])
  const [availableGamePhases, setAvailableGamePhases] = useState<CustomGamePhase[]>(
    CUSTOM_GAME_OPTIONS.map((game) => game.phase),
  )

  const customModeEnabled = user?.features?.socialIcebreakerCustomModeEnabled ?? true
  // mini_script is env-driven server-side; two directions, both fail-safe:
  // the picker drops it only when the server explicitly says false, and the
  // preset preview promises its 加映 row only when explicitly true.
  const miniScriptPickerEnabled = user?.features?.socialIcebreakerMiniScriptEnabled !== false
  const miniScriptPreviewEnabled = user?.features?.socialIcebreakerMiniScriptEnabled === true

  // ScrollView scrollIntoView target for the custom empty-state link. Cleared
  // after the jump so later re-renders do not scroll the page again.
  const [scrollTarget, setScrollTarget] = useState('')

  // Reset transient flags on swipe-back / foreground
  useResetOnShow(setIsSubmitting)

  useEffect(() => {
    if (!scrollTarget) return
    const timer = setTimeout(() => setScrollTarget(''), 600)
    return () => clearTimeout(timer)
  }, [scrollTarget])

  // Load persisted selection on mount
  useEffect(() => {
    try {
      const stored = Taro.getStorageSync<StoredSelection | undefined>(STORAGE_KEY)
      if (stored && stored.tier) {
        // Guard against a legacy/retired machine id sitting in storage: an
        // unknown tier would render with no active card and an undefined
        // preview background. Unknown values fall back to the default preset.
        const validTiers = new Set<TierMachineId>([
          ...TIER_OPTIONS.map((option) => option.id),
          CUSTOM_TIER_ID,
        ])
        if (validTiers.has(stored.tier)) {
          setSelectedTier(stored.tier)
        }
      }
      if (stored && stored.vibe) {
        const validVibes = VIBE_OPTIONS.map((v) => v.id)
        setSelectedVibe(validVibes.includes(stored.vibe) ? stored.vibe : 'balanced')
      }
      if (stored?.selectedPhases) {
        const validPhases = new Set(CUSTOM_GAME_OPTIONS.map((game) => game.phase))
        setSelectedPhases(stored.selectedPhases.filter((phase) => validPhases.has(phase)))
      }
    } catch {
      // Storage read failure is non-fatal
    }
  }, [])

  // Funnel metric (G10): one preview impression per page mount.
  useEffect(() => {
    socialIcebreakerAnalytics.track('preview_viewed', sessionId)
  }, [sessionId])

  useEffect(() => {
    let active = true
    void apiRequest<{ phases: CustomGamePhase[] }>({
      path: '/api/social-icebreaker/custom-games',
      method: 'GET',
    }).then(({ phases }) => {
      if (!active) return
      const known = new Set(CUSTOM_GAME_OPTIONS.map((game) => game.phase))
      // The catalog endpoint lists every known custom phase; offering one the
      // server has disabled would only fail later at /start.
      const available = phases.filter(
        (phase) => known.has(phase) && (miniScriptPickerEnabled || phase !== 'mini_script'),
      )
      setAvailableGamePhases(available)
      setSelectedPhases((current) => current.filter((phase) => available.includes(phase)))
    }).catch((err) => {
      logError('tier-selector:custom-game-catalog-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    })
    return () => {
      active = false
    }
  }, [miniScriptPickerEnabled])

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
      } else if (selectedTier === 'custom' && selectedPhases.length === 0) {
        // Browsing never commits: collapsing the list while a hollow 自由局
        // is selected restores the recommended preset, so the CTA can never
        // fire an empty custom session by accident.
        const fallback = recommendedPreset ?? TIER_PRESETS[1]
        setSelectedTier(fallback.tier)
        setSelectedVibe(fallback.vibe)
      }
      return next
    })
  }, [sessionId, selectedTier, selectedPhases.length, recommendedPreset])

  const handleToggleCustomGame = useCallback((phase: CustomGamePhase) => {
    setSelectedTier('custom')
    setSelectedVibe('balanced')
    setSelectedPhases((current) => toggleCustomGameSelection(current, phase))
    setFadeKey((key) => key + 1)
    if (!shouldReduceMotion) haptics('light')
  }, [shouldReduceMotion])

  /** Empty 自由局 preview → open the picker (if collapsed) and jump to it. */
  const handlePreviewCustomLink = useCallback(() => {
    setShowAdvanced(true)
    setScrollTarget('tier-advanced-grid')
    if (!shouldReduceMotion) haptics('light')
    socialIcebreakerAnalytics.track('preview_custom_link_tapped', sessionId)
  }, [sessionId, shouldReduceMotion])

  const handleStart = useCallback(async () => {
    if (isSubmitting) {
      return
    }

    if (!sessionId) {
      Taro.showToast({ title: '缺少会话信息', icon: 'none', duration: TOAST_MEDIUM_MS })
      return
    }

    if (selectedTier === 'custom' && selectedPhases.length === 0) {
      Taro.showToast({ title: '至少选择一个游戏哦', icon: 'none', duration: TOAST_MEDIUM_MS })
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
        selectedPhases,
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
              selectedPhases: selectedTier === 'custom' ? selectedPhases : undefined,
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
  }, [isSubmitting, sessionId, displayName, selectedTier, selectedVibe, selectedPhases])

  const yuezaiReaction = YUEZAI_REACTIONS[selectedTier][selectedVibe]

  // Preview echoes the card's display name (轻松破冰/深度畅聊/游戏狂欢/自由局),
  // never the machine tier label, so the confirmation reads as the same choice.
  const selectedCardTitle = selectedTier === 'custom'
    ? '自由局'
    : (TIER_PRESETS.find((p) => p.tier === selectedTier)?.title ?? '')

  // Real flow data: preset tiers mirror the server run-plan templates (with the
  // 加映 mini_script row spliced in before 回顾 whenever the server reports that
  // phase enabled); 自由局 lists the picked games in tap order.
  const previewFlow = useMemo<PreviewFlowRow[]>(() => {
    if (selectedTier === 'custom') {
      return selectedPhases.map((phase) => ({
        key: phase,
        label: PREVIEW_PHASE_LABELS[phase] ?? phase,
        minutes: CUSTOM_GAME_OPTIONS.find((game) => game.phase === phase)?.minutes ?? 0,
      }))
    }
    const plan = TIER_RUN_PLANS[selectedTier]
    if (!plan) return []
    const rows: PreviewFlowRow[] = plan.segments.map((segment, index) => ({
      key: `${segment.phase}-${index}`,
      label: PREVIEW_PHASE_LABELS[segment.phase] ?? segment.phase,
      minutes: segment.allocatedMinutes,
      energy: segment.energyWeight,
    }))
    if (miniScriptPreviewEnabled) {
      // The server funds this segment out of the other rows, so the tier total
      // stays constant and the 25′ here is nominal, not the funded amount.
      const bonusRow: PreviewFlowRow = {
        key: 'mini_script-bonus',
        label: PREVIEW_PHASE_LABELS.mini_script ?? 'mini_script',
        minutes: MINI_SCRIPT_PREVIEW_MINUTES,
        purpose: '加映',
      }
      const recapIndex = rows.findIndex((row) => row.key.startsWith('recap-'))
      if (recapIndex >= 0) rows.splice(recapIndex, 0, bonusRow)
      else rows.push(bonusRow)
    }
    if (rows.length > 0) {
      rows[0] = { ...rows[0], purpose: '开场' }
      rows[rows.length - 1] = { ...rows[rows.length - 1], purpose: '收尾' }
    }
    return rows
  }, [selectedTier, selectedPhases, miniScriptPreviewEnabled])

  // Menu-style two-column itinerary: reading order runs down the left column,
  // then down the right — never zig-zagging across the fold.
  const previewFlowMid = Math.ceil(previewFlow.length / 2)
  const previewFlowColumns = [
    previewFlow.slice(0, previewFlowMid),
    previewFlow.slice(previewFlowMid),
  ]

  const isCustomEmpty = selectedTier === 'custom' && selectedPhases.length === 0
  const customSelectionMinutes = getCustomSelectionMinutes(selectedPhases)
  // Guardrail (G5): beyond ~6 rows or 70 minutes the evening turns into a rush.
  const customOverloaded = selectedPhases.length > 6 || customSelectionMinutes > 70

  // Figures line — one new fact instead of an echo of the card title.
  const previewFigures = isCustomEmpty
    ? '待你排 · 至少 1 个环节'
    : selectedTier === 'custom'
      ? `自由局 · 已排 ${selectedPhases.length} 个环节 · 约 ${customSelectionMinutes} 分钟`
      : `${selectedCardTitle} · ${TIER_RUN_PLANS[selectedTier]?.totalMinutes ?? 0} 分钟 · ${previewFlow.length} 个环节`

  return (
    <View className={`tier-selector ${shouldReduceMotion ? 'tier-selector--reduce-motion' : ''}`}>
      {/* Scrollable content region — keeps the page itself from scrolling
          (no onPageScroll) while every card stays reachable on short phones. */}
      <ScrollView
        className='tier-selector__scroll'
        scrollY
        enhanced
        scrollIntoView={scrollTarget}
        showScrollbar={false}
      >
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
                        <View className='tier-selector__check-icon'>
                          <JoyJoinIcon emoji='✓' size={24} />
                        </View>
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
              aria-label={showAdvanced ? '收起游戏列表' : '先看看有哪些游戏，不改当前选择'}
              role='button'
              aria-expanded={showAdvanced}
              aria-controls='tier-advanced-grid'
            >
              <Text className='tier-selector__advanced-toggle-text'>
                {showAdvanced ? '收起游戏列表' : '先看看有哪些游戏'}
              </Text>
              <View className={`tier-selector__advanced-toggle-arrow ${showAdvanced ? 'tier-selector__advanced-toggle-arrow--up' : ''}`} />
            </View>

            {showAdvanced && (
              <View id='tier-advanced-grid' className='tier-selector__game-list'>
                <Text className='tier-selector__game-list-hint'>
                  点选游戏即加入自由局 · 按点选顺序进行
                </Text>
                {CUSTOM_GAME_OPTIONS.filter((game) =>
                  availableGamePhases.includes(game.phase),
                ).map((game) => {
                  const order = selectedPhases.indexOf(game.phase) + 1
                  const isSelected = order > 0
                  return (
                    <View
                      key={game.phase}
                      className={`tier-selector__game-row ${isSelected ? 'tier-selector__game-row--selected' : ''}`}
                      onClick={() => handleToggleCustomGame(game.phase)}
                      hoverClass='tier-selector__game-row--pressed'
                      hoverStartTime={0}
                      hoverStayTime={120}
                      role='checkbox'
                      aria-checked={isSelected}
                      aria-label={`${game.title}，预计${game.minutes}分钟${isSelected ? `，第${order}个` : ''}`}
                    >
                      <PhaseHeaderIcon
                        phase={game.iconPhase}
                        size={56}
                        className='tier-selector__game-icon'
                      />
                      <View className='tier-selector__game-copy'>
                        <Text className='tier-selector__game-title'>{game.title}</Text>
                        <Text className='tier-selector__game-duration'>预计 {game.minutes} 分钟</Text>
                      </View>
                      {isSelected && (
                        <View className='tier-selector__game-selection'>
                          <JoyJoinIcon emoji='✓' size={20} />
                          <Text className='tier-selector__game-order'>{order}</Text>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
      </View>

      {/* Custom mode card */}
      {customModeEnabled && (
        <View className='tier-selector__section'>
          <View
            className={`tier-selector__custom-card ${selectedTier === 'custom' ? 'tier-selector__custom-card--active' : ''}`}
            onClick={() => {
              handleSelectCombo('custom', 'balanced')
              setShowAdvanced(true)
            }}
            hoverClass='tier-selector__custom-card--pressed'
            hoverStartTime={0}
            hoverStayTime={200}
            aria-label='自由局，游戏和顺序由你决定'
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
              <Text className='tier-selector__custom-card-tagline'>自己挑游戏排顺序，自由度最高</Text>
              <Text className='tier-selector__custom-card-meta'>
                {selectedPhases.length > 0
                  ? `已选 ${selectedPhases.length} 个 · 约 ${getCustomSelectionMinutes(selectedPhases)} 分钟`
                  : '时长由你定 · 至少 1 个游戏'}
              </Text>
            </View>
            {selectedTier === 'custom' && (
              <View className='tier-selector__custom-card-check'>
                <View className='tier-selector__check-icon'>
                  <JoyJoinIcon emoji='✓' size={24} />
                </View>
              </View>
            )}
            <View className='tier-selector__custom-card-sparkle tier-selector__custom-card-sparkle--1' />
            <View className='tier-selector__custom-card-sparkle tier-selector__custom-card-sparkle--2' />
          </View>
        </View>
      )}

      {/* Flow preview for the selected choice — the procedural answer to
          "今晚到底做什么". De-weighted through value structure (no fill, no
          chrome, no shadow) so it never reads as a fourth tappable option. */}
      <View className='tier-selector__preview' key={`preview-${fadeKey}`}>
        <View className='tier-selector__preview-frame'>
          <Image
            className='tier-selector__preview-frame-image'
            src={TIER_CARD_BACKGROUNDS[selectedTier]}
            mode='aspectFill'
            aria-hidden
          />
        </View>
        <Text className='tier-selector__preview-kicker'>今晚流程</Text>
        <Text className='tier-selector__preview-figures'>{previewFigures}</Text>
        {isCustomEmpty ? (
          <View className='tier-selector__preview-flow'>
            <View className='tier-selector__preview-flow-col'>
              <View className='tier-selector__preview-flow-row tier-selector__preview-flow-row--ghost tier-selector__preview-flow-row--last'>
                <Text className='tier-selector__preview-flow-index'>01</Text>
                <View className='tier-selector__preview-flow-label'>
                  <Text className='tier-selector__preview-flow-name'>第一个环节</Text>
                </View>
                <Text className='tier-selector__preview-flow-minutes'>—</Text>
              </View>
            </View>
            <View className='tier-selector__preview-flow-col'>
              <View className='tier-selector__preview-flow-row tier-selector__preview-flow-row--ghost'>
                <Text className='tier-selector__preview-flow-index'>02</Text>
                <View className='tier-selector__preview-flow-label'>
                  <Text className='tier-selector__preview-flow-name'>第二个环节</Text>
                </View>
                <Text className='tier-selector__preview-flow-minutes'>—</Text>
              </View>
              <View
                className='tier-selector__preview-flow-row tier-selector__preview-flow-row--action tier-selector__preview-flow-row--last'
                onClick={handlePreviewCustomLink}
                hoverClass='tier-selector__preview-flow-row--pressed'
                hoverStartTime={0}
                hoverStayTime={100}
                role='button'
                aria-label='去挑一个游戏'
              >
                <Text className='tier-selector__preview-flow-action'>去挑一个</Text>
                <View className='tier-selector__preview-flow-action-arrow' />
              </View>
            </View>
          </View>
        ) : (
          previewFlow.length > 0 && (
            <View className='tier-selector__preview-flow'>
              {previewFlowColumns.map((column, columnIndex) => (
                <View key={`col-${columnIndex}`} className='tier-selector__preview-flow-col'>
                  {column.map((item, rowIndex) => {
                    // Menu-style reading order: down the left column first.
                    const displayIndex = (columnIndex === 0 ? 0 : previewFlowMid) + rowIndex
                    const isLastInColumn = rowIndex === column.length - 1
                    return (
                      <View
                        key={item.key}
                        className={`tier-selector__preview-flow-row ${isLastInColumn ? 'tier-selector__preview-flow-row--last' : ''}`}
                        style={{ animationDelay: `${displayIndex * 30}ms` }}
                      >
                        <Text className='tier-selector__preview-flow-index'>
                          {String(displayIndex + 1).padStart(2, '0')}
                        </Text>
                        <View className='tier-selector__preview-flow-label'>
                          <Text className='tier-selector__preview-flow-name'>{item.label}</Text>
                          {item.purpose && (
                            <Text className='tier-selector__preview-flow-purpose'>{item.purpose}</Text>
                          )}
                        </View>
                        {item.energy !== undefined && (
                          <View className='tier-selector__preview-flow-energy'>
                            {[1, 2, 3].map((level) => (
                              <View
                                key={level}
                                className={`tier-selector__preview-flow-dot ${level <= item.energy! ? 'tier-selector__preview-flow-dot--on' : ''}`}
                              />
                            ))}
                          </View>
                        )}
                        <Text className='tier-selector__preview-flow-minutes'>{item.minutes}′</Text>
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
          )
        )}
        {!isCustomEmpty && (
          <Text
            className={`tier-selector__preview-affirmation ${customOverloaded ? 'tier-selector__preview-affirmation--warning' : ''}`}
          >
            {customOverloaded
              ? '环节偏多，节奏会赶 · 建议 5 个以内'
              : getPreviewAffirmation(selectedTier, selectedVibe)}
          </Text>
        )}
        <View className='tier-selector__preview-footnote'>
          <Text className='tier-selector__preview-anchor'>这一轮结束后，进入自由聊天时间</Text>
          <Text className='tier-selector__preview-signature'>悦聚 · 按 6 人桌编排</Text>
        </View>
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
        <Text className='tier-selector__footer-note'>
          环节由悦仔带着走，你只管点下一步 · 开始后全桌可见
        </Text>
      </View>
    </View>
  )
}
