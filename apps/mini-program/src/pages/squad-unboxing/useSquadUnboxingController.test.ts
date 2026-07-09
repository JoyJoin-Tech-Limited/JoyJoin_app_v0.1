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
})
