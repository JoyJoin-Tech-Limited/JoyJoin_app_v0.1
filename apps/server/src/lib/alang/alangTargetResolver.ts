import type { MissionContent, StoryNode } from "@shared/alang/contentSchema";
import {
  normalizeAlangCoordinate,
  type AlangCoordinate,
} from "@shared/alang/missionTypes";

export type AlangArrivalTargetKind = "search" | "companion";

interface MissionLocationSource {
  targetLocation?: unknown;
  companionEndLocation?: unknown;
}

interface ProgressLocationSource {
  targetLocation?: unknown;
  companionEndLocation?: unknown;
}

interface ResolveAlangArrivalTargetOptions {
  mission: MissionLocationSource;
  progress?: ProgressLocationSource | null;
  content: MissionContent;
  kind: AlangArrivalTargetKind;
  currentNode?: StoryNode | null;
  requireProgressCoordinates?: boolean;
}

/**
 * One coordinate authority for both route display and 5 m arrival checks.
 * Per-run progress points win so an internal test never falls back to another
 * run or the demo story. Mission/content values remain a compatibility path
 * only for non-test flows where progress coordinates are not required.
 */
export function resolveAlangArrivalTarget({
  mission,
  progress,
  content,
  kind,
  currentNode,
  requireProgressCoordinates = false,
}: ResolveAlangArrivalTargetOptions): AlangCoordinate | null {
  const expectedNodeType = kind === "companion" ? "companion_move" : "search_gate";
  const matchingCurrentNode = currentNode?.type === expectedNodeType
    ? currentNode
    : null;
  const matchingContentNode = content.nodes.find((node) => node.type === expectedNodeType);
  const progressCoordinate = kind === "companion"
    ? progress?.companionEndLocation
    : progress?.targetLocation;
  const persistedMissionCoordinate = kind === "companion"
    ? mission.companionEndLocation
    : mission.targetLocation;
  const contentDefault = kind === "companion"
    ? content.meta?.defaultCompanionEndLocation
    : content.meta?.defaultTargetLocation;

  const configuredProgressCoordinate = normalizeAlangCoordinate(progressCoordinate);
  if (configuredProgressCoordinate) return configuredProgressCoordinate;
  if (requireProgressCoordinates) return null;

  for (const candidate of [
    persistedMissionCoordinate,
    matchingCurrentNode?.gpsTrigger,
    matchingContentNode?.gpsTrigger,
    contentDefault,
  ]) {
    const coordinate = normalizeAlangCoordinate(candidate);
    if (coordinate) return coordinate;
  }

  return null;
}
