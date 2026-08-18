import type { JoinedEventSummary } from '@shared/api'
import { describe, expect, it } from 'vitest'
import {
  formatEventDateTime,
  getEventPoolStatusLabel,
  getJoinedEventDisplayDateTime,
  getJoinedEventStatusLabel,
  isJoinedEventTerminal,
} from '../eventDisplay'

describe('eventDisplay', () => {
  describe('getJoinedEventDisplayDateTime', () => {
    it('prefers finalDateTime when grouped and status is active', () => {
      const event: JoinedEventSummary = {
        id: '1',
        status: 'matched',
        groupId: 'g1',
        dateTime: '2026-04-12T19:30:00+08:00',
        finalDateTime: '2026-04-14T19:30:00+08:00',
      }
      expect(getJoinedEventDisplayDateTime(event)).toBe('2026-04-14T19:30:00+08:00')
    })

    it('prefers displayStatus over raw status when choosing finalDateTime', () => {
      const event: JoinedEventSummary = {
        id: '1',
        status: 'closed',
        displayStatus: 'venue_unlocked',
        groupId: 'g1',
        dateTime: '2026-04-12T19:30:00+08:00',
        finalDateTime: '2026-04-14T19:30:00+08:00',
      }
      expect(getJoinedEventDisplayDateTime(event)).toBe('2026-04-14T19:30:00+08:00')
    })

    it('falls back to dateTime when displayStatus is terminal', () => {
      const event: JoinedEventSummary = {
        id: '1',
        status: 'completed',
        displayStatus: 'attended',
        groupId: 'g1',
        dateTime: '2026-04-12T19:30:00+08:00',
        finalDateTime: '2026-04-14T19:30:00+08:00',
      }
      expect(getJoinedEventDisplayDateTime(event)).toBe('2026-04-12T19:30:00+08:00')
    })

    it('falls back to dateTime when groupId is missing', () => {
      const event: JoinedEventSummary = {
        id: '1',
        status: 'registered',
        dateTime: '2026-04-12T19:30:00+08:00',
        finalDateTime: '2026-04-14T19:30:00+08:00',
      }
      expect(getJoinedEventDisplayDateTime(event)).toBe('2026-04-12T19:30:00+08:00')
    })

    it('falls back to dateTime for terminal statuses even with groupId', () => {
      const event: JoinedEventSummary = {
        id: '1',
        status: 'cancelled',
        groupId: 'g1',
        dateTime: '2026-04-12T19:30:00+08:00',
        finalDateTime: '2026-04-14T19:30:00+08:00',
      }
      expect(getJoinedEventDisplayDateTime(event)).toBe('2026-04-12T19:30:00+08:00')
    })

    it('returns undefined when both date fields are missing', () => {
      expect(getJoinedEventDisplayDateTime({ status: undefined })).toBeUndefined()
    })
  })

  describe('formatEventDateTime', () => {
    it('returns placeholder for missing date', () => {
      expect(formatEventDateTime(undefined)).toBe('时间待定')
    })

    it('returns placeholder for invalid date', () => {
      expect(formatEventDateTime('not-a-date')).toBe('时间待定')
    })

    it('includes year when event is in a different year', () => {
      const date = '2027-01-01T19:30:00+08:00'
      expect(formatEventDateTime(date)).toContain('2027')
    })

    it('uses 今天 when event is today', () => {
      const now = new Date()
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T19:30:00+08:00`
      expect(formatEventDateTime(date)).toMatch(/^今天 /)
    })

    it('uses 明天 when event is tomorrow', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T19:30:00+08:00`
      expect(formatEventDateTime(date)).toMatch(/^明天 /)
    })

    it('uses 后天 when event is the day after tomorrow', () => {
      const dayAfter = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      const date = `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}T19:30:00+08:00`
      expect(formatEventDateTime(date)).toMatch(/^后天 /)
    })

    it('omits year and relative prefix when event is further out', () => {
      const now = new Date()
      const future = new Date(now.getFullYear(), now.getMonth() + 1, 15, 19, 30)
      const date = future.toISOString()
      const formatted = formatEventDateTime(date)
      expect(formatted).not.toMatch(/^(今天|明天|后天) /)
      expect(formatted).not.toContain(String(future.getFullYear()))
    })
  })

  describe('getJoinedEventStatusLabel', () => {
    it('maps known statuses to labels', () => {
      expect(getJoinedEventStatusLabel('matched')).toBe('已排桌')
      expect(getJoinedEventStatusLabel('pending')).toBe('排桌中')
      expect(getJoinedEventStatusLabel('registered')).toBe('已报名')
      expect(getJoinedEventStatusLabel('confirmed')).toBe('已确认')
      expect(getJoinedEventStatusLabel('venue_unlocked')).toBe('场地已解锁')
      expect(getJoinedEventStatusLabel('cancelled')).toBe('已取消')
      expect(getJoinedEventStatusLabel('declined')).toBe('已取消')
      expect(getJoinedEventStatusLabel('no_show')).toBe('未出席')
    })

    it('treats completed and attended as completed', () => {
      expect(getJoinedEventStatusLabel('completed')).toBe('已完成')
      expect(getJoinedEventStatusLabel('attended')).toBe('已完成')
    })

    it('returns empty string for unknown status', () => {
      expect(getJoinedEventStatusLabel('unknown')).toBe('')
    })
  })

  describe('isJoinedEventTerminal', () => {
    it('returns true for terminal statuses', () => {
      expect(isJoinedEventTerminal('completed')).toBe(true)
      expect(isJoinedEventTerminal('attended')).toBe(true)
      expect(isJoinedEventTerminal('cancelled')).toBe(true)
      expect(isJoinedEventTerminal('declined')).toBe(true)
      expect(isJoinedEventTerminal('no_show')).toBe(true)
    })

    it('returns false for null, undefined, or empty status', () => {
      expect(isJoinedEventTerminal(null)).toBe(false)
      expect(isJoinedEventTerminal(undefined)).toBe(false)
      expect(isJoinedEventTerminal('')).toBe(false)
    })

    it('returns false for active statuses', () => {
      expect(isJoinedEventTerminal('pending')).toBe(false)
      expect(isJoinedEventTerminal('registered')).toBe(false)
      expect(isJoinedEventTerminal('matched')).toBe(false)
      expect(isJoinedEventTerminal('confirmed')).toBe(false)
      expect(isJoinedEventTerminal('venue_unlocked')).toBe(false)
      expect(isJoinedEventTerminal('upcoming')).toBe(false)
    })
  })

  describe('getEventPoolStatusLabel (2026-07-28 — event-detail raw `active` fix)', () => {
    it('localizes every pool lifecycle status', () => {
      expect(getEventPoolStatusLabel('active')).toBe('招募中')
      expect(getEventPoolStatusLabel('matching')).toBe('排桌中')
      expect(getEventPoolStatusLabel('matched')).toBe('已成局')
      expect(getEventPoolStatusLabel('completed')).toBe('已结束')
      expect(getEventPoolStatusLabel('cancelled')).toBe('已取消')
      expect(getEventPoolStatusLabel('archived')).toBe('已关闭')
    })

    it('never leaks a raw enum for unknown/empty statuses', () => {
      expect(getEventPoolStatusLabel(null)).toBe('')
      expect(getEventPoolStatusLabel(undefined)).toBe('')
      expect(getEventPoolStatusLabel('')).toBe('')
      expect(getEventPoolStatusLabel('some_future_status')).toBe('')
    })
  })
})
