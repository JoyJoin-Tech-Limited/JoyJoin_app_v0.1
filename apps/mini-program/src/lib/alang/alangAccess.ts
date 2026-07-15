import type { AuthUserResponse } from '@shared/api'

type AlangFeatureFlags = Pick<
  NonNullable<AuthUserResponse['features']>,
  'alangEnabled'
>

export type AlangAccessUser = {
  appMode?: AuthUserResponse['appMode']
  singleTestMode?: AuthUserResponse['singleTestMode']
  features?: AlangFeatureFlags
}

/** Product entry points are controlled only by the server-resolved feature flag. */
export function shouldShowAlangEntry(
  user: AlangAccessUser | null | undefined,
): boolean {
  return user?.features?.alangEnabled === true
}

/** Debug controls additionally require the server-provided single-test marker. */
export function shouldShowAlangDebugTools(
  user: AlangAccessUser | null | undefined,
): boolean {
  return shouldShowAlangEntry(user)
    && user?.singleTestMode === true
    && user?.appMode === 'test'
}
