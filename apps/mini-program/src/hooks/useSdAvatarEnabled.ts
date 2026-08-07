import { useAuth } from './useAuth'

/**
 * Reads the SD_AVATAR_ENABLED feature flag from the server-resolved auth user.
 * Default false. Gates the SD pixel avatar sprites (ArchetypeHead
 * variant='sd') in 40rpx+ roster/list slots.
 */
export function useSdAvatarEnabled(): boolean {
  const { user } = useAuth()
  return user?.features?.sdAvatarEnabled ?? false
}
