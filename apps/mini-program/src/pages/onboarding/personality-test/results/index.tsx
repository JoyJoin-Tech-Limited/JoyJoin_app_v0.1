import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo } from 'react'
import Button from '../../../../components/Button'
import Card from '../../../../components/Card'
import { useAuth } from '../../../../hooks/useAuth'
import { useOnboardingAnalytics } from '../../../../hooks/useOnboardingAnalytics'
import {
  clearAnonymousAssessmentStorage,
  hasAnonymousAssessmentResult,
  readAnonymousAssessmentSession,
  type AnonymousAssessmentResult,
  type AnonymousAssessmentTopMatch,
} from '../../../../lib/anonymousOnboarding'
import { MINI_PROGRAM_ROUTES } from '../../../../lib/onboardingRoutes'
import { navigateToMiniProgramNextStep } from '../../../../lib/onboardingNavigation'
import './index.scss'

const TRAIT_LABELS: Array<{ key: string; label: string }> = [
  { key: 'A', label: '亲和力' },
  { key: 'O', label: '开放性' },
  { key: 'C', label: '责任心' },
  { key: 'E', label: '稳定感' },
  { key: 'X', label: '外向度' },
  { key: 'P', label: '快乐值' },
]

const ARCHETYPE_SUMMARIES: Record<string, string> = {
  开心柯基: '你更容易在陌生局里先把气氛带热，让大家更快放松下来。',
  太阳鸡: '你不是最吵的那个，但往往是让整桌节奏稳定下来的那个人。',
  夸夸豚: '你很会看见别人身上的亮点，关系会在你的真诚里自然升温。',
  机智狐: '你擅长把普通聊天拐到更有意思的方向，聊着聊着就有火花。',
  淡定海豚: '你习惯先看气场再发力，一旦找到对的人，连接会很顺。',
  织网蛛: '你更像局里的连接器，擅长把看起来不相干的人慢慢搭上线。',
  暖心熊: '你会让人感觉被接住，适合把陌生感聊成熟悉感。',
  灵感章鱼: '你的脑洞和新鲜视角，会让一场局突然多出意料之外的惊喜。',
  沉思猫头鹰: '你不一定先开口，但你说出来的话通常最有记忆点。',
  定心大象: '你带来的稳定感很强，很多人会因为你在而更安心。',
  稳如龟: '你会先判断再靠近，一旦投入就很靠谱。',
  隐身猫: '你看起来低调，但往往最知道什么人值得深聊。',
}

function getTraitEntries(result: AnonymousAssessmentResult | null): Array<{ key: string; label: string; value: number }> {
  const traitScores = result?.traitScores ?? {}

  return TRAIT_LABELS.map(({ key, label }) => {
    const rawValue = Number(traitScores[key] ?? 0)
    return {
      key,
      label,
      value: Math.max(0, Math.min(Math.round(rawValue), 100)),
    }
  })
}

function getTopMatches(
  result: AnonymousAssessmentResult | null,
  storedMatches: AnonymousAssessmentTopMatch[] | null | undefined,
): AnonymousAssessmentTopMatch[] {
  if (Array.isArray(storedMatches) && storedMatches.length > 0) {
    return storedMatches
  }

  const resultMatches = result?.topMatches
  return Array.isArray(resultMatches) ? resultMatches : []
}

export default function PersonalityTestResultsPage() {
  const auth = useAuth()
  const snapshot = useMemo(() => readAnonymousAssessmentSession(), [])
  const hasResult = hasAnonymousAssessmentResult(snapshot)
  const result = (snapshot?.result ?? null) as AnonymousAssessmentResult | null
  const primaryArchetype = typeof result?.primaryArchetype === 'string' ? result.primaryArchetype : ''
  const summary = ARCHETYPE_SUMMARIES[primaryArchetype] ?? '你已经有了一个很清晰的社交氛围倾向，接下来登录就能继续完善资料。'
  const traitEntries = getTraitEntries(result)
  const topMatches = getTopMatches(result, snapshot?.topArchetypes)
  const analytics = useOnboardingAnalytics('personality-test-results', {
    enabled: !auth.isLoading && !auth.isAuthenticated,
    startMetadata: {
      primaryArchetype: primaryArchetype || 'unknown',
      topMatchCount: topMatches.length,
      hasStoredResult: hasResult,
    },
  })

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' })
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep])

  const handleRestart = useCallback(() => {
    clearAnonymousAssessmentStorage()
    void Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.personalityTest })
  }, [])

  const handleContinue = useCallback(async () => {
    try {
      analytics.stepCompleted({
        action: 'continue-to-auth-gate',
        primaryArchetype: primaryArchetype || 'unknown',
      })
      await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTestAuthGate })
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法继续登录'
      analytics.errorOccurred('continue_cta_failed', message)
      Taro.showToast({
        title: '暂时无法继续，请稍后重试',
        icon: 'none',
      })
    }
  }, [analytics, primaryArchetype])

  if (auth.isLoading) {
    return (
      <View className='personality-results'>
        <View className='personality-results__loading'>
          <Text className='personality-results__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  if (!hasResult || !result) {
    return (
      <View className='personality-results'>
        <View className='personality-results__empty'>
          <Text className='personality-results__title'>结果还没准备好</Text>
          <Text className='personality-results__subtitle'>
            当前设备里没有找到可继续的匿名测试结果，重新做一次会更稳妥。
          </Text>
          <Button onClick={handleRestart}>
            重新开始测试
          </Button>
        </View>
      </View>
    )
  }

  return (
    <ScrollView className='personality-results' scrollY enhanced showScrollbar={false}>
      <View className='personality-results__hero'>
        <Text className='personality-results__eyebrow'>匿名结果已解锁</Text>
        <Text className='personality-results__title'>你的氛围原型更接近</Text>
        <Text className='personality-results__archetype'>{primaryArchetype || '神秘原型'}</Text>
        <Text className='personality-results__subtitle'>{summary}</Text>
      </View>

      <Card className='personality-results__card'>
        <Text className='personality-results__card-title'>这一版结果先告诉你什么</Text>
        <Text className='personality-results__card-copy'>
          登录后，系统会按你的真实进度把你继续送往基础资料或正确的下一步。
        </Text>

        {topMatches.length > 0 ? (
          <View className='personality-results__match-list'>
            {topMatches.slice(0, 3).map((match) => (
              <View key={match.archetype} className='personality-results__match-chip'>
                <Text className='personality-results__match-name'>{match.archetype}</Text>
                <Text className='personality-results__match-score'>{Math.round(match.score)}%</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card className='personality-results__card'>
        <Text className='personality-results__card-title'>你的社交雷达</Text>
        <View className='personality-results__traits'>
          {traitEntries.map((trait) => (
            <View key={trait.key} className='personality-results__trait-row'>
              <View className='personality-results__trait-label-row'>
                <Text className='personality-results__trait-label'>{trait.label}</Text>
                <Text className='personality-results__trait-value'>{trait.value}</Text>
              </View>
              <View className='personality-results__trait-track'>
                <View className='personality-results__trait-fill' style={{ width: `${trait.value}%` }} />
              </View>
            </View>
          ))}
        </View>
      </Card>

      <View className='personality-results__actions'>
        <Button onClick={() => void handleContinue()}>
          微信登录，继续下一步
        </Button>
        <Button variant='secondary' onClick={handleRestart}>
          重新测试一次
        </Button>
      </View>
    </ScrollView>
  )
}