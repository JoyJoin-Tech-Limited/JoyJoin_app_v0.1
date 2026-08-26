import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLASH_HOME_QUERY_KEY, useFlashHome } from './useFlash'

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

describe('Flash home query privacy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the home list without requesting or caching raw coordinates', () => {
    mocks.useQuery.mockImplementation((options) => options)
    useFlashHome(true)

    expect(mocks.useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: FLASH_HOME_QUERY_KEY,
      staleTime: 30_000,
      retry: 1,
      enabled: true,
    }))
    mocks.useQuery.mock.calls[0][0].queryFn()
    expect(mocks.fetchHome).toHaveBeenCalledWith()
  })
})
