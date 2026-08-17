import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  confirmPoolGroupAttendance,
  getPoolGroupRoomState,
  type GatheringRoomMember,
  type GatheringRoomStateResponse,
} from '@shared/api'
import {
  ROOM_POKE_EMOJIS,
  type RoomPokeEmoji,
  type RoomMemberEnteredData,
  type RoomMemberLeftData,
  type RoomPokeData,
  type RoomPresenceStateData,
  type UserConfirmedData,
  type WSMessage,
} from '@shared/wsEvents'
import { apiRequest } from '../../lib/api/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { haptics } from '../../lib/utils/haptics'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { logInfo, logWarn } from '../../lib/utils/logger'
import { TOAST_SHORT_MS, TOAST_MEDIUM_MS } from '../../lib/utils/uiConstants'
import { gatheringRoomAnalytics } from '../../lib/analytics/gatheringRoomAnalytics'
import type { GatheringRoomMemberProfile, GatheringRoomPokeBadge, GatheringRoomPresence } from '../../components/gathering-room/GatheringRoomScene'

/**
 * useGatheringRoomController — view-model for the 集结房间 page.
 *
 * Data: TanStack Query on GET /api/pool-groups/:groupId/room-state (REST
 * snapshot). Presence: WebSocket ROOM_* events joined with
 * USER_JOINED {userId, eventId: blindBoxEventId} (skipped when the event id
 * is null). USER_CONFIRMED drives the all-confirmed celebration.
 *
 * PRD three presence states are derived per member: confirmed/late
 * attendance → seated; otherwise in presentUserIds → 在场; else 未现身.
 */

/** How long the look-up bounce / poke badge / celebration stay on screen. */
const ENTERING_BOUNCE_MS = 1200
const POKE_BADGE_MS = 2200
const CELEBRATION_MS = 4200
const OWN_DOOR_ENTRY_MS = 1100

const ROOM_WS_EVENT_TYPES = [
  'ROOM_PRESENCE_STATE',
  'ROOM_MEMBER_ENTERED',
  'ROOM_MEMBER_LEFT',
  'ROOM_POKE',
  'USER_CONFIRMED',
] as const

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

/** "周六见" style farewell derived from the event's actual date — the
 *  hardcoded 周六 lie about every non-Saturday event (fix 2026-08-12).
 *  Falls back to the neutral 活动见 when the date is missing/unparseable. */
export function formatMeetDayLabel(eventDateTime: string | null | undefined): string {
  if (!eventDateTime) return '活动见'
  const parsed = new Date(eventDateTime)
  if (Number.isNaN(parsed.getTime())) return '活动见'
  return `${WEEKDAY_LABELS[parsed.getDay()]}见`
}

export interface UseGatheringRoomControllerArgs {
  groupId: string
}

