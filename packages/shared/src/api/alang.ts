import type { ApiTransport } from "./core.js";
import type {
  AlangProgressRequest,
  AlangGpsRequest,
  AlangChoiceRequest,
  AlangChoiceResponse,
  AlangArrivalResponse,
  AlangStoryArchiveSummary,
  AlangCoordinate,
} from "../alang/missionTypes.js";
import { ALANG_TEST_COORDINATE_SYSTEM } from "../alang/testPointValidation.js";
import type {
  FlashAcceptRequest,
  FlashAssignmentResponse,
  FlashCoordinateRequest,
  FlashEncounterResponse,
  FlashFeedbackRequest,
  FlashHomeResponse,
  FlashLocateResponse,
  FlashPreferenceDto,
  FlashPreferenceUpdateRequest,
} from "../alang/flashTypes.js";

export interface AlangStartMissionRequest {
  targetLocation: AlangCoordinate;
  companionEndLocation: AlangCoordinate;
  coordinateSystem: typeof ALANG_TEST_COORDINATE_SYSTEM;
}

// API DTO types (mirrored from server route responses)
export interface AlangMissionSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  stage: string;
  currentNodeId?: string;
  progressPercent: number;
  isDebugSession: boolean;
}

export interface AlangMissionDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: unknown;
  /**
   * Companion destination is deliberately absent before the companion stage.
   * The server owns that disclosure boundary; clients must not derive it from
   * story content during search.
   */
  routeDestination?: AlangCoordinate;
  /** Internal single-test recovery signal; never used to expose search coordinates. */
  testConfigurationInvalid?: boolean;
  myProgress: {
    progressId: string;
    stage: string;
    currentNodeId: string;
    nodeHistory: string[];
    choicesMade: Array<{ nodeId: string; choiceIndex: number; label: string }>;
    status: string;
    isDebugSession: boolean;
    arrivedAt?: string;
    completedAt?: string;
    archiveId?: string;
  } | null;
}

export interface AlangProgressSnapshot {
  progressId: string;
  stage: string;
  currentNodeId: string;
  nodeHistory: string[];
  choicesMade: Array<{ nodeId: string; choiceIndex: number; label: string }>;
  completed?: boolean;
  archiveId?: string;
  /** Disclosed only after the companion stage is reached. */
  routeDestination?: AlangCoordinate;
  testConfigurationInvalid?: boolean;
}

export interface AlangDebugResetResponse {
  reset: true;
  deletedProgressCount: number;
  deletedArchiveCount: number;
}

export function getAlangMissions(api: ApiTransport): Promise<AlangMissionSummary[]> {
  return api<AlangMissionSummary[]>({ path: "/api/alang/missions", method: "GET" });
}

export function getAlangMissionDetail(api: ApiTransport, slug: string): Promise<AlangMissionDetail> {
  return api<AlangMissionDetail>({ path: `/api/alang/missions/${slug}`, method: "GET" });
}

export function startAlangMission(
  api: ApiTransport,
  slug: string,
  data?: AlangStartMissionRequest,
): Promise<AlangProgressSnapshot> {
  return api<AlangProgressSnapshot>({
    path: `/api/alang/missions/${slug}/start`,
    method: "POST",
    ...(data ? { data } : {}),
  });
}

export function reportAlangProgress(api: ApiTransport, slug: string, data: AlangProgressRequest): Promise<{ ok: boolean; stage: string; currentNodeId: string }> {
  return api<{ ok: boolean; stage: string; currentNodeId: string }>({
    path: `/api/alang/missions/${slug}/progress`,
    method: "POST",
    data,
  });
}

export function reportAlangGps(api: ApiTransport, slug: string, data: AlangGpsRequest): Promise<AlangArrivalResponse> {
  return api<AlangArrivalResponse>({
    path: `/api/alang/missions/${slug}/gps`,
    method: "POST",
    data,
  });
}

export function submitAlangChoice(api: ApiTransport, slug: string, data: AlangChoiceRequest): Promise<AlangChoiceResponse> {
  return api<AlangChoiceResponse>({
    path: `/api/alang/missions/${slug}/choice`,
    method: "POST",
    data,
  });
}

export function recoverAlangMission(api: ApiTransport, slug: string): Promise<AlangProgressSnapshot> {
  return api<AlangProgressSnapshot>({
    path: `/api/alang/missions/${slug}/recover`,
    method: "GET",
  });
}

export function completeAlangMission(api: ApiTransport, slug: string): Promise<{ archiveId: string }> {
  return api<{ archiveId: string }>({
    path: `/api/alang/missions/${slug}/complete`,
    method: "POST",
  });
}

export function abandonAlangMission(api: ApiTransport, slug: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>({
    path: `/api/alang/missions/${slug}/abandon`,
    method: "POST",
  });
}

export function getAlangStoryArchives(api: ApiTransport): Promise<AlangStoryArchiveSummary[]> {
  return api<AlangStoryArchiveSummary[]>({ path: "/api/alang/archives", method: "GET" });
}

export function getAlangArchiveDetail(api: ApiTransport, archiveId: string): Promise<AlangStoryArchiveSummary> {
  return api<AlangStoryArchiveSummary>({ path: `/api/alang/archives/${archiveId}`, method: "GET" });
}

