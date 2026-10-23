import { describe, expect, it } from 'vitest'
import {
  DUO_GUEST_COPY_RESERVED_L1,
  DUO_GUEST_COPY_SHARED_TABLE_L2,
  DUO_NAME_FALLBACK,
  DUO_SOLO_CONFIRM_BODY,
  DUO_SOLO_CONFIRM_PRIMARY,
  DUO_SOLO_CONFIRM_SECONDARY,
  DUO_SOLO_CONFIRM_TITLE,
  DUO_WAITING_COPY_ONLY_YOU,
  DUO_WAITING_COPY_PROMISED,
  DUO_WAITING_COPY_SENT_FRIEND,
  getDuoSoloConfirmTitle,
  getDuoWaitingCopy,
  getGuestDuoCopy,
  interpolateDuoName,
  resolveDuoStatusWaitingDirection,
  resolveDuoWaitingCopy,
  resolveDuoWaitingPresentation,
  resolveGuestCopyVariant,
  truncateDuoName,
} from '../duoCopy'

/**
 * 双人成行 S3 waiting 文案矩阵（合同 duo-s3-waiting-copy-direction）。
 *
 * Covers: D-1 逐字文案；AC-2 viewer 相对四方向 + 不可达组合防御 + 字段缺失回退；
 * AC-3「就等你」门槛（viewerRole === pendingSide / inviterRegistered === true）；
 * AC-8「再喊一次」仅 D1；D-3 code-point 截断（emoji 安全）；D-4 合规扫描；
 * D-6 兜底与优先级（bound > D3 > guest/D2 > D1）。
 *
 * Emoji literals are built via String.fromCodePoint — the repo guardrail
 * scanner rejects inline emoji in any apps/mini-program TS/TSX source.
 */

const fromCodePoints = (...codePoints: number[]) => String.fromCodePoint(...codePoints)
// 7 single-code-point emoji (each is a surrogate pair in UTF-16).
const SEVEN_EMOJI_NAME = fromCodePoints(0x1F600, 0x1F603, 0x1F604, 0x1F601, 0x1F606, 0x1F605, 0x1F923)
const SIX_EMOJI_TRUNCATED = fromCodePoints(0x1F600, 0x1F603, 0x1F604, 0x1F601, 0x1F606, 0x1F605) + '…'

describe('truncateDuoName (D-3)', () => {
  it('truncates a 7-char Chinese name to 6 code points + …', () => {
    expect(truncateDuoName('一二三四五六七')).toBe('一二三四五六…')
  })

  it('keeps an exactly-6-char name verbatim (no …)', () => {
    expect(truncateDuoName('一二三四五六')).toBe('一二三四五六')
  })

  it('keeps short names verbatim', () => {
    expect(truncateDuoName('阿明')).toBe('阿明')
  })

  it('truncates a 7-emoji name to 6 whole code points + … (no lone surrogate halves)', () => {
    const result = truncateDuoName(SEVEN_EMOJI_NAME)
    expect(result).toBe(SIX_EMOJI_TRUNCATED)
    // 6 emoji (2 UTF-16 units each) + 1 ellipsis = 13 UTF-16 units, and every
    // code point is intact — a UTF-16 .slice() would have split a pair.
    expect(result.length).toBe(13)
    expect(Array.from(result).length).toBe(7)
  })

  it('falls back to 朋友 for empty / blank / missing names (D-6)', () => {
    expect(truncateDuoName('')).toBe(DUO_NAME_FALLBACK)
    expect(truncateDuoName('   ')).toBe(DUO_NAME_FALLBACK)
    expect(truncateDuoName(null)).toBe(DUO_NAME_FALLBACK)
    expect(truncateDuoName(undefined)).toBe(DUO_NAME_FALLBACK)
    expect(DUO_NAME_FALLBACK).toBe('朋友')
  })
})

describe('interpolateDuoName', () => {
  it('replaces the {name} token with the truncated name', () => {
    expect(interpolateDuoName(DUO_WAITING_COPY_SENT_FRIEND, '小明')).toBe('已发给 小明，等 TA 报名')
  })

  it('falls back to 朋友 when the name is missing', () => {
    expect(interpolateDuoName(DUO_WAITING_COPY_SENT_FRIEND, undefined)).toBe('已发给 朋友，等 TA 报名')
  })
})

