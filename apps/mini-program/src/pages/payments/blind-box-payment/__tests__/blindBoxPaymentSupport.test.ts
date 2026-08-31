import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 2026-08-31 support-coverage audit: the payment-failure copy told users to
// "联系客服" but offered no way to reach one. The error block now ships the
// same native WeChat customer-service session button (open-type="contact")
// as event-detail / event-coordination, with plan context for the agent.

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(resolve(here, '..', 'index.tsx'), 'utf-8')
const scss = readFileSync(resolve(here, '..', 'index.scss'), 'utf-8')

describe('blind-box-payment native customer-service entry (2026-08-31)', () => {
  it('renders the contact button inside the payment-error block', () => {
    expect(tsx).toContain("openType='contact'")
    expect(tsx).toContain("sessionFrom={`blind-box-payment:${selectedPlan}`}")
    expect(tsx).toContain('showMessageCard')
    expect(tsx).toContain("sendMessageTitle='悦聚支付问题'")
    // The button only appears alongside a payment error.
    const errorBlock = tsx.split('payment-page__error-block')[1] ?? ''
    expect(errorBlock).toContain('payment-page__support-btn')
  })

  it('tracks the tap through the events analytics pipeline', () => {
    expect(tsx).toContain("eventsAnalytics.track('support_contact_tap'")
    expect(tsx).toContain("location: 'blind-box-payment'")
    expect(tsx).toContain('plan: selectedPlan')
  })

  it('ships CSS for both new classes (class-coverage gate)', () => {
    expect(scss).toContain('&__error-block')
    expect(scss).toContain('&__support-btn')
  })
})
