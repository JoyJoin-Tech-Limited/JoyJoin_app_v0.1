import { useState, useCallback, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Input, Image, Textarea } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logInfo, logError } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import ModalOverlay from '../../components/ModalOverlay'
import Button from '../../components/Button'
import Card from '../../components/Card'
import './index.scss'

// ─── Types ────────────────────────────────────────────────────────

interface EventDetail {
  id: string
  title?: string
  dateTime?: string
  status?: string
  [key: string]: unknown
}

interface Participant {
  id: string
  firstName?: string
  displayName?: string
  nickname?: string
  archetype?: string
  avatarUrl?: string
  birthdate?: string
  gender?: string
  educationLevel?: string
  interestsRankedTop3?: string[]
  interestsTop?: string[]
  topInterests?: string[]
  [key: string]: unknown
}

interface ChatMessage {
  id: string
  message?: string
  content?: string
  createdAt: string
  userId: string
  user?: Participant
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

type ReportType = 'harassment' | 'spam' | 'inappropriate' | 'hate_speech' | 'other'

const REPORT_TYPE_OPTIONS: Array<{ value: ReportType; label: string; emoji: string }> = [
  { value: 'harassment', label: '骚扰或威胁', emoji: '🚫' },
  { value: 'spam', label: '垃圾信息', emoji: '📨' },
  { value: 'inappropriate', label: '不当内容', emoji: '⚠️' },
  { value: 'hate_speech', label: '仇恨言论', emoji: '⛔' },
  { value: 'other', label: '其他', emoji: '📝' },
]

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

function formatUnlockCountdown(hoursUntilUnlock?: number): string {
  if (typeof hoursUntilUnlock !== 'number' || hoursUntilUnlock <= 0) {
    return '即将开放'
  }

  const totalMinutes = Math.max(Math.round(hoursUntilUnlock * 60), 1)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `${days}天${hours}小时后开放`
  }

  if (hours > 0) {
    return `${hours}小时${minutes}分钟后开放`
  }

  return `${minutes}分钟后开放`
}

function getAgeLabel(birthdate?: string): string | null {
  if (!birthdate) {
    return null
  }

  const birth = new Date(birthdate)
  if (Number.isNaN(birth.getTime())) {
    return null
  }

  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const hasBirthdayPassed =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())

  if (!hasBirthdayPassed) {
    age -= 1
  }

  return age > 0 ? `${age}岁` : null
}

function getParticipantInterests(participant?: Participant): string[] {
  if (!participant) {
    return []
  }

  const candidates = [participant.interestsRankedTop3, participant.interestsTop, participant.topInterests]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    }
  }

  return []
}

function getParticipantMeta(participant?: Participant): string[] {
  if (!participant) {
    return []
  }

  return [participant.gender, getAgeLabel(participant.birthdate), participant.educationLevel].filter(
    (value): value is string => Boolean(value),
  )
}

function getMessageBody(message: ChatMessage): string {
  return message.message ?? message.content ?? ''
}

