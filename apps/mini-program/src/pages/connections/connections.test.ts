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
      peerArchetype: '开心柯基',
      peerWechatId: 'test_wechat_id',
      connectionReasons: ['兴趣相投'],
      nextStepPreference: '加微信',
      createdAt: '2026-04-22T10:00:00Z',
    }
    expect(fullConn.peerWechatId).toBe('test_wechat_id')
  })
})
