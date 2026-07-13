import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAlangMissions,
  fetchAlangMissionDetail,
  callStartMission,
  callRecoverMission,
  callCompleteMission,
  callAbandonMission,
  fetchStoryArchives,
  fetchArchiveDetail,
} from './api'
import type { AlangMissionDetail } from '@shared/api'

const ALANG_MISSIONS_KEY = ['alang', 'missions']
const ALANG_MISSION_DETAIL_KEY = (slug: string) => ['alang', 'mission', slug]
const ALANG_ARCHIVES_KEY = ['alang', 'archives']
const ALANG_ARCHIVE_DETAIL_KEY = (id: string) => ['alang', 'archive', id]

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

export function useStartMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: callStartMission,
    onSuccess: async (data, slug) => {
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
    mutationFn: callRecoverMission,
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