function getParticipantFromMessage(message: ChatMessage, participants: Participant[]): Participant | null {
  const fromList = participants.find((participant) => participant.id === message.userId)
  if (fromList) {
    return fromList
  }

  if (message.user) {
    return {
      ...message.user,
      id: message.user.id || message.userId,
    }
  }

  return null
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
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [reportingMessage, setReportingMessage] = useState<ChatMessage | null>(null)
  const [reportType, setReportType] = useState<ReportType>('harassment')
  const [reportDescription, setReportDescription] = useState('')

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

  const { data: participantsResponse = [] } = useQuery<Participant[]>({
    queryKey: ['mini-program', 'event-participants', eventId],
    queryFn: () =>
      apiRequest<Participant[]>({
        path: `/api/events/${encodeURIComponent(eventId)}/participants`,
      }),
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
  const isChatLocked = !chatUnlocked

  const participants = participantsResponse.length > 0 ? participantsResponse : []
  const dateGroups = groupMessagesByDate(messages)
  const currentUserId = currentUser?.id
  const unlockCountdownLabel = formatUnlockCountdown(messagesResponse?.hoursUntilUnlock)
  const totalMessages = messages.length

  const participantSummary = useMemo(() => {
    if (participants.length === 0) {
      return '等待更多参与者加入'
    }

    return `已加入 ${participants.length} 人 · 已有 ${totalMessages} 条消息`
  }, [participants.length, totalMessages])

  // ── Send message mutation ───────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest({
        path: `/api/events/${encodeURIComponent(eventId)}/messages`,
        method: 'POST',
        data: { message: content },
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

  const reportMutation = useMutation({
    mutationFn: () => {
      if (!reportingMessage) {
        throw new Error('未选择要举报的消息')
      }

      return apiRequest({
        path: '/api/chat-reports',
        method: 'POST',
        data: {
          messageId: reportingMessage.id,
          eventId,
          reportedUserId: reportingMessage.userId,
          reportType,
          description: reportDescription.trim() || undefined,
        },
      })
    },
    onSuccess: () => {
      Taro.showToast({ title: '举报已提交', icon: 'success', duration: 1800 })
      setReportingMessage(null)
      setReportType('harassment')
      setReportDescription('')
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '举报失败'
      logError('[EventCoordination] Report failed', { eventId, message })
      Taro.showToast({ title: '举报失败，请重试', icon: 'none', duration: 2200 })
    },
  })

  const handleSend = useCallback(() => {
    const trimmed = messageText.trim()
    if (!trimmed || sendMutation.isPending) return
    sendMutation.mutate(trimmed)
  }, [messageText, sendMutation])

  const handleOpenParticipant = useCallback((participant: Participant | null) => {
    if (!participant) {
      return
    }

    setSelectedParticipant(participant)
  }, [])

  const handleOpenReport = useCallback((message: ChatMessage) => {
    if (message.userId === currentUserId) {
      return
    }

    setReportingMessage(message)
    setReportType('harassment')
    setReportDescription('')
  }, [currentUserId])

  const handleCloseParticipant = useCallback(() => {
    setSelectedParticipant(null)
  }, [])

  const handleCloseReport = useCallback(() => {
    if (reportMutation.isPending) {
      return
    }

    setReportingMessage(null)
    setReportType('harassment')
    setReportDescription('')
  }, [reportMutation.isPending])

  const handleSubmitReport = useCallback(() => {
    if (!reportingMessage || reportMutation.isPending) {
      return
    }

    reportMutation.mutate()
  }, [reportMutation, reportingMessage])

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
        <Text className='coordination-page__summary'>{participantSummary}</Text>
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
              <View
                key={p.id}
                className='coordination-page__participant'
                onClick={() => handleOpenParticipant(p)}
              >
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
            {unlockCountdownLabel ? (
              <Text className='coordination-page__lock-countdown'>
                {unlockCountdownLabel}
              </Text>
            ) : null}
            <Text className='coordination-page__lock-hint'>活动开始前 24 小时，聊天和举报入口都会一起开放。</Text>
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
                      const messageBody = getMessageBody(msg)
                      const participant = getParticipantFromMessage(msg, participants)

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
                            <View
                              className='coordination-page__message-avatar-wrap'
                              onClick={() => handleOpenParticipant(participant)}
                            >
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
                              <View className='coordination-page__message-header'>
                                <Text className='coordination-page__message-sender'>
                                  {senderName}
                                </Text>
                                {participant?.archetype ? (
                                  <Text className='coordination-page__message-tag'>
                                    {participant.archetype}
                                  </Text>
                                ) : null}
                              </View>
                            ) : null}
                            <View
                              className='coordination-page__message-bubble'
                              onLongPress={() => handleOpenReport(msg)}
                            >
                              <Text className='coordination-page__message-content'>
                                {messageBody}
                              </Text>
                            </View>
                            <View className='coordination-page__message-footer'>
                              <Text className='coordination-page__message-time'>
                                {formatTime(msg.createdAt)}
                              </Text>
                              {isOwn ? (
                                <Text className='coordination-page__message-status'>已送达</Text>
                              ) : (
                                <Text
                                  className='coordination-page__message-action'
                                  onClick={() => handleOpenReport(msg)}
                                >
                                  举报
                                </Text>
                              )}
                            </View>
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

      {selectedParticipant ? (
        <ModalOverlay className='coordination-page__overlay' onClick={handleCloseParticipant}>
          <View className='coordination-page__sheet' onClick={(event) => event.stopPropagation()}>
            <Card className='coordination-page__sheet-card'>
              <View className='coordination-page__sheet-head'>
                <Text className='coordination-page__sheet-title'>参与者信息</Text>
                <Text className='coordination-page__sheet-close' onClick={handleCloseParticipant}>关闭</Text>
              </View>

              <View className='coordination-page__profile-hero'>
                {selectedParticipant.avatarUrl ? (
                  <Image
                    className='coordination-page__profile-avatar'
                    src={selectedParticipant.avatarUrl}
                    mode='aspectFill'
                  />
                ) : (
                  <View className='coordination-page__profile-avatar coordination-page__profile-avatar--placeholder'>
                    <Text className='coordination-page__profile-avatar-initial'>
                      {getInitial(getName(selectedParticipant))}
                    </Text>
                  </View>
                )}

                <View className='coordination-page__profile-copy'>
                  <Text className='coordination-page__profile-name'>
                    {getName(selectedParticipant)}
                  </Text>
                  {selectedParticipant.archetype ? (
                    <Text className='coordination-page__profile-archetype'>
                      {selectedParticipant.archetype}
                    </Text>
                  ) : null}
                </View>
              </View>

              {getParticipantMeta(selectedParticipant).length > 0 ? (
                <View className='coordination-page__chip-row'>
                  {getParticipantMeta(selectedParticipant).map((item) => (
                    <View key={item} className='coordination-page__chip'>
                      <Text className='coordination-page__chip-text'>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {getParticipantInterests(selectedParticipant).length > 0 ? (
                <View className='coordination-page__sheet-section'>
                  <Text className='coordination-page__sheet-section-title'>Ta 的兴趣</Text>
                  <View className='coordination-page__tag-row'>
                    {getParticipantInterests(selectedParticipant).slice(0, 6).map((interest) => (
                      <View key={interest} className='coordination-page__tag'>
                        <Text className='coordination-page__tag-text'>{interest}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <Text className='coordination-page__sheet-note'>
                先在群聊里打个招呼，等活动开始前 24 小时后就能更自然地聊起来。
              </Text>
            </Card>
          </View>
        </ModalOverlay>
      ) : null}

      {reportingMessage ? (
        <ModalOverlay className='coordination-page__overlay' onClick={handleCloseReport}>
          <View className='coordination-page__sheet' onClick={(event) => event.stopPropagation()}>
            <Card className='coordination-page__sheet-card'>
              <View className='coordination-page__sheet-head'>
                <Text className='coordination-page__sheet-title'>举报此消息</Text>
                <Text className='coordination-page__sheet-close' onClick={handleCloseReport}>关闭</Text>
              </View>

              <View className='coordination-page__sheet-section'>
                <Text className='coordination-page__sheet-section-title'>消息内容</Text>
                <Text className='coordination-page__report-preview'>
                  {getMessageBody(reportingMessage)}
                </Text>
              </View>

              <View className='coordination-page__sheet-section'>
                <Text className='coordination-page__sheet-section-title'>举报类型</Text>
                <View className='coordination-page__report-options'>
                  {REPORT_TYPE_OPTIONS.map((option) => (
                    <View
                      key={option.value}
                      className={`coordination-page__report-option ${
                        option.value === reportType ? 'coordination-page__report-option--active' : ''
                      }`}
                      onClick={() => setReportType(option.value)}
                    >
                      <Text className='coordination-page__report-option-emoji'>{option.emoji}</Text>
                      <Text className='coordination-page__report-option-label'>{option.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className='coordination-page__sheet-section'>
                <Text className='coordination-page__sheet-section-title'>补充说明（可选）</Text>
                <Textarea
                  className='coordination-page__report-textarea'
                  value={reportDescription}
                  maxlength={200}
                  placeholder='告诉我们发生了什么，我们会尽快处理。'
                  onInput={(event) => setReportDescription(event.detail.value)}
                  autoHeight
                />
              </View>

              <Text className='coordination-page__sheet-note'>
                举报会直接进入官方审核队列。请尽量描述清楚问题，我们会优先处理活动内的安全问题。
              </Text>

              <View className='coordination-page__sheet-actions'>
                <Button variant='secondary' className='coordination-page__sheet-btn' onClick={handleCloseReport} disabled={reportMutation.isPending}>
                  取消
                </Button>
                <Button className='coordination-page__sheet-btn' onClick={handleSubmitReport} loading={reportMutation.isPending} disabled={reportMutation.isPending}>
                  {reportMutation.isPending ? '提交中…' : '提交举报'}
                </Button>
              </View>
            </Card>
          </View>
        </ModalOverlay>
      ) : null}
    </View>
  )
}
