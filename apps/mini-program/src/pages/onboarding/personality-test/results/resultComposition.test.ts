import { describe, expect, it } from 'vitest'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import {
  buildAuthUserResultState,
  buildResultCardComposition,
} from './resultHelpers'

describe('personality result card composition boundaries', () => {
  it('omits serial on a no-session auth revisit while retaining genuine canonical metadata', () => {
    const authResult = buildAuthUserResultState({ id: 'user-revisit', primaryArchetype: 'koala' })

    const composition = buildResultCardComposition({
      archetype: authResult?.result.primaryArchetype,
      sessionId: undefined,
    })

    expect(composition.serialNumber).toBeUndefined()
    expect(composition.archetypeRank).toBe(7)
    expect(composition.skillSet).toBeDefined()
    expect(composition.skillSet?.activeSkill.name).toBeTruthy()
  })

  it('uses canonical primaryArchetype before legacy display copy for mixed auth fields', () => {
    const authResult = buildAuthUserResultState({
      id: 'user-mixed',
      archetype: '开心柯基',
      primaryArchetype: 'koala',
    })

    expect(authResult?.result.primaryArchetype).toBe('koala')
    expect(archetypeRegistry[authResult?.result.primaryArchetype ?? '']?.name).toBe('树洞考拉')

    const composition = buildResultCardComposition({
      archetype: authResult?.result.primaryArchetype,
      sessionId: null,
    })
    expect(composition).toMatchObject({
      archetypeRank: 7,
      serialNumber: undefined,
    })
    expect(composition.skillSet).toBeDefined()
  })

  it('resolves legacy display-name-only auth without changing the canonical result contract', () => {
    const authResult = buildAuthUserResultState({ archetype: '开心柯基' })

    expect(authResult?.result.primaryArchetype).toBe('corgi')
    expect(archetypeRegistry[authResult?.result.primaryArchetype ?? '']?.name).toBe('社牛柯基')
  })

  it('omits skills and rank for an unknown archetype and never invents a serial', () => {
    expect(buildResultCardComposition({
      archetype: '未登记命格',
      sessionId: undefined,
    })).toEqual({
      skillSet: undefined,
      archetypeRank: undefined,
      serialNumber: undefined,
    })
  })

  it('keeps a real anonymous session serial deterministic without affecting canonical rank', () => {
    const input = { archetype: 'koala', sessionId: 'anonymous-session-1' }
    const first = buildResultCardComposition(input)
    const second = buildResultCardComposition(input)

    expect(first.serialNumber).toMatch(/^#\d{5}$/)
    expect(first.serialNumber).toBe(second.serialNumber)
    expect(first.archetypeRank).toBe(7)
    expect(first.skillSet).toBeDefined()
  })
})
