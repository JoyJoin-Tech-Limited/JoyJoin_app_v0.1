import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SESSION_DIR = resolve(process.cwd(), 'src/pages/icebreaker-session')
const readSrc = (rel: string) => readFileSync(resolve(SESSION_DIR, rel), 'utf8')

const pageSource = readSrc('index.tsx')
const actionsSource = readSrc('hooks/useSocialActions.ts')
const pageStyles = readSrc('index.scss')

/** Strip comments so the host-authority scan matches CODE only — prose that
 *  documents the manual /transfer-host semantics (threshold anchoring) must
 *  not trip the "no client surface" assertion. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/**
 * Wave 3 (icebreaker-uiux-wave3, contract AC-08): 「我离开一下」 self-state
 * entry + host-unreachable informational hint.
 *
 * Red lines locked here:
 *  - leave is self-state only, idempotent, and rejoin restores everything
 *    (POST /:id/leave is the sprint's ONLY new route — §5 路由豁免);
 *  - the host-unreachable hint is PURE information — no claim UI, no
 *    auto-advance wording, and no reference to the manual /transfer-host
 *    route anywhere in the client (host authority 红线);
 *  - every new field (`leftUserIds` / `hostUnreachable`) is consumed via
 *    optional chaining / positive equality so a flag-off snapshot renders
 *    nothing new (AC-03 fallback).
 */
describe('leave entry + host-away hint — wiring (wave3 AC-08)', () => {
  it('useSocialActions posts the self-state marker through the one new route', () => {
    expect(actionsSource).toContain("'/leave'")
    expect(actionsSource).toContain('{ left }')
    expect(actionsSource).toContain('handleToggleLeave')
  })

  it('page consumes leftUserIds optimistically with server reconciliation', () => {
    // Optional-chained consumption: field absent (flag off) → undefined →
    // local optimistic state rules (离开/回来不丢任何本地乐观状态).
    expect(pageSource).toContain('session?.leftUserIds?.includes(currentUserId)')
    expect(pageSource).toContain('serverAway ?? localAway ?? false')
    // Failure/skipped release: an un-applied tap must not wedge the marker.
    expect(pageSource).toContain('setLocalAway(null)')
  })

  it('renders the secondary entry plus the reassurance copy', () => {
    expect(pageSource).toContain('icebreaker__leave-row')
    expect(pageSource).toContain('我离开一下')
    expect(pageSource).toContain('我回来了')
    expect(pageSource).toContain('已暂时离开，不影响大家，回来接着玩')
    // Interactive affordance discipline: haptics + hoverClass on the tap.
    expect(pageSource).toContain("hoverClass='icebreaker__leave-toggle--pressed'")
    expect(pageSource).toContain("haptics('light')")
  })

  it('host-unreachable hint is positive-equality, player-only, and honest', () => {
    // `=== true` only — field absent (flag off) renders nothing.
    expect(pageSource).toContain('session?.hostUnreachable === true')
    // The host never needs to be told they are away themselves.
    expect(pageSource).toContain('!isHost && session?.hostUnreachable === true')
    expect(pageSource).toContain('icebreaker__host-away')
    // Honest, calm copy — and NO auto-advance / auto-transfer wording.
    expect(pageSource).toContain('主持人暂时离开了，大家先聊着，主持人回来就继续～')
    const hintCopy = '主持人暂时离开了，大家先聊着，主持人回来就继续～'
    expect(hintCopy).not.toMatch(/自动|认领|接管/)
  })

  it('no transfer-host surface anywhere in the subpackage client code', () => {
    expect(stripComments(pageSource)).not.toMatch(/transfer-host|transferHost/i)
    expect(stripComments(actionsSource)).not.toMatch(/transfer-host|transferHost/i)
  })

  it('page styles define the leave/host-away BEM blocks', () => {
    for (const selector of [
      '&__host-away {',
      '&__host-away-text {',
      '&__leave-row {',
      '&__leave-note {',
      '&__leave-toggle {',
      '&__leave-toggle--pressed {',
      '&__leave-toggle-text {',
      '&__leave-toggle--away &__leave-toggle-text {',
    ]) {
      expect(pageStyles).toContain(selector)
    }
  })
})
