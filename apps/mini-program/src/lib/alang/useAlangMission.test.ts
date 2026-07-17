import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAlangRetestClientState,
  syncAlangMissionProgress,
} from './useAlangMission'

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

  it('synchronously advances a cached stage before the next page mounts', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['alang', 'mission', 'meet-alang'], {
      slug: 'meet-alang',
      myProgress: {
        progressId: 'progress-1',
        stage: 'searching',
        currentNodeId: 'search-gate',
        nodeHistory: ['search-gate'],
        choicesMade: [],
        status: 'in_progress',
        isDebugSession: false,
      },
    })

    syncAlangMissionProgress(queryClient, 'meet-alang', {
      stage: 'found',
      currentNodeId: 'found-scene',
    })

    const cached = queryClient.getQueryData<any>(['alang', 'mission', 'meet-alang'])
    expect(cached.myProgress).toMatchObject({
      stage: 'found',
      currentNodeId: 'found-scene',
      nodeHistory: ['search-gate', 'found-scene'],
    })
    queryClient.clear()
  })

  it('hydrates a server-owned progress snapshot when the cached detail was still empty', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['alang', 'mission', 'alang-demo'], {
      id: 'mission-1',
      slug: 'alang-demo',
      title: '阿浪',
      description: '测试任务',
      content: {},
      myProgress: null,
    })

    syncAlangMissionProgress(queryClient, 'alang-demo', {
      progressId: 'progress-server',
      status: 'in_progress',
      isDebugSession: true,
      stage: 'searching',
      currentNodeId: 'search-gate',
    })

    const cached = queryClient.getQueryData<any>(['alang', 'mission', 'alang-demo'])
    expect(cached.myProgress).toEqual({
      progressId: 'progress-server',
      status: 'in_progress',
      isDebugSession: true,
      stage: 'searching',
      currentNodeId: 'search-gate',
      nodeHistory: ['search-gate'],
      choicesMade: [],
    })
    queryClient.clear()
  })
})
