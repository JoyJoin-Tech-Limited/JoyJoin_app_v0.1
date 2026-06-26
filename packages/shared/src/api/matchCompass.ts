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
  return api<MatchCompassResponse>({
    path: `/api/match-compass/${encodeURIComponent(poolId)}`,
  })
}

export function updateMatchCompassPreferences(
  api: ApiTransport,
  poolId: string,
  payload: UpdateMatchCompassPreferencesRequest
): Promise<MatchCompassResponse> {
  return api<MatchCompassResponse>({
    path: `/api/match-compass/${encodeURIComponent(poolId)}/preferences`,
    method: 'PATCH',
    data: payload,
  })
}
