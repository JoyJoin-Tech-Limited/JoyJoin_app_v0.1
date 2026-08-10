import type { NPCResponseEvent } from './StoryUnitRuntime'
import { getFlashStoryUnitDefinition, type FlashStoryUnitId } from '@shared/alang/flashStorySeason'

export interface NPCResponseContext {
  intro: string
  success?: string | null
}

export function resolveNPCResponse(unitId: FlashStoryUnitId, eventType: NPCResponseEvent, context: NPCResponseContext): string {
  const definition = getFlashStoryUnitDefinition(unitId)
  if (!definition) throw new Error(`Unsupported Flash story unit '${unitId}'`)
  if (eventType === 'INTRO') return context.intro
  if (eventType === 'FIRST_MISTAKE') return definition.firstMistake
  return context.success ?? definition.success
}
