import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const card = readFileSync(resolve(here, '..', 'components', 'WarmupCardSlot.tsx'), 'utf-8')
const warmup = readFileSync(resolve(here, '..', 'phases', 'WarmupPhaseView.tsx'), 'utf-8')
const phaseViews = readFileSync(resolve(here, '..', 'SessionPhaseViews.tsx'), 'utf-8')
const page = readFileSync(resolve(here, '..', 'index.tsx'), 'utf-8')

describe('acknowledgment-beat-v1 warmup wiring', () => {
  it('defaults the server flag off and computes one table-level assignment', () => {
    expect(page).toContain('acknowledgmentBeatEnabled: features?.icebreakerAcknowledgmentBeatEnabled ?? false')
    expect(phaseViews).toContain('acknowledgmentBeatEnabled={props.acknowledgmentBeatEnabled}')
    expect(warmup).toContain('assignAcknowledgmentBeat({')
    expect(warmup).toContain('isTestMode')
    expect(warmup).toContain('runBots')
  })

  it('renders a static cue in the existing bottom slot with no new interaction', () => {
    expect(card).toContain('shouldShowAcknowledgmentBeat({')
    expect(card).toContain("className='warmup-card-slot__ack-beat'")
    expect(card).toContain('{ACKNOWLEDGMENT_BEAT_CUE}')
    const cueBlock = card.split("className='warmup-card-slot__ack-beat'")[1]?.split('</Text>')[0] ?? ''
    expect(cueBlock).not.toContain('onClick')
    expect(cueBlock).not.toContain('role=')
    expect(card).toContain('!showAcknowledgmentBeat')
  })

  it('emits assignment once per session and response view once per visible topic', () => {
    expect(card).toContain('acknowledgmentAssignmentTrackedRef')
    expect(card).toContain('acknowledgmentBeatViewTrackedRef')
    expect(card).toContain("'warmup_acknowledgment_assignment'")
    expect(card).toContain("'warmup_response_beat_view'")
    expect(card).toContain('buildAcknowledgmentBeatMetadata(')
    expect(card).toContain('topicId: currentTopic.id')
    expect(card).toContain('topicSetRevision')
    expect(card).toContain('if (!showAcknowledgmentBeat || !isFlipped || state !== \'topic_card\') return')
    expect(card).toContain('currentTopic.id')
  })

  it('uses server-confirmed pool context, persistent claims and occlusion-safe delayed exposure', () => {
    expect(phaseViews).toContain('poolGroupContext={session.poolGroupContext}')
    expect(warmup).toContain('poolGroupContext,')
    expect(page).toContain('acknowledgmentExposureAllowed: isPageVisible && !highPriorityOverlayVisible')
    expect(warmup).toContain('acknowledgmentExposureAllowed && !ritualGateOpen && !showCelebration')
    expect(card).toContain('claimAcknowledgmentBeatExposure')
    expect(card).toContain('buildAcknowledgmentAssignmentStorageKey')
    expect(card).toContain('buildAcknowledgmentViewStorageKey')
    expect(card).toContain('!acknowledgmentExposureAllowed')
    expect(card).toContain('ACKNOWLEDGMENT_EXPOSURE_DELAY_MS')
    expect(card).toContain('return () => clearTimeout(timer)')
  })
})
