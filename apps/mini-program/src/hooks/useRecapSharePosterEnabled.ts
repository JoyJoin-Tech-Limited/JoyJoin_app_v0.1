import { useAuth } from './useAuth'

/**
 * Reads the RECAP_SHARE_POSTER_ENABLED feature flag from the server-resolved
 * auth user (2026-10-20, spec 规格一). Default false (ships dark): flag off =
 * zero share surface on the icebreaker recap (byte-identical legacy panel).
 */
export function useRecapSharePosterEnabled(): boolean {
  const { user } = useAuth()
  return user?.features?.recapSharePosterEnabled ?? false
}
