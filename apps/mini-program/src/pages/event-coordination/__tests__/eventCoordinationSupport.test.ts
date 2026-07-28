import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 2026-07-28 support pivot (event-coordination): the placeholder QR card
// became a native WeChat customer-service session button
// (open-type="contact"). Source locks.

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(resolve(here, '..', 'index.tsx'), 'utf-8')
const scss = readFileSync(resolve(here, '..', 'index.scss'), 'utf-8')

describe('event-coordination native customer-service entry (2026-07-28)', () => {
  it('opens the WeChat customer-service session via open-type="contact"', () => {
    expect(tsx).toContain("openType='contact'")
    expect(tsx).toContain('sessionFrom={`event-coordination:${eventId}`}')
    expect(tsx).toContain('showMessageCard')
  })

  it('tracks the tap through the events analytics pipeline', () => {
    expect(tsx).toContain("eventsAnalytics.track('support_contact_tap'")
    expect(tsx).toContain("location: 'event-coordination'")
  })

  it('ships CSS for the button and keeps zero QR references', () => {
    expect(scss).toContain('&__support-btn')
    expect(tsx).not.toContain('customer-service-support')
    expect(tsx).not.toContain('supportQrSrc')
    expect(tsx).not.toContain('previewImage')
    expect(scss).not.toContain('&__support-qr')
    expect(scss).not.toContain('&__support-helper')
  })

  it('keeps the compliance-freeze notice copy (group chat stays closed)', () => {
    expect(tsx).toContain('小程序内自由群聊已关闭')
    expect(tsx).toContain('官方客服')
  })
})
