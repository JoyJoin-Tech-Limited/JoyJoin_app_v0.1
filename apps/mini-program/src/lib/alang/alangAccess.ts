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

/** 街头盲盒入口恒可见，但有两种模式：alangEnabled=false 时是「内测中」预告
 *  态（预告卡 + 静态预告页），true 时是正式功能。模式判定用 isStreetBlindBoxLive。 */
export function shouldShowStreetBlindBoxEntry(): boolean {
  return true
}

/** 街头盲盒正式功能是否上线（alangEnabled=true）。false = 预告态。
 *  Fail-closed：features 缺失/未加载一律视为预告态。 */
export function isStreetBlindBoxLive(
  user: AlangAccessUser | null | undefined,
): boolean {
  return user?.features?.alangEnabled === true
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
