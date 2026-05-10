import type {
  EventPoolRegistrationPayload,
  NormalizedEventPoolRegistrationPayload,
} from '@shared/api'
import type { PoolEventType } from './flowConfig'

export type RegistrationStep = 0 | 1 | 2 | 3

export interface RegistrationFormState {
  eventIntent: string[]
  preferredLanguages: string[]
  budgetRange?: string[]
  dietaryRestrictions: string[]
  barThemes: string[]
  alcoholComfort?: string
  barBudgetRange?: string[]
}

export const INITIAL_FORM_STATE: RegistrationFormState = {
  eventIntent: [],
  preferredLanguages: [],
  dietaryRestrictions: [],
  barThemes: [],
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function findLabels(values: string[], options: { value: string; label: string }[]): string[] {
  return options.filter((option) => values.includes(option.value)).map((option) => option.label)
}

export function buildRegistrationPayload(
  formState: RegistrationFormState,
  eventType: PoolEventType,
): EventPoolRegistrationPayload {
  return {
    eventIntent: formState.eventIntent,
    preferredLanguages: formState.preferredLanguages,
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