export function useGatheringRoomController({ groupId }: UseGatheringRoomControllerArgs) {
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()
  const queryClient = useQueryClient()

  const gatheringRoomEnabled = currentUser?.features?.gatheringRoomEnabled ?? false
  const [reducedMotion] = useState(() => getSystemReducedMotion())
  const [pageVisible, setPageVisible] = useState(true)

  useDidShow(() => setPageVisible(true))
  useDidHide(() => setPageVisible(false))

  // ── REST snapshot ────────────────────────────────────────────────────────
  const {
    data: roomState,
    isLoading,
    error,
  } = useQuery<GatheringRoomStateResponse>({
    queryKey: ['mini-program', 'gathering-room-state', groupId],
    queryFn: () => getPoolGroupRoomState(apiRequest, groupId),
    enabled: !!groupId && gatheringRoomEnabled && !authLoading,
    // Gentle poll only while the page is visible and there is no WS room to join
    // (event row not yet created) — with WS live, presence/confirmation arrive over
    // the socket. WeChat has no document.hidden, so gate on our page-visible flag.
    refetchInterval: (query) =>
      !pageVisible || query.state.data?.blindBoxEventId ? false : 30_000,
  })

  const blindBoxEventId = roomState?.blindBoxEventId ?? null
  const currentUserId = currentUser?.id

  // ── Presence state (WS) ──────────────────────────────────────────────────
  const [presentUserIds, setPresentUserIds] = useState<ReadonlySet<string>>(() => new Set())
  const snapshotReceivedRef = useRef(false)
  const [enteringUserIds, setEnteringUserIds] = useState<ReadonlySet<string>>(() => new Set())
  const [pokeBadge, setPokeBadge] = useState<GatheringRoomPokeBadge | null>(null)
  const [playOwnDoorEntry, setPlayOwnDoorEntry] = useState(false)
  const [firstArriver, setFirstArriver] = useState(false)
  const [celebrationText, setCelebrationText] = useState<string | null>(null)
  const celebratedRef = useRef(false)

  // Single managed-timeout map: every ephemeral UI timer (entering bounce per
  // user, own door entry, poke badge, celebration) lives here keyed by name,
  // so unmount cleanup clears all of them in one pass.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
  }, [])
  const setManagedTimeout = useCallback((key: string, cb: () => void, ms: number) => {
    const timers = timersRef.current
    const existing = timers.get(key)
    if (existing) clearTimeout(existing)
    timers.set(key, setTimeout(() => { timers.delete(key); cb() }, ms))
  }, [])

  const markEntering = useCallback((userId: string) => {
    setEnteringUserIds((current) => {
      if (current.has(userId)) return current
      const next = new Set(current)
      next.add(userId)
      return next
    })
    // Re-arm semantics come free: setManagedTimeout clears any existing timer
    // for this key before arming the new one.
    setManagedTimeout(`entering:${userId}`, () => {
      setEnteringUserIds((current) => {
        if (!current.has(userId)) return current
        const next = new Set(current)
        next.delete(userId)
        return next
      })
    }, ENTERING_BOUNCE_MS)
  }, [setManagedTimeout])

  const handleWsMessage = useCallback(
    (message: WSMessage) => {
      switch (message.type) {
        case 'ROOM_PRESENCE_STATE': {
          const data = message.data as RoomPresenceStateData
          const next = new Set(data.presentUserIds ?? [])
          const isFirstSnapshot = !snapshotReceivedRef.current
          snapshotReceivedRef.current = true
          setPresentUserIds(next)
          if (isFirstSnapshot && currentUserId) {
            const othersPresent = [...next].filter((id) => id !== currentUserId)
            // First-arriver banner (PRD): own first visit and nobody else here.
            if (next.has(currentUserId) && othersPresent.length === 0) {
              setFirstArriver(true)
            }
            // Own door-entry animation plays once per page visit.
            if (!reducedMotion) {
              setPlayOwnDoorEntry(true)
              setManagedTimeout('door-entry', () => {
                setPlayOwnDoorEntry(false)
              }, OWN_DOOR_ENTRY_MS)
            }
          }
          return
        }
        case 'ROOM_MEMBER_ENTERED': {
          const data = message.data as RoomMemberEnteredData
          if (!data?.userId) return
          setPresentUserIds((current) => {
            if (current.has(data.userId)) return current // dedupe own broadcast
            const next = new Set(current)
            next.add(data.userId)
            return next
          })
          if (data.userId !== currentUserId) {
            setFirstArriver(false)
            markEntering(data.userId)
          }
          return
        }
        case 'ROOM_MEMBER_LEFT': {
          // Authoritative after the server-side grace period — remove now.
          const data = message.data as RoomMemberLeftData
          if (!data?.userId) return
          setPresentUserIds((current) => {
            if (!current.has(data.userId)) return current
            const next = new Set(current)
            next.delete(data.userId)
            return next
          })
          return
        }
        case 'ROOM_POKE': {
          const data = message.data as RoomPokeData
          if (!data || data.targetUserId !== currentUserId) return
          const fromMember = roomState?.members.find((member) => member.userId === data.fromUserId)
          const fromName = fromMember?.displayName || '队友'
          setPokeBadge({ fromName, emoji: data.emoji, ts: data.ts || Date.now() })
          haptics('light')
          setManagedTimeout('poke-badge', () => {
            setPokeBadge(null)
          }, POKE_BADGE_MS)
          return
        }
        case 'USER_CONFIRMED': {
          const data = message.data as UserConfirmedData
          if (!data) return
          // All-confirmed moment (PRD): celebrate once per session per user.
          if (
            data.totalParticipants > 0 &&
            data.confirmedCount >= data.totalParticipants &&
            !celebratedRef.current
          ) {
            celebratedRef.current = true
            setCelebrationText(`全员到齐！这桌稳了，${formatMeetDayLabel(roomState?.eventDateTime)}～`)
            haptics('success')
            gatheringRoomAnalytics.track('room_all_present', {
              poolId: groupId,
              groupId,
              screen: 'gathering-room',
              totalParticipants: data.totalParticipants,
            })
            setManagedTimeout('celebration', () => {
              setCelebrationText(null)
            }, CELEBRATION_MS)
          }
          // Keep the confirmed counts fresh for the header strip.
          queryClient.invalidateQueries({ queryKey: ['mini-program', 'gathering-room-state', groupId] })
          return
        }
        default:
      }
    },
    [currentUserId, groupId, queryClient, reducedMotion, roomState?.members, roomState?.eventDateTime, markEntering, setManagedTimeout],
  )

  const { send } = useWebSocket({
    autoConnect: !!blindBoxEventId && gatheringRoomEnabled,
    eventTypes: [...ROOM_WS_EVENT_TYPES],
    eventId: blindBoxEventId ?? undefined,
    joinEventId: blindBoxEventId ?? undefined,
    onMessage: handleWsMessage,
  })

  // ── Analytics: room_entered once per page visit ──────────────────────────
  const enteredTrackedRef = useRef(false)
  useEffect(() => {
    if (!roomState || enteredTrackedRef.current) return
    enteredTrackedRef.current = true
    logInfo('[GatheringRoom] Room entered', { groupId })
    gatheringRoomAnalytics.track('room_entered', {
      poolId: groupId,
      groupId,
      screen: 'gathering-room',
      totalParticipants: roomState.totalParticipants,
      confirmedCount: roomState.confirmedCount,
    })
  }, [roomState, groupId])

  // ── Derived view model ───────────────────────────────────────────────────
  // Keep member profiles stable (identity + equipment) and presence transient
  // so the scene's PixelAvatarComposite instances don't re-render on every
  // ephemeral WS presence update. Structural sharing: a profile object is
  // rebuilt only when that member's underlying data actually changed —
  // otherwise every refetch (30s poll / confirm / WS broadcast) would defeat
  // the memoized seats and re-render all six avatars.
  const memberProfilesRef = useRef<{
    signatures: Map<string, string>
    profiles: Map<string, GatheringRoomMemberProfile>
  }>({ signatures: new Map(), profiles: new Map() })

  const memberProfiles = useMemo(() => {
    const members = roomState?.members ?? []
    const { signatures, profiles } = memberProfilesRef.current
    const nextSignatures = new Map<string, string>()
    const nextProfiles = new Map<string, GatheringRoomMemberProfile>()
    const list = members.map((member: GatheringRoomMember) => {
      const signature = JSON.stringify([
        member.displayName,
        member.archetype,
        member.outfit,
        member.equippedItems,
      ])
      nextSignatures.set(member.userId, signature)
      const previous = profiles.get(member.userId)
      const profile: GatheringRoomMemberProfile =
        previous && signatures.get(member.userId) === signature
          ? previous
          : {
              userId: member.userId,
              displayName: member.displayName,
              archetype: member.archetype,
              outfit: member.outfit ?? null,
              equippedItems: member.equippedItems ?? [],
            }
      nextProfiles.set(member.userId, profile)
      return profile
    })
    memberProfilesRef.current = { signatures: nextSignatures, profiles: nextProfiles }
    return list
  }, [roomState?.members])

  const presenceByUserId = useMemo(
    () =>
      new Map(
        (roomState?.members ?? []).map((member: GatheringRoomMember) => {
          const presence: GatheringRoomPresence =
            member.attendanceStatus === 'confirmed' || member.attendanceStatus === 'late'
              ? 'confirmed'
              : presentUserIds.has(member.userId)
                ? 'present'
                : 'absent'
          return [member.userId, presence]
        }),
      ),
    [roomState?.members, presentUserIds],
  )

  const ownMember = useMemo(
    () => roomState?.members.find((member) => member.userId === currentUserId) ?? null,
    [roomState?.members, currentUserId],
  )
  const ownConfirmed =
    ownMember?.attendanceStatus === 'confirmed' || ownMember?.attendanceStatus === 'late'

  const presentCount = useMemo(
    () => [...presenceByUserId.values()].filter((presence) => presence !== 'absent').length,
    [presenceByUserId],
  )

  // ── Tablemate card sheet ─────────────────────────────────────────────────
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const selectedMember = useMemo(
    () => roomState?.members.find((member) => member.userId === selectedUserId) ?? null,
    [roomState?.members, selectedUserId],
  )

  const handleAvatarTap = useCallback((member: GatheringRoomMemberProfile) => {
    haptics('light')
    setSelectedUserId(member.userId)
  }, [])

  const closeSheet = useCallback(() => {
    haptics('light')
    setSelectedUserId(null)
  }, [])

  // ── Poke ─────────────────────────────────────────────────────────────────
  const handlePoke = useCallback(
    (targetUserId: string, emoji: RoomPokeEmoji) => {
      if (!blindBoxEventId || !currentUserId) return
      if (!ROOM_POKE_EMOJIS.includes(emoji)) {
        logWarn('[GatheringRoom] Ignoring unknown poke emoji', { emoji })
        return
      }
      send({
        type: 'ROOM_POKE',
        userId: currentUserId,
        eventId: blindBoxEventId,
        data: { targetUserId, emoji },
      })
      gatheringRoomAnalytics.track('room_poke', {
        poolId: groupId,
        groupId,
        screen: 'gathering-room',
        targetUserId,
        emoji,
      })
      haptics('light')
      setSelectedUserId(null)
      Taro.showToast({ title: '已经替你传达啦', icon: 'none', duration: TOAST_SHORT_MS })
    },
    [blindBoxEventId, currentUserId, groupId, send],
  )

  // ── Confirm attendance ───────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)

  const confirmAttendanceMutation = useMutation({
    mutationFn: () => confirmPoolGroupAttendance(apiRequest, groupId),
    onSuccess: (response) => {
      logInfo('[GatheringRoom] Attendance confirmed', {
        groupId,
        blindBoxEventId: response.blindBoxEventId,
      })
      gatheringRoomAnalytics.track('room_confirm_attendance', {
        poolId: groupId,
        groupId,
        screen: 'gathering-room',
        blindBoxEventId: response.blindBoxEventId,
      })
      haptics('success')
      Taro.showToast({ title: `座位已锁定，${formatMeetDayLabel(roomState?.eventDateTime)}`, icon: 'none', duration: TOAST_SHORT_MS })
      // Seated animation: the refetched snapshot flips presence to confirmed
      // and the CSS transition on the seat body animates the shift.
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'gathering-room-state', groupId] })
      setIsSubmitting(false)
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : '确认出席没成功'
      logWarn('[GatheringRoom] Attendance confirmation failed', { groupId, message })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_MEDIUM_MS })
      setIsSubmitting(false)
    },
  })

  const handleConfirmAttendance = useCallback(() => {
    if (isSubmitting || confirmAttendanceMutation.isPending || ownConfirmed) return
    haptics('medium')
    setIsSubmitting(true)
    confirmAttendanceMutation.mutate()
  }, [confirmAttendanceMutation, isSubmitting, ownConfirmed])

  useResetOnShow(setIsSubmitting)

  return {
    gatheringRoomEnabled,
    authLoading,
    isLoading,
    error,
    roomState,
    memberProfiles,
    presenceByUserId,
    currentUserId,
    ownConfirmed,
    presentCount,
    presentUserIds,
    enteringUserIds,
    playOwnDoorEntry,
    pokeBadge,
    firstArriverText: firstArriver ? '你是第一个到的～悦仔陪你等大家推门进来' : null,
    celebrationText,
    reducedMotion,
    pageVisible,
    selectedMember,
    isSubmitting,
    confirmPending: confirmAttendanceMutation.isPending,
    retry: () =>
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'gathering-room-state', groupId] }),
    handleAvatarTap,
    closeSheet,
    handlePoke,
    handleConfirmAttendance,
  }
}
