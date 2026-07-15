import Taro from '@tarojs/taro'
import { useCallback } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  fetchAlangMissions,
  fetchAlangMissionDetail,
  callStartMission,
  callRecoverMission,
  callCompleteMission,
  callAbandonMission,
  callDebugReset,
  fetchStoryArchives,
  fetchArchiveDetail,
} from './api'
import type { AlangMissionDetail } from '@shared/api'

const ALANG_MISSIONS_KEY = ['alang', 'missions']
const ALANG_MISSION_DETAIL_KEY = (slug: string) => ['alang', 'mission', slug]
const ALANG_ARCHIVES_KEY = ['alang', 'archives']
const ALANG_ARCHIVE_DETAIL_KEY = (id: string) => ['alang', 'archive', id]
const ALANG_QUERY_ROOT = ['alang']
const ALANG_RECOVER_MUTATION_KEY = ['alang', 'recover']

/**
 * Removes every client-side snapshot that can resurrect a pre-reset Alang run.
 * The server reset remains authoritative; this only clears the current device's
 * mission/archive queries, recover mutation result and internal point config.
 */
export async function clearAlangRetestClientState(
  queryClient: QueryClient,
  slug: string,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: ALANG_QUERY_ROOT })
  queryClient.removeQueries({ queryKey: ALANG_QUERY_ROOT })

  const mutationCache = queryClient.getMutationCache()
  mutationCache
    .findAll({ mutationKey: ALANG_RECOVER_MUTATION_KEY })
    .forEach((mutation) => mutationCache.remove(mutation))

  try {
    Taro.removeStorageSync(`jj_alang_config_${slug}`)
  } catch {
    // Storage cleanup is best-effort. The reset flow always relaunches the
    // config page, which cannot start until fresh points are selected again.
  }
}

export function useAlangMissions(enabled = true) {
  return useQuery({
    queryKey: ALANG_MISSIONS_KEY,
    queryFn: fetchAlangMissions,
    enabled,
    staleTime: 30_000,
  })
}

export function useAlangMissionDetail(slug: string, enabled = true) {
  return useQuery({
    queryKey: ALANG_MISSION_DETAIL_KEY(slug),
    queryFn: () => fetchAlangMissionDetail(slug),
    enabled: !!slug && enabled,
    staleTime: 10_000,
  })
}

export type AlangProgressTransition = {
  stage: string
  currentNodeId: string
}

export function syncAlangMissionProgress(
  queryClient: QueryClient,
  slug: string,
  snapshot: AlangProgressTransition,
): void {
  queryClient.setQueryData<AlangMissionDetail>(ALANG_MISSION_DETAIL_KEY(slug), (current) => {
    if (!current?.myProgress) return current
    const nodeHistory = current.myProgress.nodeHistory.includes(snapshot.currentNodeId)
      ? current.myProgress.nodeHistory
      : [...current.myProgress.nodeHistory, snapshot.currentNodeId]
    return {
      ...current,
      myProgress: {
        ...current.myProgress,
        stage: snapshot.stage,
        currentNodeId: snapshot.currentNodeId,
        nodeHistory,
      },
    }
  })
}

/**
 * Keeps stage routing synchronous after a raw progress edge succeeds. Without
 * this, a newly mounted stage page can read the pre-edge Query snapshot and
 * redirect back before its background refetch finishes.
 */
export function useSyncAlangMissionProgress() {
  const queryClient = useQueryClient()

  return useCallback((
    slug: string,
    snapshot: AlangProgressTransition,
  ) => {
    syncAlangMissionProgress(queryClient, slug, snapshot)
  }, [queryClient])
}

export function useStartMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: callStartMission,
    onSuccess: async (data, input) => {
      const slug = typeof input === 'string' ? input : input.slug
      qc.setQueryData<AlangMissionDetail>(ALANG_MISSION_DETAIL_KEY(slug), (current) =>
        current
          ? {
              ...current,
              myProgress: {
                progressId: data.progressId,
                stage: data.stage,
                currentNodeId: data.currentNodeId,
                nodeHistory: data.nodeHistory,
                choicesMade: data.choicesMade,
                status: data.completed ? 'completed' : 'in_progress',
                isDebugSession: false,
                archiveId: data.archiveId,
              },
            }
          : current
      )
      await Promise.all([
        qc.invalidateQueries({ queryKey: ALANG_MISSIONS_KEY }),
        qc.invalidateQueries({ queryKey: ALANG_MISSION_DETAIL_KEY(slug) }),
      ])
    },
  })
}

export function useRecoverMission() {
  return useMutation({
    mutationKey: ALANG_RECOVER_MUTATION_KEY,
    mutationFn: callRecoverMission,
  })
}

export function useResetAlangMission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['alang', 'debug', 'reset'],
    mutationFn: callDebugReset,
    onSuccess: async (_result, slug) => {
      await clearAlangRetestClientState(queryClient, slug)
    },
  })
}

export function useCompleteMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: callCompleteMission,
    onSuccess: async (_data, slug) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ALANG_MISSIONS_KEY }),
        qc.invalidateQueries({ queryKey: ALANG_MISSION_DETAIL_KEY(slug) }),
        qc.invalidateQueries({ queryKey: ALANG_ARCHIVES_KEY }),
      ])
    },
  })
}

export function useAbandonMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: callAbandonMission,
    onSuccess: async (_data, slug) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ALANG_MISSIONS_KEY }),
        qc.invalidateQueries({ queryKey: ALANG_MISSION_DETAIL_KEY(slug) }),
      ])
    },
  })
}

export function useStoryArchives(enabled = true) {
  return useQuery({
    queryKey: ALANG_ARCHIVES_KEY,
    queryFn: fetchStoryArchives,
    enabled,
    staleTime: 60_000,
  })
}

export function useArchiveDetail(archiveId: string, enabled = true) {
  return useQuery({
    queryKey: ALANG_ARCHIVE_DETAIL_KEY(archiveId),
    queryFn: () => fetchArchiveDetail(archiveId),
    enabled: !!archiveId && enabled,
    staleTime: 60_000,
  })
}
