import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashPreferencesPage from './index'

const mocks = vi.hoisted(() => ({ useAuth: vi.fn(), usePreferences: vi.fn(), update: vi.fn() }))

vi.mock('@tarojs/taro', () => ({ default: { setNavigationBarTitle: vi.fn(), showToast: vi.fn() } }))
vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
  Switch: ({ checked, onChange, 'aria-label': ariaLabel, disabled }: any) => (
    <input
      type='checkbox'
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange({ detail: { value: event.target.checked } })}
    />
  ),
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/alang/useFlash', () => ({
  useFlashPreferences: mocks.usePreferences,
  useUpdateFlashPreferences: () => ({ mutateAsync: mocks.update, isPending: false }),
}))

const preferences = {
  personalizationEnabled: false,
  usePersonality: true,
  useInterests: true,
  useIndustry: false,
  useDistrict: true,
  useTaskBehavior: false,
  tags: [{ id: '11111111-1111-4111-8111-111111111111', source: 'interests', label: '安静空间' }],
}

describe('Flash personalization preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.usePreferences.mockReturnValue({ data: preferences, isLoading: false, isError: false, refetch: vi.fn() })
    mocks.update.mockImplementation(async (update: Record<string, unknown>) => ({ ...preferences, ...update }))
  })

  it('records explicit consent when personalization is enabled', async () => {
    render(<FlashPreferencesPage />)
    fireEvent.click(screen.getByRole('checkbox', { name: '个性化任务开关' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({
      personalizationEnabled: true,
      consentVersion: 'flash-personalization-v1',
    }))
  })

  it('deletes a visible task tag through the shared deleteTagIds field', async () => {
    render(<FlashPreferencesPage />)
    fireEvent.click(screen.getByRole('button', { name: '删除任务标签安静空间' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({
      deleteTagIds: ['11111111-1111-4111-8111-111111111111'],
    }))
  })

  it('fails closed before reading preferences when the feature is disabled', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashPreferencesPage />)
    expect(mocks.usePreferences).toHaveBeenCalledWith(false)
    expect(screen.getByText('街头盲盒正在准备下一次见面')).toBeInTheDocument()
  })
})
