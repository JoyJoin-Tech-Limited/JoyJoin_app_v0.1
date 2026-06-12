import { STALE_TIME_PROFILE_TAGLINE_MS, TOAST_FATAL_MS } from '../../../lib/utils/uiConstants'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import AnalyzingAnimation from '../../../components/loading/AnalyzingAnimation'
import InterestChipCloud from '../../../components/profile/InterestChipCloud'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { haptics } from '../../../lib/utils/haptics'
import Taro from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { getMascotDisplayName } from '../../../lib/mascot/mascotDisplay'
import { logError, logInfo } from '../../../lib/utils/logger'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import { getArchetypeVisual, getXiaoyueAsset } from '../personality-test/visuals'
import './index.scss'

const QUERY_TIMEOUT_MS = 12_000

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
  const [isCelebrating, setIsCelebrating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [error, setError] = useState('')
  const [isRevealReady, setIsRevealReady] = useState(false)

  useResetOnShow(setIsPageExiting, setIsSubmitting, setIsCelebrating, setIsRevealReady)
  const queryClient = useQueryClient()
  const { user, isLoading } = useAuthGuard({
    suspendOnboardingRedirect: isSubmitting || isPageExiting,
  })
  const invalidateAuth = useInvalidateAuth()
  const analytics = useOnboardingAnalytics('profile-review', { enabled: !isLoading })

  const shouldLoadInterests = !isLoading && Boolean(user?.hasCompletedInterestsCarousel)
  const { data: profileTagline, isLoading: isTaglineLoading, isError: isTaglineError } = useQuery({
    queryKey: ['mini-program', 'onboarding-profile-tagline'],
    queryFn: () =>
      Promise.race([
        getProfileTagline(apiRequest),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), QUERY_TIMEOUT_MS),
        ),
      ]),
    enabled: !isLoading && Boolean(user),
    staleTime: STALE_TIME_PROFILE_TAGLINE_MS,
    retry: 1,
  })

  const {
    data: interestsData,
    isLoading: isInterestsLoading,
    isFetching: isInterestsFetching,
    isError: isInterestsError,
  } = useQuery<UserInterestsResponse | null>({
    queryKey: ['mini-program', 'profile-review-interests'],
    enabled: shouldLoadInterests,
    retry: 1,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await Promise.race([
          getUserInterests(apiRequest),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), QUERY_TIMEOUT_MS),
          ),
        ]) as UserInterestsResponse | null
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

  // Preload archetype full-body image to prevent flash on cold start
  useEffect(() => {
    if (!visual?.asset) return
    Taro.getImageInfo({ src: visual.asset }).catch(() => { /* fire-and-forget */ })
  }, [visual?.asset])

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

  const coachCopy =
    topInterestLabels.length > 0
      ? `进入发现后，${getMascotDisplayName(user)}会优先参考这些高热兴趣，为你推荐更像你的活动和搭子。`
      : '进入发现后，你现在确认好的资料就会先帮你筛出更合适的活动。'

  const aiInsightLine =
    !isTaglineLoading && isTaglineError
      ? GENERIC_PROFILE_TAGLINE_FALLBACK
      : profileTagline?.insightLine?.trim() || ''
  const showInterestSkeleton = shouldLoadInterests && !interestsData && !isInterestsError && (isInterestsLoading || isInterestsFetching)
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

      setIsCelebrating(true)
      haptics('success')

      await new Promise((resolve) => setTimeout(resolve, 500))

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
      setIsCelebrating(false)
      const message = err instanceof Error ? err.message : getErrorMessage('operation-failed')
      setError(message)
      analytics.errorOccurred('complete_failed', message)
      logError('[ProfileReview] Complete failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_FATAL_MS })
    } finally {
      setIsSubmitting(false)
    }
  }, [analytics, archetype, interestsData?.totalSelections, invalidateAuth, isSubmitting])

  const getStageClassName = useCallback((step: number) =>
    [
      'profile-review__stage',
      `profile-review__stage--${step}`,
      isRevealReady ? 'profile-review__stage--visible' : '',
    ]
      .filter(Boolean)
      .join(' '), [isRevealReady])

  if (isLoading) {
    return (
      <OnboardingLoadingShell
        stepLabel='最后一步 · 入场卡预览'
        title={`${getMascotDisplayName(user)}在翻开你的入场卡`}
        subtitle='最后这一页准备好后，你就可以去发现第一场适合你的局。'
      />
    )
  }

  return (
    <View className={pageClassName}>
      <ScrollView className='profile-review__scroll' scrollY enhanced showScrollbar={false}>
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
            <Text className='profile-review__eyebrow'>最后一步 · 入场卡预览</Text>
            <Text className='profile-review__title'>
              你的 <Text className='profile-review__title-en'>JoyJoin</Text> 入场卡已就绪
            </Text>
            <Text className='profile-review__subtitle'>确认这张入场卡后，就去发现第一场适合你的局。</Text>
          </View>

          <View className={`profile-review__mascot ${getStageClassName(2)}`}>
            <XiaoyueChatBubble
              content={coachCopy}
              pose='pointing'
              horizontal
              showGlow
              tail
            />
          </View>

          <Card className={`profile-review__hero-card ${getStageClassName(3)}`}>
            <View className='profile-review__hero-copy'>
              <Text className='profile-review__hero-name'>{displayName}</Text>

              {/* AI-generated social tag — presented prominently as the user's tagline */}
              {isTaglineLoading ? (
                <View className='profile-review__hero-tagline profile-review__hero-tagline--loading' aria-busy='true'>
                  <View className='profile-review__hero-tagline-shimmer' />
                </View>
              ) : aiInsightLine ? (
                <View className={`profile-review__hero-tagline${isTaglineError ? ' profile-review__hero-tagline--error' : ''}`}>
                  <Text className='profile-review__hero-tagline-text'>{aiInsightLine}</Text>
                  {isTaglineError ? (
                    <Text
                      className='profile-review__hero-tagline-retry'
                      onClick={() => {
                        haptics('light')
                        queryClient.invalidateQueries({ queryKey: ['mini-program', 'onboarding-profile-tagline'] })
                      }}
                    >
                      重试
                    </Text>
                  ) : null}
                </View>
              ) : null}

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
                    {visual.name}
                  </Text>
                </View>
              ) : null}
              {visual?.summary ? (
                <Text className='profile-review__hero-summary'>{visual.summary}</Text>
              ) : (
                <Text className='profile-review__hero-summary'>你的基础资料和兴趣画像已经准备好被看见了。</Text>
              )}
            </View>

            <View className='profile-review__avatar-wrap'>
              {visual?.asset ? (
                <Image className='profile-review__avatar-image' src={visual.asset} mode='aspectFit' lazyLoad />
              ) : (
                <ArchetypeHead archetype={archetype} size={100} fallbackText={displayName} />
              )}
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

          <Card className={`profile-review__card ${getStageClassName(5)}`}>
            <Text className='profile-review__card-title'>兴趣热度摘要</Text>

            {isInterestsError ? (
              <View className='profile-review__interest-error' role='status' aria-live='polite'>
                <Text className='profile-review__interest-error-title'>兴趣数据加载失败</Text>
                <Text className='profile-review__interest-error-copy'>
                  网络不太稳定，但你的入场卡已经可以用了。先出发，兴趣数据稍后自动同步。
                </Text>
                <View
                  className='profile-review__interest-error-retry'
                  onClick={() => {
                    haptics('light')
                    queryClient.invalidateQueries({ queryKey: ['mini-program', 'profile-review-interests'] })
                  }}
                  hoverClass='profile-review__interest-error-retry--hover'
                >
                  <Text className='profile-review__interest-error-retry-text'>重新加载兴趣数据</Text>
                </View>
              </View>
            ) : showInterestSkeleton ? (
              <View className='profile-review__interest-skeleton' aria-busy='true'>
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
                  <InterestChipCloud
                    labels={topInterestLabels}
                    accent
                    className='profile-review__chip-group'
                  />
                ) : null}

                {dominantCategories.length > 0 ? (
                  <InterestChipCloud
                    labels={dominantCategories.map((item) => MACRO_CATEGORY_LABELS[item] || item)}
                    className='profile-review__chip-group'
                  />
                ) : null}
              </>
            ) : !isInterestsLoading && !isInterestsFetching && interestsData === null && !isInterestsError ? (
              <View className='profile-review__interest-placeholder' role='status' aria-live='polite'>
                <Text className='profile-review__interest-placeholder-title'>暂无兴趣标签</Text>
                <Text className='profile-review__interest-placeholder-copy'>
                  你还没点选兴趣标签，但入场卡已经可以使用了。先出发，以后还能随时补充。
                </Text>
              </View>
            ) : (
              <View className='profile-review__interest-placeholder' role='status' aria-live='polite'>
                <View className='profile-review__interest-placeholder-pulse'>
                  <View className='profile-review__interest-placeholder-dot' />
                  <View className='profile-review__interest-placeholder-dot' style={{ animationDelay: '0.2s' }} />
                  <View className='profile-review__interest-placeholder-dot' style={{ animationDelay: '0.4s' }} />
                </View>
                <Text className='profile-review__interest-placeholder-title'>兴趣摘要马上就位</Text>
                <Text className='profile-review__interest-placeholder-copy'>
                  你刚选的兴趣正在整理成摘要，先带着这张入场卡出发也完全没问题。
                </Text>
              </View>
            )}
          </Card>

          {error ? (
            <View
              className='profile-review__error'
              role='alert'
              aria-live='polite'
              onClick={() => {
                haptics('light')
                handleComplete()
              }}
              hoverClass='profile-review__error--hover'
            >
              <Text className='profile-review__error-text'>{error}</Text>
              <Text className='profile-review__error-retry'>点击重试</Text>
            </View>
          ) : null}

          {/* Reserve space for fixed footer */}
          <View className='profile-review__footer-reserve' />
        </View>
      </ScrollView>

      {/* Fixed bottom CTA bar */}
      <View className={`profile-review__cta ${getStageClassName(6)}`}>
        <Button
          variant='brand'
          className='profile-review__submit'
          onClick={() => {
            haptics('heavy')
            handleComplete()
          }}
          disabled={isSubmitting || isCelebrating}
          loading={isSubmitting && !isCelebrating}
        >
          {isCelebrating ? '入场卡已确认' : isSubmitting ? '正在完成…' : '确认并进入发现'}
        </Button>
      </View>
    </View>
  )
}
