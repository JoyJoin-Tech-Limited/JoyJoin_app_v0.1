import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 2026-07-28 device-recording audit (活动详情): the 时间 row rendered a raw
// ISO string and the 状态 row rendered the raw English enum (`active`).
// Same-day support pivot: the placeholder QR card became a native WeChat
// customer-service session button (open-type="contact") — no asset to
// maintain, user never leaves the mini program. Source locks for all three.

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(resolve(here, '..', 'index.tsx'), 'utf-8')
const scss = readFileSync(resolve(here, '..', 'index.scss'), 'utf-8')

describe('event-detail data hygiene (2026-07-28)', () => {
  it('formats the event time via formatEventDateTime (no raw ISO leak)', () => {
    expect(tsx).toContain('formatEventDateTime(event.dateTime)')
    expect(tsx).not.toContain("event.dateTime ?? '时间待定'")
  })

  it('localizes pool status via getEventPoolStatusLabel (no raw `active`)', () => {
    expect(tsx).toContain('getEventPoolStatusLabel(event.status)')
    expect(tsx).not.toContain('{event.status}</Text>')
    // The status row now carries the same icon slot as its sibling rows.
    const statusRow = tsx.split('getEventPoolStatusLabel(event.status)')[0] ?? ''
    expect(statusRow).toContain('event-detail__icon-slot')
  })
})

describe('event-detail native customer-service entry (2026-07-28)', () => {
  it('opens the WeChat customer-service session via open-type="contact"', () => {
    expect(tsx).toContain("openType='contact'")
    expect(tsx).toContain('sessionFrom={`event-detail:${eventId}`}')
    // Agent context: the session carries a mini-program card of this event.
    expect(tsx).toContain('showMessageCard')
    expect(tsx).toContain('sendMessageTitle={event.title')
  })

  it('tracks the tap through the events analytics pipeline', () => {
    expect(tsx).toContain("eventsAnalytics.track('support_contact_tap'")
    expect(tsx).toContain("location: 'event-detail'")
  })

  it('ships CSS for the button and keeps zero QR references', () => {
    expect(scss).toContain('&__support-btn')
    expect(tsx).not.toContain('customer-service-support')
    expect(tsx).not.toContain('supportQrSrc')
    expect(tsx).not.toContain('previewImage')
    expect(tsx).not.toContain('showMenuByLongpress')
    expect(scss).not.toContain('&__support-qr')
    expect(scss).not.toContain('&__support-helper')
  })
})
