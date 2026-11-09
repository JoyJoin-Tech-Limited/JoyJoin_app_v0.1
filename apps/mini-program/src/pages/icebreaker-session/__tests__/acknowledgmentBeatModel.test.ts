import { describe, expect, it } from 'vitest'
import {
  ACKNOWLEDGMENT_BEAT_EXPERIMENT_ID,
  ACKNOWLEDGMENT_BEAT_CUE,
  assignAcknowledgmentBeat,
  buildAcknowledgmentBeatMetadata,
  shouldShowAcknowledgmentBeat,
} from '../viewModels/acknowledgmentBeatModel'

function forTable(eventPoolGroupId = 'pool-group-001') {
  return {
    enabled: true,
    icebreakerSessionId: eventPoolGroupId,
    poolGroupContext: { eventPoolGroupId, poolId: 'pool-001' },
    isTestMode: false,
    runBots: false,
  }
}

const base = forTable()

describe('acknowledgment beat assignment', () => {
  it('requires the flag, route id and server-confirmed real pool-group context', () => {
    expect(assignAcknowledgmentBeat({ ...base, enabled: false }).eligible).toBe(false)
    expect(assignAcknowledgmentBeat({ ...base, icebreakerSessionId: '' }).eligible).toBe(false)
    expect(assignAcknowledgmentBeat({ ...base, poolGroupContext: null }).eligible).toBe(false)
    expect(assignAcknowledgmentBeat({ ...base, poolGroupContext: undefined }).eligible).toBe(false)
    expect(assignAcknowledgmentBeat({
      ...base,
      poolGroupContext: { eventPoolGroupId: 'another-group', poolId: 'pool-001' },
    }).eligible).toBe(false)
    expect(assignAcknowledgmentBeat({
      ...base,
      poolGroupContext: { eventPoolGroupId: base.icebreakerSessionId, poolId: '' },
    }).eligible).toBe(false)
  })

  it('rejects test, bot and non-pool sessions rather than relabeling their ids', () => {
    expect(assignAcknowledgmentBeat({ ...base, isTestMode: true }).eligible).toBe(false)
    expect(assignAcknowledgmentBeat({ ...base, runBots: true }).eligible).toBe(false)
    const blindBox = { ...base, icebreakerSessionId: 'blind-box-1', poolGroupContext: null }
    expect(assignAcknowledgmentBeat(blindBox).eligible).toBe(false)
    expect(buildAcknowledgmentBeatMetadata(assignAcknowledgmentBeat(blindBox))).toBeNull()
  })

  it('is deterministic for the same table and stable across input objects', () => {
    const first = assignAcknowledgmentBeat(base)
    const second = assignAcknowledgmentBeat({ ...base })
    expect(first).toEqual(second)
    expect(first.eligible).toBe(true)
    expect(first.experimentId).toBe(ACKNOWLEDGMENT_BEAT_EXPERIMENT_ID)
    expect(['control', 'treatment']).toContain(first.variant)
  })

  it('assigns both variants across a realistic set of tables', () => {
    const variants = new Set(
      Array.from({ length: 40 }, (_, index) =>
        assignAcknowledgmentBeat(forTable(`pool-group-${index}`)).variant,
      ),
    )
    expect(variants).toEqual(new Set(['control', 'treatment']))
  })

  it('uses only server-confirmed pool/group attribution', () => {
    const experiment = assignAcknowledgmentBeat(base)
    expect(buildAcknowledgmentBeatMetadata(experiment)).toEqual({
      experimentId: ACKNOWLEDGMENT_BEAT_EXPERIMENT_ID,
      variant: experiment.variant,
      eventPoolGroupId: base.icebreakerSessionId,
      poolId: 'pool-001',
    })
    expect(buildAcknowledgmentBeatMetadata({
      ...experiment,
      icebreakerSessionId: 'polymorphic-other-id',
    })).toBeNull()
  })
})

describe('acknowledgment beat display precedence', () => {
  const experiment = { ...assignAcknowledgmentBeat(base), variant: 'treatment' as const }
  const visible = {
    experiment,
    state: 'topic_card',
    isFlipped: true,
    showPermissionLine: false,
    showDeepPrompt: false,
  }

  it('shows only on the visible flipped topic card for treatment', () => {
    expect(shouldShowAcknowledgmentBeat(visible)).toBe(true)
    expect(shouldShowAcknowledgmentBeat({ ...visible, isFlipped: false })).toBe(false)
    expect(shouldShowAcknowledgmentBeat({ ...visible, state: 'intro' })).toBe(false)
    expect(shouldShowAcknowledgmentBeat({ ...visible, experiment: { ...experiment, variant: 'control' } })).toBe(false)
  })

  it('never displaces permission or deep-pouch guidance', () => {
    expect(shouldShowAcknowledgmentBeat({ ...visible, showPermissionLine: true })).toBe(false)
    expect(shouldShowAcknowledgmentBeat({ ...visible, showDeepPrompt: true })).toBe(false)
  })

  it('uses the frozen copy', () => {
    expect(ACKNOWLEDGMENT_BEAT_CUE).toBe('先接一句，再换题；不想展开也可以。')
  })
})
