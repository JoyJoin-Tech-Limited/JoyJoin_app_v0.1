import { getFlashFirstActExperienceContract } from '@joyjoin/shared/alang/flashFirstActExperience'
import { getFlashStoryUnitDefinition, type FlashStoryUnitId } from '@joyjoin/shared/alang/flashStorySeason'
import { getAtuanLaterActDefinition, isAtuanLaterActUnitId } from '@joyjoin/shared/alang/atuanLaterActs'

const LOCAL_TEMPLATE_LATER_ACT_IDS = new Set<FlashStoryUnitId>([
  's1-p2-alang',
  's1-p3-alang',
  's1-p2-lizi',
  's1-p3-lizi',
  's1-p2-momo',
  's1-p3-momo',
  's1-p2-shiqi',
  's1-p3-shiqi',
])

export function isFlashLocalTemplateExperienceUnitId(unitId: string): boolean {
  return Boolean(getFlashFirstActExperienceContract(unitId))
    || unitId === 's1-p1-atuan'
    || unitId === 's1-p2-atuan'
    || unitId === 's1-p3-atuan'
    || LOCAL_TEMPLATE_LATER_ACT_IDS.has(unitId as FlashStoryUnitId)
}

function v2ClosureText(storedContent: unknown): string | null {
  const v2 = storedContent as { nodes?: Record<string, { type?: string; segments?: Array<{ text?: string }>; variants?: Array<{ when?: unknown; segments?: Array<{ text?: string }> }> }> } | null
  if (!v2?.nodes) return null
  const closure = Object.values(v2.nodes).find((node) => node?.type === 'closure')
  if (!closure) return null
  const defaultVariant = closure.variants?.find((variant) => variant.when === 'default')
  const segments = defaultVariant?.segments ?? closure.segments ?? []
  const text = segments.map((segment) => segment.text ?? '').join('')
  return text || null
}

function hasRuntimeQuestion(storedContent: unknown): storedContent is { question: { id: string; options: unknown[] } } {
  const question = storedContent && typeof storedContent === 'object'
    ? (storedContent as { question?: unknown }).question
    : null
  return Boolean(
    question
    && typeof question === 'object'
    && typeof (question as { id?: unknown }).id === 'string'
    && Array.isArray((question as { options?: unknown }).options)
    && (question as { options: unknown[] }).options.length >= 2,
  )
}

function atuanLaterActRuntimeContent(unitId: string, storedContent: unknown): any | null {
  if (!isAtuanLaterActUnitId(unitId)) return null
  if ((storedContent as { v?: unknown } | null)?.v !== 2 && hasRuntimeQuestion(storedContent)) return storedContent

  const definition = getAtuanLaterActDefinition(unitId)
  const stored = storedContent && typeof storedContent === 'object' && (storedContent as { v?: number }).v !== 2
    ? storedContent as Record<string, unknown>
    : {}
  const response = definition.endings[0]?.responseCopy ?? v2ClosureText(storedContent) ?? definition.opening

  return {
    ...stored,
    opening: typeof stored.opening === 'string' ? stored.opening : definition.opening,
    action: typeof stored.action === 'string' ? stored.action : definition.action.prompt,
    discovery: typeof stored.discovery === 'string' ? stored.discovery : definition.action.prompt,
    question: {
      id: `${unitId}-template-response-v1`,
      prompt: definition.action.prompt,
      options: definition.approaches.map((approach, index) => ({
        id: `${unitId}-template-${index === 0 ? 'a' : 'b'}`,
        label: approach.label,
        tags: [],
      })),
    },
    responseByOption: Object.fromEntries(
      definition.approaches.map((_, index) => [
        `${unitId}-template-${index === 0 ? 'a' : 'b'}`,
        definition.endings[index]?.responseCopy ?? response,
      ]),
    ),
    closing: response,
  }
}

/**
 * The four rebuilt first acts are a flat, scene-driven contract even when an
 * older database snapshot still contains the retired v2 pilot document.
 * Resolve the content at the service boundary so deploys remain compatible
 * before and after the forward data migration is applied.
 */
export function resolveFlashFirstActRuntimeContent(unitId: string, storedContent: unknown): any {
  const contract = getFlashFirstActExperienceContract(unitId)
  if (!contract) {
    const atuanLaterAct = atuanLaterActRuntimeContent(unitId, storedContent)
    if (atuanLaterAct) return atuanLaterAct

    const definition = getFlashStoryUnitDefinition(unitId)
    if (!definition || !LOCAL_TEMPLATE_LATER_ACT_IDS.has(unitId as FlashStoryUnitId)) return storedContent
    const stored = storedContent && typeof storedContent === 'object' && (storedContent as { v?: number }).v !== 2
      ? storedContent as Record<string, unknown>
      : {}
    const response = typeof (stored as { closing?: unknown }).closing === 'string'
      ? (stored as { closing: string }).closing
      : v2ClosureText(storedContent) ?? definition.success
    return {
      ...stored,
      opening: typeof stored.opening === 'string' ? stored.opening : definition.goal,
      action: typeof stored.action === 'string' ? stored.action : definition.goal,
      discovery: typeof stored.discovery === 'string' ? stored.discovery : definition.success,
      question: {
        id: `${unitId}-template-response-v1`,
        prompt: definition.goal,
        options: [
          { id: `${unitId}-template-a`, label: definition.goal, tags: [] },
          { id: `${unitId}-template-b`, label: definition.success, tags: [] },
        ],
      },
      responseByOption: {
        [`${unitId}-template-a`]: response,
        [`${unitId}-template-b`]: response,
      },
      closing: response,
    }
  }

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
