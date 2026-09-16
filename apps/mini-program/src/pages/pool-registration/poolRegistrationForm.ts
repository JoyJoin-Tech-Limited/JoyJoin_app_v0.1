import type {
  EventPoolRegistrationPayload,
  NormalizedEventPoolRegistrationPayload,
} from '@shared/api'
import { normalizeBudgetTierIds } from '@shared/budgetTiers'
import type { PoolEventType } from './flowConfig'

// Phase 2 (registration-ceremony-spec-20260817 §6): the all-optional details
// step folded into the intent step, so the flow is 0 brief / 1 budget /
// 2 intent+details.
export type RegistrationStep = 0 | 1 | 2

export interface RegistrationFormState {
  eventIntent: string[]
  preferredLanguages: string[]
  budgetRange?: string[]
  barThemes: string[]
  alcoholComfort?: string
  barBudgetRange?: string[]
  invitationCode?: string
}

export const INITIAL_FORM_STATE: RegistrationFormState = {
  eventIntent: [],
  preferredLanguages: [],
  barThemes: [],
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function findLabels(values: string[], options: { value: string; label: string }[]): string[] {
  return options.filter((option) => values.includes(option.value)).map((option) => option.label)
}

export function hasAnyDetailSelection(
  formState: RegistrationFormState,
  eventType: PoolEventType,
): boolean {
  const hasLanguage = formState.preferredLanguages.length > 0
  if (eventType === '酒局') {
    return hasLanguage || formState.barThemes.length > 0 || !!formState.alcoholComfort
  }
  return hasLanguage
}

/**
 * Canonicalize stored budget values to registry tier ids
 * (`packages/shared/src/budgetTiers.ts`).
 *
 * `budgetRange` is always the dining namespace and `barBudgetRange` the drinks
 * namespace — the columns are namespaced by field, not by pool type. Legacy
 * labels from drafts persisted before the tier cutover map onto ids so a
 * restored selection still matches the id-valued options.
 *
 * Values with no registry counterpart are kept verbatim instead of dropped:
 * the server tolerates legacy/unknown values on write, and silently discarding
 * a user's selection would be the worse failure. The blind-box `100-200` is
 * deliberately left unmapped — that is open decision B3.
 */
function canonicalizeTierValues(
  raw: string[] | undefined,
  eventType: PoolEventType,
): string[] | undefined {
  if (!raw || raw.length === 0) {
    return raw
  }

  const { ids, unknown } = normalizeBudgetTierIds(raw, { eventType })
  return [...ids, ...unknown]
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
          barBudgetRange: canonicalizeTierValues(formState.barBudgetRange, '酒局'),
          barThemes: formState.barThemes,
          alcoholComfort: formState.alcoholComfort ? [formState.alcoholComfort] : undefined,
        }
      : {
          budgetRange: canonicalizeTierValues(formState.budgetRange, '饭局'),
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
    budgetRange: canonicalizeTierValues(draft.budgetRange ?? undefined, '饭局')?.slice(0, 1),
    barThemes: draft.barThemes ?? [],
    alcoholComfort,
    barBudgetRange: canonicalizeTierValues(draft.barBudgetRange ?? undefined, '酒局')?.slice(0, 1),
    invitationCode: draft.invitationCode,
  }
}

export function resolveRegistrationStep(step: number): RegistrationStep {
  switch (step) {
    case 0:
    case 1:
    case 2:
      return step
    default:
      // Phase 2 clamp: legacy payment-return drafts may still carry
      // resumeStep = 3 (the removed details step) — land them on the merged
      // intent+details step instead.
      return 2
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
