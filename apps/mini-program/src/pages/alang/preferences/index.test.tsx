import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FlashPreferencesPage from './index'

vi.mock('@tarojs/taro', () => ({ default: { setNavigationBarTitle: vi.fn() } }))
vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))

describe('formal reviewed-story disclosure', () => {
  it('states the no-profile and no-runtime-AI contract without consent controls', () => {
    render(<FlashPreferencesPage />)

    expect(screen.getByText('这一季，不需要交出你的资料')).toBeInTheDocument()
    expect(screen.getByText('不读取个人画像')).toBeInTheDocument()
    expect(screen.getByText('不由 AI 临场续写')).toBeInTheDocument()
    expect(screen.getByText('选择仍然算数')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText('更专属的剧情')).not.toBeInTheDocument()
  })
})
