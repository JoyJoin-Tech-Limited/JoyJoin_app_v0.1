import type {
  SocialSessionState,
  SocialIcebreakerPhase,
} from '@shared/socialIcebreaker'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import type { SessionParticipant, SessionPhase } from './phaseViews'

export interface IcebreakerSession extends SocialSessionState {
  id: string
  phase: SessionPhase
}

export interface EventSessionDiscovery {
  sessionId?: string | null
  checkedInCount?: number
  expectedAttendees?: number
  currentPhase?: string | null
}

export interface SessionDetailsParticipant {
  userId?: string
  id?: string
  displayName?: string
  nickname?: string
  archetype?: string
  interests?: string[]
  topicsHappy?: string[]
  topicsAvoid?: string[]
  [key: string]: unknown
}

export interface LegacyIcebreakerSessionDetails {
  id: string
  eventId: string
  eventType?: string
  eventTitle?: string
  participants?: SessionDetailsParticipant[]
  [key: string]: unknown
}

export interface SocialStartResponse {
  socialSessionId: string
  currentPhase: SocialIcebreakerPhase
  hostUserId: string
  hostDisplayName: string
  state: SocialSessionState
}

export interface SocialRecapResponse {
  summary?: {
    headline?: string
    moments?: string[]
    closingLine?: string
  }
  medals?: Array<{
    emoji: string
    title: string
    recipientDisplayName: string
    description: string
  }>
  state?: SocialSessionState
  meta?: AIResponseMeta
}

export function normaliseSession(state: SocialSessionState): IcebreakerSession {
  return {
    ...state,
    id: state.socialSessionId,
    phase: state.currentPhase,
  }
}

export function getUserDisplayName(user: Record<string, unknown> | undefined): string {
  if (!user) {
    return '参与者'
  }

  if (typeof user.displayName === 'string' && user.displayName.trim() !== '') {
    return user.displayName
  }

  if (typeof user.nickname === 'string' && user.nickname.trim() !== '') {
    return user.nickname
  }

  return '参与者'
}

export function getUserArchetype(user: Record<string, unknown> | undefined): string | undefined {
  if (!user) {
    return undefined
  }

  if (typeof user.archetype === 'string' && user.archetype.trim() !== '') {
    return user.archetype
  }

  if (typeof user.primaryArchetype === 'string' && user.primaryArchetype.trim() !== '') {
    return user.primaryArchetype
  }

  return undefined
}

export function getUserInterests(user: Record<string, unknown> | undefined): string[] {
  if (!user) {
    return []
  }

  const candidateLists = [user.interestsRankedTop3, user.interests, user.topInterests]

  for (const candidate of candidateLists) {
    if (Array.isArray(candidate)) {
      return candidate.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    }
  }

  return []
}

export function getErrorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }

  return fallback
}

export function deriveParticipants(
  session: IcebreakerSession,
  roster: SessionDetailsParticipant[],
  hostId?: string,
): SessionParticipant[] {
  const rosterByUserId = new Map(
    roster.map((participant) => [participant.userId ?? participant.id ?? '', participant] as const),
  )

  if (session.joinedParticipants && session.joinedParticipants.length > 0) {
    return session.joinedParticipants.map((participant) => {
      const details = rosterByUserId.get(participant.userId)

      return {
        ...details,
        userId: participant.userId,
        displayName: participant.displayName || details?.displayName || details?.nickname,
        archetype: details?.archetype,
        interests: Array.isArray(details?.interests)
          ? details.interests.filter((value): value is string => typeof value === 'string')
          : [],
        isHost: participant.userId === hostId,
        isActive: participant.isActive,
      }
    })
  }

  if (roster.length > 0) {
    return roster.map((participant) => {
      const userId = participant.userId ?? participant.id ?? ''

      return {
        ...participant,
        userId,
        displayName: participant.displayName ?? participant.nickname,
        archetype: participant.archetype,
        interests: Array.isArray(participant.interests)
          ? participant.interests.filter((value): value is string => typeof value === 'string')
          : [],
        isHost: userId === hostId,
      }
    })
  }

  const ids = new Set<string>()
  session.lieDetectivePlayers?.forEach((p) => ids.add(p.userId))
  session.warmupReadyUserIds?.forEach((id) => ids.add(id))
  session.personalityDiceChallenges?.forEach((challenge) => ids.add(challenge.userId))
  if (hostId) ids.add(hostId)

  return Array.from(ids).map((userId) => ({
    userId,
    displayName:
      session.lieDetectivePlayers?.find((p) => p.userId === userId)?.displayName ??
      session.personalityDiceChallenges?.find((challenge) => challenge.userId === userId)?.displayName,
    isHost: userId === hostId,
  }))
}

export function buildSocialPath(socialSessionId: string, suffix = ''): string {
  const encodedId = encodeURIComponent(socialSessionId)
  return `/api/social-icebreaker/${encodedId}${suffix}`
}
