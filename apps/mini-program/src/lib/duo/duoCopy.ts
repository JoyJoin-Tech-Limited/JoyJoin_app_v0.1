import type { DuoRole, DuoStatusState } from '../api/duo'

/**
 * 双人成行 waiting 文案唯一权威（S3 / PR-2，合同 duo-s3-waiting-copy-direction）。
 *
 * Every user-facing duo waiting string lives HERE as a constant — the duo card
 * (duo-status path), the S2 guest surface (公开码查询路径), and any future duo
 * surface must interpolate these templates instead of inlining strings
 * (Maintainability pillar; S2 AC-9 locks copy ownership to this module).
 *
 * 逐字文案（D-1，逐字相等由单测断言，改一个字都要过合同）:
 *   D1       已发给 {name}，等 TA 报名        — inviter × pendingSide=invitee
 *   D2       {name} 已经报名了，就等你         — 「就等你」: 对方已报名 × 我未报名
 *   D3       你和 {name} 约好了，等 TA 报名    — invitee × pendingSide=inviter
 *   guest L1 {name} 这局给你留了个位置         — 报名前 invitee（inviterRegistered 假/缺失）
 *   guest L2 报名后你们会被排进同一桌          — guest 副行，恒为此句
 *
 * 「就等你」门槛（AC-3）: 仅在 viewer 本人是未报名方时可渲染 ——
 *   duo-status 路径: viewerRole === pendingSide（inviter × inviter）
 *   lookup 路径:     inviterRegistered === true
 *   任一字段缺失/未知一律回退到不带「就等你」的版本（D1 / guest 默认 L1）。
 *
 * 方向优先级（D-6，数据打架时）: bound > D3 > guest/D2 > D1 —— 宁静勿错。
 */

/** D-6: 名字缺失三向统一「朋友」兜底。 */
export const DUO_NAME_FALLBACK = '朋友'
/** D-3: 名字 >6 字（按 code point）截断为前 6 字 +「…」。 */
export const DUO_NAME_MAX_CODE_POINTS = 6
export const DUO_NAME_ELLIPSIS = '…'

// D-1 逐字模板（{name} 为插值占位符，渲染时以 truncateDuoName 结果替换）。
export const DUO_WAITING_COPY_SENT_FRIEND = '已发给 {name}，等 TA 报名'
export const DUO_WAITING_COPY_ONLY_YOU = '{name} 已经报名了，就等你'
export const DUO_WAITING_COPY_PROMISED = '你和 {name} 约好了，等 TA 报名'
export const DUO_GUEST_COPY_RESERVED_L1 = '{name} 这局给你留了个位置'
export const DUO_GUEST_COPY_SHARED_TABLE_L2 = '报名后你们会被排进同一桌'

const NAME_TOKEN = '{name}'

/** duo-status 路径的三向标识。 */
export type DuoWaitingDirection =
  | 'sentFriend' // D1 — 已发给对方，等 TA 报名（唯一带「再喊一次」）
  | 'onlyYou' // D2 — 对方已经报名了，就等你
  | 'promised' // D3 — 你和对方约好了，等 TA 报名

/** lookup（guest）路径的两向标识。 */
export type DuoGuestCopyVariant =
  | 'reserved' // guest L1 — 对方这局给你留了个位置
  | 'onlyYou' // D2 — 对方已经报名了，就等你

export interface DuoWaitingCopyResolved {
  direction: DuoWaitingDirection
  text: string
  /** AC-8: 「再喊一次」仅 D1 方向渲染（对方在等我时再分享没有意义）。 */
  showAgain: boolean
}

/**
 * D-3 昵称截断（emoji 安全）。
 *
 * 按 code point 计（`Array.from`，禁止 `.slice()` 按 UTF-16 切——会把代理对
 * 切成孤立半 surrogate）。>6 字 → 前 6 字 +「…」；空/缺省/纯空白 →「朋友」。
 */
export function truncateDuoName(name?: string | null): string {
  if (!name) return DUO_NAME_FALLBACK
  const trimmed = name.trim()
  if (trimmed === '') return DUO_NAME_FALLBACK
  const chars = Array.from(trimmed)
  if (chars.length <= DUO_NAME_MAX_CODE_POINTS) return trimmed
  return `${chars.slice(0, DUO_NAME_MAX_CODE_POINTS).join('')}${DUO_NAME_ELLIPSIS}`
}

/** {name} 插值（全部出现都替换；split/join 兼容老 JSCore，不依赖 replaceAll）。 */
export function interpolateDuoName(template: string, name?: string | null): string {
  return template.split(NAME_TOKEN).join(truncateDuoName(name))
}

/**
 * duo-status 路径矩阵（AC-2/AC-3）—— viewerRole × pendingSide:
 *   inviter × invitee → D1（等对方报名，带「再喊一次」）
 *   inviter × inviter → D2（对方已报名，就等你）
 *   invitee × inviter → D3（你和对方约好了，等 TA 报名）
 *   invitee × invitee → 不可达（use 行只在报名时写入），防御性回退 D1
 *   任一字段缺失/未知 → D1（旧服务端/字段未下传时绝不渲染「就等你」）
 */
