import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import XiaoyueCheckoutGuidance from '../components/XiaoyueCheckoutGuidance'
import type { UserCouponSummary } from '@shared/api'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

const welcomeCoupon: UserCouponSummary = {
  id: 'coupon-1',
  code: 'WELCOME20',
  discountType: 'fixed',
  discountValue: 2000,
  isUsed: false,
  status: 'available',
}

describe('XiaoyueCheckoutGuidance', () => {
  it('explains the selected plan using the supplied final price without a coupon', () => {
    render(
      <XiaoyueCheckoutGuidance
        selectedPlan='single'
        bestCoupon={null}
        effectiveCouponCode={undefined}
        discountAmount={0}
        finalPrice={8800}
      />,
    )

    expect(screen.getByText('你选的是「单场局票」，本次实付 ¥88。')).toBeInTheDocument()
    expect(screen.queryByText(/优惠/)).not.toBeInTheDocument()
  })

  it('names the effective coupon, supplied discount, and supplied final price', () => {
    render(
      <XiaoyueCheckoutGuidance
        selectedPlan='single'
        bestCoupon={welcomeCoupon}
        effectiveCouponCode='WELCOME20'
        discountAmount={2000}
        finalPrice={6800}
      />,
    )

    expect(screen.getByText('你选的是「单场局票」，本次实付 ¥68。')).toBeInTheDocument()
    expect(screen.getByText('见面礼券已计入，优惠 ¥20。')).toBeInTheDocument()
  })

  it('omits coupon copy when the available coupon is not effective for this order', () => {
    render(
      <XiaoyueCheckoutGuidance
        selectedPlan='pack_3'
        bestCoupon={welcomeCoupon}
        effectiveCouponCode={undefined}
        discountAmount={2000}
        finalPrice={19100}
      />,
    )

    expect(screen.getByText('你选的是「三连局包」，本次实付 ¥191。')).toBeInTheDocument()
    expect(screen.queryByText(/见面礼已计入/)).not.toBeInTheDocument()
  })

  it('renders nothing when both plan and price facts are unavailable', () => {
    const { container } = render(
      <XiaoyueCheckoutGuidance
        selectedPlan={null}
        bestCoupon={null}
        effectiveCouponCode={undefined}
        discountAmount={0}
        finalPrice={null}
      />,
    )

    expect(container.querySelector('.xiaoyue-checkout-guidance')).toBeNull()
  })

  it('escapes coupon text instead of interpreting markup', () => {
    const unsafeCode = '<script>alert(1)</script>'
    const { container } = render(
      <XiaoyueCheckoutGuidance
        selectedPlan='single'
        bestCoupon={{ ...welcomeCoupon, code: unsafeCode }}
        effectiveCouponCode={unsafeCode}
        discountAmount={2000}
        finalPrice={6800}
      />,
    )

    expect(screen.getByText(new RegExp(unsafeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })
})
