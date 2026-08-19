import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeFlashRouteParam, getFlashCanonicalRoute, redirectToFlashCanonical } from './flashNavigation'

const mocks = vi.hoisted(() => ({
  redirectTo: vi.fn(),
  getCurrentPages: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    redirectTo: mocks.redirectTo,
    getCurrentPages: mocks.getCurrentPages,
  },
}))

describe('Flash canonical screen routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.redirectTo.mockResolvedValue({})
    mocks.getCurrentPages.mockReturnValue([])
  })

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
      .toBe('/pages/alang-story/dialogue/index?encounterId=e1')
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

  it('preserves the replay session when a later act moves into the story subpackage', () => {
    expect(getFlashCanonicalRoute(
      {
        canonicalScreen: 'dialogue',
        encounterId: 'encounter-replay',
        storyEpisode: { code: 's1-p2-shiqi' },
      } as any,
      { replay: true, replaySession: 'session-42' },
    )).toBe(
      '/pages/alang-story/dialogue/index?encounterId=encounter-replay&replay=1&replaySession=session-42',
    )
  })

  it('converges first and later acts onto one dialogue route instead of creating a two-page cycle', () => {
    const firstActRoute = getFlashCanonicalRoute({
      canonicalScreen: 'dialogue',
      encounterId: 'encounter-1',
      storyEpisode: { code: 's1-p1-alang' },
    } as any)
    const laterActRoute = getFlashCanonicalRoute({
      canonicalScreen: 'dialogue',
      encounterId: 'encounter-1',
      storyEpisode: { code: 's1-p2-alang' },
    } as any)

    expect(firstActRoute).toBe(laterActRoute)
  })

  it('ignores a stale caller after the canonical target is already the real top page', async () => {
    mocks.getCurrentPages.mockReturnValue([{ route: 'pages/alang-story/dialogue/index' }])

    await expect(redirectToFlashCanonical(
      {
        canonicalScreen: 'dialogue',
        encounterId: 'encounter-1',
        storyEpisode: { code: 's1-p2-alang' },
      } as any,
      '/pages/alang/dialogue/index',
    )).resolves.toBe(false)
    expect(mocks.redirectTo).not.toHaveBeenCalled()
  })

  it('recovers when the native runtime supplies a non-string caller path', async () => {
    await expect(redirectToFlashCanonical(
      { canonicalScreen: 'dialogue', encounterId: 'encounter-1' },
      { route: 'pages/alang/dialogue/index' } as unknown as string,
    )).resolves.toBe(true)

    expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang-story/dialogue/index?encounterId=encounter-1',
    })
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
