import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { AuthUser } from '../../hooks/useAuth'

/**
 * Resolve the user-facing mascot display name.
 *
 * Falls back to the shared default when auth is not yet loaded
 * (e.g., during initial app launch or logout state).
 */
export function getMascotDisplayName(user?: AuthUser | null): string {
  return user?.mascotDisplayName?.trim() || DEFAULT_MASCOT_DISPLAY_NAME
}
