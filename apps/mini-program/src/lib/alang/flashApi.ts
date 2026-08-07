import Taro from '@tarojs/taro'
import {
  abandonFlashTask as abandonFlashTaskRequest,
  answerFlashEncounter as answerFlashEncounterRequest,
  arriveAtFlashTask as arriveAtFlashTaskRequest,
  deliverFlashTask as deliverFlashTaskRequest,
  getFlashAssignment as getFlashAssignmentRequest,
  getFlashEncounter as getFlashEncounterRequest,
  getFlashHome as getFlashHomeRequest,
  getFlashPreferences as getFlashPreferencesRequest,
  locateFlashNpc as locateFlashNpcRequest,
  rerollFlashTask as rerollFlashTaskRequest,
  respondToFlashTask as respondToFlashTaskRequest,
  submitFlashFeedback as submitFlashFeedbackRequest,
  updateFlashPreferences as updateFlashPreferencesRequest,
} from '@shared/api'
import {
  FLASH_ARRIVAL_RADIUS_METERS,
  FLASH_ENCOUNTER_ARRIVAL_RADIUS_METERS,
  type FlashAssignmentResponse as SharedFlashAssignmentResponse,
  type FlashCoordinateRequest,
  type FlashEncounterResponse as SharedFlashEncounterResponse,
  type FlashFeedbackRequest,
  type FlashHomeResponse as SharedFlashHomeResponse,
  type FlashLocateResponse as SharedFlashLocateResponse,
  type FlashPreferenceDto,
  type FlashPreferenceUpdateRequest,
  type FlashTaskDto,
} from '@shared/alang/flashTypes'
import { apiRequest } from '../api/api'
import type {
  FlashAssignmentActionView,
  FlashAssignmentView,
  FlashCanonicalSnapshot,
  FlashEncounterView,
  FlashStoryFragmentView,
  FlashHomeView,
  FlashLocationSnapshot,
  FlashLocateView,
  FlashPreferencesView,
  FlashTaskSummary,
} from './flashTypes'

export async function fetchFlashStoryFragments(): Promise<FlashStoryFragmentView[]> {
  const response = await apiRequest<{ fragments: FlashStoryFragmentView[] }>({
    path: '/api/alang/flash/story/fragments',
    method: 'GET',
  })
  return response.fragments
}

function toCoordinate(location: FlashLocationSnapshot): FlashCoordinateRequest {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    coordinateSystem: 'gcj02',
  }
}

function adaptTaskDto(task: FlashTaskDto): FlashTaskSummary {
  return {
    id: task.id,
    assignmentId: task.id,
    templateId: task.code,
    npc: {
      id: task.npc.id,
      slug: task.npc.slug,
      name: task.npc.name,
    },
    title: task.title,
    category: task.category,
    invitationType: task.invitationType,
    followUpTargetNpc: task.followUpTargetNpc,
    status: task.status,
    dueAt: task.expiresAt,
    destinationName: task.destination?.name,
    districtName: task.destination?.district,
    shortBrief: task.brief,
    arrivedAt: task.arrivedAt ?? undefined,
    feedbackSubmittedAt: task.feedbackSubmittedAt ?? undefined,
  }
}

export function adaptFlashHomeDto(response: SharedFlashHomeResponse): FlashHomeView {
  return {
    canonicalScreen: response.canonicalScreen,
    encounterId: response.encounterId ?? undefined,
    assignmentId: response.assignmentId ?? undefined,
    serverNow: response.serverNow,
    onlineNpcs: response.onlineNpcs.map((online) => ({
      id: online.npc.id,
      slug: online.npc.slug,
      name: online.npc.name,
      animal: online.npc.species,
      invitation: online.npc.inviteLine,
      districtName: online.district,
      locationAddress: online.locationAddress,
      appearanceId: online.appearanceId,
      endsAt: online.endsAt,
      remainingSeconds: Math.max(0, online.remainingMinutes * 60),
      themeKey: online.npc.slug,
    })),
    myTasks: response.myTasks.map(adaptTaskDto),
    preferenceSummary: {
      personalizationEnabled: response.preferenceSummary.personalizationEnabled,
      activeSourceCount: [
        response.preferenceSummary.usePersonality,
        response.preferenceSummary.useInterests,
        response.preferenceSummary.useIndustry,
        response.preferenceSummary.useDistrict,
        response.preferenceSummary.useTaskBehavior,
      ].filter(Boolean).length,
      tagCount: response.preferenceSummary.tags.length,
    },
  }
}

