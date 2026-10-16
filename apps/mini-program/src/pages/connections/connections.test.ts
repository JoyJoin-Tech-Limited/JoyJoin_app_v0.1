import { describe, expect, it } from 'vitest'
import type { MyConnection } from '@shared/api'

function getPeerDisplayName(conn: MyConnection): string {
  return conn.peerDisplayName ?? '悦聚好友'
}

function getEventLabel(conn: MyConnection): string {
  return conn.eventType ?? '某次活动'
}

function getPeerInitial(name?: string | null): string {
  return (name ?? '?')[0]
}

/**
 * Mirrors the 印象标签回流 render rule on pages/connections/index.tsx
 * (2026-10-16 premium-uplift spec #18): the quiet line 「同桌觉得你：…」
 * renders only when the peer gave ≥1 preset tag; join is the middle dot.
 */
function getPeerImpressionLine(conn: { peerImpressionTags?: string[] | null }): string | null {
  const tags = conn.peerImpressionTags
  if (!Array.isArray(tags) || tags.length === 0) return null
  return `同桌觉得你：${tags.join('·')}`
}

describe('connections page helpers', () => {
  it('returns peerDisplayName when available', () => {
    const conn: MyConnection = {
      id: '1',
      eventId: 'e1',
      peerId: 'p1',
      peerDisplayName: 'Alice',
    }
    expect(getPeerDisplayName(conn)).toBe('Alice')
  })

  it('falls back to 悦聚好友 when peerDisplayName is missing', () => {
    const conn: MyConnection = {
      id: '1',
      eventId: 'e1',
      peerId: 'p1',
    }
    expect(getPeerDisplayName(conn)).toBe('悦聚好友')
  })

  it('falls back to 悦聚好友 when peerDisplayName is null', () => {
    const conn: MyConnection = {
      id: '1',
      eventId: 'e1',
      peerId: 'p1',
      peerDisplayName: null,
    }
    expect(getPeerDisplayName(conn)).toBe('悦聚好友')
  })

  it('returns eventType when available', () => {
    const conn: MyConnection = {
      id: '1',
      eventId: 'e1',
      peerId: 'p1',
      eventType: '饭局',
    }
    expect(getEventLabel(conn)).toBe('饭局')
  })

  it('falls back to 某次活动 when eventType is missing', () => {
    const conn: MyConnection = {
      id: '1',
      eventId: 'e1',
      peerId: 'p1',
    }
    expect(getEventLabel(conn)).toBe('某次活动')
  })

  it('extracts first character for avatar initial', () => {
    expect(getPeerInitial('Alice')).toBe('A')
    expect(getPeerInitial('王大明')).toBe('王')
  })

  it('falls back to ? for null or undefined names', () => {
    expect(getPeerInitial(null)).toBe('?')
    expect(getPeerInitial(undefined)).toBe('?')
  })

  it('accepts all MyConnection fields without type errors', () => {
    const fullConn: MyConnection = {
      id: '1',
      eventId: 'evt-1',
      eventType: '饭局',
      eventDate: '2026-04-22T10:00:00Z',
      peerId: 'peer-1',
      peerDisplayName: 'Test User',
      peerArchetype: 'corgi',
      peerWechatId: 'test_wechat_id',
      connectionReasons: ['兴趣相投'],
      nextStepPreference: '加微信',
      createdAt: '2026-04-22T10:00:00Z',
    }
    expect(fullConn.peerWechatId).toBe('test_wechat_id')
  })

  describe('getPeerImpressionLine (印象标签回流)', () => {
    it('formats two tags with the middle-dot join', () => {
      expect(getPeerImpressionLine({ peerImpressionTags: ['温暖', '会聊天'] })).toBe(
        '同桌觉得你：温暖·会聊天',
      )
    })

    it('formats a single tag without a trailing separator', () => {
      expect(getPeerImpressionLine({ peerImpressionTags: ['有趣'] })).toBe('同桌觉得你：有趣')
    })

    it('returns null when the peer left no tags (line hidden)', () => {
      expect(getPeerImpressionLine({ peerImpressionTags: null })).toBeNull()
      expect(getPeerImpressionLine({ peerImpressionTags: [] })).toBeNull()
      expect(getPeerImpressionLine({})).toBeNull()
    })

    it('uses WeChat-review-safe vocabulary (同桌, no 匹配/社交/撮合)', () => {
      const line = getPeerImpressionLine({ peerImpressionTags: ['温暖'] })
      expect(line).toContain('同桌觉得你')
      expect(line).not.toMatch(/匹配|社交|撮合|灵魂|AI/)
    })
  })
})
