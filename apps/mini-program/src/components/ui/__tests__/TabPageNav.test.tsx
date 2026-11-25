import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TabPageNav, { getTabPageNavHeightPx } from '../TabPageNav'

vi.mock('@tarojs/components', () => ({
  Text: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />,
  View: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getSystemInfoSync: () => ({ windowWidth: 375, statusBarHeight: 44 }),
    getMenuButtonBoundingClientRect: () => ({ left: 280, right: 367, top: 48, width: 87, height: 32 }),
  },
}))

describe('TabPageNav', () => {
  it('renders the page name in the shared brand title class', () => {
    const { getByTestId } = render(<TabPageNav title='我的足迹' testId='tab-nav' />)

    const nav = getByTestId('tab-nav')
    expect(nav.className).toContain('tab-page-nav')
    expect(nav.querySelector('.tab-page-nav__title')?.textContent).toBe('我的足迹')
  })

  it('reserves the measured status bar height so Android matches iOS', () => {
    const { getByTestId } = render(<TabPageNav title='去发现' testId='tab-nav' />)

    expect(getByTestId('tab-nav').style.paddingTop).toBe('44px')
  })

  it('offsets the right slot clear of the WeChat capsule', () => {
    const { getByTestId } = render(
      <TabPageNav title='我的' right={<span data-testid='bell'>bell</span>} testId='tab-nav' />,
    )

    const slot = getByTestId('bell').parentElement
    expect(slot?.className).toContain('tab-page-nav__right')
    // 375 - 280 + 12px capsule gap
    expect(slot?.style.right).toBe('107px')
  })

  it('supports condensed and fixed variants', () => {
    const { getByTestId } = render(<TabPageNav title='进行中' condensed fixed testId='tab-nav' />)

    const nav = getByTestId('tab-nav')
    expect(nav.className).toContain('tab-page-nav--condensed')
    expect(nav.className).toContain('tab-page-nav--fixed')
  })

  it('exposes the total nav height for page-level scroll offsets', () => {
    // 44px status bar + 88rpx (44px at 375 design width)
    expect(getTabPageNavHeightPx()).toBe(88)
  })
})
