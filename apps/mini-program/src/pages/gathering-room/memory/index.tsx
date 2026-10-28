import Taro, { useRouter } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Canvas, Image, Text, View } from '@tarojs/components'
import { getPoolGroupRoomState } from '@shared/api'
import { apiRequest } from '../../../lib/api/api'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { useProfileCardShare } from '../../../lib/profile/useProfileCardShare'
import { PROFILE_CARD_CANVAS_ID } from '../../../lib/profile/profileCardPoster'
import JoyJoinLoadingScreen from '../../../components/loading/JoyJoinLoadingScreen'
import StatusCard from '../../../components/ui/StatusCard'
import Button from '../../../components/ui/Button'
import PixelAvatarComposite from '../../../components/profile/PixelAvatarComposite'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import './index.scss'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

function formatMemoryDate(value: string | null | undefined): string {
  if (!value) return '那天的我们'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '那天的我们'
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`
}

export default function GatheringRoomMemoryPage() {
  const router = useRouter()
  const groupId = router.params.groupId ?? ''
  const { user, isLoading: authLoading } = useAuthGuard()

  const roomStateQuery = useQuery({
    queryKey: ['mini-program', 'gathering-room-state', groupId],
    queryFn: () => getPoolGroupRoomState(apiRequest, groupId),
    enabled: Boolean(groupId) && !authLoading && Boolean(user),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const roomState = roomStateQuery.data ?? null
  const self = useMemo(
    () => roomState?.members.find((member) => member.userId === user?.id) ?? null,
    [roomState, user?.id]
  )
  const itemsById = useMemo(
    () => new Map((self?.equippedItems ?? []).map((item) => [item.id, item] as const)),
    [self]
  )
  const dateLabel = formatMemoryDate(roomState?.eventDateTime)
  const venueName = roomState?.venue?.name ?? '地点待定'

  const profileCardShare = useProfileCardShare({
    enabled: Boolean(self?.archetype),
    card: {
      displayName: self?.displayName ?? user?.displayName ?? '桌友',
      tagline: dateLabel,
      pixelArchetypeId: self?.archetype ?? null,
      outfit: self?.outfit ?? null,
      itemsById,
    },
    // No QR and no equipment lookups: this smaller poster remains shareable
    // when a layer or the full-outfit path fails, and still carries the date.
    fallbackCard: {
      displayName: self?.displayName ?? user?.displayName ?? '桌友',
      tagline: dateLabel,
      pixelArchetypeId: self?.archetype ?? null,
    },
  })

  if (authLoading || roomStateQuery.isLoading) {
    return <JoyJoinLoadingScreen />
  }

  if (roomStateQuery.isError) {
    return (
      <View className='gathering-room-memory gathering-room-memory--state'>
        <StatusCard
          tone='error'
          title='这一桌还没打开'
          description='网络有点慢，稍后再试一次。'
          action={{ label: '重试', onClick: () => void roomStateQuery.refetch() }}
        />
      </View>
    )
  }

  if (!roomState || roomState.eventPhase !== 'ended') {
    return (
      <View className='gathering-room-memory gathering-room-memory--state'>
        <StatusCard
          tone='info'
          title='活动结束后再来'
          description='这一桌的记忆页会在活动结束后亮起来。'
          action={{ label: '回到集结房间', onClick: () => Taro.navigateBack() }}
        />
      </View>
    )
  }

  return (
    <View className='gathering-room-memory'>
      <Canvas
        canvasId={PROFILE_CARD_CANVAS_ID}
        className='gathering-room-memory__poster-canvas'
        style={{ width: '1080px', height: '1560px' }}
      />
      <View className='gathering-room-memory__hero'>
        <Text className='gathering-room-memory__eyebrow'>那天的我们</Text>
        <Text className='gathering-room-memory__title'>{dateLabel}</Text>
        <Text className='gathering-room-memory__venue'>{venueName}</Text>

        {self?.archetype && self?.outfit ? (
          <View className='gathering-room-memory__avatar'>
            <PixelAvatarComposite
              archetypeId={self.archetype}
              outfit={self.outfit}
              itemsById={itemsById}
              variant='full'
            />
          </View>
        ) : self?.avatarUrl ? (
          <Image className='gathering-room-memory__avatar-image' src={self.avatarUrl} mode='aspectFill' />
        ) : null}

        <Text className='gathering-room-memory__caption'>当前造型 · 不是活动当天的穿搭快照</Text>
      </View>

      <View className='gathering-room-memory__card'>
        <Text className='gathering-room-memory__card-title'>这一桌，{roomState.members.length} 个人</Text>
        <View className='gathering-room-memory__members'>
          {roomState.members.map((member) => (
            <View key={member.userId} className='gathering-room-memory__member'>
              {member.avatarUrl ? (
                <Image
                  className='gathering-room-memory__member-avatar'
                  src={member.avatarUrl}
                  mode='aspectFill'
                />
              ) : (
                <View className='gathering-room-memory__member-avatar gathering-room-memory__member-avatar--empty'>
                  <ArchetypeHead
                    archetype={member.archetype}
                    size={80}
                    variant='grid'
                    fallbackText={member.displayName?.slice(0, 1) || '友'}
                  />
                </View>
              )}
              <Text className='gathering-room-memory__member-name'>
                {member.userId === user?.id ? '我' : member.displayName}
              </Text>
            </View>
          ))}
        </View>
        <Text className='gathering-room-memory__note'>
          没有奖励，也不解锁任何东西，只是想替这一桌留个念想。
        </Text>
      </View>

      <View className='gathering-room-memory__actions'>
        <Button
          className='gathering-room-memory__share'
          disabled={profileCardShare.isGenerating || !self?.archetype || !self?.outfit}
          onClick={() => void profileCardShare.handleShare()}
        >
          {profileCardShare.isGenerating ? '正在生成…' : '保存这一页'}
        </Button>
        <Text className='gathering-room-memory__hint'>自愿保存或分享，活动详情里还有这一桌的记录。</Text>
      </View>
    </View>
  )
}
