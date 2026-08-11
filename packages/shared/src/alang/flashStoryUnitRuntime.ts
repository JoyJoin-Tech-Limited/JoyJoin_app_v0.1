import {
  FLASH_STORY_ANALYTICS_EVENTS,
  isFlashStoryUnitId,
  type FlashStoryAnalyticsEvent,
  type FlashStoryUnitId,
} from './flashStorySeason'
import {
  atuanFirstActSubmissionSchema,
  restoreAtuanFirstActProgress,
  type AtuanFirstActProgress,
  type AtuanFirstActSubmission,
} from './atuanFirstAct'

export const STORY_UNIT_VERSION = 2 as const

export type StoryUnitStage =
  | 'INIT'
  | 'NPC_INTRO'
  | 'OBJECT_INTERACTION'
  | 'OBJECT_DIVERGED'
  | 'OBJECT_SUCCESS'
  | 'NPC_RESPONSE'
  | 'COMPLETED'

export type NPCResponseEvent = 'INTRO' | 'FIRST_MISTAKE' | 'SUCCESS'
export type FlashStoryUnitAnalyticsEvent = FlashStoryAnalyticsEvent

export interface StoryUnitChoice {
  questionId: string
  optionId: string
  label: string
  storyPath?: AtuanFirstActSubmission
}

export interface StoryUnitQuestionSnapshot {
  id: string
  options: Array<{ id: string; label: string }>
}

export interface StoryUnitState {
  unitId: FlashStoryUnitId
  version: typeof STORY_UNIT_VERSION
  stage: StoryUnitStage
  choice: StoryUnitChoice | null
  companionEvent: NPCResponseEvent
  divergenceCopy: string | null
  atuanFirstAct: AtuanFirstActProgress | null
  analyticsSent: FlashStoryUnitAnalyticsEvent[]
}

export type StoryUnitAction =
  | { type: 'ENTER' }
  | { type: 'START_INTERACTION'; choice: StoryUnitChoice; atuanFirstAct?: AtuanFirstActProgress }
  | { type: 'FIRST_MISTAKE' }
  | { type: 'OBJECT_DIVERGED'; copy: string }
  | { type: 'OBJECT_ALIGNED'; choice?: StoryUnitChoice }
  | { type: 'ATUAN_FIRST_ACT_UPDATED'; progress: AtuanFirstActProgress }
  | { type: 'RESPONSE_RECEIVED' }
  | { type: 'COMPLETE' }
  | { type: 'ANALYTIC_RECORDED'; event: FlashStoryUnitAnalyticsEvent }

const STAGES: StoryUnitStage[] = [
  'INIT',
  'NPC_INTRO',
  'OBJECT_INTERACTION',
  'OBJECT_DIVERGED',
  'OBJECT_SUCCESS',
  'NPC_RESPONSE',
  'COMPLETED',
]

const NPC_EVENTS: NPCResponseEvent[] = ['INTRO', 'FIRST_MISTAKE', 'SUCCESS']
const ANALYTICS_EVENTS: readonly FlashStoryUnitAnalyticsEvent[] = FLASH_STORY_ANALYTICS_EVENTS

export function createStoryUnitState(unitId: FlashStoryUnitId): StoryUnitState {
  return {
    unitId,
    version: STORY_UNIT_VERSION,
    stage: 'INIT',
    choice: null,
    companionEvent: 'INTRO',
    divergenceCopy: null,
    atuanFirstAct: null,
    analyticsSent: [],
  }
}

function isChoice(value: unknown): value is StoryUnitChoice {
  if (!value || typeof value !== 'object') return false
  const choice = value as Partial<StoryUnitChoice>
  const pathIsValid = choice.storyPath === undefined || atuanFirstActSubmissionSchema.safeParse(choice.storyPath).success
  return pathIsValid
    && typeof choice.questionId === 'string'
    && choice.questionId.length > 0
    && typeof choice.optionId === 'string'
    && choice.optionId.length > 0
    && typeof choice.label === 'string'
    && choice.label.length > 0
}

