import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildStructuredInterestsPayload,
  submitInterests,
  INTEREST_CATEGORY_EMOJIS,
  type InterestSelectionDraft,
  type InterestSelectionLevel,
} from '@shared/api'
import {
  INTEREST_TAXONOMY,
  MACRO_CATEGORY_LABELS,
  type InterestDefinition,
  type MacroCategory,
} from '@shared/interests'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { getOnboardingVoiceLine, type OnboardingVoiceStepId } from '@shared/copy/onboardingVoice'
import { getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import { ARCHETYPE_BY_ID, type ArchetypeId } from '@shared/personality/archetypeNames'
import { CATEGORY_COLORS } from '@shared/ui/categoryColors'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { useAuth, useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useStepAbandonGuard } from '../../../hooks/onboarding/useStepAbandonGuard'
import { useOnboardingCheckpoint } from '../../../hooks/onboarding/useOnboardingCheckpoint'
import { usePreloadCategoryIcons } from '../../../hooks/usePreloadCategoryIcons'
import { TOAST_DEFAULT_MS } from '../../../lib/utils/uiConstants'
import { navigateToMiniProgramNextStep } from '../../../lib/onboarding/onboardingNavigation'
import { ONBOARDING_MASCOT_SIZE } from '../../../lib/onboarding/onboardingRoutes'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { looksLikeOfflineError, OFFLINE_PREFLIGHT_COPY } from '../../../lib/utils/offlineDetection'
import { prefetchCeremonyAssets, prefetchInterestIllustrations } from '../../../lib/utils/onboardingPrefetch'
import { logError, logInfo, logWarn } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import OnboardingLoadingShell, { SHELL_EXIT_HOLD_MS } from '../../../components/loading/OnboardingLoadingShell'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import BoxJourneySpine from '../../../components/onboarding/BoxJourneySpine'
import { getXiaoyueAsset } from '../personality-test/visuals'
import './index.scss'

const MIN_INTERESTS = 3
// No maximum selection count (product decision 2026-08-03): users may select
// as many interests as they like. The server likewise enforces only the min.

// Per-tap coachmark copy keyed by the level the tap just reached.
// Copy budget: ≤10 chars so the anchored bubble stays clear of card edges.
const TAP_HINT_COPY: Record<InterestSelectionLevel, string> = {
  1: '再点一次增强热度',
  2: '再点一次设为必聊项',
  3: '再点取消必聊项',
}
const TAP_HINT_DURATION_MS = 1800

// Milestone toast icons (passed to JoyJoinIcon) — module scope so they are
// not re-created on every render.
const UNLOCKED_EMOJI = '🎉'
const FIRST_PRIORITY_EMOJI = '⭐'
const ALL_CATEGORIES_EMOJI = '🌈'

const CATEGORY_ORDER: MacroCategory[] = ['food', 'play', 'sports', 'culture', 'life', 'growth']

// R3-9 人格在场: each taxonomy category gets its own archetype-voiced hint
// line in the voice matrix (Tier A per archetype, Tier B fallback).
const CATEGORY_VOICE_STEP_IDS: Record<MacroCategory, OnboardingVoiceStepId> = {
  food: 'extended-category-food',
  play: 'extended-category-play',
  sports: 'extended-category-sports',
  culture: 'extended-category-culture',
  life: 'extended-category-life',
  growth: 'extended-category-growth',
}

// WeChat resolves inline var() unreliably, so inline styles carry the resolved
// hex values. Must stay in sync with --jj-heat-l1..l3 in index.scss.
const HEAT_COLORS = {
  1: '#A78BFA',
  2: '#8B5CF6',
  3: '#F97316',
} as const

const CATEGORY_META: Record<MacroCategory, { dotColor: string; description: string }> = {
  food: { dotColor: CATEGORY_COLORS.food, description: '火锅、日料、咖啡、小酌——适合边吃边聊的场景。' },
  play: { dotColor: CATEGORY_COLORS.play, description: '剧本杀、KTV、小酒馆——一群人一起玩最热闹。' },
  sports: { dotColor: CATEGORY_COLORS.sports, description: '徒步、健身、露营、骑行——用身体认识新朋友。' },
  culture: { dotColor: CATEGORY_COLORS.culture, description: '看展、电影、演唱会、追剧——一起去看点什么。' },
  life: { dotColor: CATEGORY_COLORS.life, description: '摄影、穿搭、旅行、CityWalk——把日常过成喜欢的样子。' },
  growth: { dotColor: CATEGORY_COLORS.growth, description: '阅读、科技、搞事业、语言搭子——聊得来也学得动。' },
}

const INTEREST_LEVEL_META: Array<{
  level: InterestSelectionLevel
  label: string
  shortLabel: string
  description: string
  color: string
  bgColor: string
  borderColor: string
}> = [
  { level: 1, label: '感兴趣', shortLabel: '感兴趣', description: '加入你的兴趣画像', color: HEAT_COLORS[1], bgColor: 'rgba(167,139,250,0.12)', borderColor: 'rgba(167,139,250,0.28)' },
  { level: 2, label: '很热衷', shortLabel: '很热衷', description: '更容易聊到停不下来', color: HEAT_COLORS[2], bgColor: 'rgba(139,92,246,0.14)', borderColor: 'rgba(139,92,246,0.35)' },
  { level: 3, label: '必聊项', shortLabel: '必聊项', description: '优先排到同好，预览重点展示', color: HEAT_COLORS[3], bgColor: 'rgba(249,115,22,0.16)', borderColor: 'rgba(249,115,22,0.42)' },
]

const activeInterests = INTEREST_TAXONOMY.filter((item) => item.active)
const groupedInterests = activeInterests.reduce<Record<MacroCategory, InterestDefinition[]>>(
  (acc, item) => {
    const category = item.macroCategory as MacroCategory
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  },
  {} as Record<MacroCategory, InterestDefinition[]>,
)

// First-visit gesture demo target: the first card of the first category. A
// CSS-only "ghost tap" loop plays on this card until the user's first real
// tap, demonstrating the multi-tap heat gesture before any interaction.
const DEMO_TOPIC_ID = groupedInterests[CATEGORY_ORDER[0]]?.[0]?.id ?? null

function getInterestLevelMeta(level: InterestSelectionLevel | undefined) {
  return INTEREST_LEVEL_META.find((item) => item.level === level)
}

function InterestTierIndicator({ level }: { level: InterestSelectionLevel }) {
  return (
    <View className='extended-data__tier-indicator' aria-label={`热度 ${level} 档`}>
      {INTEREST_LEVEL_META.map((meta) => {
        const filled = level >= meta.level
        return (
          <View
            key={meta.level}
            className={[
              'extended-data__tier-indicator-segment',
              filled ? 'extended-data__tier-indicator-segment--filled' : '',
              `extended-data__tier-indicator-segment--level-${meta.level}`,
            ].join(' ')}
            style={filled ? { backgroundColor: meta.color } : undefined}
          />
        )
      })}
    </View>
  )
}

export default function ExtendedDataPage() {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const [levelsById, setLevelsById] = useState<Record<string, InterestSelectionLevel>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [error, setError] = useState('')
  // Loading-shell continuity bridge (see essential-data for the twin).
  const [shellFading, setShellFading] = useState(false)
  const [shellDismissed, setShellDismissed] = useState(false)
  const shellRenderedRef = useRef(false)

  useResetOnShow(setIsPageExiting, setIsSubmitting, setShellFading)
  const [tapHint, setTapHint] = useState<{ topicId: string; level: InterestSelectionLevel; message: string } | null>(null)
  // Set on the first real tap anywhere — permanently ends the ghost-tap demo
  // for this session (the user has started interacting, demo has done its job).
  const [tapDemoDismissed, setTapDemoDismissed] = useState(false)
  const [poppingCardId, setPoppingCardId] = useState<string | null>(null)
  const [milestone, setMilestone] = useState<'unlocked' | 'first-priority' | 'all-categories' | null>(null)
  const poppingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const milestoneTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tapHintTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // L2/L3 hints show once per session (keyed `l2`/`l3`); the L1 discovery hint
  // may repeat on up to 3 distinct cards (keyed `l1:<topicId>`).
  const seenTapHintsRef = useRef<Set<string>>(new Set())
  const l1HintCountRef = useRef(0)
  // Once any card reaches L2, the user has demonstrated the heat gesture —
  // permanently suppress the L1 "tap again" hint for this session.
  const hasReachedLevel2Ref = useRef(false)
  const { isLoading } = useAuthGuard({
    suspendOnboardingRedirect: isSubmitting || isPageExiting,
  })

  // Loading-shell continuity bridge: hold the shell for a short exit fade
  // once auth resolves. Reduced motion swaps instantly; a shell that never
  // rendered (fast cached auth) is dismissed without any hold. The fading
  // guard is a ref — see the same effect in essential-data for why the
  // state flag must NOT be a dependency (stuck-shell bug).
  const shellFadingRef = useRef(false)

  useEffect(() => {
    if (isLoading) {
      shellRenderedRef.current = true
      return
    }
    if (shellDismissed || !shellRenderedRef.current) return
    if (shouldReduceMotion) {
      setShellDismissed(true)
      return
    }
    if (shellFadingRef.current) return
    shellFadingRef.current = true
    setShellFading(true)
    const t = setTimeout(() => setShellDismissed(true), SHELL_EXIT_HOLD_MS)
    return () => clearTimeout(t)
  }, [isLoading, shellDismissed, shouldReduceMotion])
  const { user } = useAuth()
  const userArchetype = (user?.archetype as ArchetypeId | undefined) ?? (user?.primaryArchetype as ArchetypeId | undefined)
  const archetypeName = userArchetype ? ARCHETYPE_BY_ID[userArchetype]?.nameCn : undefined
  const archetypeAccent = userArchetype ? getContrastSafeArchetypeColor(userArchetype) : undefined

  usePreloadCategoryIcons(!isLoading)

  // Idle-prefetch the first interest illustration of each category after the
  // first contentful render — deferred so it never competes with first paint.
  useEffect(() => {
    if (isLoading) return
    const t = setTimeout(() => {
      void prefetchInterestIllustrations()
    }, 1000)
    return () => clearTimeout(t)
  }, [isLoading])
  // Pre-warm the coach bubble's pointing sprite so it decodes before the
  // bubble animates in (replaces the old 0×0 hidden <Image> preload hack).
  useEffect(() => {
    Taro.getImageInfo({ src: getXiaoyueAsset('pointing') }).catch(() => {
      logWarn('[ExtendedData] Pointing sprite pre-warm failed', { src: getXiaoyueAsset('pointing') })
    })
  }, [])
  const invalidateAuth = useInvalidateAuth()
  const analytics = useOnboardingAnalytics('extended-data', { enabled: !isLoading })
  const { saveCheckpoint } = useOnboardingCheckpoint()

  // R1-3 funnel: single-screen enter/abandon discipline. step_enter pairs with
  // the essential-data sub-step events so funnel queries stay uniform.
  useEffect(() => {
    if (isLoading) return
    analytics.stepEnter({ stepId: 'interests', stepIndex: 0 })
  }, [analytics, isLoading])

  const { markCompleted: markInterestsCompleted } = useStepAbandonGuard(() => {
    if (isLoading) return
    analytics.stepAbandoned('exit', {
      stepId: 'interests',
      stepIndex: 0,
      selectedCount: Object.keys(levelsById).length,
    })
  })

  useEffect(() => {
    return () => {
      if (poppingTimeoutRef.current) {
        clearTimeout(poppingTimeoutRef.current)
      }
      if (milestoneTimeoutRef.current) {
        clearTimeout(milestoneTimeoutRef.current)
      }
      if (tapHintTimeoutRef.current) {
        clearTimeout(tapHintTimeoutRef.current)
      }
    }
  }, [])

  const selectionDrafts = useMemo<InterestSelectionDraft[]>(
    () =>
      Object.entries(levelsById).map(([topicId, level]) => ({
        topicId,
        level,
      })),
    [levelsById],
  )

  const selectionPreview = useMemo(
    () => buildStructuredInterestsPayload(selectionDrafts),
    [selectionDrafts],
  )

  const selectedCount = selectionPreview.totalSelections
  const topPriorityCount = selectionPreview.topPriorities?.length ?? 0

  const prevSelectedCountRef = useRef(selectedCount)
  const prevTopPriorityCountRef = useRef(topPriorityCount)
  const prevCategoryCoverageRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const prev = prevSelectedCountRef.current
    prevSelectedCountRef.current = selectedCount
    const prevPriority = prevTopPriorityCountRef.current
    prevTopPriorityCountRef.current = topPriorityCount

    const selectedCategories = new Set(
      selectionPreview.selections.map((s) => INTEREST_TAXONOMY.find((i) => i.id === s.topicId)?.macroCategory).filter(Boolean),
    )
    const prevCategories = prevCategoryCoverageRef.current
    prevCategoryCoverageRef.current = selectedCategories as Set<string>

    let newMilestone: typeof milestone = null
    if (prev < MIN_INTERESTS && selectedCount >= MIN_INTERESTS) {
      haptics('success')
      newMilestone = 'unlocked'
    } else if (prevPriority === 0 && topPriorityCount > 0) {
      haptics('success')
      newMilestone = 'first-priority'
    } else if (selectedCategories.size === CATEGORY_ORDER.length && selectedCategories.size > prevCategories.size) {
      haptics('success')
      newMilestone = 'all-categories'
    }

    if (newMilestone) {
      if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current)
      setMilestone(newMilestone)
      milestoneTimeoutRef.current = setTimeout(() => {
        milestoneTimeoutRef.current = null
        setMilestone((current) => (current === newMilestone ? null : current))
      }, 2200)
    }
  }, [selectedCount, topPriorityCount, selectionPreview.selections])

  const canSubmit = selectedCount >= MIN_INTERESTS

  const coachCopy = useMemo(() => {
    if (selectedCount === 0) {
      // Bet 1 人格在场: Xiaoyue narrates as the user's archetype (Tier A
      // voice matrix); Tier B step line is the unknown-archetype fallback.
      return getOnboardingVoiceLine('extended-interests', userArchetype)
    }

    if (!canSubmit) {
      return archetypeName
        ? `已经有 ${selectedCount} 个同好信号了。再选 ${MIN_INTERESTS - selectedCount} 个，${archetypeName}的画像就能生成。`
        : `已经有 ${selectedCount} 个同好信号了。再选 ${MIN_INTERESTS - selectedCount} 个，画像就能生成。`
    }

    if (topPriorityCount > 0) {
      return '必聊项会优先帮你找到同好。继续升温，或者直接生成入场卡预览。'
    }

    return '画像已解锁！把最期待的兴趣升到必聊项，帮你排得更对味。'
  }, [archetypeName, canSubmit, selectedCount, topPriorityCount, userArchetype])

  const ctaLabel = useMemo(() => {
    if (isSubmitting) {
      return '提交中…'
    }
    if (canSubmit) {
      return '生成我的入场卡预览'
    }
    return `还需 ${Math.max(MIN_INTERESTS - selectedCount, 0)} 项热度`
  }, [canSubmit, isSubmitting, selectedCount])

  const pageClassName = ['extended-data', isPageExiting ? 'extended-data--exiting' : '']
    .filter(Boolean)
    .join(' ')

  const toggleInterestLevel = useCallback(
    (topicId: string) => {
      setTapDemoDismissed(true)
      const currentLevel = levelsById[topicId]

      const nextLevels = { ...levelsById }

      if (!currentLevel) {
        nextLevels[topicId] = 1
      } else if (currentLevel === 1) {
        nextLevels[topicId] = 2
      } else if (currentLevel === 2) {
        nextLevels[topicId] = 3
      } else {
        delete nextLevels[topicId]
      }

      setLevelsById(nextLevels)
      haptics('light')
      setPoppingCardId(topicId)
      if (poppingTimeoutRef.current) {
        clearTimeout(poppingTimeoutRef.current)
      }
      poppingTimeoutRef.current = setTimeout(() => {
        poppingTimeoutRef.current = null
        setPoppingCardId((current) => (current === topicId ? null : current))
      }, 200)

      const reachedLevel = nextLevels[topicId]
      if (reachedLevel === 2 || reachedLevel === 3) {
        hasReachedLevel2Ref.current = true
      }

      // Anchored per-tap guidance. L2/L3 hints show once per session; the L1
      // discovery hint may repeat on up to 3 distinct cards until the user
      // reaches L2 anywhere. The L3 hint is suppressed when this tap also
      // fires the first-priority milestone toast (contradictory messages).
      if (tapHintTimeoutRef.current) {
        clearTimeout(tapHintTimeoutRef.current)
        tapHintTimeoutRef.current = null
      }
      const milestoneFiresOnThisTap = reachedLevel === 3 && topPriorityCount === 0
      let hintKey: string | null = null
      if (reachedLevel === 1 && !hasReachedLevel2Ref.current && l1HintCountRef.current < 3) {
        hintKey = `l1:${topicId}`
      } else if ((reachedLevel === 2 || reachedLevel === 3) && !milestoneFiresOnThisTap) {
        hintKey = `l${reachedLevel}`
      }
      if (hintKey != null && reachedLevel != null && !seenTapHintsRef.current.has(hintKey)) {
        seenTapHintsRef.current.add(hintKey)
        if (reachedLevel === 1) {
          l1HintCountRef.current += 1
        }
        setTapHint({ topicId, level: reachedLevel, message: TAP_HINT_COPY[reachedLevel] })
        tapHintTimeoutRef.current = setTimeout(() => {
          tapHintTimeoutRef.current = null
          setTapHint(null)
        }, TAP_HINT_DURATION_MS)
      } else {
        setTapHint(null)
      }
    },
    [analytics, levelsById, topPriorityCount],
  )

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) {
      if (!canSubmit) {
        analytics.validationFailed('interests', 'min-selection-not-reached')
      }
      return
    }

    try {
      const network = await Taro.getNetworkType()
      if (network.networkType === 'none') {
        Taro.showToast({
          title: OFFLINE_PREFLIGHT_COPY,
          icon: 'none',
          duration: TOAST_DEFAULT_MS,
        })
        analytics.errorOccurred('submit_offline', 'network unavailable')
        return
      }
    } catch {
      // Best-effort: continue if network detection fails
    }

    setIsSubmitting(true)
    setError('')

    try {
      logInfo('[ExtendedData] Submitting interests', {
        selectedCount,
        topPriorityCount,
        totalHeat: selectionPreview.totalHeat,
      })

      await submitInterests(apiRequest, { interests: selectionDrafts })

      // Fire-and-forget: warm the profile-review ceremony's blind-box art
      // during the post-submit gap. Never awaited, never blocks navigation.
      void prefetchCeremonyAssets()

      await saveCheckpoint('extended-data')
      await invalidateAuth()
      const userState = await getUserState()

      analytics.stepCompleted({
        selectedInterestCount: selectedCount,
        totalHeat: selectionPreview.totalHeat,
        nextStep: userState.nextStep ?? 'profile-review',
      })
      // Submit succeeded — the onward navigation must not count as abandonment.
      markInterestsCompleted()

      // NOTE: prefers-reduced-motion is respected by the CSS animations in this screen.
      // The route transition below is handled by onboardingNavigation and is not user-motion.
      await navigateToMiniProgramNextStep(userState.nextStep, {
        mode: 'replace',
        transition: { beforeNavigate: () => setIsPageExiting(true) },
      })
    } catch (err) {
      setIsPageExiting(false)
      // Offline branch: inline banner with unified copy (no 暂存 promise —
      // selection drafts here are session-local, so only re-submit is promised).
      // Inline banner only — no toast duplicating the same failure message.
      if (looksLikeOfflineError(err)) {
        const offlineMessage = '网络好像断开了，连上网络后重新提交就好。'
        setError(offlineMessage)
        analytics.errorOccurred('submit_offline', offlineMessage)
        logError('[ExtendedData] Submit failed offline', { message: offlineMessage })
        return
      }
      const message = err instanceof Error ? err.message : getErrorMessage('submit-failed')
      setError(message)
      analytics.errorOccurred('submit_failed', message)
      logError('[ExtendedData] Submit failed', { message })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    canSubmit,
    invalidateAuth,
    isSubmitting,
    markInterestsCompleted,
    saveCheckpoint,
    selectedCount,
    selectionDrafts,
    selectionPreview.totalHeat,
    topPriorityCount,
  ])

  if (isLoading || (shellRenderedRef.current && !shellDismissed)) {
    return (
      <OnboardingLoadingShell
        stepLabel='装盒中 · 第 2 格'
        title={`${DEFAULT_MASCOT_DISPLAY_NAME}在点亮你的兴趣热度`}
        subtitle='把这一步准备好后，资料预览就会更有你的味道。'
        continuity
        exiting={shellFading}
      />
    )
  }

  const milestone_emoji = milestone
    ? milestone === 'unlocked'
      ? UNLOCKED_EMOJI
      : milestone === 'first-priority'
        ? FIRST_PRIORITY_EMOJI
        : ALL_CATEGORIES_EMOJI
    : null

  return (
    <View className={pageClassName}>
      <View className='extended-data__header extended-data__stage extended-data__stage--1'>
        {/* 装盒进度 spine (Bet 3) replaces the old "Onboarding 3 / 4"
            eyebrow pill in place. */}
        <BoxJourneySpine
          step={2}
          accentColor={archetypeAccent}
          className='extended-data__spine'
        />
        <Text className='extended-data__title'>把兴趣热度标出来</Text>
        <Text className='extended-data__subtitle'>
          轻点加入 → 再点升温 → 三档成为必聊项
        </Text>
      </View>

      <View className='extended-data__coach extended-data__stage extended-data__stage--2'>
        <XiaoyueChatBubble
          content={coachCopy}
          pose='pointing'
          horizontal
          showGlow
          tail
          avatarSize={ONBOARDING_MASCOT_SIZE}
        />
      </View>

      <View className='extended-data__heat-guide extended-data__stage extended-data__stage--3'>
        {INTEREST_LEVEL_META.map((item, index) => (
          <View key={item.level} className='extended-data__heat-guide-step'>
            <View
              className='extended-data__heat-guide-dot'
              style={{
                backgroundColor: item.color,
                borderColor: item.borderColor,
              }}
            />
            <View className='extended-data__heat-guide-text'>
              <Text className='extended-data__heat-guide-label'>{item.label}</Text>
              <Text className='extended-data__heat-guide-desc'>{item.description}</Text>
            </View>
            {index < INTEREST_LEVEL_META.length - 1 && (
              <View className='extended-data__heat-guide-arrow'>
                <Text className='extended-data__heat-guide-arrow-text'>&rarr;</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      <ScrollView className='extended-data__scroll' scrollY enhanced showScrollbar={false}>
        <View className='extended-data__content'>
          {(Object.entries(groupedInterests) as [MacroCategory, InterestDefinition[]][])
            .sort((left, right) => CATEGORY_ORDER.indexOf(left[0]) - CATEGORY_ORDER.indexOf(right[0]))
            .map(([category, items]) => {
              const selectedInCategory = items.filter((item) => levelsById[item.id]).length

              return (
                <Card key={category} className='extended-data__category'>
                  <View className='extended-data__category-header'>
                    <View className='extended-data__category-title-wrap'>
                      <JoyJoinIcon
                        emoji={INTEREST_CATEGORY_EMOJIS[category]}
                        tier='category'
                        size={36}
                        lazyLoad={false}
                        className={[
                          'extended-data__category-icon',
                          selectedInCategory > 0 ? 'extended-data__category-icon--active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      />
                      <View className='extended-data__category-title-group'>
                        <Text className='extended-data__category-title'>
                          {MACRO_CATEGORY_LABELS[category]}
                        </Text>
                        <Text className='extended-data__category-description'>
                          {CATEGORY_META[category]?.description}
                        </Text>
                        {/* R3-9 人格在场: archetype-voiced per-category hint
                            (Tier A when the archetype is known, Tier B
                            fallback otherwise) — the section's own hint line,
                            no new surface. */}
                        <Text className='extended-data__category-hint'>
                          {getOnboardingVoiceLine(CATEGORY_VOICE_STEP_IDS[category], userArchetype)}
                        </Text>
                      </View>
                    </View>
                    {selectedInCategory > 0 ? (
                      <Text className='extended-data__category-count'>
                        {selectedInCategory} 已选
                      </Text>
                    ) : null}
                  </View>

                  <View className='extended-data__interest-grid'>
                    {items.map((item, itemIndex) => {
                      const level = levelsById[item.id]
                      const levelMeta = getInterestLevelMeta(level)
                      // Grid is 2-column: first-row cards render the bubble
                      // below so it is not clipped by the category header.
                      const isFirstRow = itemIndex < 2
                      const showTapHint = tapHint?.topicId === item.id
                      // Ghost-tap demo plays only on the first card, only
                      // while nothing is selected (covers checkpoint restores
                      // that pre-populate selections).
                      const showTapDemo =
                        !tapDemoDismissed && selectedCount === 0 && item.id === DEMO_TOPIC_ID

                      return (
                        <View
                          key={item.id}
                          className={[
                            'extended-data__interest-card',
                            level ? `extended-data__interest-card--level-${level}` : '',
                            poppingCardId === item.id ? 'extended-data__interest-card--popping' : '',
                            showTapHint ? 'extended-data__interest-card--hint' : '',
                            showTapDemo ? 'extended-data__interest-card--demo' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          role='button'
                          aria-pressed={!!level}
                          aria-label={level ? `${item.label}，${levelMeta?.label}` : `${item.label}，未选择`}
                          onClick={() => toggleInterestLevel(item.id)}
                          hoverClass='extended-data__interest-card--pressed'
                          hoverStayTime={100}
                        >
                          {showTapHint ? (
                            <View
                              className={[
                                'extended-data__coachmark',
                                isFirstRow ? 'extended-data__coachmark--below' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              aria-live='polite'
                              role='status'
                            >
                              <View className='extended-data__coachmark-tap' aria-hidden='true'>
                                <View className='extended-data__coachmark-tap-pulse' />
                              </View>
                              <View
                                className={`extended-data__coachmark-dot extended-data__coachmark-dot--level-${tapHint.level}`}
                                aria-hidden='true'
                              />
                              <Text className='extended-data__coachmark-text'>{tapHint.message}</Text>
                              <View className='extended-data__coachmark-arrow' aria-hidden='true' />
                            </View>
                          ) : null}
                          {showTapDemo ? (
                            <View className='extended-data__tap-demo' aria-hidden='true'>
                              <View className='extended-data__tap-demo-tint extended-data__tap-demo-tint--l1' />
                              <View className='extended-data__tap-demo-tint extended-data__tap-demo-tint--l2' />
                              <View className='extended-data__tap-demo-ring' />
                              <View className='extended-data__tap-demo-ring extended-data__tap-demo-ring--2' />
                            </View>
                          ) : null}
                          <View className='extended-data__interest-card-top'>
                            <Text className='extended-data__interest-label'>{item.label}</Text>
                            {level ? <InterestTierIndicator level={level} /> : null}
                          </View>
                          <Text className='extended-data__interest-meta'>
                            {levelMeta?.shortLabel || '轻点选择'}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </Card>
              )
            },
          )}
        </View>
      </ScrollView>

      {milestone ? (
        <View className='extended-data__milestone-toast' aria-live='polite' role='status'>
          <View className='extended-data__milestone-toast-inner'>
            {milestone_emoji && (
              <JoyJoinIcon emoji={milestone_emoji} size={56} className='extended-data__milestone-toast-emoji' />
            )}
            <Text className='extended-data__milestone-toast-title'>
              {milestone === 'unlocked'
                ? '同好画像解锁'
                : milestone === 'first-priority'
                  ? '首个必聊项诞生'
                  : '六大领域全亮'}
            </Text>
            <Text className='extended-data__milestone-toast-subtitle'>
              {milestone === 'unlocked'
                ? '可以生成入场卡预览了'
                : milestone === 'first-priority'
                  ? '优先排到同好从这里开始'
                  : '你的兴趣版图真的很丰盛'}
            </Text>
          </View>
        </View>
      ) : null}

      <View className='extended-data__footer'>
        {/* Compact summary row: heat thermometer + counts. The detailed
            stats (热度总值, top-category story) live on the profile-review
            entry card; the CTA below carries the remaining-count coaching. */}
        <View className='extended-data__footer-summary'>
          <View className='extended-data__footer-thermometer' aria-label='热度温度计'>
            {INTEREST_LEVEL_META.map((meta) => {
              const filled = selectedCount >= meta.level
              return (
                <View
                  key={meta.level}
                  className={[
                    'extended-data__footer-thermometer-segment',
                    filled ? 'extended-data__footer-thermometer-segment--filled' : '',
                  ].join(' ')}
                  style={filled ? { backgroundColor: meta.color } : undefined}
                />
              )
            })}
          </View>

          <Text className='extended-data__footer-combined-stat'>
            已选 {selectedCount} 项 · 必聊 {topPriorityCount} 项
          </Text>
        </View>

        {error ? (
          <View className='extended-data__error' aria-live='assertive' role='alert'>
            {error}
          </View>
        ) : null}

        <Button
          variant='brand'
          className={[
            'extended-data__submit',
            canSubmit && !isSubmitting ? 'extended-data__submit--unlocked' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          loading={isSubmitting}
        >
          {ctaLabel}
        </Button>
      </View>
    </View>
  )
}
