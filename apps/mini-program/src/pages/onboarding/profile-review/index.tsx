import { STALE_TIME_PROFILE_TAGLINE_MS, TOAST_FATAL_MS } from '../../../lib/utils/uiConstants'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import AnalyzingAnimation from '../../../components/loading/AnalyzingAnimation'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { haptics } from '../../../lib/utils/haptics'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  completeProfileReview,
  getProfileTagline,
  getUserInterests,
  type UserInterestsResponse,
} from '@shared/api'
import { GENERIC_PROFILE_TAGLINE_FALLBACK } from '@shared/ai/onboarding'
import { getIntentLabel } from '@shared/constants'
import { MACRO_CATEGORY_LABELS, type MacroCategory } from '@shared/interests'
import { getIndustryDisplayLabel, getOccupationDisplayLabel } from '@shared/occupations'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { navigateToMiniProgramNextStep } from '../../../lib/onboarding/onboardingNavigation'
import { getMascotDisplayName } from '../../../lib/mascot/mascotDisplay'
import { logError, logInfo } from '../../../lib/utils/logger'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import { getArchetypeVisual, getXiaoyueAsset } from '../personality-test/visuals'
import './index.scss'

function getAgeLabel(user: Record<string, unknown> | undefined): string {
  if (!user) {
    return ''
  }

  if (typeof user.age === 'number' && Number.isFinite(user.age)) {
    return `${user.age}岁`
  }

  if (typeof user.age === 'string' && user.age.trim() !== '') {
    return `${user.age.trim()}岁`
  }

  const birthdate = typeof user.birthdate === 'string' ? user.birthdate : ''
  if (birthdate !== '') {
    const date = new Date(birthdate)
    if (!Number.isNaN(date.getTime())) {
      const today = new Date()
      let age = today.getFullYear() - date.getFullYear()
      const monthDiff = today.getMonth() - date.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age -= 1
      }
      if (age > 0) {
        return `${age}岁`
      }
    }
  }

  const birthYear =
    typeof user.birthYear === 'number'
      ? user.birthYear
      : typeof user.birthYear === 'string' && user.birthYear.trim() !== ''
        ? Number(user.birthYear)
        : 0

  if (Number.isFinite(birthYear) && birthYear > 0) {
    return `${new Date().getFullYear() - birthYear}岁`
  }

  return ''
}

