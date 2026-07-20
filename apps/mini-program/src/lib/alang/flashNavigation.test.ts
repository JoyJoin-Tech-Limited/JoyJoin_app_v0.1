import { describe, expect, it } from 'vitest'
import { getFlashCanonicalRoute } from './flashNavigation'

describe('Flash canonical screen routing', () => {
  it('maps every recoverable server screen to the formal subpackage page', () => {
    expect(getFlashCanonicalRoute({ canonicalScreen: 'radar', appearanceId: 'a 1' }))
      .toBe('/pages/alang/search/index?appearanceId=a%201')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'dialogue', encounterId: 'e1' }))
      .toBe('/pages/alang/dialogue/index?encounterId=e1')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'task', assignmentId: 't1' }))
      .toBe('/pages/alang/companion/index?assignmentId=t1')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'feedback', assignmentId: 't1' }))
      .toBe('/pages/alang/result/index?assignmentId=t1')
  })

  it('fails safely to home when a canonical entity id is missing', () => {
    expect(getFlashCanonicalRoute({ canonicalScreen: 'dialogue' })).toBe('/pages/alang/event/index')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'unavailable' })).toBe('/pages/alang/event/index')
  })
})
