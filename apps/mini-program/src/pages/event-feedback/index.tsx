import { View, Text, Button, Textarea, Input, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { getEventParticipants, type EventParticipantSummary } from '@shared/api'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { apiRequest } from '../../lib/api/api'
import { queryClient } from '../../lib/api/queryClient'
import { CONNECTIONS_SHELL_QUERY_KEY } from '../../lib/prefetchEngine'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { trackFeedbackEvent } from '../../lib/analytics/feedbackAnalytics'
import { getMascotDisplayName } from '../../lib/mascot/mascotDisplay'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { CEREMONY_HEROES } from '../../lib/ceremonyHeroes'
import { haptics } from '../../lib/utils/haptics'
import { logInfo, logError } from '../../lib/utils/logger'
import { TOAST_DEFAULT_MS } from '../../lib/utils/uiConstants'
import RatingFace from '../../components/ui/RatingFace'
import JoyJoinLoadingScreen from '../../components/loading/JoyJoinLoadingScreen'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import Card from '../../components/ui/Card'
import Chip from '../../components/ui/Chip'
import {
  ATTENDEE_TRAIT_PRESETS,
  ATMOSPHERE_LABELS,
  CONNECTION_STATUS_OPTIONS,
  IMPROVEMENT_AREA_PRESETS,
  MAX_IMPROVEMENT_AREAS,
  MAX_TAGS_PER_ATTENDEE,
  RADAR_DIMENSIONS,
  VENUE_STYLE_OPTIONS,
  type ConnectionRadarState,
  type ConnectionStatusLiteral,
  type RadarKey,
  type VenueStyleLiteral,
} from './feedbackOptions'
import { buildEventFeedbackPayload, type AttendeeTraitInput } from './feedbackPayload'
import './index.scss'

interface MutualMatch {
  userId: string
  displayName: string
  archetype: string | null
  wechatContactId: string | null
}

// 2026-08-15 merge: the old 6-screen flow (rating → connections → comment →
// invite → deep-atmosphere → deep-people) folded into 3 screens. The rating
// faces and the 均衡反馈 deep fields all describe the same event experience, so
// they now share one screen; the invite interstitial is gone.
type FeedbackStep =
  | 'experience'
  | 'connections'
  | 'wrapup'
  | 'revealed'

/** Ordered interactive steps (revealed is the terminal celebration, not a step). */
const FEEDBACK_STEP_ORDER: Array<Exclude<FeedbackStep, 'revealed'>> = ['experience', 'connections', 'wrapup']

/** 1/2/3 progress dots — the flow had no sense of place before (2026-07-28). */
function renderStepProgress(current: Exclude<FeedbackStep, 'revealed'>) {
  const activeIndex = FEEDBACK_STEP_ORDER.indexOf(current)
  return (
    <View className='event-feedback__progress' aria-hidden='true'>
      {FEEDBACK_STEP_ORDER.map((stepId, index) => (
        <View
          key={stepId}
          className={`event-feedback__progress-dot ${index <= activeIndex ? 'event-feedback__progress-dot--active' : ''}`}
        />
      ))}
    </View>
  )
}

// ─── Balanced layer primitives (均衡反馈) ──────────────────────────────────
// The thermometer and the connection radar share ONE 1-5 dot language (灯格):
// the same ScaleDots primitive, only the dot size differs.

interface ScaleDotsProps {
  value: number
  onChange: (value: number) => void
  labels?: readonly string[]
  ariaGroupLabel: string
  compact?: boolean
}

function ScaleDots({ value, onChange, labels, ariaGroupLabel, compact = false }: ScaleDotsProps) {
  return (
    <View
      className={`event-feedback__scale ${compact ? 'event-feedback__scale--compact' : ''}`}
      role='radiogroup'
      aria-label={ariaGroupLabel}
    >
      <View className='event-feedback__scale-dots'>
        {Array.from({ length: 5 }, (_, index) => {
          const dotValue = index + 1
          const isLit = value >= dotValue
          return (
            <View
              key={index}
              className={`event-feedback__scale-dot ${isLit ? 'event-feedback__scale-dot--lit' : ''}`}
              hoverClass='event-feedback__scale-dot--pressed'
              role='radio'
              aria-checked={value === dotValue}
              aria-label={`${labels?.[index] ?? `${dotValue} 分`}`}
              onClick={() => {
                haptics('light')
                onChange(dotValue)
              }}
            />
          )
        })}
      </View>
      {labels ? (
        <View className='event-feedback__scale-labels'>
          {labels.map((label, index) => (
            <Text
              key={label}
              className={`event-feedback__scale-label ${value === index + 1 ? 'event-feedback__scale-label--active' : ''}`}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** 氛围温度计 — horizontal 1-5 scale with an animated fill track. */
function Thermometer({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View className='event-feedback__thermo'>
      <ScaleDots
        value={value}
        onChange={onChange}
        labels={ATMOSPHERE_LABELS}
        ariaGroupLabel='氛围温度计，1 到 5 分'
      />
      <View className='event-feedback__thermo-track' aria-hidden='true'>
        <View
          className='event-feedback__thermo-fill'
          // G13 (2026-08-07 audit): fill ends at the CENTER of the selected dot
          // (dot centers sit at 10/30/50/70/90% of the row), not at the column edge.
          style={{ transform: `scaleX(${value > 0 ? (value - 0.5) / 5 : 0})` }}
        />
      </View>
    </View>
  )
}

/** One radar dimension — label + hint above a compact 5-dot scale. */
function RadarScale({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <View className='event-feedback__radar-row'>
      <View className='event-feedback__radar-head'>
        <Text className='event-feedback__radar-label'>{label}</Text>
        <Text className='event-feedback__radar-hint'>{hint}</Text>
      </View>
      <ScaleDots value={value} onChange={onChange} ariaGroupLabel={`${label}，1 到 5 分`} compact />
    </View>
  )
}

/** Selectable pill — venue style + connection status share this surface. */
function SelectPill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <View
      className={`event-feedback__select-pill ${selected ? 'event-feedback__select-pill--selected' : ''}`}
      hoverClass='event-feedback__select-pill--pressed'
      role='radio'
      aria-checked={selected}
      onClick={onClick}
    >
      <Text className='event-feedback__select-pill-label'>{label}</Text>
      {selected && <Text className='event-feedback__select-pill-check'>✓</Text>}
    </View>
  )
}

function ParticipantAvatar({ participant, name }: { participant: EventParticipantSummary; name: string }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (!participant.avatarUrl || imageFailed) {
    return (
      <ArchetypeHead
        archetype={participant.archetype}
        size={80}
        fallbackText={name}
      />
    )
  }

  return (
    <Image
      className='event-feedback__participant-avatar'
      src={participant.avatarUrl}
      mode='aspectFill'
      ariaLabel={`${name}的头像`}
      lazyLoad
      onError={() => setImageFailed(true)}
    />
  )
}

export default function EventFeedbackPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()
  const currentUserId = currentUser?.id

  const [step, setStep] = useState<FeedbackStep>('experience')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedConnections, setSelectedConnections] = useState<string[]>([])
  const [mutualMatches, setMutualMatches] = useState<MutualMatch[]>([])
  // ─── Balanced layer state (均衡反馈) — every field is optional ───
  const [atmosphereScore, setAtmosphereScore] = useState(0)
  const [atmosphereNote, setAtmosphereNote] = useState('')
  const [radar, setRadar] = useState<ConnectionRadarState>({
    topicResonance: 0,
    personalityMatch: 0,
    backgroundDiversity: 0,
    overallFit: 0,
  })
  const [venueStyleRating, setVenueStyleRating] = useState<VenueStyleLiteral | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusLiteral | null>(null)
  const [attendeeTraits, setAttendeeTraits] = useState<Record<string, { tags: string[]; note: string }>>({})
  const [improvementAreas, setImprovementAreas] = useState<string[]>([])
  const [improvementOther, setImprovementOther] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Tier-S wait (M1): optimistic 已提交 flip shown the instant the user taps —
  // the POST runs in the background; on error the button reverts.
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  // C5 — Fires success haptic only once per revealed-entry (ref guard prevents re-fire on re-render)
  const revealedHapticFiredRef = useRef(false)
  // G6 (2026-08-07 audit): CDN failure fallback for the celebration imagery.
  const [heroFailed, setHeroFailed] = useState(false)
  const [mascotFailed, setMascotFailed] = useState(false)

  // G12 (2026-08-07 audit): a swipe-back mid-submit would otherwise leave the
  // CTA stuck in 提交中… — reset the transient flag when the page is re-shown.
  // 2026-08-15: also reset the optimistic submitted flip so the button does not
  // show 已提交 while clickable after returning from swipe-back.
  useResetOnShow(setIsSubmitting, setSubmitted)

  // C5 — Fire success haptic when entering the revealed step (effect, not render)
  useEffect(() => {
    if (step === 'revealed' && !revealedHapticFiredRef.current) {
      revealedHapticFiredRef.current = true
      haptics('success')
    }
  }, [step])

  const { data: participants = [], isLoading: participantsLoading, isError: participantsError } = useQuery<EventParticipantSummary[]>({
    queryKey: ['mini-program', 'event-participants', eventId],
    queryFn: async () => {
      // The server already excludes the viewer; keep the client filter as a
      // defensive no-op against stale cached shapes.
      const res = await getEventParticipants(apiRequest, eventId)
      return res.filter((p) => p.id !== currentUserId)
    },
    enabled: !!eventId && !authLoading && !!currentUserId,
  })

  // Balanced-layer funnel (2026-08-15 merge): the invite interstitial is gone
  // and the deep fields are inline, so "engaged" = the FIRST deep field the
  // user touches (thermometer / radar / venue / status / trait tag / improve
  // chip). Fired exactly once per page visit.
  const deepEngagedRef = useRef(false)
  const markDeepEngaged = useCallback(() => {
    if (deepEngagedRef.current) return
    deepEngagedRef.current = true
    trackFeedbackEvent('feedback_deep_engaged', { eventId })
  }, [eventId])

  const toggleConnection = useCallback((userId: string) => {
    setSelectedConnections((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }, [])

  // Up to MAX_TAGS_PER_ATTENDEE tags per person; a 4th tap is ignored.
  const toggleAttendeeTag = useCallback((userId: string, tag: string) => {
    setAttendeeTraits((prev) => {
      const entry = prev[userId] ?? { tags: [], note: '' }
      const has = entry.tags.includes(tag)
      if (!has && entry.tags.length >= MAX_TAGS_PER_ATTENDEE) return prev
      markDeepEngaged()
      return {
        ...prev,
        [userId]: {
          ...entry,
          tags: has ? entry.tags.filter((t) => t !== tag) : [...entry.tags, tag],
        },
      }
    })
  }, [markDeepEngaged])

  const setAttendeeNote = useCallback((userId: string, note: string) => {
    setAttendeeTraits((prev) => ({
      ...prev,
      [userId]: { tags: prev[userId]?.tags ?? [], note },
    }))
  }, [])

  const setRadarDimension = useCallback((key: RadarKey, value: number) => {
    markDeepEngaged()
    setRadar((prev) => ({ ...prev, [key]: value }))
  }, [markDeepEngaged])

  // Up to MAX_IMPROVEMENT_AREAS areas; further taps are ignored.
  const toggleImprovementArea = useCallback((area: string) => {
    setImprovementAreas((prev) => {
      if (prev.includes(area)) {
        markDeepEngaged()
        return prev.filter((a) => a !== area)
      }
      if (prev.length >= MAX_IMPROVEMENT_AREAS) return prev
      markDeepEngaged()
      return [...prev, area]
    })
  }, [markDeepEngaged])

  const handleSubmit = useCallback(async () => {
    if (!eventId || isSubmitting) return

    setIsSubmitting(true)
    setSubmitted(true)
    setError('')
    try {
      logInfo('[EventFeedback] Submitting', { eventId, rating, connections: selectedConnections.length })
      const attendeeTraitsPayload: Record<string, AttendeeTraitInput> = {}
      for (const [userId, entry] of Object.entries(attendeeTraits)) {
        // Only keep impressions for people still selected on the connections
        // step — if a user unchecks someone, their tags/notes must not be
        // submitted (completeness-audit P1, 2026-08-15).
        if (!selectedConnections.includes(userId)) continue
        const participant = participants.find((p) => p.id === userId)
        attendeeTraitsPayload[userId] = {
          displayName: participant?.displayName || participant?.firstName || '参与者',
          tags: entry.tags,
          improvementNote: entry.note,
        }
      }
      // 2026-08-15 merge: deep fields are inline, so the balanced payload is
      // always sent — buildEventFeedbackPayload drops untouched fields, and the
      // server's hasDeepFeedback / XP tier keys off CONTENT, not the client path.
      // The same content check drives the feedback_deep_submitted funnel event.
      const hasDeepFields =
        atmosphereScore > 0 ||
        atmosphereNote.trim() !== '' ||
        venueStyleRating !== null ||
        connectionStatus !== null ||
        improvementAreas.length > 0 ||
        improvementOther.trim() !== '' ||
        Object.values(radar).some((value) => value > 0) ||
        Object.values(attendeeTraits).some(
          (entry) => entry.tags.length > 0 || entry.note.trim() !== '',
        )
      const res = await apiRequest<{ mutualMatches?: MutualMatch[] }>({
        path: `/api/events/${encodeURIComponent(eventId)}/feedback`,
        method: 'POST',
        data: buildEventFeedbackPayload({
          rating,
          comment,
          connections: selectedConnections,
          balanced: {
            atmosphereScore,
            atmosphereNote,
            attendeeTraits: attendeeTraitsPayload,
            connectionRadar: radar,
            connectionStatus,
            hasNewConnections: selectedConnections.length > 0,
            improvementAreas,
            improvementOther,
            venueStyleRating,
          },
        }),
      })
      setMutualMatches(res.mutualMatches || [])
      setStep('revealed')
      if (hasDeepFields) {
        trackFeedbackEvent('feedback_deep_submitted', { eventId })
      }
      // Invalidate the Connections Predictive Shell so the 连接 tab reflects the
      // new feedback-complete / connections state instead of stale feedback-pending.
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_SHELL_QUERY_KEY })
      Taro.showToast({ title: '反馈已提交', icon: 'success', duration: TOAST_DEFAULT_MS })
    } catch (err) {
      const message = err instanceof Error ? err.message : getErrorMessage('submit-failed')
      setError(message)
      logError('[EventFeedback] Submit failed', { message })
      setSubmitted(false)
      setIsSubmitting(false)
    }
  }, [
    eventId,
    rating,
    comment,
    selectedConnections,
    isSubmitting,
    atmosphereScore,
    atmosphereNote,
    attendeeTraits,
    participants,
    radar,
    connectionStatus,
    improvementAreas,
    improvementOther,
    venueStyleRating,
  ])

  const handleCopyWechat = useCallback((wechatId: string) => {
    Taro.setClipboardData({
      data: wechatId,
      success: () => {
        Taro.showToast({ title: '微信号已复制', icon: 'success', duration: TOAST_DEFAULT_MS })
      },
      fail: () => {
        Taro.showToast({ title: getErrorMessage('copy-failed'), icon: 'none', duration: TOAST_DEFAULT_MS })
      },
    })
  }, [])

  if (authLoading || participantsLoading) {
    return (
      <JoyJoinLoadingScreen
        title='准备反馈页面…'
        subtitle={`${getMascotDisplayName(currentUser)}在确认你的活动参与记录`}
        showSkeleton={false}
      />
    )
  }

  // ─── Revealed step ─────────────────────────────────────────────────────────
  if (step === 'revealed') {
    const hasMatches = mutualMatches.length > 0
    return (
      <View className='event-feedback event-feedback--revealed'>
        <ScrollView
          className='event-feedback__success-scroll'
          scrollY
          enhanced
          showScrollbar={false}
        >
        <View className='event-feedback__success'>
          {/* C5 — Ceremony hero backdrop for the thanks moment (Batch C) */}
          {!heroFailed && (
            <Image
              className='event-feedback__success-hero'
              mode='aspectFit'
              src={CEREMONY_HEROES.eventFeedbackThanks}
              ariaLabel=''
              lazyLoad
              onError={() => setHeroFailed(true)}
            />
          )}
          {!mascotFailed && (
            <Image
              className='event-feedback__success-mascot'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset(hasMatches ? 'matchSuccess' : 'thanksFeedback')}
              onError={() => setMascotFailed(true)}
            />
          )}
          {hasMatches ? (
            <View className='event-feedback__success-title-row'>
              <JoyJoinIcon emoji='🎉' tier='reaction' size={32} />
              <Text className='event-feedback__success-title'>互选成功！</Text>
            </View>
          ) : (
            <Text className='event-feedback__success-title'>感谢你的反馈！</Text>
          )}
          <Text className='event-feedback__success-text'>
            {hasMatches
              ? `你和 ${mutualMatches.length} 位参与者互相选择了对方`
              : '你的评价帮助我们变得更好'}
          </Text>

          {hasMatches ? (
            <View className='event-feedback__matches'>
              {mutualMatches.map((match) => (
                <Card key={match.userId} className='event-feedback__match-card'>
                  <View className='event-feedback__match-row'>
                    <ArchetypeHead archetype={match.archetype || undefined} size={64} fallbackText={match.displayName} />
                    <View className='event-feedback__match-info'>
                      <Text className='event-feedback__match-name'>{match.displayName}</Text>
                      {match.wechatContactId ? (
                        <View
                          className='event-feedback__match-wechat'
                          hoverClass='event-feedback__match-wechat--pressed'
                          // Type narrowing does not cross the closure boundary;
                          // the non-null assertion is safe because we are inside
                          // the `match.wechatContactId ?` truthy branch.
                          onClick={() => handleCopyWechat(match.wechatContactId!)}
                        >
                          <Text className='event-feedback__match-wechat-label'>微信号</Text>
                          <Text className='event-feedback__match-wechat-id'>{match.wechatContactId}</Text>
                          <Text className='event-feedback__match-wechat-hint'>点击复制</Text>
                        </View>
                      ) : (
                        <Text className='event-feedback__match-no-wechat'>对方尚未设置微信号</Text>
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          <Button className='event-feedback__back-btn' onClick={() => Taro.navigateBack()}>
            返回
          </Button>
        </View>
        </ScrollView>
      </View>
    )
  }

  // ─── Experience step (merged 2026-08-15): faces + thermometer + radar + ───
  // venue/status all describe the same night, so they share ONE screen. Every
  // field is optional — the CTA is always 下一步, never a skip-or-answer fork.
  if (step === 'experience') {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__header'>
          <Text className='event-feedback__title'>今晚这局怎么样？</Text>
          {renderStepProgress('experience')}
          {/* Why-we-ask line: no points pitch (there's no coupon-linked 积分
              system to redeem them against) — just the honest reason. */}
          <Text className='event-feedback__purpose-hint'>你的观察，会让下一场更对味</Text>
        </View>

        <ScrollView className='event-feedback__deep-scroll' scrollY enhanced showScrollbar={false}>
          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>整体体验如何？</Text>
            <View className='event-feedback__rating'>
              <RatingFace value={rating} onSelect={setRating} />
            </View>
          </View>

          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>氛围温度计</Text>
            <Text className='event-feedback__card-hint'>整场下来，气氛停在哪个刻度？</Text>
            <Thermometer
              value={atmosphereScore}
              onChange={(value) => {
                markDeepEngaged()
                setAtmosphereScore(value)
              }}
            />
            <Input
              className='event-feedback__deep-input'
              placeholder='补充一句（选填）'
              value={atmosphereNote}
              onInput={(e) => setAtmosphereNote(e.detail.value)}
              maxlength={100}
              aria-label='氛围补充说明（选填）'
            />
          </View>

          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>连接雷达</Text>
            <Text className='event-feedback__card-hint'>凭感觉点一点，不用纠结</Text>
            <View className='event-feedback__radar'>
              {RADAR_DIMENSIONS.map((dim) => (
                <RadarScale
                  key={dim.key}
                  label={dim.label}
                  hint={dim.hint}
                  value={radar[dim.key]}
                  onChange={(value) => setRadarDimension(dim.key, value)}
                />
              ))}
            </View>
          </View>

          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>场地印象</Text>
            <View
              className='event-feedback__venue-row'
              role='radiogroup'
              aria-label='场地风格满意度'
            >
              {VENUE_STYLE_OPTIONS.map((option) => (
                <SelectPill
                  key={option.value}
                  label={option.label}
                  selected={venueStyleRating === option.value}
                  onClick={() => {
                    haptics('light')
                    markDeepEngaged()
                    setVenueStyleRating(option.value)
                  }}
                />
              ))}
            </View>

            <Text className='event-feedback__card-title event-feedback__card-title--spaced'>散场之后</Text>
            <Text className='event-feedback__card-hint'>和这些人现在是什么状态？</Text>
            <View
              className='event-feedback__status-grid'
              role='radiogroup'
              aria-label='散场后与参与者的联系状态'
            >
              {CONNECTION_STATUS_OPTIONS.map((status) => (
                <SelectPill
                  key={status}
                  label={status}
                  selected={connectionStatus === status}
                  onClick={() => {
                    haptics('light')
                    markDeepEngaged()
                    setConnectionStatus(status)
                  }}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View className='event-feedback__footer'>
          <Button
            className='event-feedback__submit'
            onClick={() => {
              haptics('light')
              setStep('connections')
            }}
            ariaLabel='进入下一步'
          >
            下一步
          </Button>
        </View>
      </View>
    )
  }

  // ─── Connections step ──────────────────────────────────────────────────────
  if (step === 'connections') {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__header'>
          <Text className='event-feedback__title'>想继续了解谁？</Text>
          {renderStepProgress('connections')}
        </View>

        <ScrollView className='event-feedback__deep-scroll' scrollY enhanced showScrollbar={false}>
          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>选择想保持联系的人</Text>
            <Text className='event-feedback__card-hint'>互相选择后，即可看到对方的微信号</Text>
            {participantsError ? (
              <View className='event-feedback__participants-error' role='alert' aria-live='polite'>
                <Text className='event-feedback__participants-error-text'>参与者信息加载失败</Text>
                <Button
                  className='event-feedback__participants-retry'
                  onClick={() => {
                    haptics('light')
                    void queryClient.refetchQueries({ queryKey: ['mini-program', 'event-participants', eventId] })
                  }}
                  ariaLabel='重试加载参与者'
                >
                  重试
                </Button>
              </View>
            ) : participants.length === 0 ? (
              <Text className='event-feedback__empty-participants'>暂时没有其他参与者信息</Text>
            ) : (
              <View className='event-feedback__participant-grid'>
                {participants.map((p) => {
                  const isSelected = selectedConnections.includes(p.id)
                  const participantName = p.displayName || p.firstName || '匿名'
                  return (
                    <View
                      key={p.id}
                      className={`event-feedback__participant-item ${isSelected ? 'event-feedback__participant-item--selected' : ''}`}
                      onClick={() => {
                        haptics('light')
                        toggleConnection(p.id)
                      }}
                      role='button'
                      aria-pressed={isSelected}
                      aria-label={`选择${participantName}`}
                    >
                      <ParticipantAvatar participant={p} name={participantName} />
                      <Text className='event-feedback__participant-name'>
                        {participantName}
                      </Text>
                      {isSelected && (
                        <Text className='event-feedback__participant-check'>✓</Text>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </ScrollView>

        <View className='event-feedback__footer'>
          <Button
            className='event-feedback__submit'
            onClick={() => {
              haptics('light')
              setStep('wrapup')
            }}
            ariaLabel={selectedConnections.length > 0 ? `已选 ${selectedConnections.length} 人，进入下一步` : '跳过选择，进入下一步'}
          >
            {selectedConnections.length > 0
              ? `已选 ${selectedConnections.length} 人，下一步`
              : '跳过，下一步'}
          </Button>
        </View>
      </View>
    )
  }

  // ─── Wrap-up step (merged 2026-08-15): attendee impressions + improvement ──
  // areas + free comment. Impressions only render for people picked on the
  // connections step (轻量原则).
  if (step === 'wrapup') {
    const attendees = participants.filter((p) => selectedConnections.includes(p.id))
    const improvementRemaining = MAX_IMPROVEMENT_AREAS - improvementAreas.length
    return (
      <View className='event-feedback'>
        <View className='event-feedback__header'>
          <Text className='event-feedback__title'>还有什么想说的？</Text>
          {renderStepProgress('wrapup')}
        </View>

        <ScrollView className='event-feedback__deep-scroll' scrollY enhanced showScrollbar={false}>
          {attendees.length > 0 ? (
            <View className='event-feedback__card'>
              <Text className='event-feedback__card-title'>参与者印象</Text>
              <Text className='event-feedback__card-hint'>聊聊你在意的 TA</Text>
              {attendees.map((p, index) => {
                const entry = attendeeTraits[p.id] ?? { tags: [], note: '' }
                const name = p.displayName || p.firstName || '匿名'
                return (
                  <View
                    key={p.id}
                    className='event-feedback__attendee'
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <View className='event-feedback__attendee-head'>
                      <ArchetypeHead
                        archetype={p.archetype}
                        size={64}
                        variant='head'
                        fallbackText={name}
                      />
                      <View className='event-feedback__attendee-info'>
                        <Text className='event-feedback__attendee-name'>{name}</Text>
                        <Text className='event-feedback__attendee-hint'>
                          最多选 {MAX_TAGS_PER_ATTENDEE} 个印象
                        </Text>
                      </View>
                    </View>
                    <View className='event-feedback__attendee-tags'>
                      {ATTENDEE_TRAIT_PRESETS.map((tag) => {
                        const selected = entry.tags.includes(tag)
                        const disabled = !selected && entry.tags.length >= MAX_TAGS_PER_ATTENDEE
                        return (
                          <Chip
                            key={tag}
                            label={tag}
                            selected={selected}
                            compact
                            disabled={disabled}
                            onClick={() => {
                              haptics('light')
                              toggleAttendeeTag(p.id, tag)
                            }}
                          />
                        )
                      })}
                    </View>
                    <Input
                      className='event-feedback__attendee-note'
                      placeholder='想给 TA 的悄悄话（选填）'
                      value={entry.note}
                      onInput={(e) => setAttendeeNote(p.id, e.detail.value)}
                      maxlength={100}
                      aria-label={`给${name}的悄悄话（选填）`}
                    />
                  </View>
                )
              })}
            </View>
          ) : null}

          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>改进建议</Text>
            <Text className='event-feedback__card-hint'>
              {improvementRemaining > 0
                ? `最多选 ${MAX_IMPROVEMENT_AREAS} 个，还能选 ${improvementRemaining} 个`
                : `已经选满 ${MAX_IMPROVEMENT_AREAS} 个，先这样吧`}
            </Text>
            <View className='event-feedback__improve-list'>
              {IMPROVEMENT_AREA_PRESETS.map((area, index) => {
                const selected = improvementAreas.includes(area)
                const disabled = !selected && improvementAreas.length >= MAX_IMPROVEMENT_AREAS
                return (
                  <View
                    key={area}
                    className={`event-feedback__improve-item ${selected ? 'event-feedback__improve-item--selected' : ''} ${disabled ? 'event-feedback__improve-item--disabled' : ''}`}
                    hoverClass={disabled ? undefined : 'event-feedback__improve-item--pressed'}
                    style={{ animationDelay: `${index * 45}ms` }}
                    role='checkbox'
                    aria-checked={selected}
                    aria-disabled={disabled || undefined}
                    onClick={disabled ? undefined : () => {
                      haptics('light')
                      toggleImprovementArea(area)
                    }}
                  >
                    <Text className='event-feedback__improve-label'>{area}</Text>
                    {selected && <Text className='event-feedback__improve-check'>✓</Text>}
                  </View>
                )
              })}
            </View>
            <Input
              className='event-feedback__deep-input'
              placeholder='还有别的想说的？（选填）'
              value={improvementOther}
              onInput={(e) => setImprovementOther(e.detail.value)}
              maxlength={200}
              aria-label='其他改进建议（选填）'
            />
          </View>

          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>想说点什么？（可选）</Text>
            <Textarea
              className='event-feedback__textarea'
              placeholder='分享你的感受和建议…'
              value={comment}
              onInput={(e) => setComment(e.detail.value)}
              maxlength={500}
              aria-label='分享你的感受和建议（可选）'
            />
          </View>
        </ScrollView>

        {error ? <View className='event-feedback__error' role='alert' aria-live='polite'><Text>{error}</Text></View> : null}

        <View className='event-feedback__footer'>
          <View className='event-feedback__footer-row'>
            <Button
              className='event-feedback__submit-ghost'
              onClick={() => {
                haptics('light')
                setStep('connections')
              }}
              disabled={isSubmitting}
              ariaLabel='返回选择联系人'
            >
              上一步
            </Button>
            <Button
              className={`event-feedback__submit${submitted ? ' event-feedback__submit--submitted' : ''}`}
              onClick={() => {
                haptics('medium')
                handleSubmit()
              }}
              disabled={isSubmitting || submitted}
              ariaLabel='提交反馈'
            >
              {submitted ? '已提交' : '提交反馈'}
            </Button>
          </View>
        </View>
      </View>
    )
  }

  // Defensive: unknown step state
  return (
    <JoyJoinLoadingScreen
      title='页面加载中…'
      subtitle={`${getMascotDisplayName(currentUser)}正在准备`}
      showSkeleton={false}
    />
  )
}
