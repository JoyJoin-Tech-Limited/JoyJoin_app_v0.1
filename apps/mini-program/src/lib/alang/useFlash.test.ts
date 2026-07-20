import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ useQuery: vi.fn(), fetchHome: vi.fn() }))

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}))
vi.mock('./flashApi', () => ({
  fetchFlashHome: mocks.fetchHome,
  fetchFlashEncounter: vi.fn(),
  fetchFlashAssignment: vi.fn(),
  fetchFlashPreferences: vi.fn(),
  locateFlashAppearance: vi.fn(),
  answerFlashEncounter: vi.fn(),
  rerollFlashEncounter: vi.fn(),
  respondToFlashTaskOffer: vi.fn(),
  deliverFlashTask: vi.fn(),
  arriveAtFlashAssignment: vi.fn(),
  submitFlashFeedback: vi.fn(),
  abandonFlashAssignment: vi.fn(),
  updateFlashPreferences: vi.fn(),
}))

import { FLASH_HOME_QUERY_KEY, useFlashHome } from './useFlash'

describe('Flash home query privacy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('never places raw coordinates in the React Query key', () => {
    const location = { latitude: 22.5431, longitude: 114.0579, accuracy: 10 }
    mocks.useQuery.mockImplementation((options) => options)
    useFlashHome(location, true)

    expect(mocks.useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: FLASH_HOME_QUERY_KEY,
      staleTime: 0,
      enabled: true,
    }))
    expect(JSON.stringify(mocks.useQuery.mock.calls[0][0].queryKey)).not.toMatch(/22\.5431|114\.0579/)
  })
})
