import { describe, expect, it } from 'vitest'
import { decodeFlashRouteParam, getFlashCanonicalRoute } from './flashNavigation'

describe('Flash canonical screen routing', () => {
  it('decodes display parameters without throwing on malformed input', () => {
    let deeplyEncodedDistrict = '宝安区'
    for (let pass = 0; pass < 5; pass += 1) {
      deeplyEncodedDistrict = encodeURIComponent(deeplyEncodedDistrict)
    }

    expect(decodeFlashRouteParam('%E9%BB%98%E9%BB%98')).toBe('默默')
    expect(decodeFlashRouteParam('%25E5%258D%2597%25E5%25B1%25B1%25E5%258C%25BA')).toBe('南山区')
    expect(decodeFlashRouteParam(deeplyEncodedDistrict)).toBe('宝安区')
    expect(decodeFlashRouteParam('100%')).toBe('100%')
    expect(decodeFlashRouteParam('%E9%BB', '这位朋友')).toBe('这位朋友')
    expect(decodeFlashRouteParam(undefined)).toBe('')
  })

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
