import { useAuth } from './useAuth'

/**
 * Reads the AIGC_LABELS_ENABLED feature flag from the server-resolved auth user.
 * Default false.
 */
export function useAIGCLabelsEnabled(): boolean {
  const { user } = useAuth()
  return user?.features?.aigcLabelsEnabled ?? false
}
