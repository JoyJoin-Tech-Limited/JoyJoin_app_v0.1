// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')

describe('squad-unboxing page composition', () => {
  it('delegates orchestration to useSquadUnboxingController', () => {
    expect(pageSource).toContain("from './useSquadUnboxingController'")
    expect(pageSource).toContain('useSquadUnboxingController(')
    expect(pageSource).not.toContain('useQuery<PoolGroupDetailsResponse>')
  })
})