export function resolveDuoStatusWaitingDirection(input: {
  viewerRole?: DuoRole | null
  pendingSide?: DuoRole | null
}): DuoWaitingDirection {
  if (input.viewerRole === 'inviter' && input.pendingSide === 'inviter') return 'onlyYou'
  if (input.viewerRole === 'invitee' && input.pendingSide === 'inviter') return 'promised'
  return 'sentFriend'
}

/** 方向 → 逐字文案（{name} 经 truncateDuoName 截断插值）。 */
export function getDuoWaitingCopy(
  direction: DuoWaitingDirection,
  friendDisplayName?: string | null,
): string {
  switch (direction) {
    case 'onlyYou':
      return interpolateDuoName(DUO_WAITING_COPY_ONLY_YOU, friendDisplayName)
    case 'promised':
      return interpolateDuoName(DUO_WAITING_COPY_PROMISED, friendDisplayName)
    default:
      return interpolateDuoName(DUO_WAITING_COPY_SENT_FRIEND, friendDisplayName)
  }
}

/** duo-status 路径一站式解析（卡片用）: 方向 + 文案 +「再喊一次」门控。 */
export function resolveDuoWaitingCopy(input: {
  viewerRole?: DuoRole | null
  pendingSide?: DuoRole | null
  friendDisplayName?: string | null
}): DuoWaitingCopyResolved {
  const direction = resolveDuoStatusWaitingDirection(input)
  return {
    direction,
    text: getDuoWaitingCopy(direction, input.friendDisplayName),
    showAgain: direction === 'sentFriend',
  }
}

/**
 * lookup 路径矩阵（AC-2/AC-3，guest 表面）:
 *   inviterRegistered === true → D2（对方已经报名了，就等你）
 *   false / 缺失               → guest L1（对方这局给你留了个位置）
 */
export function resolveGuestCopyVariant(input: {
  inviterRegistered?: boolean | null
}): DuoGuestCopyVariant {
  return input.inviterRegistered === true ? 'onlyYou' : 'reserved'
}

/** guest 表面两行文案（L2 恒为「报名后你们会被排进同一桌」）。 */
export function getGuestDuoCopy(
  variant: DuoGuestCopyVariant,
  inviterDisplayName?: string | null,
): { line1: string; line2: string } {
  const template = variant === 'onlyYou' ? DUO_WAITING_COPY_ONLY_YOU : DUO_GUEST_COPY_RESERVED_L1
  return {
    line1: interpolateDuoName(template, inviterDisplayName),
    line2: DUO_GUEST_COPY_SHARED_TABLE_L2,
  }
}

/**
 * D-6 方向仲裁（数据打架时的优先级）: bound > D3 > guest/D2 > D1，宁静勿错。
 *
 * 卡片（duo-status 路径）用 serverState + 两字段调用，guestArrival 缺省即可；
 * S2 guest 表面（公开码查询路径）用 guestArrival: true + inviterRegistered
 * 调用。两路信号冲突时（例如被邀请人同时持有自己的邀请码）按上述优先级裁定。
 */
export type DuoWaitingPresentation =
  | { kind: 'bound' }
  | { kind: 'waiting'; direction: DuoWaitingDirection; showAgain: boolean }
  | { kind: 'guest'; variant: DuoGuestCopyVariant }
  | { kind: 'none' }

export function resolveDuoWaitingPresentation(input: {
  serverState?: DuoStatusState | null
  viewerRole?: DuoRole | null
  pendingSide?: DuoRole | null
  /** true = 报名前 invitee 的 guest 表面（lookup 路径参与仲裁）。 */
  guestArrival?: boolean
  inviterRegistered?: boolean | null
}): DuoWaitingPresentation {
  // bound 压过一切 waiting/guest 信号。
  if (input.serverState === 'bound') return { kind: 'bound' }

  if (input.serverState === 'waiting') {
    const direction = resolveDuoStatusWaitingDirection(input)
    // D3 是 waiting 内最高优先级，压过任何 guest 信号。
    if (direction === 'promised') return { kind: 'waiting', direction, showAgain: false }
    // duo-status 路径的「就等你」（D2）。
    if (direction === 'onlyYou') return { kind: 'waiting', direction, showAgain: false }
    // D1 层: 显式 inviter×invitee、防御性 invitee×invitee 都落在这里；仅当
    // 方向字段齐备且 guest 路径给出正向「就等你」信号时，guest/D2 压过 D1。
    // 字段缺失/未知一律回退 D1（AC-3）——缺失不是打架，不引入 guest 信号。
    const directionKnown = isDuoRole(input.viewerRole) && isDuoRole(input.pendingSide)
    if (directionKnown && input.guestArrival && input.inviterRegistered === true) {
      return { kind: 'guest', variant: 'onlyYou' }
    }
    return { kind: 'waiting', direction: 'sentFriend', showAgain: true }
  }

  if (input.guestArrival) {
    return { kind: 'guest', variant: resolveGuestCopyVariant(input) }
  }

  return { kind: 'none' }
}

function isDuoRole(value: unknown): value is DuoRole {
  return value === 'inviter' || value === 'invitee'
}
