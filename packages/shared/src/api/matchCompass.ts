import type { ApiTransport } from './core.js'

export type MatchCompassTemperatureBand = 'cold' | 'mild' | 'warm' | 'fire'
export type MatchCompassGenderComposition = 'mixed' | 'female_only' | 'no_pref'

export interface MatchCompassResponse {
  strictness: number
  preferredDistricts: string[] | null
  genderComposition: MatchCompassGenderComposition | null
  acceptPairs: boolean | null
  ageMatchPreference: string | null
  tableVibePreference: string | null
  temperatureBand: MatchCompassTemperatureBand
  temperatureScore: number
  eligibleUserCount: number
  isLocked: boolean
  lockAt: string | null
  primaryArchetype: string | null
}

export interface UpdateMatchCompassPreferencesRequest {
  strictness?: number
  preferredDistricts?: string[] | null
  genderComposition?: MatchCompassGenderComposition | null
  acceptPairs?: boolean | null
  ageMatchPreference?: string | null
  tableVibePreference?: string | null
}

export function getMatchCompass(
  api: ApiTransport,
  poolId: string
): Promise<MatchCompassResponse> {
  return api<MatchCompassServerResponse>({
    path: `/api/event-pools/${encodeURIComponent(poolId)}/match-compass`,
  }).then(normalizeMatchCompassResponse)
}

export function updateMatchCompassPreferences(
  api: ApiTransport,
  registrationId: string,
  payload: UpdateMatchCompassPreferencesRequest
): Promise<unknown> {
  return api({
    path: `/api/event-pool-registrations/${encodeURIComponent(registrationId)}/preferences`,
    method: 'PATCH',
    data: payload,
  })
}

type MatchCompassServerResponse =
  | MatchCompassResponse
  | NestedMatchCompassServerResponse

interface NestedMatchCompassServerResponse {
  matchCompass?: Partial<Pick<
    MatchCompassResponse,
    | 'strictness'
    | 'preferredDistricts'
    | 'genderComposition'
    | 'acceptPairs'
    | 'ageMatchPreference'
    | 'tableVibePreference'
  >>
  poolComposition?: {
    temperature?: { level?: MatchCompassTemperatureBand }
    eligibleCount?: number
  }
  lockInfo?: {
    locked?: boolean
    lockAt?: string | null
  }
}

const DEFAULT_TEMPERATURE_SCORE: Record<MatchCompassTemperatureBand, number> = {
  cold: 40,
  mild: 60,
  warm: 75,
  fire: 90,
}

function normalizeMatchCompassResponse(raw: MatchCompassServerResponse): MatchCompassResponse {
  if ('strictness' in raw && typeof raw.strictness === 'number') {
    return {
      ...raw,
      lockAt: raw.lockAt ?? null,
    }
  }

  const nested = raw as NestedMatchCompassServerResponse
  const compass = nested.matchCompass ?? {}
  const temperatureBand: MatchCompassTemperatureBand = nested.poolComposition?.temperature?.level ?? 'mild'

  return {
    strictness: compass.strictness ?? 50,
    preferredDistricts: compass.preferredDistricts ?? null,
    genderComposition: compass.genderComposition ?? null,
    acceptPairs: compass.acceptPairs ?? null,
    ageMatchPreference: compass.ageMatchPreference ?? null,
    tableVibePreference: compass.tableVibePreference ?? null,
    temperatureBand,
    temperatureScore: DEFAULT_TEMPERATURE_SCORE[temperatureBand],
    eligibleUserCount: nested.poolComposition?.eligibleCount ?? 0,
    isLocked: nested.lockInfo?.locked ?? false,
    lockAt: nested.lockInfo?.lockAt ?? null,
    primaryArchetype: null,
  }
}
