import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logInfo } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import './index.scss'

// ─── Types ────────────────────────────────────────────────────────

interface PoolGroup {
  id: string
  poolId: string
  eventId?: string
  groupNumber?: number
  matchScore?: number
  members?: GroupMember[]
  theme?: string
  themeEmoji?: string
  themeTagline?: string
  themeVibe?: string
  themeHighlights?: string[]
  teamName?: string
  teamTagline?: string
  teamEmoji?: string
  [key: string]: unknown
}

interface GroupMember {
  id: string
  displayName?: string
  nickname?: string
  archetype?: string
  archetypeLabel?: string
  gender?: string
  birthYear?: number
  interests?: string[]
  avatarUrl?: string
  [key: string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Return a display name from a member record. */
function getMemberName(member: GroupMember): string {
  return member.displayName || member.nickname || '匿名'
}

/** Get the first character for an avatar placeholder. */
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

/** Calculate approximate age from birth year. */
function getAge(birthYear?: number): number | null {
  if (!birthYear) return null
  return new Date().getFullYear() - birthYear
}

/** Map vibe string to Chinese label. */
function getVibeLabel(vibe?: string): string {
  switch (vibe) {
    case 'playful':
      return '轻松有趣'
    case 'professional':
      return '专业交流'
    case 'creative':
      return '创意满满'
    case 'adventurous':
      return '探索冒险'
    default:
      return vibe ?? ''
  }
}

// ─── Component ────────────────────────────────────────────────────

export default function SquadUnboxingPage() {
  const router = useRouter()
  const groupId = router.params.groupId ?? ''
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()

  // ── Fetch group data ────────────────────────────────────────────
  const {
    data: group,
    isLoading,
    error: fetchError,
  } = useQuery<PoolGroup>({
    queryKey: ['mini-program', 'pool-group', groupId],
    queryFn: () =>
      apiRequest<PoolGroup>({
        path: `/api/pool-groups/${encodeURIComponent(groupId)}`,
      }),
    enabled: !!groupId && !authLoading,
  })

  const currentUserId = currentUser?.id
  const members = group?.members ?? []

  // ── Navigate to event coordination chat ─────────────────────────
  const handleGoToChat = () => {
    if (!group?.eventId) {
      Taro.showToast({ title: '活动聊天尚未开启', icon: 'none', duration: 2000 })
      return
    }
    logInfo('[SquadUnboxing] Navigating to event coordination', { eventId: group.eventId })
    Taro.navigateTo({
      url: `/pages/event-coordination/index?id=${group.eventId}`,
    })
  }

  const handleBackToEvents = () => {
    Taro.switchTab({ url: '/pages/events/index' })
  }

  // ── Loading state ───────────────────────────────────────────────
  if (authLoading || isLoading) {
    return <LoadingScreen message='揭晓小队中…' />
  }

  // ── Error / not found ───────────────────────────────────────────
  if (fetchError || !group) {
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

  // Derive theme fields — prefer team name fields, fall back to theme fields
  const themeEmoji = group.teamEmoji || group.themeEmoji
  const themeName = group.teamName || group.theme
  const themeTagline = group.teamTagline || group.themeTagline
  const themeVibe = group.themeVibe
  const themeHighlights = group.themeHighlights

  return (
    <ScrollView className='squad-unboxing' scrollY enhanced showScrollbar={false}>
      {/* ── Theme Header ───────────────────────────────────────── */}
      <View className='squad-unboxing__header'>
        {themeEmoji ? (
          <Text className='squad-unboxing__header-emoji'>{themeEmoji}</Text>
        ) : (
          <Text className='squad-unboxing__header-emoji'>🎁</Text>
        )}
        <Text className='squad-unboxing__header-title'>
          {themeName ?? '你的小队'}
        </Text>
        {themeTagline ? (
          <Text className='squad-unboxing__header-tagline'>{themeTagline}</Text>
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
          <Text className='squad-unboxing__score-value'>{group.matchScore}</Text>
        </View>
      ) : null}

      {/* ── Theme Details ──────────────────────────────────────── */}
      {themeVibe || (themeHighlights && themeHighlights.length > 0) ? (
        <Card className='squad-unboxing__theme-card'>
          {themeVibe ? (
            <View className='squad-unboxing__theme-vibe'>
              <Text className='squad-unboxing__theme-vibe-label'>🎨 氛围</Text>
              <Text className='squad-unboxing__theme-vibe-value'>
                {getVibeLabel(themeVibe)}
              </Text>
            </View>
          ) : null}

          {themeHighlights && themeHighlights.length > 0 ? (
            <View className='squad-unboxing__theme-highlights'>
              <Text className='squad-unboxing__theme-highlights-title'>✨ 亮点</Text>
              {themeHighlights.map((h, i) => (
                <View key={i} className='squad-unboxing__theme-highlight-row'>
                  <Text className='squad-unboxing__theme-highlight-dot'>•</Text>
                  <Text className='squad-unboxing__theme-highlight-text'>{h}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* ── Members List ───────────────────────────────────────── */}
      <View className='squad-unboxing__members-section'>
        <Text className='squad-unboxing__members-title'>
          小队成员 ({members.length})
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
              const isCurrentUser = member.id === currentUserId
              const name = getMemberName(member)
              const age = getAge(member.birthYear)

              return (
                <Card
                  key={member.id}
                  className={
                    'squad-unboxing__member-card' +
                    (isCurrentUser ? ' squad-unboxing__member-card--current' : '')
                  }
                >
                  {/* Avatar */}
                  <View className='squad-unboxing__member-avatar-wrap'>
                    {member.avatarUrl ? (
                      <Image
                        className='squad-unboxing__member-avatar'
                        src={member.avatarUrl}
                        mode='aspectFill'
                      />
                    ) : (
                      <View className='squad-unboxing__member-avatar squad-unboxing__member-avatar--placeholder'>
                        <Text className='squad-unboxing__member-avatar-initial'>
                          {getInitial(name)}
                        </Text>
                      </View>
                    )}
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
                      {age ? (
                        <Text className='squad-unboxing__member-age'>{age}岁</Text>
                      ) : null}
                    </View>

                    {member.archetypeLabel || member.archetype ? (
                      <Text className='squad-unboxing__member-archetype'>
                        {member.archetypeLabel ?? member.archetype}
                      </Text>
                    ) : null}

                    {member.interests && member.interests.length > 0 ? (
                      <View className='squad-unboxing__member-interests'>
                        {member.interests.slice(0, 3).map((interest, i) => (
                          <View key={i} className='squad-unboxing__member-interest-tag'>
                            <Text className='squad-unboxing__member-interest-text'>
                              {interest}
                            </Text>
                          </View>
                        ))}
                        {member.interests.length > 3 ? (
                          <Text className='squad-unboxing__member-interest-more'>
                            +{member.interests.length - 3}
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
        {group.eventId ? (
          <Button
            variant='primary'
            className='squad-unboxing__chat-btn'
            onClick={handleGoToChat}
          >
            进入活动聊天
          </Button>
        ) : null}

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
