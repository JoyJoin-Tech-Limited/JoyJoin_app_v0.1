import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  confirmPoolGroupAttendance,
  getPoolGroupAnalysis,
  getPoolGroupDetails,
  type PoolGroupDetailsResponse,
  type PoolGroupMemberSummary,
} from '@shared/api'
import type { OverallChemistry, PairExplanation } from '@shared/types/groupAnalysis'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logError, logInfo } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import './index.scss'

type FlowState = 'ready' | 'shaking' | 'revealed'
type AnalysisStage = 0 | 1 | 2 | 3 | 4

interface ChemistryTokens {
  emoji: string
  title: string
  description: string
  chipClassName: string
}

function getMemberName(member: PoolGroupMemberSummary): string {
  return member.displayName || '匿名'
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

function formatDateTime(dateTime?: string | null): string {
  if (!dateTime) {
    return '时间待定'
  }

  const parsedDate = new Date(dateTime)
  if (Number.isNaN(parsedDate.getTime())) {
    return '时间待定'
  }

  return parsedDate.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getVibeLabel(vibe?: string | null): string {
  switch (vibe) {
    case 'playful':
      return '轻松有趣'
    case 'professional':
      return '专业交流'
    case 'creative':
      return '创意碰撞'
    case 'adventurous':
      return '探索冒险'
    default:
      return vibe ?? '今晚成桌'
  }
}

function getChemistryTokens(
  chemistry?: OverallChemistry,
  matchScore?: number | null,
): ChemistryTokens {
  const fallbackScore = typeof matchScore === 'number' ? Math.round(matchScore) : null

  switch (chemistry) {
    case 'fire':
      return {
        emoji: '🔥',
        title: '超级火花',
        description: '这桌的聊天温度很高，基本不会冷场。',
        chipClassName: 'squad-unboxing__chemistry-chip--fire',
      }
    case 'warm':
      return {
        emoji: '✨',
        title: '暖意融融',
        description: '同频感很稳定，适合边吃边慢慢聊开。',
        chipClassName: 'squad-unboxing__chemistry-chip--warm',
      }
    case 'cold':
      return {
        emoji: '🌱',
        title: '慢慢发现',
        description: '这桌是耐聊型组合，越往后越容易找到共同节奏。',
        chipClassName: 'squad-unboxing__chemistry-chip--cold',
      }
    case 'mild':
      return {
        emoji: '💬',
        title: '相聊甚欢',
        description: '这桌的风格平衡又自然，很适合从小话题慢慢热起来。',
        chipClassName: 'squad-unboxing__chemistry-chip--mild',
      }
    default:
      return {
        emoji: '💫',
        title: fallbackScore !== null ? `默契度 ${fallbackScore}%` : '今晚有戏',
        description: '小悦已经替你把这一桌锁定，接下来看看你们为什么会聊得来。',
        chipClassName: 'squad-unboxing__chemistry-chip--fallback',
      }
  }
}

function triggerLightHaptic() {
  if (typeof Taro.vibrateShort === 'function') {
    void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
  }
}

export default function SquadUnboxingPage() {
  const router = useRouter()
  const groupId = router.params.groupId ?? ''
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()

  const [flowState, setFlowState] = useState<FlowState>('ready')
  const [showActionZone, setShowActionZone] = useState(false)
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>(0)

  const {
    data: poolGroup,
    isLoading,
    error: fetchError,
  } = useQuery<PoolGroupDetailsResponse>({
    queryKey: ['mini-program', 'pool-group', groupId],
    queryFn: () => getPoolGroupDetails(apiRequest, groupId),
    enabled: !!groupId && !authLoading,
  })

  const {
    data: groupAnalysis,
    isLoading: isLoadingAnalysis,
  } = useQuery({
    queryKey: ['mini-program', 'pool-group-analysis', groupId],
    queryFn: () => getPoolGroupAnalysis(apiRequest, groupId),
    enabled: !!groupId && flowState === 'revealed',
    staleTime: 1000 * 60 * 7,
    retry: 1,
  })

  const currentUserId = currentUser?.id
  const members = poolGroup?.members ?? []
  const group = poolGroup?.group
  const pool = poolGroup?.pool

  const confirmAttendanceMutation = useMutation({
    mutationFn: () => confirmPoolGroupAttendance(apiRequest, groupId),
    onSuccess: async (response) => {
      logInfo('[SquadUnboxing] Attendance confirmed', {
        groupId,
        blindBoxEventId: response.blindBoxEventId,
      })

      await Taro.showToast({
        title: '已确认出席',
        icon: 'success',
        duration: 1800,
      })

      if (response.blindBoxEventId) {
        Taro.redirectTo({ url: `/pages/event-detail/index?id=${response.blindBoxEventId}` })
        return
      }

      Taro.navigateTo({ url: `/pages/pool-group-detail/index?groupId=${groupId}` })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '确认出席失败'
      logError('[SquadUnboxing] Attendance confirmation failed', {
        groupId,
        message,
      })
      Taro.showToast({ title: message, icon: 'none', duration: 2200 })
    },
  })

  const chemistryTokens = useMemo(
    () => getChemistryTokens(groupAnalysis?.overallChemistry, group?.matchScore),
    [group?.matchScore, groupAnalysis?.overallChemistry],
  )

  const sortedPairExplanations = useMemo<PairExplanation[]>(() => {
    if (!groupAnalysis?.pairExplanations) {
      return []
    }

    if (!currentUserId) {
      return groupAnalysis.pairExplanations
    }

    return [...groupAnalysis.pairExplanations].sort((left, right) => {
      const leftHasCurrentUser = left.pairKey.includes(currentUserId)
      const rightHasCurrentUser = right.pairKey.includes(currentUserId)

      if (leftHasCurrentUser && !rightHasCurrentUser) return -1
      if (!leftHasCurrentUser && rightHasCurrentUser) return 1
      return 0
    })
  }, [currentUserId, groupAnalysis?.pairExplanations])

  const pairKeyMemberMap = useMemo(() => {
    const map = new Map<string, [PoolGroupMemberSummary, PoolGroupMemberSummary]>()

    for (let index = 0; index < members.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < members.length; nextIndex += 1) {
        const pairKey = [members[index].userId, members[nextIndex].userId].sort().join('-')
        map.set(pairKey, [members[index], members[nextIndex]])
      }
    }

    return map
  }, [members])

  const strongConnectionCount = useMemo(() => {
    const highChemistryPairs = sortedPairExplanations.filter((pair) => pair.chemistryScore >= 70)
    return highChemistryPairs.length > 0 ? highChemistryPairs.length : sortedPairExplanations.length
  }, [sortedPairExplanations])

  const viewerPairs = useMemo<PairExplanation[]>(() => {
    if (Array.isArray(groupAnalysis?.myPairs) && groupAnalysis.myPairs.length > 0) {
      return groupAnalysis.myPairs
    }

    if (!currentUserId) {
      return []
    }

    return sortedPairExplanations.filter((pair) => {
      const members = pairKeyMemberMap.get(pair.pairKey)
      return Boolean(members && members.some((member) => member.userId === currentUserId))
    })
  }, [currentUserId, groupAnalysis?.myPairs, pairKeyMemberMap, sortedPairExplanations])

  const viewerPairByMemberId = useMemo(() => {
    const map = new Map<string, PairExplanation>()

    if (!currentUserId) {
      return map
    }

    viewerPairs.forEach((pair) => {
      const members = pairKeyMemberMap.get(pair.pairKey)
      const otherMember = members?.find((member) => member.userId !== currentUserId)
      if (otherMember) {
        map.set(otherMember.userId, pair)
      }
    })

    return map
  }, [currentUserId, pairKeyMemberMap, viewerPairs])

  const groupThemeHighlights = useMemo(
    () =>
      Array.isArray(group?.highlights)
        ? group.highlights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 4)
        : [],
    [group?.highlights],
  )

  const analysisThemeTags = useMemo(() => {
    if (Array.isArray(groupAnalysis?.groupThemeTags) && groupAnalysis.groupThemeTags.length > 0) {
      return groupAnalysis.groupThemeTags.slice(0, 4)
    }

    return groupThemeHighlights
  }, [groupAnalysis?.groupThemeTags, groupThemeHighlights])

  const handleOpenBox = useCallback(() => {
    triggerLightHaptic()
    setShowActionZone(false)
    setAnalysisStage(0)
    setFlowState('shaking')
  }, [])

  const handleConfirmAttendance = useCallback(() => {
    if (confirmAttendanceMutation.isPending) {
      return
    }

    confirmAttendanceMutation.mutate()
  }, [confirmAttendanceMutation])

  const handleOpenGroupDetail = useCallback(() => {
    Taro.navigateTo({ url: `/pages/pool-group-detail/index?groupId=${groupId}` })
  }, [groupId])

  const handleSkip = useCallback(async () => {
    if (analysisStage < 4) {
      setAnalysisStage(4)
    }

    const { confirm } = await Taro.showModal({
      title: '先离开这桌？',
      content:
        strongConnectionCount > 0
          ? `系统已经看出这桌至少有 ${strongConnectionCount} 组潜在连接点，真的要先离开吗？`
          : '你稍后仍然可以从活动页回来看这桌的揭晓内容。',
      confirmText: '先离开',
      cancelText: '再看看',
      confirmColor: '#EF4444',
    })

    if (confirm) {
      Taro.switchTab({ url: '/pages/events/index' })
    }
  }, [analysisStage, strongConnectionCount])

  useEffect(() => {
    if (flowState !== 'shaking') {
      return undefined
    }

    const timer = setTimeout(() => {
      triggerLightHaptic()
      setFlowState('revealed')
    }, 1450)

    return () => clearTimeout(timer)
  }, [flowState])

  useEffect(() => {
    if (flowState !== 'revealed') {
      return undefined
    }

    const timer = setTimeout(() => {
      setShowActionZone(true)
    }, 2300)

    return () => clearTimeout(timer)
  }, [flowState])

  useEffect(() => {
    if (flowState !== 'revealed') {
      return undefined
    }

    const timer = setTimeout(() => {
      setAnalysisStage((stage) => (stage === 0 ? 1 : stage))
    }, 900)

    return () => clearTimeout(timer)
  }, [flowState])

  useEffect(() => {
    if (analysisStage < 1 || analysisStage >= 4) {
      return undefined
    }

    const timer = setTimeout(() => {
      setAnalysisStage((stage) => (stage < 4 ? ((stage + 1) as AnalysisStage) : stage))
    }, 1650)

    return () => clearTimeout(timer)
  }, [analysisStage])

  useEffect(() => {
    if (analysisStage > 0) {
      triggerLightHaptic()
    }
  }, [analysisStage])

  if (authLoading || isLoading) {
    return <LoadingScreen message='揭晓小队中…' />
  }

  if (fetchError || !poolGroup || !group || !pool) {
    return (
      <View className='squad-unboxing'>
        <View className='squad-unboxing__error'>
          <Text className='squad-unboxing__error-icon'>😕</Text>
          <Text className='squad-unboxing__error-text'>
            {fetchError ? '加载小队信息失败' : '未找到小队信息'}
          </Text>
          <Button
            variant='secondary'
            className='squad-unboxing__error-btn'
            onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/events/index' }) })}
          >
            返回
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className='squad-unboxing'>
      <ScrollView className='squad-unboxing__scroll' scrollY enhanced showScrollbar={false}>
        <View className='squad-unboxing__header'>
          <Text className='squad-unboxing__header-emoji'>🎉</Text>
          <Text className='squad-unboxing__header-title'>
            你的{pool.eventType === 'bar' ? '酒局' : '饭局'}桌友来了
          </Text>
          <Text className='squad-unboxing__header-tagline'>
            {group.matchExplanation || pool.description || '小悦已经把这一桌锁定，准备让你看看今晚会和谁同桌。'}
          </Text>
          <View className='squad-unboxing__header-meta'>
            {group.groupNumber ? (
              <Text className='squad-unboxing__header-group-num'>第 {group.groupNumber} 组</Text>
            ) : null}
            {group.matchScore != null ? (
              <Text className='squad-unboxing__header-score'>默契度 {Math.round(group.matchScore)}%</Text>
            ) : null}
          </View>
        </View>

        {flowState === 'ready' ? (
          <Card className='squad-unboxing__blind-box-card'>
            <View className='squad-unboxing__blind-box-glow' />
            <View className='squad-unboxing__blind-box-emoji-wrap'>
              <Text className='squad-unboxing__blind-box-emoji'>🎁</Text>
            </View>
            <Text className='squad-unboxing__blind-box-title'>你的桌友来了</Text>
            <Text className='squad-unboxing__blind-box-copy'>
              这一桌 {members.length} 位桌友已经就位。先开盒，再看为什么你们会被放在同一桌。
            </Text>
            {group.theme || group.themeEmoji ? (
              <View className='squad-unboxing__blind-box-theme-pill'>
                <Text className='squad-unboxing__blind-box-theme-text'>
                  {group.themeEmoji ? `${group.themeEmoji} ` : ''}
                  {group.theme || '今晚成桌'}
                </Text>
              </View>
            ) : null}
            <Button className='squad-unboxing__open-btn' onClick={handleOpenBox}>
              揭晓桌友
            </Button>
          </Card>
        ) : null}

        {flowState === 'shaking' ? (
          <Card className='squad-unboxing__blind-box-card squad-unboxing__blind-box-card--shaking'>
            <View className='squad-unboxing__blind-box-glow' />
            <View className='squad-unboxing__blind-box-emoji-wrap squad-unboxing__blind-box-emoji-wrap--shaking'>
              <Text className='squad-unboxing__blind-box-emoji'>🎁</Text>
            </View>
            <Text className='squad-unboxing__blind-box-title'>正在开盒…</Text>
            <Text className='squad-unboxing__blind-box-copy'>
              小悦正在把今晚最值得期待的那一页翻给你看。
            </Text>
          </Card>
        ) : null}

        {flowState === 'revealed' ? (
          <>
            <View className='squad-unboxing__reveal-shell'>
              <Text className='squad-unboxing__section-label'>今晚同桌的是</Text>
              <View className='squad-unboxing__member-grid'>
                {members.map((member, index) => {
                  const name = getMemberName(member)
                  const isCurrentUser = member.userId === currentUserId
                  const industryLabel = member.industryNicheLabel || member.industryCategoryLabel
                  const visibleInterests = (member.topInterests ?? []).slice(0, 3)
                  const viewerPair = viewerPairByMemberId.get(member.userId)

                  return (
                    <Card
                      key={member.userId}
                      className={`squad-unboxing__member-card${isCurrentUser ? ' squad-unboxing__member-card--current' : ''}`}
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <View className='squad-unboxing__member-top'>
                        <View className='squad-unboxing__member-avatar-wrap'>
                          <View className='squad-unboxing__member-avatar squad-unboxing__member-avatar--placeholder'>
                            <Text className='squad-unboxing__member-avatar-initial'>
                              {getInitial(name)}
                            </Text>
                          </View>
                          {isCurrentUser ? (
                            <View className='squad-unboxing__member-badge'>
                              <Text className='squad-unboxing__member-badge-text'>我</Text>
                            </View>
                          ) : null}
                        </View>

                        <View className='squad-unboxing__member-copy'>
                          <Text className='squad-unboxing__member-name'>{name}</Text>
                          {member.archetype ? (
                            <Text className='squad-unboxing__member-archetype'>{member.archetype}</Text>
                          ) : null}
                          {member.ageLabel || industryLabel ? (
                            <Text className='squad-unboxing__member-meta'>
                              {[member.ageLabel, industryLabel].filter(Boolean).join(' · ')}
                            </Text>
                          ) : null}
                          {viewerPair?.connectionPoints?.[0] ? (
                            <Text className='squad-unboxing__member-signal'>
                              {viewerPair.connectionPoints[0]}
                            </Text>
                          ) : viewerPair ? (
                            <Text className='squad-unboxing__member-signal'>
                              默契度 {viewerPair.chemistryScore}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {visibleInterests.length > 0 ? (
                        <View className='squad-unboxing__member-interests'>
                          {visibleInterests.map((interest) => (
                            <View key={interest} className='squad-unboxing__member-interest-tag'>
                              <Text className='squad-unboxing__member-interest-text'>{interest}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </Card>
                  )
                })}
              </View>
            </View>

            <Card className='squad-unboxing__info-card'>
              <View className='squad-unboxing__info-copy'>
                <Text className='squad-unboxing__info-title'>为什么是这桌？</Text>
                <Text className='squad-unboxing__info-description'>
                  {group.matchExplanation || '这桌的组合已经锁定，下面会把更细的分析慢慢揭晓给你。'}
                </Text>
              </View>

              {pool.eventType ? (
                <View className='squad-unboxing__info-row'>
                  <Text className='squad-unboxing__info-label'>🎯 活动类型</Text>
                  <Text className='squad-unboxing__info-value'>{pool.eventType}</Text>
                </View>
              ) : null}

              {group.finalDateTime || pool.dateTime ? (
                <View className='squad-unboxing__info-row'>
                  <Text className='squad-unboxing__info-label'>📅 时间</Text>
                  <Text className='squad-unboxing__info-value'>
                    {formatDateTime(group.finalDateTime ?? pool.dateTime)}
                  </Text>
                </View>
              ) : null}

              <View className='squad-unboxing__info-row'>
                <Text className='squad-unboxing__info-label'>📍 地点</Text>
                <Text className='squad-unboxing__info-value'>
                  {group.venueName || [pool.city, pool.district].filter(Boolean).join(' · ') || '待公布'}
                </Text>
              </View>
            </Card>

            {group.theme || group.themeEmoji ? (
              <Card className='squad-unboxing__theme-card'>
                <View className='squad-unboxing__theme-header'>
                  {group.themeEmoji ? (
                    <Text className='squad-unboxing__theme-emoji'>{group.themeEmoji}</Text>
                  ) : null}
                  <Text className='squad-unboxing__theme-title'>{group.theme || '今晚的主题'}</Text>
                </View>
                {group.subtitle ? (
                  <Text className='squad-unboxing__theme-subtitle'>{group.subtitle}</Text>
                ) : null}
                {group.vibe ? (
                  <View className='squad-unboxing__theme-vibe'>
                    <Text className='squad-unboxing__theme-vibe-label'>氛围：</Text>
                    <Text className='squad-unboxing__theme-vibe-value'>{getVibeLabel(group.vibe)}</Text>
                  </View>
                ) : null}
                {groupThemeHighlights.length > 0 ? (
                  <View className='squad-unboxing__theme-highlights'>
                    {groupThemeHighlights.map((highlight) => (
                      <View key={highlight} className='squad-unboxing__theme-highlight'>
                        <Text className='squad-unboxing__theme-highlight-text'>· {highlight}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : null}

            {analysisStage > 0 ? (
              <View className='squad-unboxing__analysis-stack'>
                {analysisStage >= 1 ? (
                  <Card className='squad-unboxing__analysis-card squad-unboxing__analysis-card--chemistry'>
                    <Text className='squad-unboxing__section-label'>这桌的火花</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton squad-unboxing__skeleton--banner' />
                    ) : (
                      <>
                        <View className={`squad-unboxing__chemistry-chip ${chemistryTokens.chipClassName}`}>
                          <Text className='squad-unboxing__chemistry-emoji'>{chemistryTokens.emoji}</Text>
                          <Text className='squad-unboxing__chemistry-title'>{chemistryTokens.title}</Text>
                        </View>
                        <Text className='squad-unboxing__analysis-text'>{chemistryTokens.description}</Text>
                      </>
                    )}
                  </Card>
                ) : null}

                {analysisStage >= 2 ? (
                  <Card className='squad-unboxing__analysis-card'>
                    <Text className='squad-unboxing__section-label'>这桌的整体氛围</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton-list'>
                        <View className='squad-unboxing__skeleton squad-unboxing__skeleton--line' />
                        <View className='squad-unboxing__skeleton squad-unboxing__skeleton--line squad-unboxing__skeleton--line-short' />
                      </View>
                    ) : groupAnalysis ? (
                      <>
                        {analysisThemeTags.length > 0 ? (
                          <View className='squad-unboxing__tag-row'>
                            {analysisThemeTags.map((tag) => (
                              <View key={tag} className='squad-unboxing__tag-chip'>
                                <Text className='squad-unboxing__tag-chip-text'>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {groupAnalysis.groupThemeCompanion ? (
                          <Text className='squad-unboxing__analysis-text'>
                            {groupAnalysis.groupThemeCompanion}
                          </Text>
                        ) : null}
                        <Text className='squad-unboxing__analysis-text'>{groupAnalysis.groupDynamics}</Text>
                      </>
                    ) : (
                      <Text className='squad-unboxing__analysis-text'>{group.matchExplanation}</Text>
                    )}
                  </Card>
                ) : null}

                {analysisStage >= 3 ? (
                  <Card className='squad-unboxing__analysis-card'>
                    <Text className='squad-unboxing__section-label'>你和这桌最容易从哪里聊开？</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton-list'>
                        {[0, 1].map((item) => (
                          <View key={item} className='squad-unboxing__skeleton squad-unboxing__skeleton--pair' />
                        ))}
                      </View>
                    ) : viewerPairs.length > 0 ? (
                      <View className='squad-unboxing__pair-list'>
                        {viewerPairs.slice(0, 2).map((pair, index) => {
                          const pairMembers = pairKeyMemberMap.get(pair.pairKey)
                          const otherMember = pairMembers?.find((member) => member.userId !== currentUserId)
                          const pairLabel = otherMember
                            ? `你 × ${getMemberName(otherMember)}`
                            : pairMembers
                              ? `${getMemberName(pairMembers[0])} × ${getMemberName(pairMembers[1])}`
                              : pair.pairKey

                          return (
                            <View
                              key={pair.pairKey}
                              className='squad-unboxing__pair-card'
                              style={{ animationDelay: `${index * 140}ms` }}
                            >
                              <View className='squad-unboxing__pair-top'>
                                <Text className='squad-unboxing__pair-label'>{pairLabel}</Text>
                                <Text className='squad-unboxing__pair-score'>{pair.chemistryScore}</Text>
                              </View>
                              {pair.connectionPoints.length > 0 ? (
                                <View className='squad-unboxing__pair-pill-row'>
                                  {pair.connectionPoints.slice(0, 3).map((point) => (
                                    <View key={point} className='squad-unboxing__pair-pill'>
                                      <Text className='squad-unboxing__pair-pill-text'>{point}</Text>
                                    </View>
                                  ))}
                                </View>
                              ) : null}
                              <Text className='squad-unboxing__pair-copy'>{pair.explanation}</Text>
                            </View>
                          )
                        })}
                      </View>
                    ) : sortedPairExplanations.length > 0 ? (
                      <View className='squad-unboxing__pair-list'>
                        {sortedPairExplanations.slice(0, 2).map((pair, index) => {
                          const pairMembers = pairKeyMemberMap.get(pair.pairKey)
                          const pairLabel = pairMembers
                            ? `${getMemberName(pairMembers[0])} × ${getMemberName(pairMembers[1])}`
                            : pair.pairKey

                          return (
                            <View
                              key={pair.pairKey}
                              className='squad-unboxing__pair-card'
                              style={{ animationDelay: `${index * 140}ms` }}
                            >
                              <View className='squad-unboxing__pair-top'>
                                <Text className='squad-unboxing__pair-label'>{pairLabel}</Text>
                                <Text className='squad-unboxing__pair-score'>{pair.chemistryScore}</Text>
                              </View>
                              <Text className='squad-unboxing__pair-copy'>{pair.explanation}</Text>
                            </View>
                          )
                        })}
                      </View>
                    ) : (
                      <Text className='squad-unboxing__analysis-text'>
                        {group.matchExplanation || '这桌有不少潜在共同点，见面后会更快找到节奏。'}
                      </Text>
                    )}
                  </Card>
                ) : null}

                {analysisStage >= 4 ? (
                  <Card className='squad-unboxing__analysis-card'>
                    <Text className='squad-unboxing__section-label'>今晚聊什么？</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__topic-row'>
                        {[0, 1, 2].map((item) => (
                          <View key={item} className='squad-unboxing__skeleton squad-unboxing__skeleton--topic' />
                        ))}
                      </View>
                    ) : groupAnalysis?.iceBreakers && groupAnalysis.iceBreakers.length > 0 ? (
                      <View className='squad-unboxing__topic-row'>
                        {groupAnalysis.iceBreakers.map((topic, index) => (
                          <View
                            key={`${topic}-${index}`}
                            className='squad-unboxing__topic-chip'
                            style={{ animationDelay: `${index * 120}ms` }}
                          >
                            <Text className='squad-unboxing__topic-chip-text'>{topic}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text className='squad-unboxing__analysis-text'>
                        先从彼此最近最上头的一件事聊起，通常都能很快破冰。
                      </Text>
                    )}
                  </Card>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <View className='squad-unboxing__spacer' />
      </ScrollView>

      {flowState === 'revealed' && showActionZone ? (
        <View className='squad-unboxing__action-zone'>
          <Button
            className='squad-unboxing__confirm-btn'
            onClick={handleConfirmAttendance}
            disabled={confirmAttendanceMutation.isPending}
            loading={confirmAttendanceMutation.isPending}
          >
            {confirmAttendanceMutation.isPending ? '确认中…' : '确认出席'}
          </Button>

          <Button
            variant='secondary'
            className='squad-unboxing__detail-btn'
            onClick={handleOpenGroupDetail}
          >
            查看活动详情
          </Button>

          <Text className='squad-unboxing__skip-link' onClick={handleSkip}>
            稍后再看
          </Text>
        </View>
      ) : null}
    </View>
  )
}
