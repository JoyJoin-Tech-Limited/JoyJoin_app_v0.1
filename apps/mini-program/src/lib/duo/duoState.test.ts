import { describe, expect, it } from 'vitest'
import { resolveDuoCardState, type DuoCardStateInput } from './duoState'

function input(overrides: Partial<DuoCardStateInput> = {}): DuoCardStateInput {
  return {
    isLoading: false,
    isError: false,
    serverState: undefined,
    mode: 'solo',
    hasShared: false,
    ...overrides,
  }
}

describe('resolveDuoCardState', () => {
  it('defaults to the collapsed single-row state', () => {
    expect(resolveDuoCardState(input())).toBe('collapsed')
    expect(resolveDuoCardState(input({ serverState: 'none' }))).toBe('collapsed')
  })

  it('loading and local error take precedence over everything else', () => {
    expect(resolveDuoCardState(input({ isLoading: true, serverState: 'bound' }))).toBe('loading')
    expect(resolveDuoCardState(input({ isError: true, serverState: 'waiting', mode: 'duo' }))).toBe('error')
  })

  it('bound is always server-derived, even in solo mode', () => {
    expect(resolveDuoCardState(input({ serverState: 'bound', mode: 'solo' }))).toBe('bound')
    expect(resolveDuoCardState(input({ serverState: 'bound', mode: 'duo', hasShared: true }))).toBe('bound')
  })

  it('duo selection expands pre-share and waits post-share', () => {
    expect(resolveDuoCardState(input({ mode: 'duo' }))).toBe('expanded')
    expect(resolveDuoCardState(input({ mode: 'duo', hasShared: true }))).toBe('waiting')
  })

  it('picking 1人 back pre-share returns to collapsed (spec §A.5)', () => {
    expect(resolveDuoCardState(input({ serverState: 'waiting', mode: 'solo' }))).toBe('collapsed')
  })

  it('restores waiting from a share timestamp even if the server still says none', () => {
    expect(resolveDuoCardState(input({ serverState: 'none', mode: 'duo', hasShared: true }))).toBe('waiting')
  })
})