export function alangDebugForceNode(api: ApiTransport, slug: string, nodeId: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>({
    path: `/api/alang/debug/missions/${slug}/force-node`,
    method: "POST",
    data: { nodeId },
  });
}

export function alangDebugReset(api: ApiTransport, slug: string): Promise<AlangDebugResetResponse> {
  return api<AlangDebugResetResponse>({
    path: `/api/alang/debug/missions/${slug}/reset`,
    method: "POST",
  });
}

export function alangDebugMockGps(
  api: ApiTransport,
  slug: string,
  latitude: number,
  longitude: number,
): Promise<AlangArrivalResponse> {
  return api<AlangArrivalResponse>({
    path: `/api/alang/debug/missions/${slug}/mock-gps`,
    method: "POST",
    data: { latitude, longitude },
  });
}

export function alangDebugMockArrival(
  api: ApiTransport,
  slug: string,
): Promise<AlangArrivalResponse> {
  return api<AlangArrivalResponse>({
    path: `/api/alang/debug/missions/${slug}/mock-gps`,
    method: "POST",
    data: { mode: "arrive" },
  });
}

export function getFlashHome(
  api: ApiTransport,
  coordinate: FlashCoordinateRequest,
): Promise<FlashHomeResponse> {
  return api<FlashHomeResponse>({
    path: "/api/alang/flash/home",
    method: "POST",
    data: coordinate,
  });
}

export function locateFlashNpc(
  api: ApiTransport,
  appearanceId: string,
  coordinate: FlashCoordinateRequest,
): Promise<FlashLocateResponse> {
  return api<FlashLocateResponse>({
    path: `/api/alang/flash/appearances/${appearanceId}/locate`,
    method: "POST",
    data: coordinate,
  });
}

export function getFlashEncounter(
  api: ApiTransport,
  encounterId: string,
): Promise<FlashEncounterResponse> {
  return api<FlashEncounterResponse>({
    path: `/api/alang/flash/encounters/${encounterId}`,
    method: "GET",
  });
}

export function answerFlashEncounter(
  api: ApiTransport,
  encounterId: string,
  data: { questionId: string; optionId: string },
): Promise<FlashEncounterResponse> {
  return api<FlashEncounterResponse>({
    path: `/api/alang/flash/encounters/${encounterId}/answer`,
    method: "POST",
    data,
  });
}

export function rerollFlashTask(
  api: ApiTransport,
  encounterId: string,
): Promise<FlashEncounterResponse> {
  return api<FlashEncounterResponse>({
    path: `/api/alang/flash/encounters/${encounterId}/reroll`,
    method: "POST",
  });
}

export function respondToFlashTask(
  api: ApiTransport,
  encounterId: string,
  data: FlashAcceptRequest,
): Promise<FlashAssignmentResponse | FlashEncounterResponse> {
  return api<FlashAssignmentResponse | FlashEncounterResponse>({
    path: `/api/alang/flash/encounters/${encounterId}/accept`,
    method: "POST",
    data,
  });
}

export function deliverFlashTask(
  api: ApiTransport,
  encounterId: string,
  assignmentId: string,
): Promise<FlashEncounterResponse> {
  return api<FlashEncounterResponse>({
    path: `/api/alang/flash/encounters/${encounterId}/deliver`,
    method: "POST",
    data: { assignmentId },
  });
}

export function getFlashAssignment(
  api: ApiTransport,
  assignmentId: string,
): Promise<FlashAssignmentResponse> {
  return api<FlashAssignmentResponse>({
    path: `/api/alang/flash/assignments/${assignmentId}`,
    method: "GET",
  });
}

export function arriveAtFlashTask(
  api: ApiTransport,
  assignmentId: string,
  coordinate: FlashCoordinateRequest,
): Promise<FlashAssignmentResponse & { distanceMeters: number; arrived: boolean }> {
  return api<FlashAssignmentResponse & { distanceMeters: number; arrived: boolean }>({
    path: `/api/alang/flash/assignments/${assignmentId}/arrive`,
    method: "POST",
    data: coordinate,
  });
}

export function submitFlashFeedback(
  api: ApiTransport,
  assignmentId: string,
  data: FlashFeedbackRequest,
): Promise<FlashAssignmentResponse> {
  return api<FlashAssignmentResponse>({
    path: `/api/alang/flash/assignments/${assignmentId}/feedback`,
    method: "POST",
    data,
  });
}

export function abandonFlashTask(api: ApiTransport, assignmentId: string): Promise<{ ok: true }> {
  return api<{ ok: true }>({
    path: `/api/alang/flash/assignments/${assignmentId}/abandon`,
    method: "POST",
  });
}

export function getFlashPreferences(api: ApiTransport): Promise<FlashPreferenceDto> {
  return api<FlashPreferenceDto>({ path: "/api/alang/flash/preferences", method: "GET" });
}

export function updateFlashPreferences(
  api: ApiTransport,
  data: FlashPreferenceUpdateRequest,
): Promise<FlashPreferenceDto> {
  return api<FlashPreferenceDto>({
    path: "/api/alang/flash/preferences",
    method: "PUT",
    data,
  });
}

export function deleteFlashPreferenceTag(api: ApiTransport, tagId: string): Promise<FlashPreferenceDto> {
  return api<FlashPreferenceDto>({
    path: `/api/alang/flash/preferences/tags/${tagId}`,
    method: "DELETE",
  });
}
