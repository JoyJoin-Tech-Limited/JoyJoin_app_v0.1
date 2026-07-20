import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LegacyFlashDetailRedirect from './index'

const mocks = vi.hoisted(() => ({ useAuth: vi.fn(), redirectTo: vi.fn() }))

vi.mock('@tarojs/taro', () => ({ default: { redirectTo: mocks.redirectTo } }))
vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))

describe('legacy Flash detail redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.redirectTo.mockResolvedValue({})
  })

  it('recovers old URLs through the formal server-owned home', async () => {
    render(<LegacyFlashDetailRedirect />)
    expect(screen.getByText('正在接回新的闪现…')).toBeInTheDocument()
    await waitFor(() => expect(mocks.redirectTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' }))
  })

  it('fails closed without navigating when the feature is disabled', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<LegacyFlashDetailRedirect />)
    expect(screen.getByText('闪现正在准备下一次见面')).toBeInTheDocument()
    expect(mocks.redirectTo).not.toHaveBeenCalled()
  })
})
