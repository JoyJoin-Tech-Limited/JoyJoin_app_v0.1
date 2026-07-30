import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashTaskPage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useAssignment: vi.fn(),
  arrive: vi.fn(),
  abandon: vi.fn(),
  retryTask: vi.fn(),
  location: vi.fn(),
  openLocation: vi.fn(),
  refetch: vi.fn(),
  canonicalRedirect: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentInstance: () => ({ router: { params: { assignmentId: 'assignment-1' } } }),
    setNavigationBarTitle: vi.fn(),
    openLocation: mocks.openLocation,
    openSetting: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn().mockResolvedValue({ confirm: true }),
    redirectTo: vi.fn(),
  },
  useDidShow: vi.fn(),
}))
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/alang/useFlash', () => ({
  useFlashAssignment: mocks.useAssignment,
  useArriveAtFlashAssignment: () => ({ mutateAsync: mocks.arrive, isPending: false }),
  useAbandonFlashAssignment: () => ({ mutateAsync: mocks.abandon, isPending: false }),
  useRetryFlashAssignment: () => ({ mutateAsync: mocks.retryTask, isPending: false }),
}))
vi.mock('../../../lib/alang/flashApi', () => ({
  getOneShotFlashLocation: mocks.location,
  getFlashLocationPermission: vi.fn().mockResolvedValue('granted'),
  getFlashApiErrorCode: (error: any) => error?.data?.code ?? null,
}))
vi.mock('../../../lib/alang/flashNavigation', () => ({ redirectToFlashCanonical: mocks.canonicalRedirect }))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

const assignment = {
  id: 'assignment-1', assignmentId: 'assignment-1', canonicalScreen: 'task',
  npc: { id: 'npc-1', slug: 'momo', name: '默默' },
  title: '替我找一处安静的角落', category: '独处放松', status: 'accepted',
  description: '不用做什么，去那里待一小会儿。', destinationName: '南头古城', districtName: '南山区',
  destinationAddress: '南山大道与深南大道交界附近', destination: { latitude: 22.538, longitude: 113.923 },
  dueAt: '2026-07-27T12:00:00+08:00',
}

describe('formal Flash task detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.useAssignment.mockReturnValue({ data: assignment, isLoading: false, isError: false, error: null, refetch: mocks.refetch })
    mocks.location.mockResolvedValue({ latitude: 22.5381, longitude: 113.9231, accuracy: 9 })
    mocks.arrive.mockResolvedValue({ canonicalScreen: 'task', assignmentId: 'assignment-1', withinRange: false, distanceMeters: 71 })
    mocks.openLocation.mockResolvedValue({})
    mocks.canonicalRedirect.mockResolvedValue(false)
  })

  it('opens only the public task destination in the native map', async () => {
    render(<FlashTaskPage />)
    fireEvent.click(screen.getByRole('button', { name: '在地图中查看南头古城' }))
    await waitFor(() => expect(mocks.openLocation).toHaveBeenCalledWith({
      latitude: 22.538,
      longitude: 113.923,
      name: '南头古城',
      address: '南山大道与深南大道交界附近',
      scale: 16,
    }))
  })

  it('checks arrival with one explicit location snapshot', async () => {
    render(<FlashTaskPage />)
    expect(mocks.location).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('我已到达'))
    await waitFor(() => expect(mocks.arrive).toHaveBeenCalledWith({
      assignmentId: 'assignment-1',
      location: { latitude: 22.5381, longitude: 113.9231, accuracy: 9 },
    }))
    expect(await screen.findByText(/大约相距 71 米/)).toBeInTheDocument()
  })

  it('shows an explicit unavailable state for a withdrawn destination', () => {
    mocks.useAssignment.mockReturnValue({
      data: undefined, isLoading: false, isError: true,
      error: { data: { code: 'FLASH_DESTINATION_WITHDRAWN' } }, refetch: mocks.refetch,
    })
    render(<FlashTaskPage />)
    expect(screen.getByText('这个任务已经不能继续了')).toBeInTheDocument()
    expect(screen.getByText(/不会有惩罚/)).toBeInTheDocument()
  })

  it('does not fetch or locate a disabled deep link', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashTaskPage />)
    expect(mocks.useAssignment).toHaveBeenCalledWith('assignment-1', false)
    expect(mocks.location).not.toHaveBeenCalled()
  })
})