export default function ProfileReviewPage() {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [error, setError] = useState('')
  const [isRevealReady, setIsRevealReady] = useState(false)
  const { user, isLoading } = useAuthGuard({
    suspendOnboardingRedirect: isSubmitting || isPageExiting,
  })
  const invalidateAuth = useInvalidateAuth()
  const analytics = useOnboardingAnalytics('profile-review', { enabled: !isLoading })

  useEffect(() => {
    if (isLoading) {
      return undefined
    }

    setIsRevealReady(false)
    const timer = setTimeout(() => {
      setIsRevealReady(true)
    }, 420)

    return () => clearTimeout(timer)
  }, [isLoading])

  const shouldLoadInterests = !isLoading && Boolean(user?.hasCompletedInterestsCarousel)
  const { data: profileTagline, isLoading: isTaglineLoading, isError: isTaglineError } = useQuery({
    queryKey: ['mini-program', 'onboarding-profile-tagline'],
    queryFn: () => getProfileTagline(apiRequest),
    enabled: !isLoading && Boolean(user),
    staleTime: STALE_TIME_PROFILE_TAGLINE_MS,
    retry: 1,
  })

  const {
    data: interestsData,
    isLoading: isInterestsLoading,
    isFetching: isInterestsFetching,
  } = useQuery<UserInterestsResponse | null>({
    queryKey: ['mini-program', 'profile-review-interests'],
    enabled: shouldLoadInterests,
    retry: false,
    queryFn: async () => {
      try {
        return await getUserInterests(apiRequest)
      } catch (queryError) {
        const statusCode =
          typeof queryError === 'object' && queryError !== null && 'statusCode' in queryError
            ? Number((queryError as { statusCode?: unknown }).statusCode)
            : undefined

        if (statusCode === 404) {
          return null
        }

        throw queryError
      }
    },
  })

  const displayName = (user?.displayName as string) || (user?.nickname as string) || '悦聚用户'
  const ageLabel = getAgeLabel(user as Record<string, unknown> | undefined)
  const archetype = (user?.archetype as string) || (user?.primaryArchetype as string) || ''
  const visual = archetype ? getArchetypeVisual(archetype) : null
  const currentCity = typeof user?.currentCity === 'string' ? user.currentCity : ''
  const hometownRegionCity =
    typeof user?.hometownRegionCity === 'string' ? user.hometownRegionCity : ''
  const relationshipStatus =
    typeof user?.relationshipStatus === 'string' ? user.relationshipStatus : ''
  const educationLevel = typeof user?.educationLevel === 'string' ? user.educationLevel : ''
  const occupationLabel = getOccupationDisplayLabel(
    user?.occupationId as string | undefined,
    user?.workMode as string | undefined,
    { showWorkMode: true, fallback: '' },
  )
  const industryLabel = getIndustryDisplayLabel(
    user?.occupationId as string | undefined,
    typeof user?.industryCategoryLabel === 'string' ? user.industryCategoryLabel : '',
  )
  const profileTags = [user?.gender as string | undefined, ageLabel, currentCity].filter(
    (item): item is string => Boolean(item),
  )
  const intentLabels = Array.isArray(user?.intent)
    ? user.intent
        .filter((item): item is string => typeof item === 'string')
        .map(getIntentLabel)
        .slice(0, 3)
    : []

  const topInterestLabels = useMemo(() => {
    if (!interestsData) {
      return [] as string[]
    }

    if (Array.isArray(interestsData.topPriorities) && interestsData.topPriorities.length > 0) {
      return interestsData.topPriorities.map((item) => item.label).slice(0, 4)
    }

    if (!Array.isArray(interestsData.selections)) {
      return []
    }

    return [...interestsData.selections]
      .sort((left, right) => right.level - left.level || right.heat - left.heat)
      .slice(0, 4)
      .map((item) => item.label)
  }, [interestsData])

  const dominantCategories = useMemo(() => {
    if (!interestsData?.categoryHeat) {
      return [] as MacroCategory[]
    }

    return Object.entries(interestsData.categoryHeat)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([categoryId]) => categoryId as MacroCategory)
  }, [interestsData?.categoryHeat])

  const readinessItems = useMemo(
    () => [
      { label: '性格原型', done: archetype !== '' },
      {
        label: '基础资料',
        done: displayName.trim() !== '' && typeof user?.gender === 'string' && currentCity !== '',
      },
      { label: '兴趣热度', done: Boolean(interestsData?.totalSelections) },
      { label: '社交意图', done: intentLabels.length > 0 },
    ],
    [archetype, currentCity, displayName, interestsData?.totalSelections, intentLabels.length, user?.gender],
  )

  const coachCopy =
    topInterestLabels.length > 0
      ? `进入发现后，${getMascotDisplayName(user)}会优先参考这些高热兴趣，为你推荐更像你的活动和搭子。`
      : '进入发现后，你现在确认好的资料就会先帮你筛出更合适的活动。'

  const aiInsightLine =
    profileTagline?.insightLine?.trim() ||
    (isTaglineLoading || isTaglineError ? GENERIC_PROFILE_TAGLINE_FALLBACK : '')
  const showInterestSkeleton = shouldLoadInterests && !interestsData && (isInterestsLoading || isInterestsFetching)
  const pageClassName = ['profile-review', isPageExiting ? 'profile-review--exiting' : '']
    .filter(Boolean)
    .join(' ')

  const handleComplete = useCallback(async () => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      logInfo('[ProfileReview] Completing profile review')
      await completeProfileReview(apiRequest)

      await invalidateAuth()
      const userState = await getUserState()

      analytics.stepCompleted({
        nextStep: userState.nextStep ?? 'discover',
        hasArchetype: archetype !== '',
        hasInterests: Boolean(interestsData?.totalSelections),
      })

      logInfo('[ProfileReview] Onboarding complete, routing from refreshed nextStep', {
        nextStep: userState.nextStep,
      })

      await navigateToMiniProgramNextStep(userState.nextStep, {
        mode: 'replace',
        transition: { beforeNavigate: () => setIsPageExiting(true) },
      })
    } catch (err) {
      setIsPageExiting(false)
      const message = err instanceof Error ? err.message : getErrorMessage('operation-failed')
      setError(message)
      analytics.errorOccurred('complete_failed', message)
      logError('[ProfileReview] Complete failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_FATAL_MS })
    } finally {
      setIsSubmitting(false)
    }
  }, [analytics, archetype, interestsData?.totalSelections, invalidateAuth, isSubmitting])

  const getStageClassName = (step: number) =>
    [
      'profile-review__stage',
      `profile-review__stage--${step}`,
      isRevealReady ? 'profile-review__stage--visible' : '',
    ]
      .filter(Boolean)
      .join(' ')

  if (isLoading) {
    return (
      <OnboardingLoadingShell
        stepLabel='Onboarding 4 / 4'
        title={`${getMascotDisplayName(user)}在翻开你的入场卡`}
        subtitle='最后这一页准备好后，你就可以去发现第一场适合你的局。'
      />
    )
  }

  return (
    <ScrollView className={pageClassName} scrollY enhanced showScrollbar={false}>
      <View className='profile-review__shell'>
        {!isRevealReady ? (
          <AnalyzingAnimation
            label='正在生成你的专属画像'
            subtitle={`${getMascotDisplayName(user)}正在分析你的性格密码...`}
            minDuration={1200}
            onComplete={() => setIsRevealReady(true)}
            shouldReduceMotion={shouldReduceMotion}
          />
        ) : null}

        <View className={`profile-review__welcome-illustration ${getStageClassName(0)}`}>
          {visual?.asset ? (
            <Image
              className='profile-review__welcome-image'
              src={visual.asset}
              mode='aspectFit'
              lazyLoad
            />
          ) : (
            <Image
              className='profile-review__welcome-image'
              src={getXiaoyueAsset('homeWelcome')}
              mode='aspectFit'
              lazyLoad
            />
          )}
        </View>

        <View className={`profile-review__hero ${getStageClassName(1)}`}>
          <Text className='profile-review__eyebrow'>Onboarding 4 / 4</Text>
          <Text className='profile-review__title'>
            你的 <Text className='profile-review__title-en'>JoyJoin</Text> 入场卡已就绪
          </Text>
          <Text className='profile-review__subtitle'>确认这张入场卡后，就去发现第一场适合你的局。</Text>
        </View>

        <View className={`profile-review__coach ${getStageClassName(2)}`}>
          <Image className='profile-review__coach-avatar' src={getXiaoyueAsset('pointing')} mode='aspectFit' />
          <View className='profile-review__coach-copy'>
            <Text className='profile-review__coach-title'>{`${getMascotDisplayName(user)}提示`}</Text>
            <Text className='profile-review__coach-text'>{coachCopy}</Text>
          </View>
        </View>

        <Card className={`profile-review__hero-card ${getStageClassName(3)}`}>
          <View className='profile-review__hero-main'>
            <View className='profile-review__avatar-wrap'>
              {visual?.asset ? (
                <Image className='profile-review__avatar-image' src={visual.asset} mode='aspectFit' />
              ) : (
                <ArchetypeHead archetype={archetype} size={100} fallbackText={displayName} />
              )}
            </View>
            <View className='profile-review__hero-copy'>
              <Text className='profile-review__hero-name'>{displayName}</Text>
              {archetype && visual ? (
                <View
                  className='profile-review__hero-archetype-badge'
                  style={{
                    background: visual.accentSoft,
                    borderColor: visual.accentBorder,
                  }}
                >
                  <Text
                    className='profile-review__hero-archetype-badge-text'
                    style={{ color: visual.accent }}
                  >
                    {archetype}
                  </Text>
                </View>
              ) : null}
              {visual?.summary ? (
                <Text className='profile-review__hero-summary'>{visual.summary}</Text>
              ) : (
                <Text className='profile-review__hero-summary'>你的基础资料和兴趣画像已经准备好被看见了。</Text>
              )}
              {aiInsightLine ? (
                <View className='profile-review__ai-tagline-wrap'>
                  <View className='profile-review__ai-tagline-accent' />
                  <Text className='profile-review__ai-tagline'>{aiInsightLine}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {profileTags.length > 0 ? (
            <View className='profile-review__hero-tags'>
              {profileTags.map((item) => (
                <View key={item} className='profile-review__hero-tag'>
                  <Text className='profile-review__hero-tag-text'>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <Card className={`profile-review__card ${getStageClassName(4)}`}>
          <Text className='profile-review__card-title'>进入发现前，再确认一次</Text>
          <View className='profile-review__readiness-row'>
            {readinessItems.map((item) => (
              <View
                key={item.label}
                className={[
                  'profile-review__readiness-pill',
                  item.done ? 'profile-review__readiness-pill--done' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Text className='profile-review__readiness-pill-icon'>{item.done ? '✓' : '·'}</Text>
                <Text className='profile-review__readiness-pill-text'>{item.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card className={`profile-review__card ${getStageClassName(5)}`}>
          <Text className='profile-review__card-title'>你的资料一眼看完</Text>
          <View className='profile-review__info-grid'>
            {hometownRegionCity ? (
              <View className='profile-review__info-block'>
                <Text className='profile-review__info-label'>家乡</Text>
                <Text className='profile-review__info-value'>{hometownRegionCity}</Text>
              </View>
            ) : null}
            {relationshipStatus ? (
              <View className='profile-review__info-block'>
                <Text className='profile-review__info-label'>关系状态</Text>
                <Text className='profile-review__info-value'>{relationshipStatus}</Text>
              </View>
            ) : null}
            {educationLevel ? (
              <View className='profile-review__info-block'>
                <Text className='profile-review__info-label'>学历</Text>
                <Text className='profile-review__info-value'>{educationLevel}</Text>
              </View>
            ) : null}
            {occupationLabel ? (
              <View className='profile-review__info-block'>
                <Text className='profile-review__info-label'>职业</Text>
                <Text className='profile-review__info-value'>{occupationLabel}</Text>
              </View>
            ) : null}
            {industryLabel ? (
              <View className='profile-review__info-block'>
                <Text className='profile-review__info-label'>行业</Text>
                <Text className='profile-review__info-value'>{industryLabel}</Text>
              </View>
            ) : null}
          </View>

          {intentLabels.length > 0 ? (
            <View className='profile-review__chip-group'>
              {intentLabels.map((item) => (
                <View key={item} className='profile-review__chip'>
                  <Text className='profile-review__chip-text'>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <Card className={`profile-review__card ${getStageClassName(6)}`}>
          <Text className='profile-review__card-title'>兴趣热度摘要</Text>

          {showInterestSkeleton ? (
            <View className='profile-review__interest-skeleton'>
              <View className='profile-review__interest-stats'>
                {[1, 2, 3].map((item) => (
                  <View key={item} className='profile-review__interest-stat profile-review__interest-stat--skeleton'>
                    <View className='profile-review__skeleton-line profile-review__skeleton-line--value' />
                    <View className='profile-review__skeleton-line profile-review__skeleton-line--label' />
                  </View>
                ))}
              </View>
              <View className='profile-review__skeleton-chip-row'>
                {[1, 2, 3].map((item) => (
                  <View key={item} className='profile-review__skeleton-chip' />
                ))}
              </View>
            </View>
          ) : interestsData ? (
            <>
              <View className='profile-review__interest-stats'>
                <View className='profile-review__interest-stat'>
                  <Text className='profile-review__interest-value'>{interestsData.totalSelections}</Text>
                  <Text className='profile-review__interest-label'>已选兴趣</Text>
                </View>
                <View className='profile-review__interest-stat'>
                  <Text className='profile-review__interest-value'>
                    {interestsData.topPriorities?.length ?? 0}
                  </Text>
                  <Text className='profile-review__interest-label'>重点兴趣</Text>
                </View>
                <View className='profile-review__interest-stat'>
                  <Text className='profile-review__interest-value'>{interestsData.totalHeat}</Text>
                  <Text className='profile-review__interest-label'>热度总值</Text>
                </View>
              </View>

              {topInterestLabels.length > 0 ? (
                <View className='profile-review__chip-group'>
                  {topInterestLabels.map((item) => (
                    <View key={item} className='profile-review__chip profile-review__chip--accent'>
                      <Text className='profile-review__chip-text'>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {dominantCategories.length > 0 ? (
                <View className='profile-review__chip-group'>
                  {dominantCategories.map((item) => (
                    <View key={item} className='profile-review__chip'>
                      <Text className='profile-review__chip-text'>
                        {MACRO_CATEGORY_LABELS[item] || item}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <View className='profile-review__interest-placeholder'>
              <Text className='profile-review__interest-placeholder-title'>兴趣摘要马上就位</Text>
              <Text className='profile-review__interest-placeholder-copy'>
                你刚选的兴趣正在整理成摘要，先带着这张入场卡出发也完全没问题。
              </Text>
            </View>
          )}
        </Card>

        {error ? <Text className='profile-review__error'>{error}</Text> : null}

        <View className={`profile-review__cta ${getStageClassName(7)}`}>
          <Text className='profile-review__cta-title'>确认后去发现你的第一场局</Text>
          <Text className='profile-review__cta-subtitle'>
            这里不是终点，后续都可以在「我的」里继续补充或修改资料。
          </Text>
          <Button
            variant='brand'
            className='profile-review__submit'
            onClick={() => {
              haptics('heavy')
              handleComplete()
            }}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? '正在完成…' : '确认并进入发现'}
          </Button>
        </View>
      </View>
    </ScrollView>
  )
}
