// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')
const indexPageSource = readFileSync(new URL('../../index/index.tsx', import.meta.url), 'utf8')

describe('personality test entry routing contract (2026-09-03)', () => {
  it('never redirects a guest with a completed anonymous snapshot straight to results', () => {
    expect(pageSource).not.toContain('hasAnonymousAssessmentResult')
    expect(pageSource).not.toMatch(
      /isAnonymousAssessmentSessionCompleted\(snapshot\)[^)]*\|\|[\s\S]{0,120}personalityTestResults/
    )
  })

  it('keeps the landing guest-restore skipping completed snapshots', () => {
    expect(indexPageSource).toContain('isAnonymousAssessmentSessionCompleted')
  })

  it('starts a fresh session from the intro (handleStart clears stored anonymous state)', () => {
    expect(pageSource).toContain('clearAnonymousAssessmentStorage')
  })
})
