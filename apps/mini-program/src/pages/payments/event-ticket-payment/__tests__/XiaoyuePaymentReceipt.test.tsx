import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import XiaoyuePaymentReceipt, {
  captureSameOrderReceipt,
} from '../components/XiaoyuePaymentReceipt'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

describe('captureSameOrderReceipt', () => {
  it('captures money and plan only from confirmed data explicitly tied to the same order', () => {
    expect(
      captureSameOrderReceipt('order-1', {
        status: 'completed',
        wechatOrderId: 'order-1',
        planType: 'event_single',
        finalAmount: 6800,
        discountAmount: 2000,
      }),
    ).toEqual({
      orderId: 'order-1',
      planLabel: '单场局票',
      finalAmount: 6800,
      discountAmount: 2000,
    })
  })

  it('keeps generic confirmation but omits money and plan when order provenance is unavailable', () => {
    expect(
      captureSameOrderReceipt('order-1', {
        status: 'completed',
        planType: 'event_single',
        finalAmount: 6800,
        discountAmount: 2000,
      }),
    ).toEqual({ orderId: 'order-1' })
  })

  it('rejects mismatched orders and unconfirmed responses', () => {
    expect(
      captureSameOrderReceipt('order-1', {
        status: 'completed',
        wechatOrderId: 'order-2',
        finalAmount: 6800,
      }),
    ).toBeNull()
    expect(
      captureSameOrderReceipt('order-1', {
        status: 'pending',
        wechatOrderId: 'order-1',
        finalAmount: 6800,
      }),
    ).toBeNull()
  })
})

describe('XiaoyuePaymentReceipt', () => {
  it('renders same-order paid receipt facts and next-step guidance', () => {
    render(
      <XiaoyuePaymentReceipt
        mode='paid'
        guidance='排桌开始前会第一时间通知你。'
        receipt={{ orderId: 'order-1', planLabel: '单场局票', finalAmount: 6800, discountAmount: 2000 }}
      />,
    )

    expect(screen.getByText('支付已确认')).toBeInTheDocument()
    expect(screen.getByText('单场局票')).toBeInTheDocument()
    expect(screen.getByText('实付 ¥68')).toBeInTheDocument()
    expect(screen.getByText('已省 ¥20')).toBeInTheDocument()
    expect(screen.getByText('排桌开始前会第一时间通知你。')).toBeInTheDocument()
  })

  it('omits amount, plan, and savings when a same-order receipt snapshot is unavailable', () => {
    const { container } = render(
      <XiaoyuePaymentReceipt mode='paid' guidance='报名已完成。' receipt={null} />,
    )

    expect(screen.getByText('支付已确认')).toBeInTheDocument()
    expect(container.querySelector('.xiaoyue-payment-receipt__details')).toBeNull()
    expect(container.textContent).not.toContain('¥')
    expect(container.textContent).not.toContain('已省')
  })

  it('never turns free or entitlement success into ¥0 paid or savings copy', () => {
    const { container } = render(
      <XiaoyuePaymentReceipt
        mode='entitlement'
        guidance='你的预算、期待和细节已保存。'
        receipt={{ orderId: 'order-1', planLabel: '单场局票', finalAmount: 0, discountAmount: 8800 }}
      />,
    )

    expect(screen.getByText('报名已确认')).toBeInTheDocument()
    expect(screen.getByText('你的预算、期待和细节已保存。')).toBeInTheDocument()
    expect(container.textContent).not.toContain('¥0')
    expect(container.textContent).not.toContain('已省')
    expect(container.querySelector('.xiaoyue-payment-receipt__details')).toBeNull()
  })

  it('escapes receipt text rather than interpreting markup', () => {
    const { container } = render(
      <XiaoyuePaymentReceipt
        mode='paid'
        receipt={{ orderId: 'order-1', planLabel: '<script>alert(1)</script>' }}
      />,
    )

    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })
})
