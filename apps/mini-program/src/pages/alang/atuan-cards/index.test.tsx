import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AtuanCardsPage from './index'

const { setStorageSync, navigateBack } = vi.hoisted(() => ({ setStorageSync: vi.fn(), navigateBack: vi.fn() }))

vi.mock('@tarojs/taro', () => ({
  useRouter: () => ({ params: { key: 'atuan-game', approach: 'notice_wait' } }),
  // Shared hooks in the page graph (useResetOnShow) import useDidShow
  // directly — the mock must export it or vitest throws.
  useDidShow: (_callback: () => void) => {},
  default: { setStorageSync, navigateBack },
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Atuan card sorting game', () => {
  it('lets Atuan respond to every placement and remembers each card destination', () => {
    render(<AtuanCardsPage />)

    fireEvent.click(screen.getByRole('button', { name: '可以一起记住' }))
    expect(screen.getByText(/能让人觉得被记住/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '继续整理' }))

    fireEvent.click(screen.getByRole('button', { name: '只留给卡上的人' }))
    expect(screen.getByText(/只交给卡上的人/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '继续整理' }))

    fireEvent.click(screen.getByRole('button', { name: '先替他遮住' }))
    expect(screen.getByText(/先盖住/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '收好最后一张' }))

    expect(setStorageSync).toHaveBeenCalledWith('atuan-game', [
      { cardId: 'city', destinationId: 'keep' },
      { cardId: 'habit', destinationId: 'return' },
      { cardId: 'private_time', destinationId: 'cover' },
    ])
    expect(navigateBack).toHaveBeenCalledOnce()
  })
})