describe('D-1 逐字文案（模板常量逐字相等）', () => {
  it('locks the three waiting templates + guest L1/L2 verbatim', () => {
    expect(DUO_WAITING_COPY_SENT_FRIEND).toBe('已发给 {name}，等 TA 报名')
    expect(DUO_WAITING_COPY_ONLY_YOU).toBe('{name} 已经报名了，就等你')
    expect(DUO_WAITING_COPY_PROMISED).toBe('你和 {name} 约好了，等 TA 报名')
    expect(DUO_GUEST_COPY_RESERVED_L1).toBe('{name} 这局给你留了个位置')
    expect(DUO_GUEST_COPY_SHARED_TABLE_L2).toBe('报名后你们会被排进同一桌')
  })

  it('renders the three waiting copies verbatim with a name (AC-2)', () => {
    expect(getDuoWaitingCopy('sentFriend', '小明')).toBe('已发给 小明，等 TA 报名')
    expect(getDuoWaitingCopy('onlyYou', '小明')).toBe('小明 已经报名了，就等你')
    expect(getDuoWaitingCopy('promised', '小明')).toBe('你和 小明 约好了，等 TA 报名')
  })

  it('guest copy: L1 varies by variant, L2 is always the shared-table line (AC-2)', () => {
    expect(getGuestDuoCopy('reserved', '小明')).toEqual({
      line1: '小明 这局给你留了个位置',
      line2: '报名后你们会被排进同一桌',
    })
    expect(getGuestDuoCopy('onlyYou', '小明')).toEqual({
      line1: '小明 已经报名了，就等你',
      line2: '报名后你们会被排进同一桌',
    })
  })
})

describe('resolveDuoStatusWaitingDirection — viewer 相对矩阵 (AC-2/AC-3)', () => {
  it('inviter × pendingSide=invitee → D1（等对方报名）', () => {
    expect(resolveDuoStatusWaitingDirection({ viewerRole: 'inviter', pendingSide: 'invitee' })).toBe('sentFriend')
  })

  it('inviter × pendingSide=inviter → D2（就等你：viewer 本人是未报名方）', () => {
    expect(resolveDuoStatusWaitingDirection({ viewerRole: 'inviter', pendingSide: 'inviter' })).toBe('onlyYou')
  })

  it('invitee × pendingSide=inviter → D3（你和对方约好了，等 TA 报名）', () => {
    expect(resolveDuoStatusWaitingDirection({ viewerRole: 'invitee', pendingSide: 'inviter' })).toBe('promised')
  })

  it('invitee × pendingSide=invitee → 不可达组合，防御性回退 D1（AC-2）', () => {
    expect(resolveDuoStatusWaitingDirection({ viewerRole: 'invitee', pendingSide: 'invitee' })).toBe('sentFriend')
  })

  it('任一字段缺失/未知一律回退 D1（AC-3，旧服务端兼容）', () => {
    expect(resolveDuoStatusWaitingDirection({})).toBe('sentFriend')
    expect(resolveDuoStatusWaitingDirection({ viewerRole: 'inviter' })).toBe('sentFriend')
    expect(resolveDuoStatusWaitingDirection({ pendingSide: 'invitee' })).toBe('sentFriend')
    expect(resolveDuoStatusWaitingDirection({ viewerRole: null, pendingSide: null })).toBe('sentFriend')
    expect(
      resolveDuoStatusWaitingDirection({
        viewerRole: 'stranger' as never,
        pendingSide: 'nobody' as never,
      }),
    ).toBe('sentFriend')
  })
})

describe('resolveDuoWaitingCopy — 方向 + 文案 +「再喊一次」门控 (AC-8)', () => {
  it('D1 是唯一带「再喊一次」的方向', () => {
    const resolved = resolveDuoWaitingCopy({
      viewerRole: 'inviter',
      pendingSide: 'invitee',
      friendDisplayName: '小明',
    })
    expect(resolved).toEqual({
      direction: 'sentFriend',
      text: '已发给 小明，等 TA 报名',
      showAgain: true,
    })
  })

  it('D2/D3 不带「再喊一次」（对方在等我时再分享没有意义）', () => {
    expect(
      resolveDuoWaitingCopy({ viewerRole: 'inviter', pendingSide: 'inviter', friendDisplayName: '小明' })
        .showAgain,
    ).toBe(false)
    expect(
      resolveDuoWaitingCopy({ viewerRole: 'invitee', pendingSide: 'inviter', friendDisplayName: '小明' })
        .showAgain,
    ).toBe(false)
  })

  it('名字缺失三向统一「朋友」兜底（D-6）', () => {
    expect(resolveDuoWaitingCopy({ viewerRole: 'inviter', pendingSide: 'invitee' }).text).toBe(
      '已发给 朋友，等 TA 报名',
    )
    expect(resolveDuoWaitingCopy({ viewerRole: 'inviter', pendingSide: 'inviter' }).text).toBe(
      '朋友 已经报名了，就等你',
    )
    expect(resolveDuoWaitingCopy({ viewerRole: 'invitee', pendingSide: 'inviter' }).text).toBe(
      '你和 朋友 约好了，等 TA 报名',
    )
  })

  it('长名经 truncateDuoName 截断后插值', () => {
    expect(
      resolveDuoWaitingCopy({
        viewerRole: 'inviter',
        pendingSide: 'inviter',
        friendDisplayName: '一二三四五六七',
      }).text,
    ).toBe('一二三四五六… 已经报名了，就等你')
  })
})

