import { Canvas, Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getPoolGroupAnalysis,
  getPoolGroupDetails,
  type PoolGroupDetailsResponse,
  type PoolGroupMemberSummary,
} from '@shared/api'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { apiRequest } from '../../lib/api/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import LoadingScreen from '../../components/loading/LoadingScreen'
import Card from '../../components/ui/Card'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import MissingArchetypePlaceholder from '../../components/mascot/MissingArchetypePlaceholder'
import Button from '../../components/ui/Button'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { haptics } from '../../lib/utils/haptics'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { GroupAnalysisSourceHint } from '../../components/GroupAnalysisSourceHint'
import AIGCLabel from '../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../hooks/useAIGCLabelsEnabled'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { STALE_TIME_GROUP_ANALYSIS_MS, TOAST_SHORT_MS, TOAST_MEDIUM_MS, MS_PER_MINUTE, MS_PER_HOUR } from '../../lib/utils/uiConstants'
import { formatDateTime } from '../../lib/matching/groupDisplay'
import {
  generateGroupRevealPoster,
  GROUP_REVEAL_CANVAS_ID,
} from '../../lib/utils/momentsPosterFactory'
import './index.scss'

function getMemberName(member: PoolGroupMemberSummary) {
  return member.displayName || '匿名'
}

function getCountdown(dateTime?: string | null) {
  if (!dateTime) {
    return '时间待定'
  }

  const diff = new Date(dateTime).getTime() - Date.now()
  if (Number.isNaN(diff)) {
    return '时间待定'
  }

  if (diff <= 0) {
    return '活动进行中'
  }

  const totalMinutes = Math.floor(diff / MS_PER_MINUTE)
  if (totalMinutes >= 60) {
    const totalHours = Math.ceil(diff / MS_PER_HOUR)
    return `距离开始约 ${totalHours} 小时`
  }

  return `距离开始约 ${Math.max(totalMinutes, 1)} 分钟`
}

