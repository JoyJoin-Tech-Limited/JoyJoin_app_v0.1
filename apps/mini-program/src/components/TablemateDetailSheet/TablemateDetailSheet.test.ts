// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')
const scssSource = readFileSync(new URL('./index.scss', import.meta.url), 'utf8')

describe('TablemateDetailSheet structural contract', () => {
  it('is a bottom sheet in the DuoInfoSheet family (fixed mask + bottom surface)', () => {
    expect(source).toContain("className='tablemate-sheet'")
    expect(source).toContain("className='tablemate-sheet__backdrop'")
    expect(source).toContain("'tablemate-sheet__surface'")
    expect(source).toContain("role='dialog'")
    expect(scssSource).toContain('z-index: $z-modal')
    expect(scssSource).toContain('justify-content: flex-end')
    expect(scssSource).toContain('animation: fade-slide-up') // keyframes live in _mixins.scss
  })

  it('shows FULL connection point copy — never the pill-shortened display text', () => {
    expect(source).toContain('stripConnectionPointParens')
    expect(source).not.toContain('shortenConnectionPointForPill')
    expect(source).toContain("你们的连接点")
  })

  it('keeps every hook above the visibility early-return (rules-of-hooks)', () => {
    const earlyReturn = source.indexOf('if (!visible || !member) return null')
    expect(earlyReturn).toBeGreaterThan(0)
    for (const hook of ['useState', 'useEffect', 'useMemo', 'useCallback']) {
      const lastHookCall = source.lastIndexOf(`${hook}(`)
      expect(lastHookCall).toBeLessThan(earlyReturn)
    }
  })

  it('renders a static surface variant under reduce-motion', () => {
    expect(source).toContain("'tablemate-sheet__surface tablemate-sheet__surface--static'")
    expect(scssSource).toContain('&--static')
    expect(scssSource).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('carries the pair-temperature tier tint language on the hero chip', () => {
    expect(source).toContain('tablemate-sheet__temp-chip--')
    expect(scssSource).toContain('$chemistry-warm-text')
    expect(scssSource).toContain('$chemistry-mild-text')
  })

  it('falls back through avatar → archetype asset → MissingArchetypePlaceholder', () => {
    expect(source).toContain('ARCHETYPE_ASSET_MAP')
    expect(source).toContain('<MissingArchetypePlaceholder')
    expect(source).toContain('setAvatarFailed')
  })

  it('caps section sizes so the sheet never overflows small screens', () => {
    expect(source).toContain('MAX_CONNECTION_POINTS = 3')
    expect(source).toContain('MAX_INTEREST_TAGS = 6')
    expect(scssSource).toContain('max-height: calc(100dvh - 160rpx)')
  })

  it('wraps the export in React.memo to avoid parent re-render noise', () => {
    expect(source).toContain('export default memo(TablemateDetailSheet)')
  })

  it('blocks page scroll-through while the sheet is open (catchMove)', () => {
    expect(source).toContain("className='tablemate-sheet' catchMove")
  })

  it('supports swipe-down-to-close on the handle and hero chrome only', () => {
    expect(source).toContain('pullStartYRef')
    expect(source).toContain('handlePullStart')
    expect(source).toContain('handlePullEnd')
    expect(source).toContain('endY - startY > 60')
    // The gesture must NOT be attached to the inner ScrollView body.
    const scrollIndex = source.indexOf("className='tablemate-sheet__scroll'")
    const scrollTag = source.slice(scrollIndex, source.indexOf('>', scrollIndex))
    expect(scrollTag).not.toContain('onTouchStart')
  })

  it('tints connection-point dots by rarity and wraps copy in quote marks', () => {
    expect(source).toContain('tablemate-sheet__point-dot--${point.rarity}')
    expect(source).toContain('「{point.text}」')
    expect(scssSource).toContain('&--rare')
    expect(scssSource).toContain('&--epic')
  })

  it('surfaces the numeric chemistry score in the section title, not the chip', () => {
    expect(source).toContain('你们的连接点{chemistryScore != null')
    expect(source).toContain('` · 默契 ${chemistryScore}`')
  })

  it('renders a warm empty state when there are no connection points or tags', () => {
    expect(source).toContain('悦仔还没读到你们的交集，这正是现场聊天的理由。')
    expect(scssSource).toContain('&__empty {')
  })

  it('lets the hero avatar open full-screen preview only for real avatars', () => {
    expect(source).toContain('Taro.previewImage')
    expect(source).toContain('if (!usingAvatar || !member?.avatarUrl) return')
    expect(source).toContain("'tablemate-sheet__hero-avatar--tappable'")
  })

  it('fades the hero image in on load (same progressive reveal as the card)', () => {
    expect(source).toContain("imageLoaded ? 'tablemate-sheet__hero-img--loaded' : ''")
    expect(scssSource).toContain('&--loaded')
  })

  it('uses the display font for the member name and closes on 现场见', () => {
    expect(scssSource).toContain('font-family: $font-cn-display;')
    expect(source).toContain('现场见')
  })
})
