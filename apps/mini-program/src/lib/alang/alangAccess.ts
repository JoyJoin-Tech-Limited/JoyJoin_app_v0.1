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

/** 街头盲盒是正式、默认开放的产品；内部 alang 路径不代表旧原型门禁。 */
export function shouldShowStreetBlindBoxEntry(): boolean {
  return true
}

/** Legacy Alang prototype entry points remain controlled by the old flag. */
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