export function restoreStoryUnitState(unitId: FlashStoryUnitId, value: unknown, encounterId?: string): StoryUnitState {
  const fallback = createStoryUnitState(unitId)
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<StoryUnitState>
  if (
    candidate.unitId !== unitId
    || !isFlashStoryUnitId(candidate.unitId)
    || candidate.version !== STORY_UNIT_VERSION
    || !candidate.stage
    || !STAGES.includes(candidate.stage)
    || !candidate.companionEvent
    || !NPC_EVENTS.includes(candidate.companionEvent)
  ) return fallback

  const requiresChoice = STAGES.indexOf(candidate.stage) >= STAGES.indexOf('OBJECT_INTERACTION')
  if (requiresChoice && !isChoice(candidate.choice)) return fallback

  const analyticsSent = Array.isArray(candidate.analyticsSent)
    ? candidate.analyticsSent.filter((event): event is FlashStoryUnitAnalyticsEvent => ANALYTICS_EVENTS.includes(event))
    : []
  const choice = isChoice(candidate.choice) ? candidate.choice : null
  const atuanFirstAct = unitId === 's1-p1-atuan' && encounterId
    ? restoreAtuanFirstActProgress(encounterId, candidate.atuanFirstAct)
    : null

  // V2 snapshots created before the first-act loop have no path progress.
  // Reset those active snapshots instead of dropping the user into a half-old,
  // half-new interaction after an app update.
  if (
    unitId === 's1-p1-atuan'
    && candidate.stage !== 'INIT'
    && candidate.stage !== 'NPC_INTRO'
    && !atuanFirstAct
  ) return fallback

  return {
    unitId,
    version: STORY_UNIT_VERSION,
    stage: candidate.stage,
    choice,
    companionEvent: candidate.companionEvent,
    divergenceCopy: typeof candidate.divergenceCopy === 'string' ? candidate.divergenceCopy : null,
    atuanFirstAct,
    analyticsSent: [...new Set(analyticsSent)],
  }
}

/**
 * Local recovery is valid only while the server still exposes the same
 * reviewed question and option. Content revisions keep the episode id, so a
 * stale stored payload must be discarded instead of being retried forever.
 */
export function reconcileStoryUnitState(
  unitId: FlashStoryUnitId,
  state: StoryUnitState,
  question?: StoryUnitQuestionSnapshot | null,
): StoryUnitState {
  const requiresChoice = STAGES.indexOf(state.stage) >= STAGES.indexOf('OBJECT_INTERACTION')
  if (!requiresChoice) return state
  const currentOption = question && question.id === state.choice?.questionId
    ? question.options.find((option) => option.id === state.choice?.optionId)
    : undefined
  if (!currentOption || !state.choice) return createStoryUnitState(unitId)
  if (currentOption.label === state.choice.label) return state
  return { ...state, choice: { ...state.choice, label: currentOption.label } }
}

export function storyUnitReducer(state: StoryUnitState, action: StoryUnitAction): StoryUnitState {
  switch (action.type) {
    case 'ENTER':
      return state.stage === 'INIT' ? { ...state, stage: 'NPC_INTRO' } : state
    case 'START_INTERACTION':
      return state.stage === 'NPC_INTRO'
        ? {
            ...state,
            stage: 'OBJECT_INTERACTION',
            choice: action.choice,
            atuanFirstAct: action.atuanFirstAct ?? null,
            companionEvent: 'INTRO',
          }
        : state
    case 'FIRST_MISTAKE':
      return state.stage === 'OBJECT_INTERACTION' && state.companionEvent !== 'FIRST_MISTAKE'
        ? { ...state, companionEvent: 'FIRST_MISTAKE' }
        : state
    case 'OBJECT_DIVERGED':
      return state.stage === 'OBJECT_INTERACTION' && action.copy.trim().length > 0
        ? { ...state, stage: 'OBJECT_DIVERGED', companionEvent: 'FIRST_MISTAKE', divergenceCopy: action.copy }
        : state
    case 'OBJECT_ALIGNED':
      return state.stage === 'OBJECT_INTERACTION'
        ? { ...state, stage: 'OBJECT_SUCCESS', choice: action.choice ?? state.choice, companionEvent: 'SUCCESS' }
        : state
    case 'ATUAN_FIRST_ACT_UPDATED':
      return state.unitId === 's1-p1-atuan' && state.stage === 'OBJECT_INTERACTION'
        ? { ...state, atuanFirstAct: action.progress }
        : state
    case 'RESPONSE_RECEIVED':
      return state.stage === 'OBJECT_SUCCESS'
        ? { ...state, stage: 'NPC_RESPONSE', companionEvent: 'SUCCESS' }
        : state
    case 'COMPLETE':
      return state.stage === 'NPC_RESPONSE' ? { ...state, stage: 'COMPLETED' } : state
    case 'ANALYTIC_RECORDED':
      return state.analyticsSent.includes(action.event)
        ? state
        : { ...state, analyticsSent: [...state.analyticsSent, action.event] }
    default:
      return state
  }
}

export function storyUnitStorageKey(unitId: FlashStoryUnitId, encounterId: string, episodeId: string): string {
  return `joyjoin_flash_story_unit_v${STORY_UNIT_VERSION}_${unitId}_${encounterId}_${episodeId}`
}