export default function PoolGroupDetailPage() {
  const router = useRouter()
  const groupId = router.params.groupId ?? ''
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()
  const [, setPosterPath] = useState('')
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false)

  const {
    data: poolGroup,
    isLoading,
    error,
  } = useQuery<PoolGroupDetailsResponse>({
    queryKey: ['mini-program', 'pool-group-detail', groupId],
    queryFn: () => getPoolGroupDetails(apiRequest, groupId),
    enabled: !!groupId && !authLoading,
  })

  const queryClient = useQueryClient()

  const { data: groupAnalysis, isLoading: isAnalysisLoading } = useQuery({
    queryKey: ['mini-program', 'pool-group-analysis', groupId],
    queryFn: () => getPoolGroupAnalysis(apiRequest, groupId),
    enabled: !!groupId && !authLoading && Boolean(poolGroup),
    staleTime: STALE_TIME_GROUP_ANALYSIS_MS,
    retry: 1,
  })

  const aigcLabelsEnabled = useAIGCLabelsEnabled()
  const prevVenueStatusRef = useRef<string | null>(null)

  useEffect(() => {
    if (!poolGroup) return
    const currentStatus = poolGroup.group.venueAssignmentStatus
    if (prevVenueStatusRef.current === 'unassigned' && currentStatus === 'assigned' && poolGroup.group.venueName) {
      haptics('success')
      Taro.showToast({ title: '场地已确定', icon: 'success', duration: 2000 })
    }
    prevVenueStatusRef.current = currentStatus ?? null
  }, [poolGroup])

  const handleShareGroupPoster = useCallback(async () => {
    if (!poolGroup || isGeneratingPoster) return
    setIsGeneratingPoster(true)
    try {
      const { group, pool, members } = poolGroup
      const path = await generateGroupRevealPoster({
        poolTitle: pool.title || '悦聚盲盒活动',
        groupNumber: group.groupNumber ?? undefined,
        eventType: pool.eventType || '悦聚活动',
        venueName: group.venueName || undefined,
        dateTimeText: formatDateTime(group.finalDateTime ?? pool.dateTime),
        members: members.map((m) => ({
          displayName: getMemberName(m),
          archetype: m.archetype || undefined,
        })),
        matchScore: group.matchScore ?? undefined,
      })
      setPosterPath(path)
      await Taro.showShareImageMenu({ path })
    } catch (err) {
      console.error('[PoolGroupDetail] poster generation failed:', err)
      Taro.showToast({ title: '海报没生成成功，再试试', icon: 'none', duration: TOAST_SHORT_MS })
    } finally {
      setIsGeneratingPoster(false)
    }
  }, [poolGroup, isGeneratingPoster])

  if (authLoading || isLoading) {
    return <LoadingScreen message='正在揭晓小队阵容…' />
  }

  if (error || !poolGroup) {
    return (
      <View className='pool-group-detail__error' role='alert' aria-live='polite'>
        <Image
          className='pool-group-detail__error-hero'
          src={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
          mode='widthFix'
          lazyLoad
        />
        <Text className='pool-group-detail__error-text'>加载小队详情没成功</Text>
        <View style={{ display: 'flex', gap: '24rpx' }}>
          <Button variant='primary' onClick={() => {
            haptics('light')
            queryClient.invalidateQueries({ queryKey: ['mini-program', 'pool-group-detail', groupId] })
          }}
          >
            重试
          </Button>
          <Button variant='secondary' onClick={() => {
            haptics('light')
            Taro.switchTab({ url: '/pages/events/index' })
          }}
          >
            返回活动
          </Button>
        </View>
      </View>
    )
  }

  const { group, pool, members } = poolGroup
  const currentUserId = currentUser?.id
  const locationText = [group.venueName, group.venueAddress].filter(Boolean).join(' ')

  const handleCopyAddressForNavigation = () => {
    if (!locationText) {
      return
    }

    haptics('light')
    Taro.setClipboardData({
      data: locationText,
      success: () => {
        Taro.showToast({ title: '地址已复制，请到地图应用导航', icon: 'none', duration: TOAST_MEDIUM_MS })
      },
    })
  }

  return (
    <ScrollView className='pool-group-detail' scrollY enhanced showScrollbar={false}>
      <View className='pool-group-detail__header'>
        {group.groupNumber ? (
          <View className='pool-group-detail__group-badge'>
            <View className='jj-icon-text'>
              <JoyJoinIcon emoji='✨' tier='reveal' size={20} />
              <Text className='pool-group-detail__group-badge-text'>#{group.groupNumber}组</Text>
            </View>
          </View>
        ) : null}
        <Text className='pool-group-detail__title'>{pool.title || '你的小队详情已解锁'}</Text>
        <Text className='pool-group-detail__subtitle'>
          {group.matchExplanation || pool.description || '见面信息已经为你准备好，出发前再确认一次时间和地点。'}
        </Text>
        {isAnalysisLoading ? (
          <Text className='pool-group-detail__analysis-hint'>正在加载悦仔解析…</Text>
        ) : null}
        {groupAnalysis?.groupDynamics ? (
          <Card className='pool-group-detail__analysis-card'>
            <View className='pool-group-detail__analysis-header'>
              <Text className='pool-group-detail__analysis-label'>悦仔 · 这桌氛围</Text>
              <AIGCLabel meta={groupAnalysis.meta?.aigc} />
            </View>
            <Text className='pool-group-detail__analysis-body'>{groupAnalysis.groupDynamics}</Text>
            {groupAnalysis.iceBreakers && groupAnalysis.iceBreakers.length > 0 ? (
              <Text className='pool-group-detail__analysis-ice'>
                开场灵感：{groupAnalysis.iceBreakers[0]}
              </Text>
            ) : null}
            {aigcLabelsEnabled && (
              <AIContentReportButton
                className='pool-group-detail__analysis-report'
                options={{
                  reason: '举报“这桌氛围”AI 生成内容',
                  relatedEventId: poolGroup?.group.id ?? poolGroup?.pool.id,
                }}
              />
            )}
            <GroupAnalysisSourceHint analysis={groupAnalysis} />
          </Card>
        ) : null}
        <Text className='pool-group-detail__countdown'>
          {getCountdown(group.finalDateTime ?? pool.dateTime)}
        </Text>
        {group.matchScore != null ? (
          <View className='pool-group-detail__match-score'>
            <Text className='pool-group-detail__match-score-text'>匹配度 {group.matchScore}分</Text>
          </View>
        ) : null}
      </View>

      <Card className='pool-group-detail__card'>
        <Text className='pool-group-detail__card-title'>活动信息</Text>
        <View className='pool-group-detail__info-row'>
          <View className='jj-icon-text'>
            <JoyJoinIcon emoji='📅' size={24} />
            <Text className='pool-group-detail__info-label'>时间</Text>
          </View>
          <Text className='pool-group-detail__info-value'>
            {formatDateTime(group.finalDateTime ?? pool.dateTime)}
          </Text>
        </View>
        <View className='pool-group-detail__info-row'>
          <View className='jj-icon-text'>
            <JoyJoinIcon emoji='📍' size={24} />
            <Text className='pool-group-detail__info-label'>地点</Text>
          </View>
          <Text className='pool-group-detail__info-value'>
            {group.venueName || (group.venueAssignmentStatus === 'unassigned' ? '地点待定' : [pool.city, pool.district].filter(Boolean).join(' · ') || '待公布')}
          </Text>
        </View>
        <View className='pool-group-detail__info-row'>
          <View className='jj-icon-text'>
            <JoyJoinIcon emoji='🎯' size={24} />
            <Text className='pool-group-detail__info-label'>类型</Text>
          </View>
          <Text className='pool-group-detail__info-value'>{pool.eventType || '悦聚活动'}</Text>
        </View>
        <View className='pool-group-detail__info-row'>
          <View className='jj-icon-text'>
            <JoyJoinIcon emoji='👥' size={24} />
            <Text className='pool-group-detail__info-label'>人数</Text>
          </View>
          <Text className='pool-group-detail__info-value'>{group.memberCount || members.length}人桌</Text>
        </View>
      </Card>

      {pool.description ? (
        <Card className='pool-group-detail__card'>
          <Text className='pool-group-detail__card-title'>活动介绍</Text>
          <Text className='pool-group-detail__description'>{pool.description}</Text>
        </Card>
      ) : null}

      {group.venueName ? (
        <Card className='pool-group-detail__card' aria-label='场地信息'>
          <Text className='pool-group-detail__card-title'>地点信息</Text>
          <View className='pool-group-detail__info-row'>
            <Text className='pool-group-detail__info-label'><JoyJoinIcon emoji='🏠' size={24} /> 地址</Text>
            <Text className='pool-group-detail__info-value'>
              {group.venueName}
              {group.venueAddress ? `\n${group.venueAddress}` : ''}
            </Text>
          </View>
          {pool.city ? (
            <View className='pool-group-detail__info-row'>
              <Text className='pool-group-detail__info-label'><JoyJoinIcon emoji='🌆' size={24} /> 地区</Text>
              <Text className='pool-group-detail__info-value'>
                {pool.city}{pool.district ? ` · ${pool.district}` : ''}
              </Text>
            </View>
          ) : null}
          <View className='pool-group-detail__map-actions'>
            <Button onClick={handleCopyAddressForNavigation}><JoyJoinIcon emoji='🗺️' size={24} /> 复制地址去导航</Button>
          </View>
        </Card>
      ) : group.venueAssignmentStatus === 'unassigned' ? (
        <Card className='pool-group-detail__card pool-group-detail__card--tbd'>
          <View className='pool-group-detail__tbd-header'>
            <Image
              className='pool-group-detail__tbd-mascot'
              src={getXiaoyueExpressionAsset('neutralInformation')}
              mode='aspectFit'
              lazyLoad
            />
            <View className='pool-group-detail__tbd-title-group'>
              <Text className='pool-group-detail__card-title'>地点信息</Text>
              <Text className='pool-group-detail__tbd-subtitle'>悦仔还在帮你们锁定最合适的场地</Text>
            </View>
          </View>
          <View className='pool-group-detail__info-row'>
            <Text className='pool-group-detail__info-label'><JoyJoinIcon emoji='⏳' size={24} /> 状态</Text>
            <Text className='pool-group-detail__info-value pool-group-detail__info-value--tbd'>
              地点待定
            </Text>
          </View>
          <View className='pool-group-detail__info-row'>
            <Text className='pool-group-detail__info-label'>&nbsp;</Text>
            <Text className='pool-group-detail__info-value pool-group-detail__info-value--tbd-hint'>
              一有消息马上告诉你，活动前会通知具体地点
            </Text>
          </View>
        </Card>
      ) : null}

      <Card className='pool-group-detail__card'>
        <Text className='pool-group-detail__members-title'>小队成员 ({group.memberCount || members.length})</Text>
        <View className='pool-group-detail__members-list'>
          {members.map((member) => {
            const name = getMemberName(member)
            const isCurrentUser = member.userId === currentUserId
            const visibleTags = (member.topInterests ?? []).slice(0, 3)

            return (
              <View
                key={member.userId}
                className={
                  'pool-group-detail__member-card' +
                  (isCurrentUser ? ' pool-group-detail__member-card--current' : '')
                }
              >
                <View className='pool-group-detail__member-avatar'>
                  {member.archetype ? (
                    <ArchetypeHead archetype={member.archetype} size={72} />
                  ) : (
                    <MissingArchetypePlaceholder size={72} />
                  )}
                </View>

                <View className='pool-group-detail__member-content'>
                  <View className='pool-group-detail__member-name-row'>
                    <Text className='pool-group-detail__member-name'>{name}</Text>
                    {member.ageLabel ? (
                      <Text className='pool-group-detail__member-meta'>{member.ageLabel}</Text>
                    ) : null}
                    {isCurrentUser ? (
                      <View className='pool-group-detail__member-you-badge'>
                        <Text className='pool-group-detail__member-you-text'>我</Text>
                      </View>
                    ) : null}
                  </View>

                  {member.archetype ? (
                    <Text className='pool-group-detail__member-archetype'>
                      {ARCHETYPE_BY_ID[member.archetype]?.nameCn || member.archetype}
                    </Text>
                  ) : null}

                  {member.industryNicheLabel ? (
                    <Text className='pool-group-detail__member-meta'>{member.industryNicheLabel}</Text>
                  ) : null}

                  {visibleTags.length > 0 ? (
                    <View className='pool-group-detail__member-tags'>
                      {visibleTags.map((interest) => (
                        <Text key={interest} className='pool-group-detail__member-tag'>
                          {interest}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            )
          })}
        </View>
      </Card>

      <Card className='pool-group-detail__card'>
        <Text className='pool-group-detail__card-title'>规则与到场指南</Text>
        <View className='pool-group-detail__rules'>
          <View className='pool-group-detail__rule-item'>
            <JoyJoinIcon emoji='⏰' size={24} className='pool-group-detail__rule-icon' />
            <Text className='pool-group-detail__rule'>请提前 10 分钟到场</Text>
          </View>
          <View className='pool-group-detail__rule-item'>
            <JoyJoinIcon emoji='🚫' size={24} className='pool-group-detail__rule-icon' />
            <Text className='pool-group-detail__rule'>开局前 24 小时内不可退</Text>
          </View>
          <View className='pool-group-detail__rule-item'>
            <JoyJoinIcon emoji='⚠️' size={24} className='pool-group-detail__rule-icon' />
            <Text className='pool-group-detail__rule'>迟到/缺席将影响信用分</Text>
          </View>
          <View className='pool-group-detail__rule-item'>
            <JoyJoinIcon emoji='💬' tier='chemistry' size={24} className='pool-group-detail__rule-icon' />
            <Text className='pool-group-detail__rule'>活动开始后可从活动页进入聊天或破冰入口</Text>
          </View>
        </View>
      </Card>

      <View className='pool-group-detail__actions'>
        <Button onClick={() => Taro.navigateTo({ url: `/pages/icebreaker-session/tier-selector/index?sessionId=${encodeURIComponent(group.id)}` })}>
          开始破冰
        </Button>
        <Button
          variant='secondary'
          onClick={handleShareGroupPoster}
          disabled={isGeneratingPoster}
        >
          {isGeneratingPoster ? '生成海报中…' : '分享小分队海报'}
        </Button>
        <Button variant='secondary' onClick={() => Taro.switchTab({ url: '/pages/events/index' })}>
          返回活动
        </Button>
      </View>

      {/* Hidden canvas for group reveal poster generation */}
      <Canvas
        canvasId={GROUP_REVEAL_CANVAS_ID}
        className='pool-group-detail__hidden-canvas'
        style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '750px', height: '1000px' }}
      />

      <View className='pool-group-detail__spacer' />
    </ScrollView>
  )
}
