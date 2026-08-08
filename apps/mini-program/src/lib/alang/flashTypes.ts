import type {
  FlashCanonicalScreen,
  FlashPreferenceUpdateRequest,
} from '@shared/alang/flashTypes'

/**
 * Frontend-only view models. Network payloads are owned by
 * `@shared/alang/flashTypes` and must cross the explicit adapters in
 * `flashApi.ts` before reaching these renderer-friendly shapes.
 */
export type { FlashCanonicalScreen }

export type FlashTaskStatus =
  | 'accepted'
  | 'in_progress'
  | 'arrived'
  | 'feedback_pending'
  | 'ready_to_deliver'
  | 'delivered'
  | 'completed'
  | 'expired'
  | 'abandoned'
  | 'withdrawn'
  | string

export interface FlashLocationSnapshot {
  latitude: number
  longitude: number
  accuracy?: number
}

export interface FlashNpcSummary {
  id: string
  slug: string
  name: string
  animal?: string
  invitation: string
  districtName: string
  locationAddress?: string
  appearanceId: string
  endsAt?: string
  remainingSeconds?: number
  availabilityMode?: 'scheduled' | 'manual_hold'
  themeKey?: string
}

export interface FlashNpcReference {
  id: string
  slug: string
  name: string
  animal?: string
  themeKey?: string
  avatarUrl?: string
}

export interface FlashFeedbackOption {
  id: string
  label: string
}

export interface FlashFeedbackQuestion {
  id: string
  promptId?: string
  prompt: string
  options: FlashFeedbackOption[]
}

export interface FlashTaskSummary {
  id: string
  assignmentId?: string
  templateId?: string
  npc: FlashNpcReference
  title: string
  category: string
  invitationType?: 'destination_exploration' | 'life_invitation' | 'npc_message'
  followUpTargetNpc?: { slug: string; name: string } | null
  status: FlashTaskStatus
  dueAt?: string
  destinationName?: string
  districtName?: string
  shortBrief?: string
  arrivedAt?: string
  feedbackSubmittedAt?: string
  feedbackQuestions?: FlashFeedbackQuestion[]
}

export interface FlashPreferenceSummary {
  personalizationEnabled: boolean
  activeSourceCount?: number
  tagCount?: number
}

export interface FlashHomeView {
  canonicalScreen?: FlashCanonicalScreen
  serverNow: string
  onlineNpcs: FlashNpcSummary[]
  myTasks: FlashTaskSummary[]
  preferenceSummary: FlashPreferenceSummary
  encounterId?: string
  appearanceId?: string
  assignmentId?: string
}

export interface FlashLocateView {
  canonicalScreen: FlashCanonicalScreen
  withinRange: boolean
  destination: {
    latitude: number
    longitude: number
    coordinateSystem: 'gcj02'
  }
  distanceMeters: number
  targetBearingDegrees: number
  proximityBand: 'far' | 'approaching' | 'near' | 'arrived'
  radiusMeters?: number
  encounterId?: string
  appearanceId?: string
  assignmentId?: string
  npc?: FlashNpcReference
  message?: string
}

export interface FlashDialogueOption {
  id: string
  label: string
}

export interface FlashDialogueQuestion {
  id: string
  text: string
  options: FlashDialogueOption[]
  position?: number
  total?: number
}

export interface FlashTaskOffer {
  templateId: string
  title: string
  category: string
  invitation: string
  invitationType?: 'destination_exploration' | 'life_invitation' | 'npc_message'
  followUpTargetNpc?: { slug: string; name: string } | null
  destinationName?: string
  districtName?: string
  expiresInDays?: number
  canCompleteWithoutPurchase?: boolean
}

export interface FlashDeliverySummary {
  assignmentId: string
  taskTitle: string
  invitationType?: 'destination_exploration' | 'life_invitation' | 'npc_message'
  followUpTargetNpc?: { slug: string; name: string } | null
  feedbackQuestions?: FlashFeedbackQuestion[]
  completedAt?: string
}

export interface FlashEncounterView {
  canonicalScreen: FlashCanonicalScreen
  encounterId: string
  status?: string
  appearanceId?: string
  assignmentId?: string
  npc: FlashNpcReference
  openingLine?: string
  currentQuestion?: FlashDialogueQuestion | null
  answeredQuestionCount?: number
  taskOffer?: FlashTaskOffer | null
  canReroll?: boolean
  rerollsRemaining?: number
  pendingDelivery?: FlashDeliverySummary | null
  conversationExpiresAt?: string
  shiftEndsAt?: string
  message?: string
  storyEpisode?: {
    id: string
    code: string
    seasonTitle: string
    phase: number
    title: string
    objectCode: string
    opening: string
    action: string
    discovery: string
    response: string | null
    echo?: string | null
    storyMode?: 'standard' | 'personalized'
    renderKind?: 'template' | 'ai' | 'fallback'
    ending?: {
      code: string
      vector: { trust: number; attachment: number; intervention: number; truth: number }
      highlights: Array<{ episodeTitle: string; optionLabel: string }>
    } | null
    closing: string | null
    motion: { ambient: 'none' | 'breathe' | 'drift'; blinkAssetUrl?: string; blinkIntervalSeconds?: number }
    fragment: { id: string; category: 'object' | 'past' | 'relationship' | 'key'; title: string; fact: string; assetUrl: string | null } | null
    progress: { completedInPhase: number; totalInPhase: number; completedTotal: number; total: number }
  } | null
}

export interface FlashStoryFragmentView {
  id: string
  code: string
  category: 'object' | 'past' | 'relationship' | 'key'
  title: string
  fact: string
  assetUrl: string | null
  unlockedAt: string
  episodeTitle: string
  npcName: string
}

export interface FlashAssignmentView extends FlashTaskSummary {
  canonicalScreen: FlashCanonicalScreen
  assignmentId: string
  description?: string
  destinationAddress?: string
  destination?: { latitude: number; longitude: number }
  destinationLatitude?: number
  destinationLongitude?: number
  arrivalInstructions?: string
  completionNote?: string
  encounterId?: string
  distanceMeters?: number
  radiusMeters?: number
}

export interface FlashAssignmentActionView {
  canonicalScreen: FlashCanonicalScreen
  assignmentId: string
  encounterId?: string
  withinRange?: boolean
  distanceMeters?: number
  radiusMeters?: number
  message?: string
  assignment?: FlashAssignmentView
}

export interface FlashPreferenceTag {
  id: string
  label: string
  source: 'personality' | 'interests' | 'industry' | 'district' | 'task_behavior' | string
}

export interface FlashPreferencesView {
  canonicalScreen?: FlashCanonicalScreen
  personalizationEnabled: boolean
  usePersonality: boolean
  useInterests: boolean
  useIndustry: boolean
  useDistrict: boolean
  useTaskBehavior: boolean
  tags: FlashPreferenceTag[]
}

export type FlashPreferenceUpdate = FlashPreferenceUpdateRequest

export type FlashCanonicalSnapshot = Partial<{
  canonicalScreen: FlashCanonicalScreen
  encounterId: string
  appearanceId: string
  assignmentId: string
  storyEpisode: FlashEncounterView['storyEpisode']
}>