describe('resolveGuestCopyVariant — lookup 路径 (AC-2/AC-3)', () => {
  it('inviterRegistered === true → D2（就等你）', () => {
    expect(resolveGuestCopyVariant({ inviterRegistered: true })).toBe('onlyYou')
  })

  it('inviterRegistered false/缺失 → guest 默认 L1（绝不渲染「就等你」）', () => {
    expect(resolveGuestCopyVariant({ inviterRegistered: false })).toBe('reserved')
    expect(resolveGuestCopyVariant({ inviterRegistered: null })).toBe('reserved')
    expect(resolveGuestCopyVariant({})).toBe('reserved')
  })
})

/**
 * S2 (contract duo-s2-invitee-role-separation, D-5 逐字): solo-confirm
 * dialog copy lives in this single-authority module — the dialog component
 * never inlines strings (same ownership rule as the waiting/guest lines).
 */
describe('S2 solo-confirm dialog copy (D-5 逐字)', () => {
  it('locks the four dialog strings verbatim', () => {
    expect(DUO_SOLO_CONFIRM_TITLE).toBe('这场是和 {name} 约好的')
    expect(DUO_SOLO_CONFIRM_BODY).toBe('一个人报名也可以，只是不会和 TA 同桌。')
    expect(DUO_SOLO_CONFIRM_PRIMARY).toBe('还是一起去')
    expect(DUO_SOLO_CONFIRM_SECONDARY).toBe('就我一个人')
  })

  it('getDuoSoloConfirmTitle interpolates via truncateDuoName (>6 字 → 6 字+…)', () => {
    expect(getDuoSoloConfirmTitle('阿明')).toBe('这场是和 阿明 约好的')
    expect(getDuoSoloConfirmTitle('一二三四五六七')).toBe('这场是和 一二三四五六… 约好的')
  })

  it('名字缺失/空白 → 「朋友」兜底（与三向 waiting 文案同一兜底）', () => {
    expect(getDuoSoloConfirmTitle(undefined)).toBe('这场是和 朋友 约好的')
    expect(getDuoSoloConfirmTitle('')).toBe('这场是和 朋友 约好的')
    expect(getDuoSoloConfirmTitle('   ')).toBe('这场是和 朋友 约好的')
  })

  it('S2 guest 文案与 S3 常量同一引用（AC-9：S2 不复制字符串）', () => {
    // The guest surface resolves through getGuestDuoCopy — its L1 templates
    // ARE the S3 constants (not re-typed copies).
    expect(getGuestDuoCopy('reserved', '阿明').line1).toBe(
      interpolateDuoName(DUO_GUEST_COPY_RESERVED_L1, '阿明'),
    )
    expect(getGuestDuoCopy('onlyYou', '阿明').line1).toBe(
      interpolateDuoName(DUO_WAITING_COPY_ONLY_YOU, '阿明'),
    )
    expect(getGuestDuoCopy('reserved', '阿明').line2).toBe(DUO_GUEST_COPY_SHARED_TABLE_L2)
    expect(getGuestDuoCopy('onlyYou', '阿明').line2).toBe(DUO_GUEST_COPY_SHARED_TABLE_L2)
  })
})

