import { View, Text, ScrollView, Image } from '@tarojs/components'
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
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useOnboardingCheckpoint } from '../../../hooks/onboarding/useOnboardingCheckpoint'
import { CATEGORY_COLORS } from '@shared/ui/categoryColors'
import { TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../../lib/utils/uiConstants'
import { navigateToMiniProgramNextStep } from '../../../lib/onboarding/onboardingNavigation'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { logError, logInfo } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import { getXiaoyueAsset } from '../personality-test/visuals'
import './index.scss'

const MIN_INTERESTS = 3
const MAX_INTERESTS = 10

const CATEGORY_META: Record<MacroCategory, { dotColor: string; description: string }> = {
  food: { dotColor: CATEGORY_COLORS.food, description: '适合聊口味、探店和周末吃什么。' },
  entertainment: { dotColor: CATEGORY_COLORS.entertainment, description: '更偏玩乐、破冰和局里活跃氛围。' },
  lifestyle: { dotColor: CATEGORY_COLORS.lifestyle, description: '更像你的生活节奏和线下习惯。' },
  culture: { dotColor: CATEGORY_COLORS.culture, description: '适合聊展览、演出、电影和内容审美。' },
  social: { dotColor: CATEGORY_COLORS.social, description: '适合延展成深入对话和长期共同话题。' },
}

const INTEREST_LEVEL_META: Array<{
  level: InterestSelectionLevel
  label: string
  shortLabel: string
  description: string
}> = [
  { level: 1, label: '感兴趣', shortLabel: '已标记', description: '加入你的兴趣画像' },
  { level: 2, label: '很热衷', shortLabel: '升温中', description: '更容易聊到停不下来' },
  { level: 3, label: '必聊项', shortLabel: '高热', description: '优先匹配同好，预览重点展示' },
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

function getInterestLevelMeta(level: InterestSelectionLevel | undefined) {
  return INTEREST_LEVEL_META.find((item) => item.level === level)
}

export default function ExtendedDataPage() {
  const [levelsById, setLevelsById] = useState<Record<string, InterestSelectionLevel>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [error, setError] = useState('')

  useResetOnShow(setIsPageExiting, setIsSubmitting)
  const [showFirstSelectionHint, setShowFirstSelectionHint] = useState(false)
  const [hasShownFirstSelectionHint, setHasShownFirstSelectionHint] = useState(false)
  const [poppingCardId, setPoppingCardId] = useState<string | null>(null)
  const [meterCelebration, setMeterCelebration] = useState(false)
  const { isLoading } = useAuthGuard({
    suspendOnboardingRedirect: isSubmitting || isPageExiting,
  })
  const invalidateAuth = useInvalidateAuth()
  const analytics = useOnboardingAnalytics('extended-data', { enabled: !isLoading })
  const { saveCheckpoint } = useOnboardingCheckpoint()

  useEffect(() => {
    if (!showFirstSelectionHint) {
      return undefined
    }

    const timer = setTimeout(() => {
      setShowFirstSelectionHint(false)
    }, 2200)

    return () => clearTimeout(timer)
  }, [showFirstSelectionHint])

  // Meter celebration when threshold first reached
  const prevSelectedCountRef = useRef(selectedCount)
  useEffect(() => {
    const prev = prevSelectedCountRef.current
    prevSelectedCountRef.current = selectedCount
    if (prev < MIN_INTERESTS && selectedCount >= MIN_INTERESTS) {
      setMeterCelebration(true)
      haptics('success')
      const timer = setTimeout(() => setMeterCelebration(false), 800)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [selectedCount])

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
  const dominantCategories = useMemo(
    () =>
      Object.entries(selectionPreview.categoryHeat)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([categoryId]) => categoryId),
    [selectionPreview.categoryHeat],
  )
  const highlightedSelections = useMemo(
    () =>
      [...selectionPreview.selections]
        .sort((left, right) => right.level - left.level || right.heat - left.heat)
        .slice(0, 6),
    [selectionPreview.selections],
  )
  const canSubmit = selectedCount >= MIN_INTERESTS
  const footerProgressPercent = Math.min(100, Math.round((selectedCount / MIN_INTERESTS) * 100))

  const coachCopy = useMemo(() => {
    if (selectedCount >= MAX_INTERESTS) {
      return '兴趣库已经装得满满当当了～如果想换，可以先取消一项再选新的。'
    }

    if (selectedCount === 0) {
      return '先轻点选中，再点同一项就会升级热度。第三档会成为预览页重点兴趣。'
    }

    if (topPriorityCount > 0) {
      return '你已经标出了重点兴趣，资料预览里会优先把这些高热主题亮出来。'
    }

    return '如果你有特别想聊的话题，再点同一项，把它升级成更高热度。'
  }, [selectedCount, topPriorityCount])

  const footerTitle = canSubmit
    ? '热度达标，可以生成预览了 ✨'
    : `还差 ${Math.max(MIN_INTERESTS - selectedCount, 0)} 项，就能继续预览`
  const footerSubtitle =
    selectedCount === 0
      ? '先点第一项，热度就会慢慢升起来。'
      : topPriorityCount > 0
        ? `已点亮 ${topPriorityCount} 个重点兴趣，当前热度 ${selectionPreview.totalHeat}。`
        : `当前热度 ${selectionPreview.totalHeat}，再点同一项就会继续升温。`
  const pageClassName = ['extended-data', isPageExiting ? 'extended-data--exiting' : '']
    .filter(Boolean)
    .join(' ')

  const toggleInterestLevel = useCallback(
    (topicId: string) => {
      const currentLevel = levelsById[topicId]

      if (!currentLevel && selectedCount >= MAX_INTERESTS) {
        analytics.validationFailed('interests', 'max-selection-reached')
        Taro.showToast({
          title: `最多选择 ${MAX_INTERESTS} 个兴趣`,
          icon: 'none',
          duration: TOAST_DEFAULT_MS,
        })
        return
      }

      const nextLevels = { ...levelsById }

      if (!currentLevel) {
        nextLevels[topicId] = 1
        if (selectedCount === 0 && !hasShownFirstSelectionHint) {
          setShowFirstSelectionHint(true)
          setHasShownFirstSelectionHint(true)
        }
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
      setTimeout(() => setPoppingCardId((current) => (current === topicId ? null : current)), 200)
    },
    [analytics, hasShownFirstSelectionHint, levelsById, selectedCount],
  )

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) {
      if (!canSubmit) {
        analytics.validationFailed('interests', 'min-selection-not-reached')
      }
      return
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

      await saveCheckpoint('extended-data')
      await invalidateAuth()
      const userState = await getUserState()

      analytics.stepCompleted({
        selectedInterestCount: selectedCount,
        totalHeat: selectionPreview.totalHeat,
        nextStep: userState.nextStep ?? 'profile-review',
      })

      await navigateToMiniProgramNextStep(userState.nextStep, {
        mode: 'replace',
        transition: { beforeNavigate: () => setIsPageExiting(true) },
      })
    } catch (err) {
      setIsPageExiting(false)
      const message = err instanceof Error ? err.message : getErrorMessage('submit-failed')
      setError(message)
      analytics.errorOccurred('submit_failed', message)
      logError('[ExtendedData] Submit failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_FATAL_MS })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    canSubmit,
    invalidateAuth,
    isSubmitting,
    saveCheckpoint,
    selectedCount,
    selectionDrafts,
    selectionPreview.totalHeat,
    topPriorityCount,
  ])

  if (isLoading) {
    return (
      <OnboardingLoadingShell
        stepLabel='Onboarding 3 / 4'
        title={`${DEFAULT_MASCOT_DISPLAY_NAME}在点亮你的兴趣热度`}
        subtitle='把这一步准备好后，资料预览就会更有你的味道。'
      />
    )
  }

  return (
    <View className={pageClassName}>
      <View className='extended-data__header extended-data__stage extended-data__stage--1'>
        <Text className='extended-data__eyebrow'>Onboarding 3 / 4</Text>
        <Text className='extended-data__title'>把兴趣热度标出来</Text>
        <Text className='extended-data__subtitle'>
          轻点加入 → 再点升温 → 三档高热。越热的兴趣，匹配越精准。
        </Text>
      </View>

      <XiaoyueChatBubble
        content={coachCopy}
        pose='pointing'
        horizontal
        showGlow
        tail
        className='extended-data__stage extended-data__stage--2'
      />
      <Image
        src={getXiaoyueAsset('pointing')}
        mode='aspectFit'
        style={{
          width: 0,
          height: 0,
          opacity: 0,
          position: 'absolute',
          pointerEvents: 'none',
        }}
      />

      <Card className='extended-data__summary extended-data__stage extended-data__stage--3'>
        <View className='extended-data__summary-stats'>
          <View className='extended-data__summary-stat'>
            <Text className='extended-data__summary-value'>{selectedCount}</Text>
            <Text className='extended-data__summary-label'>已选兴趣</Text>
          </View>
          <View className='extended-data__summary-stat'>
            <Text className='extended-data__summary-value'>{topPriorityCount}</Text>
            <Text className='extended-data__summary-label'>重点兴趣</Text>
          </View>
          <View className='extended-data__summary-stat'>
            <Text className='extended-data__summary-value'>{selectionPreview.totalHeat}</Text>
            <Text className='extended-data__summary-label'>热度总值</Text>
          </View>
        </View>

        {highlightedSelections.length > 0 ? (
          <View className='extended-data__selection-tray'>
            {highlightedSelections.map((selection) => {
              const meta = getInterestLevelMeta(selection.level)
              return (
                <View
                  key={selection.topicId}
                  className={[
                    'extended-data__selection-chip',
                    `extended-data__selection-chip--level-${selection.level}`,
                  ].join(' ')}
                >
                  <Text className='extended-data__selection-chip-label'>{selection.label}</Text>
                  <Text className='extended-data__selection-chip-meta'>{meta?.shortLabel}</Text>
                </View>
              )
            })}
          </View>
        ) : (
          <Text className='extended-data__selection-empty'>
            还没开始选，先点一项你想在活动里聊起来的话题。
          </Text>
        )}

        {dominantCategories.length > 0 ? (
          <View className='extended-data__dominant-categories'>
            {dominantCategories.map((categoryId) => {
              const category = categoryId as MacroCategory
              return (
                <View key={categoryId} className='extended-data__dominant-chip'>
                  <View
                    className='extended-data__dominant-chip-dot'
                    style={{ backgroundColor: CATEGORY_META[category]?.dotColor || CATEGORY_COLORS.food }}
                  />
                  <Text className='extended-data__dominant-chip-text'>
                    {MACRO_CATEGORY_LABELS[category]}
                  </Text>
                </View>
              )
            })}
          </View>
        ) : null}
      </Card>

      <View className='extended-data__legend extended-data__stage extended-data__stage--4'>
        {INTEREST_LEVEL_META.map((item) => (
          <View key={item.level} className='extended-data__legend-pill'>
            <Text className='extended-data__legend-pill-title'>{item.label}</Text>
            <Text className='extended-data__legend-pill-text'>{item.description}</Text>
          </View>
        ))}
      </View>

      <ScrollView className='extended-data__scroll' scrollY enhanced showScrollbar={false}>
        <View className='extended-data__content'>
          {(Object.entries(groupedInterests) as [MacroCategory, InterestDefinition[]][]).map(
            ([category, items]) => {
              const selectedInCategory = items.filter((item) => levelsById[item.id]).length

              return (
                <Card key={category} className='extended-data__category'>
                  <View className='extended-data__category-header'>
                    <View className='extended-data__category-title-wrap'>
                      <JoyJoinIcon
                        emoji={INTEREST_CATEGORY_EMOJIS[category]}
                        tier='category'
                        size={32}
                        className='extended-data__category-icon'
                      />
                      <Text className='extended-data__category-title'>
                        {MACRO_CATEGORY_LABELS[category]}
                      </Text>
                    </View>
                    <Text className='extended-data__category-count'>{selectedInCategory} 已选</Text>
                  </View>

                  <View className='extended-data__interest-grid'>
                    {items.map((item) => {
                      const level = levelsById[item.id]
                      const levelMeta = getInterestLevelMeta(level)

                      return (
                        <View
                          key={item.id}
                          className={[
                            'extended-data__interest-card',
                            level ? `extended-data__interest-card--level-${level}` : '',
                            poppingCardId === item.id ? 'extended-data__interest-card--popping' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => toggleInterestLevel(item.id)}
                        >
                          <Text className='extended-data__interest-label'>{item.label}</Text>
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

      {showFirstSelectionHint ? (
        <View className='extended-data__hint-toast'>
          <Text className='extended-data__hint-toast-text'>收到了，再点同一项就能把它升成更高热度。</Text>
        </View>
      ) : null}

      <View className='extended-data__footer'>
        <View className='extended-data__footer-meter'>
          <View className='extended-data__footer-meter-track'>
            <View
              className={[
                'extended-data__footer-meter-fill',
                meterCelebration ? 'extended-data__footer-meter-fill--celebrating' : '',
              ].filter(Boolean).join(' ')}
              style={{ width: `${footerProgressPercent}%` }}
            />
          </View>
          <Text className='extended-data__footer-meter-meta'>
            {canSubmit ? '已经达到入场线' : `${selectedCount}/${MIN_INTERESTS} 起步`}
          </Text>
        </View>

        <Text className='extended-data__footer-title'>{footerTitle}</Text>
        <Text className='extended-data__footer-subtitle'>{footerSubtitle}</Text>
        {error ? <Text className='extended-data__error'>{error}</Text> : null}

        <Button
          variant='brand'
          className='extended-data__submit'
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '提交中…' : `生成预览资料（${selectedCount}）`}
        </Button>
      </View>
    </View>
  )
}
