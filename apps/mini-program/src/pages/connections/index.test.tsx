import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConnectionsPage from './index'

const mocks = vi.hoisted(() => ({
  queryState: {
    data: [] as Array<Record<string, unknown>>,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  switchTab: vi.fn(),
  showActionSheet: vi.fn(),
  setClipboardData: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    switchTab: mocks.switchTab,
    showActionSheet: mocks.showActionSheet,
    setClipboardData: mocks.setClipboardData,
  },
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, enhanced: _enhanced, showScrollbar: _showScrollbar, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ lazyLoad: _lazyLoad, mode: _mode, ...props }: any) => <img {...props} />,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mocks.queryState,
}))

vi.mock('../../lib/api/api', () => ({
  apiRequest: vi.fn(),
  fetchConnectionsShell: vi.fn(),
}))
vi.mock('../../lib/prefetchEngine', () => ({ injectConnectionsShellIntoCache: vi.fn() }))
vi.mock('../../lib/api/queryClient', () => ({ queryClient: {} }))
vi.mock('../../hooks/navigation/useMiniPageGate', () => ({
  useMiniPageGate: () => ({ authLoading: false, renderGate: (node: React.ReactNode) => node }),
}))
vi.mock('../../hooks/navigation/useCustomTabBarSync', () => ({ useCustomTabBarSync: vi.fn() }))
vi.mock('../../lib/utils/tabEntranceState', () => ({ consumeTabEntrance: () => false }))
vi.mock('../../lib/utils/routePreloadAssets', () => ({
  preloadRouteAssets: vi.fn(),
  preloadPredictiveAssets: vi.fn(),
}))
vi.mock('../../lib/utils/cdnAssets', () => ({ cdnAsset: (path: string) => path }))

vi.mock('../../components/mascot/ArchetypeHead', () => ({
  default: () => <div data-testid='connection-archetype' />,
}))
vi.mock('../../components/mascot/XiaoyueEmptyState', () => ({
  default: ({ title, subtitle, actionLabel, onAction, variant, emotion }: any) => (
    <div data-testid='connections-state' data-variant={variant} data-emotion={emotion}>
      <span>{title}</span>
      {subtitle && <span>{subtitle}</span>}
      {actionLabel && onAction && <button type='button' onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}))
vi.mock('../../components/ui/JoyJoinIcon', () => ({ default: () => null }))
vi.mock('../../components/ui/Card', () => ({
  default: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

function setQueryState(
  connections: Array<Record<string, unknown>>,
  overrides: { isLoading?: boolean; isError?: boolean } = {},
) {
  mocks.queryState.data = connections
  mocks.queryState.isLoading = overrides.isLoading ?? false
  mocks.queryState.isError = overrides.isError ?? false
}

describe('ConnectionsPage editorial empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setQueryState([])
  })

  it('renders the no-card editorial state, preserves the flow card, and navigates to Discover', () => {
    const { container } = render(<ConnectionsPage />)

    expect(screen.getByText('新的连接，从一场活动开始')).toBeInTheDocument()
    expect(screen.getByTestId('connections-state')).toHaveAttribute('data-variant', 'editorial')
    expect(screen.getByTestId('connections-state')).toHaveAttribute('data-emotion', 'curious')
    expect(container.querySelector('.connections-page__empty-hero')).toBeNull()
    expect(container.querySelector('.connections-page__flow-card')).toHaveTextContent('连接建立流程')

    fireEvent.click(screen.getByRole('button', { name: '去探索活动' }))
    expect(mocks.switchTab).toHaveBeenCalledTimes(1)
    expect(mocks.switchTab).toHaveBeenCalledWith({ url: '/pages/discover/index' })
  })

  it('keeps non-empty connection content and removes the empty-only flow card', () => {
    setQueryState([{ id: 'connection-1', peerName: '阿团', peerArchetype: 'corgi' }])
    const { container } = render(<ConnectionsPage />)

    expect(screen.getByText('阿团')).toBeInTheDocument()
    expect(container.querySelector('.connections-page__card')).toBeInTheDocument()
    expect(screen.queryByTestId('connections-state')).not.toBeInTheDocument()
    expect(container.querySelector('.connections-page__flow-card')).toBeNull()
  })

  it('keeps loading and error variants unchanged and retries through the existing query', () => {
    setQueryState([], { isLoading: true })
    const view = render(<ConnectionsPage />)
    expect(screen.getByTestId('connections-state')).toHaveAttribute('data-emotion', 'waiting')
    expect(screen.getByTestId('connections-state')).not.toHaveAttribute('data-variant', 'editorial')
    expect(screen.getByText('正在加载…')).toBeInTheDocument()

    setQueryState([], { isError: true })
    view.rerender(<ConnectionsPage />)
    expect(screen.getByTestId('connections-state')).toHaveAttribute('data-emotion', 'reassure')
    expect(screen.getByTestId('connections-state')).not.toHaveAttribute('data-variant', 'editorial')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(mocks.queryState.refetch).toHaveBeenCalledTimes(1)
  })
})
