import type { ApiTransport } from './core.js'
import {
  getInterestById,
  MACRO_CATEGORY_LABELS,
  validateInterestIds,
  type MacroCategory,
} from '../interests.js'

export interface EssentialDataPayload {
  displayName?: string
  gender?: string
  birthYear?: number
  birthdate?: string
  currentCity?: string
  hometownRegionCity?: string
  relationshipStatus?: string
  educationLevel?: string
  occupationId?: string
  /** Canonical life stage. Prefer this over workMode for new writes. */
  lifeStage?: string
  /** @deprecated Use lifeStage instead. Kept for one-release read-only fallback. */
  workMode?: string
  intent?: string[]
  /** One-line social signature / bio (≤100 chars). */
  bio?: string
  /** Custom avatar URL override; null clears any previous override. */
  profileImageUrl?: string | null
  [key: string]: unknown
}

export function submitEssentialData(
  api: ApiTransport,
  data: EssentialDataPayload
): Promise<{ success: boolean }> {
  const { birthYear, birthdate, ...rest } = data
  return api<{ success: boolean }>({
    path: '/api/profile',
    method: 'PATCH',
    data: {
      ...rest,
      ...(birthdate ? { birthdate } : birthYear ? { birthdate: `${birthYear}-01-01` } : {}),
    },
  })
}

export type InterestSelectionLevel = 1 | 2 | 3

export interface InterestSelectionDraft {
  topicId: string
  level?: InterestSelectionLevel
}

export interface StructuredInterestSelection {
  topicId: string
  emoji: string
  label: string
  fullName: string
  category: string
  categoryId: MacroCategory
  level: InterestSelectionLevel
  heat: 3 | 10 | 25
}

export interface StructuredInterestTopPriority {
  topicId: string
  label: string
  heat: 25
}

export interface StructuredInterestsPayload {
  totalHeat: number
  totalSelections: number
  categoryHeat: Record<string, number>
  selections: StructuredInterestSelection[]
  topPriorities?: StructuredInterestTopPriority[]
}

export interface InterestsPayload {
  interests: StructuredInterestsPayload
}

export type InterestsPayloadInput =
  | InterestsPayload
  | { interests: StructuredInterestsPayload | string[] | InterestSelectionDraft[] }
  | string[]
  | InterestSelectionDraft[]

const INTEREST_HEAT_BY_LEVEL: Record<InterestSelectionLevel, 3 | 10 | 25> = {
  1: 3,
  2: 10,
  3: 25,
}

const food_emoji = '🍜'
const play_emoji = '🎮'
const sports_emoji = '🌿'
const culture_emoji = '🎭'
const life_emoji = '🏠'
const growth_emoji = '💡'
const default_interest_emoji = '✨'

export const INTEREST_CATEGORY_EMOJIS: Record<MacroCategory, string> = {
  food: food_emoji,
  play: play_emoji,
  sports: sports_emoji,
  culture: culture_emoji,
  life: life_emoji,
  growth: growth_emoji,
}

function normalizeInterestSelectionLevel(level: unknown): InterestSelectionLevel {
  return level === 2 || level === 3 ? level : 1
}

function isStructuredInterestsPayload(value: unknown): value is StructuredInterestsPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const payload = value as Partial<StructuredInterestsPayload>
  return (
    typeof payload.totalHeat === 'number' &&
    typeof payload.totalSelections === 'number' &&
    Array.isArray(payload.selections) &&
    typeof payload.categoryHeat === 'object' &&
    payload.categoryHeat !== null &&
    !Array.isArray(payload.categoryHeat)
  )
}

export function buildStructuredInterestsPayload(
  input: Array<string | InterestSelectionDraft>
): StructuredInterestsPayload {
  const selectionLevels = new Map<string, InterestSelectionLevel>()

  for (const item of input) {
    const topicId = typeof item === 'string' ? item : item.topicId
    if (typeof topicId !== 'string' || topicId.trim() === '') {
      continue
    }

    const normalizedTopicId = topicId.trim()
    const level = normalizeInterestSelectionLevel(typeof item === 'string' ? 1 : item.level)
    const currentLevel = selectionLevels.get(normalizedTopicId)
    selectionLevels.set(
      normalizedTopicId,
      currentLevel ? (Math.max(currentLevel, level) as InterestSelectionLevel) : level
    )
  }

  const validation = validateInterestIds(Array.from(selectionLevels.keys()))

  const selections = validation.valid
    .map((topicId) => {
      const definition = getInterestById(topicId)
      if (!definition) {
        return null
      }

      const level = selectionLevels.get(topicId) ?? 1
      const heat = INTEREST_HEAT_BY_LEVEL[level]
      const categoryLabel = MACRO_CATEGORY_LABELS[definition.macroCategory] ?? definition.macroCategory

      return {
        topicId,
        emoji: INTEREST_CATEGORY_EMOJIS[definition.macroCategory] ?? default_interest_emoji,
        label: definition.label,
        fullName: `${categoryLabel} · ${definition.label}`,
        category: categoryLabel,
        categoryId: definition.macroCategory,
        level,
        heat,
      }
    })
    .filter((item): item is StructuredInterestSelection => item !== null)

  const categoryHeat = selections.reduce<Record<string, number>>((acc, selection) => {
    acc[selection.categoryId] = (acc[selection.categoryId] ?? 0) + selection.heat
    return acc
  }, {})

  const totalHeat = selections.reduce((sum, selection) => sum + selection.heat, 0)
  const topPriorities = selections
    .filter((selection) => selection.level === 3)
    .map((selection) => ({
      topicId: selection.topicId,
      label: selection.label,
      heat: 25 as const,
    }))

  return {
    totalHeat,
    totalSelections: selections.length,
    categoryHeat,
    selections,
    ...(topPriorities.length > 0 ? { topPriorities } : {}),
  }
}

function normalizeInterestsPayloadInput(data: InterestsPayloadInput): InterestsPayload {
  if (Array.isArray(data)) {
    return {
      interests: buildStructuredInterestsPayload(data),
    }
  }

  if (data && typeof data === 'object' && 'interests' in data) {
    const interests = data.interests as unknown

    if (Array.isArray(interests)) {
      return {
        interests: buildStructuredInterestsPayload(interests as Array<string | InterestSelectionDraft>),
      }
    }

    if (isStructuredInterestsPayload(interests)) {
      return { interests }
    }
  }

  throw new Error('Invalid interests payload')
}

export function submitInterests(
  api: ApiTransport,
  data: InterestsPayloadInput
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>({
    path: '/api/user/interests',
    method: 'POST',
    data: normalizeInterestsPayloadInput(data),
  })
}

export function completeProfileReview(
  api: ApiTransport,
  bio?: string,
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>({
    path: '/api/profile-review/complete',
    method: 'POST',
    data: bio !== undefined ? { bio } : undefined,
  })
}