describe('resolveDuoWaitingPresentation — D-6 优先级 bound > D3 > guest/D2 > D1', () => {
  it('bound 压过一切 waiting/guest 信号', () => {
    expect(
      resolveDuoWaitingPresentation({
        serverState: 'bound',
        viewerRole: 'invitee',
        pendingSide: 'inviter',
        guestArrival: true,
        inviterRegistered: true,
      }),
    ).toEqual({ kind: 'bound' })
  })

  it('D3 压过正向 guest 信号（waiting + invitee×inviter）', () => {
    expect(
      resolveDuoWaitingPresentation({
        serverState: 'waiting',
        viewerRole: 'invitee',
        pendingSide: 'inviter',
        guestArrival: true,
        inviterRegistered: true,
      }),
    ).toEqual({ kind: 'waiting', direction: 'promised', showAgain: false })
  })

  it('duo-status 路径 D2：waiting + inviter×inviter → 就等你，无「再喊一次」', () => {
    expect(
      resolveDuoWaitingPresentation({ serverState: 'waiting', viewerRole: 'inviter', pendingSide: 'inviter' }),
    ).toEqual({ kind: 'waiting', direction: 'onlyYou', showAgain: false })
  })

  it('guest/D2 压过显式 D1（waiting + inviter×invitee 且 inviterRegistered === true）', () => {
    expect(
      resolveDuoWaitingPresentation({
        serverState: 'waiting',
        viewerRole: 'inviter',
        pendingSide: 'invitee',
        guestArrival: true,
        inviterRegistered: true,
      }),
    ).toEqual({ kind: 'guest', variant: 'onlyYou' })
  })

  it('显式 D1 无 guest 冲突时保持 D1 +「再喊一次」', () => {
    expect(
      resolveDuoWaitingPresentation({ serverState: 'waiting', viewerRole: 'inviter', pendingSide: 'invitee' }),
    ).toEqual({ kind: 'waiting', direction: 'sentFriend', showAgain: true })
    expect(
      resolveDuoWaitingPresentation({
        serverState: 'waiting',
        viewerRole: 'inviter',
        pendingSide: 'invitee',
        guestArrival: true,
        inviterRegistered: false,
      }),
    ).toEqual({ kind: 'waiting', direction: 'sentFriend', showAgain: true })
  })

  it('方向字段缺失时一律回退 D1——缺失不是打架，不引入 guest 信号（AC-3）', () => {
    expect(
      resolveDuoWaitingPresentation({
        serverState: 'waiting',
        guestArrival: true,
        inviterRegistered: true,
      }),
    ).toEqual({ kind: 'waiting', direction: 'sentFriend', showAgain: true })
  })

  it('非 waiting/bound 的 guest 表面按 inviterRegistered 走 lookup 路径', () => {
    expect(
      resolveDuoWaitingPresentation({ serverState: 'none', guestArrival: true, inviterRegistered: true }),
    ).toEqual({ kind: 'guest', variant: 'onlyYou' })
    expect(
      resolveDuoWaitingPresentation({ serverState: 'none', guestArrival: true, inviterRegistered: false }),
    ).toEqual({ kind: 'guest', variant: 'reserved' })
    expect(resolveDuoWaitingPresentation({ serverState: 'none', guestArrival: true })).toEqual({
      kind: 'guest',
      variant: 'reserved',
    })
  })

  it('非 guest 表面且无 waiting/bound 信号 → none（无 waiting 文案）', () => {
    expect(resolveDuoWaitingPresentation({ serverState: 'none' })).toEqual({ kind: 'none' })
    expect(resolveDuoWaitingPresentation({})).toEqual({ kind: 'none' })
  })
})

describe('D-4 合规扫描：全部文案无 emoji、无审核禁用词 (AC-5)', () => {
  const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u
  const BANNED_LITERALS = ['匹配', '社交', '灵魂', '撮合', 'AI']

  const ALL_TEMPLATES = [
    DUO_WAITING_COPY_SENT_FRIEND,
    DUO_WAITING_COPY_ONLY_YOU,
    DUO_WAITING_COPY_PROMISED,
    DUO_GUEST_COPY_RESERVED_L1,
    DUO_GUEST_COPY_SHARED_TABLE_L2,
    DUO_NAME_FALLBACK,
    // S2 (D-10): solo-confirm dialog copy is user-facing — same compliance.
    DUO_SOLO_CONFIRM_TITLE,
    DUO_SOLO_CONFIRM_BODY,
    DUO_SOLO_CONFIRM_PRIMARY,
    DUO_SOLO_CONFIRM_SECONDARY,
  ]

  const RENDERED_SAMPLES = [
    ...ALL_TEMPLATES.map((template) => interpolateDuoName(template, '小明')),
    ...ALL_TEMPLATES.map((template) => interpolateDuoName(template, undefined)),
    interpolateDuoName(DUO_WAITING_COPY_ONLY_YOU, '一二三四五六七'),
  ]

  it('模板常量无 emoji、无禁用词', () => {
    for (const template of ALL_TEMPLATES) {
      expect(EMOJI_RE.test(template), template).toBe(false)
      for (const banned of BANNED_LITERALS) {
        expect(template.includes(banned), `${template} 含禁用词 ${banned}`).toBe(false)
      }
    }
  })

  it('渲染结果（含兜底与截断路径）无 emoji、无禁用词', () => {
    for (const rendered of RENDERED_SAMPLES) {
      expect(EMOJI_RE.test(rendered), rendered).toBe(false)
      for (const banned of BANNED_LITERALS) {
        expect(rendered.includes(banned), `${rendered} 含禁用词 ${banned}`).toBe(false)
      }
    }
  })
})
