import { describe, it, expect } from 'vitest'
import {
  JOYJOIN_TERMS_SECTIONS_ZH,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_LAST_UPDATED_LABEL_ZH,
} from '../legal/joyjoinTermsZh'

/**
 * AC-11 (post-reveal Phase 0 sprint contract): terms §五 (ts-events) must match
 * the implemented refund boundary exactly — reveal-boundary refund policy, no
 * 24h/50% tiering, no vetoed penalty mechanics (排桌权重/暂停报名/爽约记录),
 * and explicit policy effective time with no retroactive refunds.
 */
const eventsSection = JOYJOIN_TERMS_SECTIONS_ZH.find((s) => s.id === 'ts-events')
const eventsBody = eventsSection?.paragraphs.join('\n') ?? ''

describe('joyjoinTermsZh — §五 refund policy (AC-11)', () => {
  it('states pre-reveal cancel is fully refundable', () => {
    expect(eventsBody).toContain('排桌完成前取消')
    expect(eventsBody).toContain('全额退款')
  })

  it('states post-reveal cancel or no-show is non-refundable', () => {
    expect(eventsBody).toContain('排桌完成后取消或未出席活动')
    expect(eventsBody).toContain('不予退款')
  })

  it('states platform-cancel / unmatched / group-collapse cases are fully refunded', () => {
    expect(eventsBody).toContain('平台取消活动')
    expect(eventsBody).toContain('场次未成行')
    expect(eventsBody).toContain('整局顺延')
  })

  it('states the policy effective time and no retroactive refunds', () => {
    expect(eventsBody).toContain('2026年8月27日')
    expect(eventsBody).toContain('不作追溯退款')
  })

  it('replaces the old 24h/50% tiering with the reveal boundary', () => {
    expect(eventsBody).not.toContain('24小时')
    expect(eventsBody).not.toContain('50%')
  })

  it('contains no vetoed penalty mechanics (排桌权重 / 暂停报名 / 缺席扣分)', () => {
    expect(eventsBody).not.toContain('排桌优先级')
    expect(eventsBody).not.toContain('排桌权重')
    expect(eventsBody).not.toContain('暂停报名')
    expect(eventsBody).not.toContain('无故缺席')
  })

  it('bumps the legal document version to the policy effective date', () => {
    expect(LEGAL_DOCUMENT_VERSION).toBe('2026-08-27')
    expect(LEGAL_LAST_UPDATED_LABEL_ZH).toBe('2026年8月27日')
  })
})
