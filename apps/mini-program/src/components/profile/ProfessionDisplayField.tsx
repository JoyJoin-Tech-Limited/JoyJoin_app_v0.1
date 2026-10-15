import { useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api/api'
import {
  createLadderStateFromClassification,
  resolveVisibleLadderRows,
  type LadderRowDescriptor,
  type LadderValue,
  type ProfessionClassificationLike,
} from '../../lib/onboarding/professionLadderReducer'
import { resolveArchetypeTraitTags } from '../../lib/onboarding/professionTraitTags'
import './ProfessionDisplayField.scss'

/** Empty-state value placeholder — the whole field taps through to the overlay. */
export const PROFESSION_DISPLAY_EMPTY_VALUE = '选填（点击告诉悦仔）'
/**
 * R7-lite recovery nudge. Names the real cost of leaving 职业 blank (a less
 * fitting table) without promising a matching outcome — mirrors the overlay's
 * skip-honesty posture.
 */
export const PROFESSION_DISPLAY_EMPTY_HINT = '补上职业，下一局的同桌更好挑'

/**
 * Server contract for `GET /api/inference/industry-cohort-count`.
 * Session-scoped (the user's own city + industry category); `null` whenever
 * the cohort is below the server's min-count floor or unavailable.
 */
export interface IndustryCohortCountResponse {
  count: number | null
}

export const INDUSTRY_COHORT_QUERY_KEY = ['mini-program', 'industry-cohort-count'] as const
export const INDUSTRY_COHORT_STALE_TIME_MS = 10 * 60 * 1000
/** Below this the server returns null; the client guard keeps the promise honest. */
export const INDUSTRY_COHORT_MIN_COUNT = 10

/**
 * Quiet same-city cohort line. Exported as a pure builder so the banned-vocab
 * suite can assert its cleanliness without rendering.
 */
export function buildIndustryCohortLine(count: number, categoryLabel: string): string {
  return `同城还有 ${count} 位${categoryLabel}方向的人`
}

export interface ProfessionDisplayFieldProps {
  rawValue?: string
  /**
   * Persisted three-tier classification (structural subset of the overlay's
   * `ProfessionClassificationData`). Typed against the reducer's own input
   * interface so this read-only display never depends on overlay internals.
   */
  classification?: ProfessionClassificationLike | null
  /** The user's archetype id — drives the deterministic 特质 pill row. */
  archetypeId?: string
  /** The user's 现居城市 (from auth) — gates the session-scoped 同城 cohort line. */
  userCity?: string
  onEdit?: () => void
  className?: string
}

/**
 * ProfessionDisplayField — the persistent 职业画像 card (read-only).
 *
 * Filled: raw profession text + 「修改 ›」, the 3-row 职业坐标阶梯
 * （类别 › 细分 › 角色, same display semantics as the overlay: canonical
 * `standardizedOccupationId` display name first, taxonomy niche as the
 * display-only fallback, AC-22 细分≈角色 merge), a deterministic 特质 pill row
 * (archetype registry traits), and a quiet 同城 cohort line.
 *
 * Empty: the same tap-through field with the recovery nudge.
 *
 * Correction lives in the overlay (opened via `onEdit`) — this surface renders
 * exclusively, with no per-row affordances. The cohort line is fail-open: it
 * renders only for a real count ≥ 10 and simply does not exist otherwise.
 */
export default function ProfessionDisplayField({
  rawValue,
  classification,
  archetypeId,
  userCity,
  onEdit,
  className = '',
}: ProfessionDisplayFieldProps) {
  const hasValue = Boolean(rawValue && rawValue.trim() !== '')

  // Read-only replay of the overlay's visible ladder rows. Unresolved rows are
  // skipped rather than shown as 待补充: this surface has no correction tray, so
  // a dead-end placeholder would be noise. The whole card still taps through to
  // the overlay when the user wants to complete them.
  const ladderRows = useMemo(() => {
    const state = createLadderStateFromClassification(classification)
    return resolveVisibleLadderRows(state).filter(
      (row): row is LadderRowDescriptor & { value: LadderValue } => row.value !== null,
    )
  }, [classification])

  // Same deterministic source as the overlay's 特质 group: the archetype
  // registry's narrative traits via resolveArchetypeTraitTags (server traits
  // are only available on the classify response, not on this surface).
  // Unknown/missing archetype → [] → the row renders nothing.
  const traitTags = useMemo(
    () => (hasValue ? resolveArchetypeTraitTags(null, archetypeId) : []),
    [hasValue, archetypeId],
  )

  const categoryLabel = classification?.industryCategoryLabel ?? null
  // Session-scoped endpoint: only worth asking when the card can actually make
  // the promise (profession filled + city + category known).
  const hasCohortInputs =
    hasValue && Boolean(userCity?.trim()) && Boolean(classification?.industryCategory)

  const { data: cohortCount } = useQuery<number | null>({
    queryKey: [
      ...INDUSTRY_COHORT_QUERY_KEY,
      userCity ?? '',
      classification?.industryCategory ?? '',
    ],
    queryFn: async () => {
      // Fail-open: an undeployed/unavailable endpoint (local dev) or any
      // failure collapses to null — the line simply does not exist.
      try {
        const data = await apiRequest<IndustryCohortCountResponse>({
          path: '/api/inference/industry-cohort-count',
        })
        // Defensive runtime guard — never trust the payload shape.
        return typeof data?.count === 'number' ? data.count : null
      } catch {
        return null
      }
    },
    enabled: hasCohortInputs,
    staleTime: INDUSTRY_COHORT_STALE_TIME_MS,
    retry: false,
  })

  const cohortLine =
    hasCohortInputs &&
    typeof cohortCount === 'number' &&
    cohortCount >= INDUSTRY_COHORT_MIN_COUNT &&
    categoryLabel
      ? buildIndustryCohortLine(cohortCount, categoryLabel)
      : null

  return (
    <View
      className={`profession-display-field ${className}`}
      onClick={onEdit}
      hoverClass={onEdit ? 'profession-display-field--active' : undefined}
      hoverStartTime={0}
      hoverStayTime={100}
      role={onEdit ? 'button' : undefined}
      aria-label={onEdit ? (hasValue ? '职业画像，点击修改' : '职业身份未填写，点击补充') : undefined}
    >
      <View className='profession-display-field__row'>
        <Text className={`profession-display-field__value ${hasValue ? 'profession-display-field__value--filled' : ''}`}>
          {hasValue ? rawValue : PROFESSION_DISPLAY_EMPTY_VALUE}
        </Text>
        {hasValue && (
          <Text className='profession-display-field__edit'>修改 ›</Text>
        )}
      </View>

      {hasValue && ladderRows.length > 0 && (
        <View className='profession-display-field__ladder'>
          {ladderRows.map((row) => (
            <View key={row.tier} className='profession-display-field__ladder-row'>
              <Text className='profession-display-field__ladder-label'>{row.label}</Text>
              <View className='profession-display-field__ladder-pill'>
                <Text className='profession-display-field__ladder-text'>{row.value.label}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {traitTags.length > 0 && (
        <View className='profession-display-field__trait-row'>
          {traitTags.map((trait) => (
            <View key={trait} className='profession-display-field__trait-pill'>
              <View className='profession-display-field__trait-dot' aria-hidden='true' />
              <Text className='profession-display-field__trait-text'>{trait}</Text>
            </View>
          ))}
        </View>
      )}

      {cohortLine && (
        <Text className='profession-display-field__cohort-line'>{cohortLine}</Text>
      )}

      {!hasValue && (
        <Text className='profession-display-field__hint'>
          {PROFESSION_DISPLAY_EMPTY_HINT}
        </Text>
      )}
    </View>
  )
}
