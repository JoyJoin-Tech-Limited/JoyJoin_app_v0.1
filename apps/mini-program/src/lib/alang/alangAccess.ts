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

/** 入口三态。`unresolved` = 还没有权威答案（auth 未回来 / features 未携带），
 *  此时不能把它当成「功能已关闭」去渲染内测态。 */
export type StreetBlindBoxMode = 'live' | 'teaser' | 'unresolved'

export interface StreetBlindBoxAccessOptions {
  /** True while `useAuth` is still resolving and no settled user exists. */
  authPending?: boolean
}

/**
 * 解析入口模式，把「未加载」和「明确关闭」分开。
 *
 * 冷启动时 `/api/auth/user` 还没回来、或缓存里的 user 没带 `features`，
 * 旧实现会 fail-closed 渲染「内测中」，随后接口返回 alangEnabled=true 又切成
 * 正式卡片——看起来就像 UI 自己换了版本。`unresolved` 让调用方渲染占位/加载态
 * 并跳过埋点，而不是先闪一下内测卡。
 */
export function resolveStreetBlindBoxMode(
  user: AlangAccessUser | null | undefined,
  options: StreetBlindBoxAccessOptions = {},
): StreetBlindBoxMode {
  if (options.authPending) return 'unresolved'

  const flag = user?.features?.alangEnabled
  if (flag === true) return 'live'
  if (flag === false) return 'teaser'

  // 没有权威 flag：已确认的游客维持 fail-closed；已登录但 features 缺失的
  // 载荷（本地/旧版本缓存、部分响应）视为未知，不能断言功能关闭。
  return user ? 'unresolved' : 'teaser'
}

/** 街头盲盒正式功能是否上线（alangEnabled=true）。false = 预告态。
 *  Fail-closed：features 缺失/未加载一律视为预告态。
 *  注意：UI 模式请优先用 resolveStreetBlindBoxMode，避免把「未加载」当成关闭。 */
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
