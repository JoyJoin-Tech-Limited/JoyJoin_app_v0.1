import Taro from '@tarojs/taro'
import { apiRequest } from '../api/api'
import {
  getAlangMissions,
  getAlangMissionDetail,
  startAlangMission,
  reportAlangProgress,
  reportAlangGps,
  submitAlangChoice,
  recoverAlangMission,
  completeAlangMission,
  abandonAlangMission,
  getAlangStoryArchives,
  getAlangArchiveDetail,
  alangDebugForceNode,
  alangDebugReset,
  alangDebugMockGps,
  alangDebugMockArrival,
} from '@shared/api'
import type { AlangStartMissionRequest } from '@shared/api'
import type { AlangGpsRequest, AlangChoiceRequest } from '@shared/alang/missionTypes'

export async function fetchAlangMissions() {
  return getAlangMissions(apiRequest)
}

export async function fetchAlangMissionDetail(slug: string) {
  return getAlangMissionDetail(apiRequest, slug)
}

export type StartAlangMissionInput = string | ({ slug: string } & AlangStartMissionRequest)

export async function callStartMission(input: StartAlangMissionInput) {
  if (typeof input === 'string') return startAlangMission(apiRequest, input)
  const { slug, ...configuration } = input
  return startAlangMission(apiRequest, slug, configuration)
}

export async function callReportProgress(slug: string, nodeId: string) {
  return reportAlangProgress(apiRequest, slug, { nodeId })
}

export async function callReportGps(slug: string, data: AlangGpsRequest) {
  return reportAlangGps(apiRequest, slug, data)
}

export async function callSubmitChoice(slug: string, data: AlangChoiceRequest) {
  return submitAlangChoice(apiRequest, slug, data)
}

export async function callRecoverMission(slug: string) {
  return recoverAlangMission(apiRequest, slug)
}

export async function callCompleteMission(slug: string) {
  return completeAlangMission(apiRequest, slug)
}

export async function callAbandonMission(slug: string) {
  return abandonAlangMission(apiRequest, slug)
}

export async function fetchStoryArchives() {
  return getAlangStoryArchives(apiRequest)
}

export async function fetchArchiveDetail(archiveId: string) {
  return getAlangArchiveDetail(apiRequest, archiveId)
}

export async function callDebugForceNode(slug: string, nodeId: string) {
  return alangDebugForceNode(apiRequest, slug, nodeId)
}

export async function callDebugReset(slug: string) {
  return alangDebugReset(apiRequest, slug)
}

export async function callDebugMockGps(slug: string, latitude: number, longitude: number) {
  return alangDebugMockGps(apiRequest, slug, latitude, longitude)
}

export async function callDebugMockArrival(slug: string) {
  return alangDebugMockArrival(apiRequest, slug)
}

// GPS helpers
export function getCurrentPosition(): Promise<Taro.getLocation.SuccessCallbackResult> {
  return new Promise((resolve, reject) => {
    Taro.getLocation({
      type: 'gcj02',
      success: resolve,
      fail: reject,
    })
  })
}

export function startLocationChange(
  callback: (res: Taro.onLocationChange.CallbackResult) => void,
  onError?: (error: unknown) => void
): () => void {
  let disposed = false
  Taro.startLocationUpdate({
    success: () => {
      if (disposed) {
        Taro.stopLocationUpdate()
        return
      }
      Taro.onLocationChange(callback)
    },
    fail: (error) => {
      onError?.(error)
    },
  })
  return () => {
    disposed = true
    Taro.offLocationChange(callback)
    Taro.stopLocationUpdate()
  }
}

export function haversine(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const R = 6371000
  const dLat = ((latitude2 - latitude1) * Math.PI) / 180
  const dLng = ((longitude2 - longitude1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((latitude1 * Math.PI) / 180) *
      Math.cos((latitude2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
