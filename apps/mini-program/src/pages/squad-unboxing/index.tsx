import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  confirmPoolGroupAttendance,
  getPoolGroupDetails,
  type PoolGroupDetailsResponse,
  type PoolGroupMemberSummary,
} from '@shared/api'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logError, logInfo } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import './index.scss'

// ─── Helpers ──────────────────────────────────────────────────────

/** Return a display name from a member record. */
function getMemberName(member: PoolGroupMemberSummary): string {
  return member.displayName || '匿名'
}

/** Get the first character for an avatar placeholder. */
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

// ─── Component ────────────────────────────────────────────────────

export default function SquadUnboxingPage() {
  const router = useRouter()
  const groupId = router.params.groupId ?? ''
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()

  // ── Fetch group data ────────────────────────────────────────────
  const {
    data: poolGroup,
    isLoading,
    error: fetchError,
  } = useQuery<PoolGroupDetailsResponse>({
    queryKey: ['mini-program', 'pool-group', groupId],
    queryFn: () => getPoolGroupDetails(apiRequest, groupId),
    enabled: !!groupId && !authLoading,
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

      Taro.switchTab({ url: '/pages/events/index' })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '确认出席失败'
      logError('[SquadUnboxing] Attendance confirmation failed', {
        groupId,
        message,
      })
      Taro.showToast({ title: '确认出席失败', icon: 'none', duration: 2200 })
    },
  })

  const handleConfirmAttendance = () => {
    if (confirmAttendanceMutation.isPending) {
      return
    }

    confirmAttendanceMutation.mutate()
  }

  const handleBackToEvents = () => {
    Taro.switchTab({ url: '/pages/events/index' })
  }

  // ── Loading state ───────────────────────────────────────────────
  if (authLoading || isLoading) {
    return <LoadingScreen message='揭晓小队中…' />
  }

  // ── Error / not found ───────────────────────────────────────────
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
    <ScrollView className='squad-unboxing' scrollY enhanced showScrollbar={false}>
      {/* ── Group Header ───────────────────────────────────────── */}
      <View className='squad-unboxing__header'>
        <Text className='squad-unboxing__header-emoji'>🎉</Text>
        <Text className='squad-unboxing__header-title'>
          {pool.title || '你的小队已揭晓'}
        </Text>
        {group.matchExplanation ? (
          <Text className='squad-unboxing__header-tagline'>{group.matchExplanation}</Text>
        ) : pool.description ? (
          <Text className='squad-unboxing__header-tagline'>{pool.description}</Text>
        ) : null}
        {group.groupNumber ? (
          <Text className='squad-unboxing__header-group-num'>
            第 {group.groupNumber} 组
          </Text>
        ) : null}
      </View>

      {/* ── Match Score ────────────────────────────────────────── */}
      {group.matchScore != null ? (
        <View className='squad-unboxing__score'>
          <Text className='squad-unboxing__score-label'>匹配指数</Text>
          <Text className='squad-unboxing__score-value'>{Math.round(group.matchScore)}</Text>
        </View>
      ) : null}

      {/* ── Group Details ─────────────────────────────────────── */}
      {(group.matchExplanation || group.venueName || group.finalDateTime || pool.eventType) ? (
        <Card className='squad-unboxing__info-card'>
          {group.matchExplanation ? (
            <View className='squad-unboxing__info-copy'>
              <Text className='squad-unboxing__info-title'>为什么是这桌？</Text>
              <Text className='squad-unboxing__info-description'>{group.matchExplanation}</Text>
            </View>
          ) : null}

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

          {group.venueName || pool.city ? (
            <View className='squad-unboxing__info-row'>
              <Text className='squad-unboxing__info-label'>📍 地点</Text>
              <Text className='squad-unboxing__info-value'>
                {group.venueName || [pool.city, pool.district].filter(Boolean).join(' · ') || '待公布'}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* ── Members List ───────────────────────────────────────── */}
      <View className='squad-unboxing__members-section'>
        <Text className='squad-unboxing__members-title'>
          小队成员 ({group.memberCount || members.length})
        </Text>

        {members.length === 0 ? (
          <View className='squad-unboxing__members-empty'>
            <Text className='squad-unboxing__members-empty-text'>
              暂无成员信息
            </Text>
          </View>
        ) : (
          <View className='squad-unboxing__members-list'>
            {members.map((member) => {
              const isCurrentUser = member.userId === currentUserId
              const name = getMemberName(member)

              return (
                <Card
                  key={member.userId}
                  className={
                    'squad-unboxing__member-card' +
                    (isCurrentUser ? ' squad-unboxing__member-card--current' : '')
                  }
                >
                  {/* Avatar */}
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

                  {/* Info */}
                  <View className='squad-unboxing__member-info'>
                    <View className='squad-unboxing__member-name-row'>
                      <Text className='squad-unboxing__member-name'>{name}</Text>
                      {member.ageLabel ? (
                        <Text className='squad-unboxing__member-age'>{member.ageLabel}</Text>
                      ) : null}
                    </View>

                    {member.archetypeLabel || member.archetype ? (
                      <Text className='squad-unboxing__member-archetype'>
                        {member.archetype}
                      </Text>
                    ) : null}

                    {member.topInterests && member.topInterests.length > 0 ? (
                      <View className='squad-unboxing__member-interests'>
                        {member.topInterests.slice(0, 3).map((interest, i) => (
                          <View key={i} className='squad-unboxing__member-interest-tag'>
                            <Text className='squad-unboxing__member-interest-text'>
                              {interest}
                            </Text>
                          </View>
                        ))}
                        {member.topInterests.length > 3 ? (
                          <Text className='squad-unboxing__member-interest-more'>
                            +{member.topInterests.length - 3}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Card>
              )
            })}
          </View>
        )}
      </View>

      {/* ── Actions ────────────────────────────────────────────── */}
      <View className='squad-unboxing__actions'>
        <Button
          variant='primary'
          className='squad-unboxing__confirm-btn'
          onClick={handleConfirmAttendance}
          disabled={confirmAttendanceMutation.isPending}
          loading={confirmAttendanceMutation.isPending}
        >
          {confirmAttendanceMutation.isPending ? '确认中…' : '确认出席'}
        </Button>

        <Button
          variant='secondary'
          className='squad-unboxing__back-btn'
          onClick={handleBackToEvents}
        >
          返回活动
        </Button>
      </View>

      <View className='squad-unboxing__spacer' />
    </ScrollView>
  )
}
