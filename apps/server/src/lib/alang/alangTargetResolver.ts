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

interface ResolveAlangArrivalTargetOptions {
  mission: MissionLocationSource;
  content: MissionContent;
  kind: AlangArrivalTargetKind;
  currentNode?: StoryNode | null;
}

/**
 * One coordinate authority for both route display and 5 m arrival checks.
 * Persisted mission fields win because they are the operator-configured value;
 * validated content remains a compatibility fallback for older rows.
 */
export function resolveAlangArrivalTarget({
  mission,
  content,
  kind,
  currentNode,
}: ResolveAlangArrivalTargetOptions): AlangCoordinate | null {
  const expectedNodeType = kind === "companion" ? "companion_move" : "search_gate";
  const matchingCurrentNode = currentNode?.type === expectedNodeType
    ? currentNode
    : null;
  const matchingContentNode = content.nodes.find((node) => node.type === expectedNodeType);
  const persisted = kind === "companion"
    ? mission.companionEndLocation
    : mission.targetLocation;
  const contentDefault = kind === "companion"
    ? content.meta?.defaultCompanionEndLocation
    : content.meta?.defaultTargetLocation;

  for (const candidate of [
    persisted,
    matchingCurrentNode?.gpsTrigger,
    matchingContentNode?.gpsTrigger,
    contentDefault,
  ]) {
    const coordinate = normalizeAlangCoordinate(candidate);
    if (coordinate) return coordinate;
  }

  return null;
}
