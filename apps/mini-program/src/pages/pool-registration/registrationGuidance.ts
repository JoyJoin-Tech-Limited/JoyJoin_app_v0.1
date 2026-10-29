export interface RegistrationDecisionNote {
  benefit: string
  facts: string[]
}

function cleanFact(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanAvailableFact(value: string | null | undefined): string {
  const cleaned = cleanFact(value)
  return cleaned === '待定' || cleaned === '时间待定' || cleaned === '地点待定' ? '' : cleaned
}

/**
 * Step-0 decision guidance is deliberately deterministic. It uses only the
 * already-fetched event facts and never infers suitability or adds a request.
 */
export function buildRegistrationDecisionNote(input: {
  dateTimeLabel?: string | null
  area?: string | null
}): RegistrationDecisionNote {
  const dateTimeLabel = cleanAvailableFact(input.dateTimeLabel)
  const area = cleanAvailableFact(input.area)
  const facts = [
    dateTimeLabel ? `时间：${dateTimeLabel}` : '',
    area ? `地点：${area}` : '',
  ].filter(Boolean)

  return {
    benefit: '先看时间、地点和费用是否合适，再决定是否留座。',
    facts: facts.slice(0, 2),
  }
}

export function buildBudgetSelectionEcho(label: string): string {
  const cleanLabel = cleanFact(label)
  return cleanLabel ? `已记下你的预算：${cleanLabel}。` : ''
}

/** Keep the echo concise even when every intent is selected. */
export function buildIntentSelectionEcho(labels: string[]): string {
  const cleanLabels = labels.map(cleanFact).filter(Boolean)
  if (cleanLabels.length === 0) return ''
  if (cleanLabels.length > 2) {
    return `已记下 ${cleanLabels.length} 个期待：${cleanLabels.slice(0, 2).join('、')}等。`
  }
  return `已记下你的期待：${cleanLabels.join('、')}。`
}

/**
 * A restored draft may already contain selections; only an explicit handler
 * calls this gate. The caller stores `hasShown` for the page visit, so step
 * back-navigation and payment rejoin cannot replay the echo.
 */
export function shouldShowFirstSelectionEcho(input: {
  hasShown: boolean
  selectionCount: number
}): boolean {
  return (
    !input.hasShown &&
    Number.isInteger(input.selectionCount) &&
    input.selectionCount > 0
  )
}
