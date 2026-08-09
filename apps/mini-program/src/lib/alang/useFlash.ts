import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  abandonFlashAssignment,
  answerFlashEncounter,
  arriveAtFlashAssignment,
  deliverFlashTask,
  fetchFlashAssignment,
  fetchFlashEncounter,
  fetchFlashHome,
  fetchFlashPreferences,
  fetchFlashStoryFragments,
  getFlashApiErrorCode,
  locateFlashAppearance,
  rerollFlashEncounter,
  retryFlashAssignment,
  respondToFlashTaskOffer,
  submitFlashFeedback,
  updateFlashPreferences,
} from './flashApi'
import type { FlashLocationSnapshot } from './flashTypes'

export const FLASH_QUERY_ROOT = ['alang', 'flash'] as const
export const FLASH_HOME_QUERY_KEY = [...FLASH_QUERY_ROOT, 'home'] as const
export const flashEncounterQueryKey = (id: string) => [...FLASH_QUERY_ROOT, 'encounter', id] as const
export const flashAssignmentQueryKey = (id: string) => [...FLASH_QUERY_ROOT, 'assignment', id] as const
export const FLASH_PREFERENCES_QUERY_KEY = [...FLASH_QUERY_ROOT, 'preferences'] as const
export const FLASH_STORY_FRAGMENTS_QUERY_KEY = [...FLASH_QUERY_ROOT, 'story-fragments'] as const

export function useFlashStoryFragments(enabled = true) {
  return useQuery({
    queryKey: FLASH_STORY_FRAGMENTS_QUERY_KEY,
    queryFn: fetchFlashStoryFragments,
    enabled,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useFlashHome(enabled = true) {
  return useQuery({
    // Home is intentionally location-free. GPS starts only after the user
    // selects a character and explicitly opens the foreground map.
    queryKey: FLASH_HOME_QUERY_KEY,
    queryFn: fetchFlashHome,
    enabled,
    staleTime: 0,
    retry: 1,
  })
}

export function useFlashEncounter(encounterId: string, enabled = true) {
  return useQuery({
    queryKey: flashEncounterQueryKey(encounterId),
    queryFn: () => fetchFlashEncounter(encounterId),
    enabled: enabled && !!encounterId,
    staleTime: 0,
    retry: 1,
  })
}

export function useFlashAssignment(assignmentId: string, enabled = true) {
  return useQuery({
    queryKey: flashAssignmentQueryKey(assignmentId),
    queryFn: () => fetchFlashAssignment(assignmentId),
    enabled: enabled && !!assignmentId,
    staleTime: 10_000,
    retry: 1,
  })
}

function useMarkFlashStateStale() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: FLASH_QUERY_ROOT, refetchType: 'none' })
  }
}

export function useLocateFlashAppearance() {
  return useMutation({
    mutationFn: (input: { appearanceId: string; location: FlashLocationSnapshot }) =>
      locateFlashAppearance(input.appearanceId, input.location),
  })
}

export function useAnswerFlashEncounter() {
  const queryClient = useQueryClient()
  const markStale = useMarkFlashStateStale()
  return useMutation({
    mutationFn: answerFlashEncounter,
    retry: (failureCount, error) => failureCount < 4 && getFlashApiErrorCode(error) === 'FLASH_STORY_GENERATION_PENDING',
    retryDelay: 1_600,
    onSuccess: (response, input) => {
      queryClient.setQueryData(flashEncounterQueryKey(input.encounterId), response)
      markStale()
    },
  })
}

export function useRerollFlashEncounter() {
  const queryClient = useQueryClient()
  const markStale = useMarkFlashStateStale()
  return useMutation({
    mutationFn: rerollFlashEncounter,
    onSuccess: (response, encounterId) => {
      queryClient.setQueryData(flashEncounterQueryKey(encounterId), response)
      markStale()
    },
  })
}

export function useRespondToFlashTaskOffer() {
  const queryClient = useQueryClient()
  const markStale = useMarkFlashStateStale()
  return useMutation({
    mutationFn: respondToFlashTaskOffer,
    onSuccess: (response, input) => {
      if ('npc' in response) queryClient.setQueryData(flashEncounterQueryKey(input.encounterId), response)
      markStale()
    },
  })
}

export function useDeliverFlashTask() {
  const queryClient = useQueryClient()
  const markStale = useMarkFlashStateStale()
  return useMutation({
    mutationFn: deliverFlashTask,
    onSuccess: (response, input) => {
      queryClient.setQueryData(flashEncounterQueryKey(input.encounterId), response)
      markStale()
    },
  })
}

export function useArriveAtFlashAssignment() {
  const queryClient = useQueryClient()
  const markStale = useMarkFlashStateStale()
  return useMutation({
    mutationFn: arriveAtFlashAssignment,
    onSuccess: (response, input) => {
      if (response.assignment) queryClient.setQueryData(flashAssignmentQueryKey(input.assignmentId), response.assignment)
      markStale()
    },
  })
}

export function useSubmitFlashFeedback() {
  const queryClient = useQueryClient()
  const markStale = useMarkFlashStateStale()
  return useMutation({
    mutationFn: submitFlashFeedback,
    onSuccess: (response, input) => {
      if (response.assignment) queryClient.setQueryData(flashAssignmentQueryKey(input.assignmentId), response.assignment)
      markStale()
    },
  })
}

export function useAbandonFlashAssignment() {
  const queryClient = useQueryClient()
  const markStale = useMarkFlashStateStale()
  return useMutation({
    mutationFn: abandonFlashAssignment,
    onSuccess: (_response, assignmentId) => {
      queryClient.removeQueries({ queryKey: flashAssignmentQueryKey(assignmentId) })
      markStale()
    },
  })
}

export function useRetryFlashAssignment() {
  const queryClient = useQueryClient()
  const markStale = useMarkFlashStateStale()
  return useMutation({
    mutationFn: retryFlashAssignment,
    onSuccess: (response, assignmentId) => {
      queryClient.setQueryData(flashAssignmentQueryKey(assignmentId), response)
      markStale()
    },
  })
}

export function useFlashPreferences(enabled = true) {
  return useQuery({
    queryKey: FLASH_PREFERENCES_QUERY_KEY,
    queryFn: fetchFlashPreferences,
    enabled,
    staleTime: 30_000,
  })
}

export function useUpdateFlashPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateFlashPreferences,
    onSuccess: (preferences) => {
      queryClient.setQueryData(FLASH_PREFERENCES_QUERY_KEY, preferences)
      void queryClient.invalidateQueries({ queryKey: FLASH_HOME_QUERY_KEY, refetchType: 'none' })
    },
  })
}
