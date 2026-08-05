import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SingleTestBanner from './SingleTestBanner'

const apiRequestMock = vi.fn()
const openSquadUnboxingMock = vi.fn()

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div {...props}>{children}</div>
  ),
  Text: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLSpanElement>>) => (
    <span {...props}>{children}</span>
  ),
}))

vi.mock('../../lib/api/api', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}))

vi.mock('../../lib/navigation/matchingNavigation', () => ({
  openSquadUnboxing: (...args: unknown[]) => openSquadUnboxingMock(...args),
}))

vi.mock('../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

describe('SingleTestBanner', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    openSquadUnboxingMock.mockReset()
  })

  it('opens the freshly created single-test squad directly in squad unboxing', async () => {
    apiRequestMock.mockResolvedValue({
      socialSessionId: 'social_group-1',
      groupId: 'group-1',
      testerRegistrationId: 'registration-1',
      registrationId: 'registration-1',
      bots: Array.from({ length: 5 }, (_, index) => ({
        botId: `bot-${index + 1}`,
        displayName: `Bot ${index + 1}`,
        archetype: 'corgi',
      })),
    })

    render(<SingleTestBanner />)
    fireEvent.click(screen.getByText('创建调试局'))

    await waitFor(() => expect(openSquadUnboxingMock).toHaveBeenCalledWith('group-1'))
  })
})
