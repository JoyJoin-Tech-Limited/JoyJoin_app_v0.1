import { useState, useCallback, useEffect } from 'react'
import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logInfo, logError } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import './index.scss'

// ─── Types ────────────────────────────────────────────────────────

interface EventDetail {
  id: string
  title?: string
  dateTime?: string
  status?: string
  participants?: Participant[]
  [key: string]: unknown
}

interface Participant {
  id: string
  displayName?: string
  nickname?: string
  archetype?: string
  avatarUrl?: string
  [key: string]: unknown
}

interface ChatMessage {
  id: string
  content: string
  createdAt: string
  userId: string
  user?: {
    id: string
    displayName?: string
    nickname?: string
    avatarUrl?: string
  }
}

interface MessagesResponse {
  chatUnlocked?: boolean
  hoursUntilUnlock?: number
  messages?: ChatMessage[]
}

interface DateGroup {
  date: string
  label: string
  messages: ChatMessage[]
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Compute a human-readable date label for message grouping. */
function getDateLabel(dateStr: string): { key: string; label: string } {
  const msgDate = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const key = msgDate.toDateString()

  if (msgDate.toDateString() === today.toDateString()) {
    return { key, label: '今天' }
  }
  if (msgDate.toDateString() === yesterday.toDateString()) {
    return { key, label: '昨天' }
  }

  const month = msgDate.getMonth() + 1
  const day = msgDate.getDate()
  return { key, label: `${month}月${day}日` }
}

/** Group an array of messages by calendar date. */
function groupMessagesByDate(messages: ChatMessage[]): DateGroup[] {
  const groups: DateGroup[] = []

  for (const msg of messages) {
    const { key, label } = getDateLabel(msg.createdAt)
    const existing = groups.find((g) => g.date === key)
    if (existing) {
      existing.messages.push(msg)
    } else {
      groups.push({ date: key, label, messages: [msg] })
    }
  }

  return groups
}

/** Format a timestamp to HH:MM. */
function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/** Compute a human-readable countdown string from now until the target date. */
function getCountdownText(dateTime: string): string {
  const target = new Date(dateTime).getTime()
  const now = Date.now()
  const diff = target - now

  if (diff <= 0) return ''

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days}天${hours}小时`
  if (hours > 0) return `${hours}小时`

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${minutes}分钟`
}

/** Get display name from a participant or message user. */
function getName(entity?: { displayName?: string; nickname?: string }): string {
  return entity?.displayName || entity?.nickname || '匿名'
}

/** Generate a colour-deterministic initial avatar from a name string. */
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────

