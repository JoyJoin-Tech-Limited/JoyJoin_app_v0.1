import { useAuth } from './useAuth'

/**
 * Reads the AIGC_LABELS_ENABLED feature flag from the server-resolved auth user.
 *
 * The server resolves this flag with a `true` default (compliance posture since
 * 2026-10-22), so `features.aigcLabelsEnabled` is normally `true`. The local
 * `false` fallback is deliberate and does NOT describe the product default: it
 * only applies when the auth payload predates the field or `/api/auth/user` has
 * not resolved yet, and it must never override an operator's kill switch with a
 * label the server did not authorise.
 */
export function useAIGCLabelsEnabled(): boolean {
  const { user } = useAuth()
  return user?.features?.aigcLabelsEnabled ?? false
}
