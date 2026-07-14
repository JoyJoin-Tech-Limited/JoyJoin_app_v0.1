import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAlangRetestClientState } from './useAlangMission'

const mocks = vi.hoisted(() => ({
  removeStorageSync: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    removeStorageSync: mocks.removeStorageSync,
  },
}))

describe('clearAlangRetestClientState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears mission, recover, archive and local point configuration state', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(['alang', 'mission', 'meet-alang'], { stale: true })
    queryClient.setQueryData(['alang', 'archives'], [{ id: 'archive-1' }])
    queryClient.setQueryData(['alang', 'archive', 'archive-1'], { id: 'archive-1' })
    queryClient.setQueryData(['unrelated', 'profile'], { keep: true })

    queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['alang', 'recover'],
      mutationFn: async () => ({ progressId: 'stale-progress' }),
    })

    await clearAlangRetestClientState(queryClient, 'meet-alang')

    expect(queryClient.getQueryData(['alang', 'mission', 'meet-alang'])).toBeUndefined()
    expect(queryClient.getQueryData(['alang', 'archives'])).toBeUndefined()
    expect(queryClient.getQueryData(['alang', 'archive', 'archive-1'])).toBeUndefined()
    expect(queryClient.getMutationCache().findAll({
      mutationKey: ['alang', 'recover'],
    })).toHaveLength(0)
    expect(queryClient.getQueryData(['unrelated', 'profile'])).toEqual({ keep: true })
    expect(mocks.removeStorageSync).toHaveBeenCalledWith('jj_alang_config_meet-alang')

    queryClient.clear()
  })
})