export default function EventCoordinationPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const queryClient = useQueryClient()
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()

  const [messageText, setMessageText] = useState('')

  // ── Fetch event details ─────────────────────────────────────────
  const {
    data: event,
    isLoading: eventLoading,
    error: eventError,
  } = useQuery<EventDetail>({
    queryKey: ['mini-program', 'event', eventId],
    queryFn: () =>
      apiRequest<EventDetail>({ path: `/api/events/${encodeURIComponent(eventId)}` }),
    enabled: !!eventId && !authLoading,
  })

  // ── Fetch messages with 5 s polling ─────────────────────────────
  const {
    data: messagesResponse,
    isLoading: messagesLoading,
  } = useQuery<MessagesResponse>({
    queryKey: ['mini-program', 'event-messages', eventId],
    queryFn: () =>
      apiRequest<MessagesResponse>({
        path: `/api/events/${encodeURIComponent(eventId)}/messages`,
      }),
    enabled: !!eventId && !authLoading,
    refetchInterval: 5000,
  })

  // Normalise messages — API may return bare array or wrapped object
  const messages: ChatMessage[] = Array.isArray(messagesResponse)
    ? (messagesResponse as ChatMessage[])
    : messagesResponse?.messages ?? []

  const chatUnlocked = Array.isArray(messagesResponse)
    ? true
    : messagesResponse?.chatUnlocked ?? true

  // ── Derived state ───────────────────────────────────────────────
  const isChatLocked = !chatUnlocked && event?.dateTime
    ? new Date(event.dateTime).getTime() > Date.now()
    : false

  const participants = event?.participants ?? []
  const dateGroups = groupMessagesByDate(messages)
  const currentUserId = currentUser?.id

  // ── Send message mutation ───────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest({
        path: `/api/events/${encodeURIComponent(eventId)}/messages`,
        method: 'POST',
        data: { content },
      }),
    onSuccess: () => {
      logInfo('[EventCoordination] Message sent', { eventId })
      setMessageText('')
      queryClient.invalidateQueries({
        queryKey: ['mini-program', 'event-messages', eventId],
      })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : '发送失败'
      logError('[EventCoordination] Send failed', { eventId, message })
      Taro.showToast({ title: '发送失败，请重试', icon: 'none', duration: 2000 })
    },
  })

  const handleSend = useCallback(() => {
    const trimmed = messageText.trim()
    if (!trimmed || sendMutation.isPending) return
    sendMutation.mutate(trimmed)
  }, [messageText, sendMutation])

  // Auto-scroll to bottom when messages change
  const [scrollIntoView, setScrollIntoView] = useState('')
  useEffect(() => {
    if (messages.length > 0) {
      // Trigger scroll by toggling the value
      setScrollIntoView('')
      setTimeout(() => setScrollIntoView('msg-anchor-bottom'), 50)
    }
  }, [messages.length])

  // ── Loading state ───────────────────────────────────────────────
  if (authLoading || eventLoading) {
    return <LoadingScreen message='加载活动聊天…' />
  }

  // ── Error state ─────────────────────────────────────────────────
  if (eventError || !event) {
    return (
      <View className='coordination-page'>
        <View className='coordination-page__error'>
          <Text className='coordination-page__error-icon'>😕</Text>
          <Text className='coordination-page__error-text'>加载活动信息失败</Text>
          <View
            className='coordination-page__error-btn'
            onClick={() => Taro.navigateBack()}
          >
            <Text className='coordination-page__error-btn-text'>返回</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className='coordination-page'>
      {/* ── Event Header ─────────────────────────────────────────── */}
      <View className='coordination-page__header'>
        <Text className='coordination-page__title'>
          {event.title ?? '活动聊天'}
        </Text>
        {event.dateTime ? (
          <Text className='coordination-page__meta'>
            📅 {new Date(event.dateTime).toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </Text>
        ) : null}
      </View>

      {/* ── Participants Row ─────────────────────────────────────── */}
      {participants.length > 0 ? (
        <ScrollView
          className='coordination-page__participants'
          scrollX
          enhanced
          showScrollbar={false}
        >
          <View className='coordination-page__participants-inner'>
            {participants.map((p) => (
              <View key={p.id} className='coordination-page__participant'>
                {p.avatarUrl ? (
                  <Image
                    className='coordination-page__participant-avatar'
                    src={p.avatarUrl}
                    mode='aspectFill'
                  />
                ) : (
                  <View className='coordination-page__participant-avatar coordination-page__participant-avatar--placeholder'>
                    <Text className='coordination-page__participant-initial'>
                      {getInitial(getName(p))}
                    </Text>
                  </View>
                )}
                <Text className='coordination-page__participant-name'>
                  {getName(p)}
                </Text>
                {p.archetype ? (
                  <Text className='coordination-page__participant-archetype'>
                    {p.archetype}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {/* ── Chat Lock Banner ─────────────────────────────────────── */}
      {isChatLocked ? (
        <View className='coordination-page__lock-banner'>
          <Text className='coordination-page__lock-icon'>🔒</Text>
          <View className='coordination-page__lock-content'>
            <Text className='coordination-page__lock-title'>
              聊天将在活动当天开启
            </Text>
            {event.dateTime ? (
              <Text className='coordination-page__lock-countdown'>
                倒计时：{getCountdownText(event.dateTime)}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          {/* ── Message Stream ───────────────────────────────────── */}
          <ScrollView
            className='coordination-page__messages'
            scrollY
            enhanced
            showScrollbar={false}
            scrollIntoView={scrollIntoView}
          >
            {messagesLoading ? (
              <View className='coordination-page__messages-loading'>
                <Text className='coordination-page__messages-loading-text'>
                  加载消息中…
                </Text>
              </View>
            ) : messages.length === 0 ? (
              <View className='coordination-page__empty'>
                <Text className='coordination-page__empty-icon'>💬</Text>
                <Text className='coordination-page__empty-title'>
                  还没有消息
                </Text>
                <Text className='coordination-page__empty-text'>
                  发送第一条消息，和小伙伴们打个招呼吧！
                </Text>
              </View>
            ) : (
              <View className='coordination-page__messages-list'>
                {dateGroups.map((group) => (
                  <View key={group.date} className='coordination-page__date-group'>
                    <View className='coordination-page__date-separator'>
                      <View className='coordination-page__date-line' />
                      <Text className='coordination-page__date-label'>
                        {group.label}
                      </Text>
                      <View className='coordination-page__date-line' />
                    </View>

                    {group.messages.map((msg) => {
                      const isOwn = msg.userId === currentUserId
                      const senderName = getName(msg.user)

                      return (
                        <View
                          key={msg.id}
                          className={`coordination-page__message ${
                            isOwn
                              ? 'coordination-page__message--own'
                              : 'coordination-page__message--other'
                          }`}
                        >
                          {!isOwn ? (
                            <View className='coordination-page__message-avatar-wrap'>
                              {msg.user?.avatarUrl ? (
                                <Image
                                  className='coordination-page__message-avatar'
                                  src={msg.user.avatarUrl}
                                  mode='aspectFill'
                                />
                              ) : (
                                <View className='coordination-page__message-avatar coordination-page__message-avatar--placeholder'>
                                  <Text className='coordination-page__message-avatar-initial'>
                                    {getInitial(senderName)}
                                  </Text>
                                </View>
                              )}
                            </View>
                          ) : null}

                          <View className='coordination-page__message-body'>
                            {!isOwn ? (
                              <Text className='coordination-page__message-sender'>
                                {senderName}
                              </Text>
                            ) : null}
                            <View className='coordination-page__message-bubble'>
                              <Text className='coordination-page__message-content'>
                                {msg.content}
                              </Text>
                            </View>
                            <Text className='coordination-page__message-time'>
                              {formatTime(msg.createdAt)}
                            </Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                ))}
                {/* Scroll anchor at the bottom of the message list */}
                <View id='msg-anchor-bottom' />
              </View>
            )}
          </ScrollView>

          {/* ── Input Bar ────────────────────────────────────────── */}
          <View className='coordination-page__input-bar'>
            <Input
              className='coordination-page__input'
              type='text'
              placeholder='输入消息…'
              value={messageText}
              onInput={(e) => setMessageText(e.detail.value)}
              onConfirm={handleSend}
              confirmType='send'
              adjustPosition
              cursorSpacing={12}
              maxlength={2000}
              disabled={sendMutation.isPending}
            />
            <View
              className={`coordination-page__send-btn ${
                !messageText.trim() || sendMutation.isPending
                  ? 'coordination-page__send-btn--disabled'
                  : ''
              }`}
              onClick={handleSend}
            >
              <Text className='coordination-page__send-btn-text'>发送</Text>
            </View>
          </View>
        </>
      )}
    </View>
  )
}
