import type { MissionContent } from '@shared/alang/contentSchema'
import type { AlangMissionProgress } from '@shared/schema'

const ROUTE_DISCLOSURE_STAGES = new Set([
  'companion',
  'arrived',
  'closing',
  'result',
  'completed',
])

/** The companion endpoint becomes client-visible only after search/dialogue. */
export function canRevealCompanionDestination(
  progress: AlangMissionProgress | null,
): boolean {
  return !!progress && ROUTE_DISCLOSURE_STAGES.has(progress.stage)
}

/**
 * Story structure may be public, but GPS triggers and default points never are.
 * A separate stage-gated response field carries the companion destination.
 */
export function redactMissionCoordinates(content: MissionContent): MissionContent {
  const meta = content.meta ? { ...content.meta } : undefined
  if (meta) {
    delete meta.defaultTargetLocation
    delete meta.defaultCompanionEndLocation
  }
  return {
    ...content,
    meta,
    nodes: content.nodes.map((node) => {
      const safeNode = { ...node }
      delete safeNode.gpsTrigger
      return safeNode
    }),
  }
}
