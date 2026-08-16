import { describe, expect, it } from 'vitest'
import { decodeFlashRouteParam, getFlashCanonicalRoute } from './flashNavigation'

describe('Flash canonical screen routing', () => {
  it('decodes display parameters without throwing on malformed input', () => {
    expect(decodeFlashRouteParam('%E9%BB%98%E9%BB%98')).toBe('默默')
    expect(decodeFlashRouteParam('%25E5%258D%2597%25E5%25B1%25B1%25E5%258C%25BA')).toBe('南山区')
    expect(decodeFlashRouteParam(
      Array.from({ length: 5 }).reduce<string>((value) => encodeURIComponent(value), '宝安区'),
    )).toBe('宝安区')
    expect(decodeFlashRouteParam('100%')).toBe('100%')
    expect(decodeFlashRouteParam('%E9%BB', '这位朋友')).toBe('这位朋友')
    expect(decodeFlashRouteParam(undefined)).toBe('')
  })

  it('maps every recoverable server screen to the formal subpackage page', () => {
    expect(getFlashCanonicalRoute({ canonicalScreen: 'map', appearanceId: 'a 1' }))
      .toBe('/pages/alang/search/index?appearanceId=a%201')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'dialogue', encounterId: 'e1' }))
      .toBe('/pages/alang/dialogue/index?encounterId=e1')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'dialogue', encounterId: 'e2', storyEpisode: { code: 's1-p2-alang' } } as any))
      .toBe('/pages/alang-story/dialogue/index?encounterId=e2')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'dialogue', encounterId: 'e3', storyEpisode: { code: 's1-p3-momo' } } as any))
      .toBe('/pages/alang-story/dialogue/index?encounterId=e3')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'dialogue', encounterId: 'e4', storyEpisode: { code: 's1-p2-lizi' } } as any))
      .toBe('/pages/alang-story/dialogue/index?encounterId=e4')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'dialogue', encounterId: 'e5', storyEpisode: { code: 's1-p3-shiqi' } } as any))
      .toBe('/pages/alang-story/dialogue/index?encounterId=e5')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'task', assignmentId: 't1' }))
      .toBe('/pages/alang/companion/index?assignmentId=t1')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'feedback', assignmentId: 't1' }))
      .toBe('/pages/alang/result/index?assignmentId=t1')
  })

  it('accepts the retired radar screen name only as a cached-route alias', () => {
    expect(getFlashCanonicalRoute({ canonicalScreen: 'radar', appearanceId: 'legacy' }))
      .toBe('/pages/alang/search/index?appearanceId=legacy')
  })

  it('fails safely to home when a canonical entity id is missing', () => {
    expect(getFlashCanonicalRoute({ canonicalScreen: 'dialogue' })).toBe('/pages/alang/event/index')
    expect(getFlashCanonicalRoute({ canonicalScreen: 'unavailable' })).toBe('/pages/alang/event/index')
  })

})
