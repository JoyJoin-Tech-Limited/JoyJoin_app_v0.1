// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const hookPath = resolve(dirname(fileURLToPath(import.meta.url)), 'useSquadUnboxingController.ts')

describe('useSquadUnboxingController flowState derivation', () => {
  const source = readFileSync(hookPath, 'utf8')

  it('re-derives flowState when groupId changes', () => {
    expect(source).toContain('prevGroupIdRef')
    expect(source).toContain("prevGroupIdRef.current === groupId")
    expect(source).toContain("setFlowState(readRevealFlag(groupId) ? 'revealed' : 'ready')")
  })

  it('guards handleOpenBox so it only runs in ready state', () => {
    expect(source).toContain("if (flowState !== 'ready') return")
  })

  it('distinguishes box taps from ribbon reveals in analytics', () => {
    expect(source).toContain("(source: 'box' | 'ribbon' = 'box')")
    expect(source).toContain("if (source === 'box')")
    expect(source).toContain("squad_unboxing_box_tap")
  })

  it('reads the persisted reveal flag from storage', () => {
    expect(source).toContain('jj_revealed_${groupId}')
    expect(source).toContain('Taro.getStorageSync')
  })

  it('derives interactivity from the persisted reveal flag (first visit = face-down game)', () => {
    // First visit (no flag): interactive → cards land face-down and flips are
    // playable. Re-entry (flag present): all-up, zero unflipped, no hint chip.
    expect(source).toContain('setIsInteractiveSession(!readRevealFlag(groupId))')
    expect(source).toMatch(/isInteractiveSession\s*\?\s*computeUnflippedCount/)
  })
})

// Tap-to-reveal wiring (AC-13): flip state is controller-owned, focus stays
// page-owned. The pure flip session is injected with host timers + analytics
// and recreated per groupId; story mode seeds deterministic face-up sets.
describe('useSquadUnboxingController flip-state wiring (tap-to-reveal)', () => {
  const source = readFileSync(hookPath, 'utf8')

  it('creates one flip session per groupId with injectable timers + analytics', () => {
    expect(source).toContain('createSquadFlipSession')
    expect(source).toContain('flipSessionGroupRef')
    expect(source).toContain('flipSessionGroupRef.current !== groupId')
    expect(source).toContain('setTimer: (cb, ms) => setTimeout(cb, ms)')
    expect(source).toContain('squadUnboxingAnalytics.track')
  })

  it('subscribes to the session snapshot and destroys it on unmount', () => {
    expect(source).toContain('session.subscribe(')
    expect(source).toContain('flipSessionRef.current?.destroy()')
  })

  it('exposes flipOne / flipAll / isFlipInFlight / notifyDealSettled wrappers', () => {
    expect(source).toContain('flipSessionRef.current!.flipOne(id, method')
    expect(source).toContain('flipSessionRef.current!.flipAll(')
    expect(source).toContain('flipSessionRef.current!.isFlipInFlight()')
    expect(source).toContain('flipSessionRef.current!.notifyDealSettled({')
  })

  it('attaches roster index + best-partner meta to every flip for analytics', () => {
    expect(source).toContain('members.findIndex((member) => member.userId === id)')
    expect(source).toContain('isBestPartner: id === bestPartnerUserId')
  })

  it('computes the best partner in the controller (viewer pair chemistry, roster tie-break)', () => {
    expect(source).toContain('computeBestPartnerUserId(members, currentUserId, viewerPairByMemberId)')
  })

  it('does NOT persist flip state — mid-game cold re-entry renders all-up (REL-02)', () => {
    // Flip sets live entirely in the pure session module: no Taro storage
    // anywhere in squadFlipState.ts. Only the group reveal flag hits storage.
    const flipModule = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'squadFlipState.ts'),
      'utf8',
    )
    expect(flipModule).not.toContain('StorageSync')
    expect(flipModule).not.toContain("from '@tarojs/taro'")
    // The only persisted key in the controller is the group reveal flag.
    const storageHits = source.match(/Taro\.setStorageSync\([^)]*\)/g) ?? []
    expect(storageHits).toHaveLength(1)
    expect(storageHits[0]).toContain('getRevealFlagKey')
    expect(source).toContain('jj_revealed_${groupId}')
  })

  it('seeds story-mode face-up sets without analytics or timers', () => {
    expect(source).toContain("storyName === 'revealed-partial'")
    expect(source).toContain("storyName === 'revealed-allup'")
    expect(source).toContain("storyName === 'focused'")
    expect(source).toContain('flipSessionRef.current?.seedFlipped(')
    const storyBlock = source.split('Story-mode seeding')[1]?.split('const groupThemeHighlights')[0] ?? ''
    expect(storyBlock).not.toContain('track(')
  })
})