export function adaptFlashLocateDto(response: SharedFlashLocateResponse): FlashLocateView {
  return {
    canonicalScreen: response.canonicalScreen,
    withinRange: response.arrived,
    destination: response.destination,
    distanceMeters: response.distanceMeters,
    targetBearingDegrees: response.targetBearingDegrees,
    proximityBand: response.proximityBand,
    radiusMeters: FLASH_ENCOUNTER_ARRIVAL_RADIUS_METERS,
    encounterId: response.encounterId ?? undefined,
    appearanceId: response.appearanceId,
  }
}

export function adaptFlashEncounterDto(response: SharedFlashEncounterResponse): FlashEncounterView {
  return {
    canonicalScreen: response.canonicalScreen,
    encounterId: response.id,
    status: response.status,
    assignmentId: response.pendingDelivery?.id,
    npc: {
      id: response.npc.id,
      slug: response.npc.slug,
      name: response.npc.name,
      animal: response.npc.species,
      themeKey: response.npc.slug,
    },
    currentQuestion: response.question
      ? {
          id: response.question.id,
          text: response.question.prompt,
          options: response.question.options,
          position: response.questionPosition?.current,
          total: response.questionPosition?.total,
        }
      : null,
    taskOffer: response.offer
      ? {
          templateId: response.offer.templateId,
          title: response.offer.title,
          category: response.offer.category,
          invitation: response.offer.requestCopy,
          invitationType: response.offer.invitationType,
          followUpTargetNpc: response.offer.followUpTargetNpc,
          destinationName: response.offer.destinationPreview?.name,
          districtName: response.offer.destinationPreview?.district,
          expiresInDays: 7,
          canCompleteWithoutPurchase: true,
        }
      : null,
    canReroll: response.offer?.canReroll ?? false,
    answeredQuestionCount: response.questionPosition
      ? Math.max(0, response.questionPosition.current - 1)
      : undefined,
    rerollsRemaining: response.offer?.canReroll ? 1 : 0,
    pendingDelivery: response.pendingDelivery
      ? {
          assignmentId: response.pendingDelivery.id,
          taskTitle: response.pendingDelivery.title,
          invitationType: response.pendingDelivery.invitationType,
          followUpTargetNpc: response.pendingDelivery.followUpTargetNpc,
          feedbackQuestions: (response.pendingDelivery.followUpPrompts ?? []).map((prompt) => ({
            id: prompt.id,
            promptId: prompt.id,
            prompt: prompt.prompt,
            options: prompt.options,
          })),
          completedAt: response.pendingDelivery.feedbackSubmittedAt ?? undefined,
        }
      : null,
    storyEpisode: response.storyEpisode ?? null,
    conversationExpiresAt: response.expiresAt,
  }
}

export function adaptFlashAssignmentDto(response: SharedFlashAssignmentResponse): FlashAssignmentView {
  const task = response.task
  return {
    ...adaptTaskDto(task),
    canonicalScreen: response.canonicalScreen,
    assignmentId: task.id,
    description: task.instructions,
    destinationAddress: task.destination?.address,
    destination: task.destination ? {
      latitude: task.destination.latitude,
      longitude: task.destination.longitude,
    } : undefined,
    arrivalInstructions: task.invitationType === 'destination_exploration'
      ? '到达地点附近 50 米内，主动点击一次「我已到达」。'
      : '不用证明，也不用打卡。下次遇见角色时，再聊聊后来怎么样。',
    feedbackQuestions: response.feedbackPrompts.map((prompt) => ({
      id: prompt.id,
      promptId: prompt.id,
      prompt: prompt.prompt,
      options: prompt.options,
    })),
    radiusMeters: FLASH_ARRIVAL_RADIUS_METERS,
  }
}

export async function retryFlashAssignment(assignmentId: string): Promise<FlashAssignmentView> {
  const response = await apiRequest<SharedFlashAssignmentResponse>({
    path: `/api/alang/flash/assignments/${assignmentId}/retry`,
    method: 'POST',
  })
  return adaptFlashAssignmentDto(response)
}

function adaptPreferencesDto(response: FlashPreferenceDto): FlashPreferencesView {
  return {
    personalizationEnabled: response.personalizationEnabled,
    usePersonality: response.usePersonality,
    useInterests: response.useInterests,
    useIndustry: response.useIndustry,
    useDistrict: response.useDistrict,
    useTaskBehavior: response.useTaskBehavior,
    tags: response.tags.map((tag) => ({
      id: tag.id,
      label: tag.label,
      source: tag.source,
    })),
  }
}

export async function fetchFlashHome(location: FlashLocationSnapshot): Promise<FlashHomeView> {
  return adaptFlashHomeDto(await getFlashHomeRequest(apiRequest, toCoordinate(location)))
}

export async function locateFlashAppearance(
  appearanceId: string,
  location: FlashLocationSnapshot,
): Promise<FlashLocateView> {
  return adaptFlashLocateDto(await locateFlashNpcRequest(apiRequest, appearanceId, toCoordinate(location)))
}

