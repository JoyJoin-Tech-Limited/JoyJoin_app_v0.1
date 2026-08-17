import { getFlashFirstActExperienceContract } from '@joyjoin/shared/alang/flashFirstActExperience'

/**
 * The four rebuilt first acts are a flat, scene-driven contract even when an
 * older database snapshot still contains the retired v2 pilot document.
 * Resolve the content at the service boundary so deploys remain compatible
 * before and after the forward data migration is applied.
 */
export function resolveFlashFirstActRuntimeContent(unitId: string, storedContent: unknown): any {
  const contract = getFlashFirstActExperienceContract(unitId)
  if (!contract) return storedContent

  const stored = storedContent && typeof storedContent === 'object' && (storedContent as { v?: number }).v !== 2
    ? storedContent as Record<string, unknown>
    : {}

  return {
    ...stored,
    opening: contract.opening,
    action: contract.action,
    discovery: contract.discovery,
    question: {
      id: `${unitId}-first-act-response-v1`,
      prompt: contract.prompt,
      options: contract.approaches.map((approach) => ({
        id: approach.id,
        label: approach.label,
        tags: [],
      })),
    },
    responseByOption: Object.fromEntries(
      contract.approaches.map((approach) => [approach.id, approach.response]),
    ),
    closing: contract.closing,
  }
}
