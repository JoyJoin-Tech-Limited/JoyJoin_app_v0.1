// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')
const sectionsSource = readFileSync(new URL('./MatchingStatusSections.tsx', import.meta.url), 'utf8')
const controllerSource = readFileSync(new URL('./useMatchingStatusController.ts', import.meta.url), 'utf8')
const revealCardSource = readFileSync(new URL('./UnifiedRevealCard.tsx', import.meta.url), 'utf8')

describe('matching-status page composition', () => {
  it('delegates the largest waiting and reveal branches to local sections', () => {
    expect(pageSource).toContain("from './MatchingStatusSections'")
    expect(pageSource).toContain('<MatchingStatusPendingSection')
    expect(pageSource).toContain('<MatchingStatusDetailSections')
    expect(pageSource).toContain('<MatchingStatusLiveOverlay')
    expect(pageSource).not.toContain("className='matching-status__waiting-seat-core'")
    expect(pageSource).not.toContain("className='matching-status__overlay-member-carousel'")

    expect(sectionsSource).toContain("className='matching-status__waiting-seat-core'")
    // 桌友 card-deck reskin (2026-08-15): the overlay members view is a
    // TablemateCard carousel, fed by the viewer pair map.
    expect(sectionsSource).toContain("className='matching-status__overlay-member-carousel'")
    expect(sectionsSource).toContain('<TablemateCard')
  })

  it('moves page-local helper ownership into the shared view-model module', () => {
    expect(pageSource).toContain("from '@shared/features/matching-status'")
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

  it('routes unrevealed match CTA into the squad unboxing flow', () => {
    expect(pageSource).toContain('onStartSquadUnboxing={handleStartSquadUnboxing}')
    expect(sectionsSource).toContain('onStartSquadUnboxing()')
    expect(controllerSource).toContain('const handleStartSquadUnboxing = useCallback')
    expect(controllerSource).toContain('replaceWithSquadUnboxing(resolvedGroupId)')
    expect(controllerSource).toContain('if (!hasRevealed && resolvedGroupId)')
  })

  it('routes main matched CTA to the event detail page', () => {
    expect(controllerSource).toContain('const handleOpenMatchedJourney = useCallback')
    expect(controllerSource).toContain('MINI_PROGRAM_ROUTES.eventDetail')
    expect(controllerSource).not.toContain('navigateToMatchedDestination(resolvedGroupId)')
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

  it('renders deterministic shared highlights above the LLM prose, hidden when empty', () => {
    // Guarded by a non-empty check so legacy payloads (no sharedHighlights) render nothing
    expect(revealCardSource).toContain('spotlight.sharedHighlights.length > 0')
    expect(revealCardSource).toContain("className='unified-reveal__highlights'")
    expect(revealCardSource).toContain("className='unified-reveal__highlight-text'")
    // Highlights block must sit between the headline and the prose body
    const headlineIndex = revealCardSource.indexOf("className='unified-reveal__headline'")
    const highlightsIndex = revealCardSource.indexOf("className='unified-reveal__highlights'")
    const bodyIndex = revealCardSource.indexOf("className='unified-reveal__body'")
    expect(headlineIndex).toBeGreaterThanOrEqual(0)
    expect(highlightsIndex).toBeGreaterThan(headlineIndex)
    expect(bodyIndex).toBeGreaterThan(highlightsIndex)
  })
})
