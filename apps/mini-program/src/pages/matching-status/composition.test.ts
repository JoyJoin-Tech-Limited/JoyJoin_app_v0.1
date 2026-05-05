// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')
const sectionsSource = readFileSync(new URL('./MatchingStatusSections.tsx', import.meta.url), 'utf8')
const controllerSource = readFileSync(new URL('./useMatchingStatusController.ts', import.meta.url), 'utf8')

describe('matching-status page composition', () => {
  it('delegates the largest waiting and reveal branches to local sections', () => {
    expect(pageSource).toContain("from './MatchingStatusSections'")
    expect(pageSource).toContain('<MatchingStatusPendingSection')
    expect(pageSource).toContain('<MatchingStatusDetailSections')
    expect(pageSource).toContain('<MatchingStatusLiveOverlay')
    expect(pageSource).not.toContain("className='matching-status__waiting-seat-core'")
    expect(pageSource).not.toContain("className='matching-status__overlay-member-grid'")

    expect(sectionsSource).toContain("className='matching-status__waiting-seat-core'")
    expect(sectionsSource).toContain("className='matching-status__overlay-member-grid'")
  })

  it('moves page-local helper ownership into the view-model module', () => {
    expect(pageSource).toContain("from './matchingStatusViewModels'")
    expect(pageSource).not.toContain('function getWaitingStateCopy')
    expect(pageSource).not.toContain('function getChemistryTokens')
    expect(pageSource).not.toContain('function getCountdownState')
  })

  it('delegates orchestration to useMatchingStatusController', () => {
    expect(pageSource).toContain("from './useMatchingStatusController'")
    expect(pageSource).toContain('useMatchingStatusController(')
    expect(pageSource).not.toContain('useWebSocket(')
    expect(pageSource).not.toContain("queryKey: ['mini-program', 'pool-registration'")
  })

  it('keeps top-level screen-state ownership in the controller', () => {
    expect(pageSource).toContain('screenState')
    expect(pageSource).not.toContain('authLoading || isLoading')
    expect(pageSource).not.toContain('fetchError || !registration')
    expect(pageSource).not.toContain('if (!currentRegistration)')
    expect(controllerSource).toContain('getMatchingStatusScreenState(')
    expect(controllerSource).toContain('resolveMatchingStatusAuthBootstrap(')
    expect(controllerSource).not.toContain('MATCH_PROGRESS_UPDATE')
  })
})