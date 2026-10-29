import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '..', 'index.tsx'), 'utf8')

describe('pool-registration Xiaoyue guidance wiring', () => {
  it('feeds the existing Step-0 letter with the factual decision note', () => {
    expect(source).toContain('decisionNote={stepZeroDecisionNote}')
    expect(source).toContain('buildRegistrationDecisionNote({')
    expect(source).toContain('dateTimeLabel: poolDateTimeLabel')
    expect(source).toContain('area: poolArea')
  })

  it('gates intent echoes from the explicit toggle handler rather than restored form state', () => {
    const handlerStart = source.indexOf('const handleIntentToggle = useCallback(')
    const handlerEnd = source.indexOf('const handleLanguageToggle', handlerStart)
    expect(handlerStart).toBeGreaterThan(-1)
    expect(handlerEnd).toBeGreaterThan(handlerStart)
    const handler = source.slice(handlerStart, handlerEnd)
    expect(handler).toContain('shouldShowFirstSelectionEcho({')
    expect(handler).toContain('hasShown: intentReactionShownRef.current')
    expect(handler).toContain('selectionCount: nextIntent.length')
  })

  it('does not reset one-shot selection gates on back-navigation between steps', () => {
    const effectStart = source.indexOf('// Clear any in-flight reaction on step entry')
    const effectEnd = source.indexOf('// Reward haptic', effectStart)
    expect(effectStart).toBeGreaterThan(-1)
    expect(effectEnd).toBeGreaterThan(effectStart)
    const stepEffect = source.slice(effectStart, effectEnd)
    expect(stepEffect).not.toContain('budgetReactionShownRef.current = false')
    expect(stepEffect).not.toContain('intentReactionShownRef.current = false')
  })

  it('passes the human-readable budget label to the recovery card', () => {
    const resumeCard = source.indexOf('<PoolRegistrationResumeCard')
    expect(resumeCard).toBeGreaterThan(-1)
    const props = source.slice(resumeCard, resumeCard + 400)
    expect(props).toContain('selectedBudget={selectedBudgetLabel}')
    expect(props).not.toContain('selectedBudget={selectedBudget}')
  })
})