export async function fetchFlashEncounter(encounterId: string): Promise<FlashEncounterView> {
  return adaptFlashEncounterDto(await getFlashEncounterRequest(apiRequest, encounterId))
}

export async function answerFlashEncounter(input: {
  encounterId: string
  questionId: string
  optionId: string
}): Promise<FlashEncounterView> {
  return adaptFlashEncounterDto(await answerFlashEncounterRequest(apiRequest, input.encounterId, {
    questionId: input.questionId,
    optionId: input.optionId,
  }))
}

export async function rerollFlashEncounter(encounterId: string): Promise<FlashEncounterView> {
  return adaptFlashEncounterDto(await rerollFlashTaskRequest(apiRequest, encounterId))
}

export async function respondToFlashTaskOffer(input: {
  encounterId: string
  accepted: boolean
}): Promise<FlashEncounterView | FlashCanonicalSnapshot> {
  const response = await respondToFlashTaskRequest(apiRequest, input.encounterId, { accepted: input.accepted })
  if ('task' in response) {
    return {
      canonicalScreen: response.canonicalScreen,
      encounterId: input.encounterId,
      assignmentId: response.task.id,
    }
  }
  return adaptFlashEncounterDto(response)
}

export async function deliverFlashTask(input: {
  encounterId: string
  assignmentId: string
  answers?: Array<{ promptId: string; optionId: string }>
}): Promise<FlashEncounterView> {
  return adaptFlashEncounterDto(await deliverFlashTaskRequest(
    apiRequest,
    input.encounterId,
    input.assignmentId,
    input.answers,
  ))
}

export async function fetchFlashAssignment(assignmentId: string): Promise<FlashAssignmentView> {
  return adaptFlashAssignmentDto(await getFlashAssignmentRequest(apiRequest, assignmentId))
}

export async function arriveAtFlashAssignment(input: {
  assignmentId: string
  location: FlashLocationSnapshot
}): Promise<FlashAssignmentActionView> {
  const response = await arriveAtFlashTaskRequest(apiRequest, input.assignmentId, toCoordinate(input.location))
  return {
    canonicalScreen: response.canonicalScreen,
    assignmentId: response.task.id,
    withinRange: response.arrived,
    distanceMeters: response.distanceMeters,
    radiusMeters: FLASH_ARRIVAL_RADIUS_METERS,
    assignment: adaptFlashAssignmentDto(response),
  }
}

export async function submitFlashFeedback(input: {
  assignmentId: string
  answers: FlashFeedbackRequest['answers']
  privateReply?: string
}): Promise<FlashAssignmentActionView> {
  const data: FlashFeedbackRequest = {
    answers: input.answers,
    ...(input.privateReply?.trim() ? { privateReply: input.privateReply.trim() } : {}),
  }
  const response = await submitFlashFeedbackRequest(apiRequest, input.assignmentId, data)
  return {
    canonicalScreen: response.canonicalScreen,
    assignmentId: response.task.id,
    assignment: adaptFlashAssignmentDto(response),
  }
}

export async function abandonFlashAssignment(assignmentId: string): Promise<FlashAssignmentActionView> {
  await abandonFlashTaskRequest(apiRequest, assignmentId)
  return { canonicalScreen: 'home', assignmentId }
}

export async function fetchFlashPreferences(): Promise<FlashPreferencesView> {
  return adaptPreferencesDto(await getFlashPreferencesRequest(apiRequest))
}

export async function updateFlashPreferences(update: FlashPreferenceUpdateRequest): Promise<FlashPreferencesView> {
  return adaptPreferencesDto(await updateFlashPreferencesRequest(apiRequest, update))
}

export function getOneShotFlashLocation(): Promise<FlashLocationSnapshot> {
  return new Promise((resolve, reject) => {
    Taro.getLocation({
      type: 'gcj02',
      success: (result: { latitude: number; longitude: number; accuracy?: number }) => {
        resolve({
          latitude: result.latitude,
          longitude: result.longitude,
          accuracy: result.accuracy,
        })
      },
      fail: reject,
    })
  })
}

export async function getFlashLocationPermission(): Promise<'granted' | 'denied' | 'unknown'> {
  try {
    const setting = await Taro.getSetting()
    const value = setting.authSetting?.['scope.userLocation']
    if (value === true) return 'granted'
    if (value === false) return 'denied'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export function getFlashApiErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const data = (error as { data?: unknown }).data
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (typeof record.code === 'string') return record.code
    if (typeof record.error === 'string' && /^[A-Z0-9_]+$/.test(record.error)) return record.error
  }
  const message = error instanceof Error ? error.message : ''
  const match = message.match(/\b[A-Z][A-Z0-9_]{3,}\b/)
  return match?.[0] ?? null
}
