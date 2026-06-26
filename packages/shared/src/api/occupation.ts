import type { ApiTransport } from './core.js'

export interface OccupationSearchMatch {
  occupationId: string
  displayName: string
  industryId: string
  confidence: number
}

export interface OccupationSearchResponse {
  query: string
  matches: OccupationSearchMatch[]
  matchSource: 'exact' | 'embedding' | 'none'
}

export function searchOccupation(
  api: ApiTransport,
  query: string
): Promise<OccupationSearchResponse> {
  return api<OccupationSearchResponse>({
    path: '/api/occupation/search',
    method: 'POST',
    data: { query },
  })
}
