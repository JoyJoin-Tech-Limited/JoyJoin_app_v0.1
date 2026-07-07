import type {
  EventPoolRegistrationPayload,
  NormalizedEventPoolRegistrationPayload,
} from '@shared/api'
import type { PoolEventType } from './flowConfig'
import { INTENT_FLOW_OPTIONS } from './flowConfig'

export type RegistrationStep = 0 | 1 | 2 | 3

export interface RegistrationFormState {
  eventIntent: string[]
  preferredLanguages: string[]
  budgetRange?: string[]
  dietaryRestrictions: string[]
  barThemes: string[]
  alcoholComfort?: string
  barBudgetRange?: string[]
  invitationCode?: string
}

export const INITIAL_FORM_STATE: RegistrationFormState = {
  eventIntent: [],
  preferredLanguages: [],
  dietaryRestrictions: [],
  barThemes: [],
}

export interface PoolRegistrationSummaryItem {
  label: string
  value: string
  icon: string
  tier: 'ui' | 'semantic'
  intentLabels?: string[]
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function findLabels(values: string[], options: { value: string; label: string }[]): string[] {
  return options.filter((option) => values.includes(option.value)).map((option) => option.label)
}

export function buildSummaryItems(
  formState: RegistrationFormState,
  eventType: PoolEventType,
): PoolRegistrationSummaryItem[] {
  const selectedBudget =
    eventType === '酒局' ? formState.barBudgetRange?.[0] ?? '' : formState.budgetRange?.[0] ?? ''
  const intentLabels = findLabels(formState.eventIntent, INTENT_FLOW_OPTIONS)

  return [
    {
      label: '你的预算',
      value: selectedBudget || '未选择',
      icon: '👑',
      tier: 'ui',
      intentLabels: [],
    },
    {
      label: '这次想收获',
      value: intentLabels.length > 0 ? intentLabels.join('、') : '未选择',
      icon: '🎯',
      tier: 'semantic',
      intentLabels,
    },
  ]
}

export function hasAnyDetailSelection(
  formState: RegistrationFormState,
  eventType: PoolEventType,
): boolean {
  const hasLanguage = formState.preferredLanguages.length > 0
  if (eventType === '酒局') {
    return hasLanguage || formState.barThemes.length > 0 || !!formState.alcoholComfort
  }
  return hasLanguage || formState.dietaryRestrictions.length > 0
}

export function buildRegistrationPayload(
  formState: RegistrationFormState,
  eventType: PoolEventType,
): EventPoolRegistrationPayload {
  return {
    eventIntent: formState.eventIntent,
    preferredLanguages: formState.preferredLanguages,
    invitationCode: formState.invitationCode || undefined,
    ...(eventType === '酒局'
      ? {
          barBudgetRange: formState.barBudgetRange,
          barThemes: formState.barThemes,
          alcoholComfort: formState.alcoholComfort ? [formState.alcoholComfort] : undefined,
        }
      : {
          budgetRange: formState.budgetRange,
          dietaryRestrictions: formState.dietaryRestrictions,
        }),
  }
}

export function buildFormStateFromDraft(
  draft: NormalizedEventPoolRegistrationPayload,
): RegistrationFormState {
  const alcoholComfort = Array.isArray(draft.alcoholComfort)
    ? draft.alcoholComfort[0]
    : undefined

  return {
    eventIntent: draft.eventIntent ?? [],
    preferredLanguages: draft.preferredLanguages ?? [],
    budgetRange: draft.budgetRange?.slice(0, 1),
    dietaryRestrictions: draft.dietaryRestrictions ?? [],
    barThemes: draft.barThemes ?? [],
    alcoholComfort,
    barBudgetRange: draft.barBudgetRange?.slice(0, 1),
    invitationCode: draft.invitationCode,
  }
}

export function resolveRegistrationStep(step: number): RegistrationStep {
  switch (step) {
    case 0:
    case 1:
    case 2:
    case 3:
      return step
    default:
      return 3
  }
}

/**
 * When advancing from `fromStep` to the next step, returns a user-facing toast if the step gate is not satisfied.
 */
export function getPoolRegistrationAdvanceBlocker(
  fromStep: RegistrationStep,
  opts: { hasBudgetSelection: boolean; hasIntentSelection: boolean },
): string | null {
  if (fromStep === 0) {
    return null
  }

  if (fromStep === 1) {
    return opts.hasBudgetSelection ? null : '先选一个预算区间'
  }

  if (fromStep === 2) {
    return opts.hasIntentSelection ? null : '至少选一个这次想收获的方向'
  }

  return null
}

export function getPoolRegistrationSubmitBlocker(opts: {
  hasBudgetSelection: boolean
  hasIntentSelection: boolean
}): string | null {
  if (opts.hasBudgetSelection && opts.hasIntentSelection) {
    return null
  }

  return '先完成预算和这次想收获的选择'
}
