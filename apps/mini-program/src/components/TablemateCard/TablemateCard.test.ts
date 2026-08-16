// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')
const scssSource = readFileSync(new URL('./index.scss', import.meta.url), 'utf8')

describe('TablemateCard structural contract', () => {
  it('delegates pill rendering to ConnectionPointPill', () => {
    expect(source).toContain("import ConnectionPointPill from '../ConnectionPointPill'")
    expect(source).toContain('<ConnectionPointPill')
  })

  it('uses the H5-safe CSS-variable shadow pattern (no inline rpx geometry)', () => {
    expect(source).toContain("'--tablemate-card-shadow-color': accent.shadow")
    expect(source).toContain("'--tablemate-card-edge-color': accent.edgeHighlight")
    expect(source).not.toMatch(/boxShadow:.*\d+rpx/)
  })

  it('wraps the export in React.memo to avoid parent re-render noise', () => {
    expect(source).toContain('export default memo(TablemateCard)')
  })

  it('lazy-loads card art', () => {
    expect(source).toContain('lazyLoad')
  })

  it('falls back through avatar → archetype asset → MissingArchetypePlaceholder', () => {
    expect(source).toContain('ARCHETYPE_ASSET_MAP')
    expect(source).toContain('<MissingArchetypePlaceholder')
  })

  it('gates the image skeleton shimmer under reduced motion', () => {
    const reduceMotionIndex = scssSource.indexOf('&--reduce-motion')
    expect(reduceMotionIndex).toBeGreaterThanOrEqual(0)
    const blockEnd = scssSource.indexOf('\n  }', reduceMotionIndex)
    const reduceMotionBlock = scssSource.slice(reduceMotionIndex, blockEnd)
    expect(reduceMotionBlock).toContain('.tablemate-card__art-skeleton')
    expect(reduceMotionBlock).toContain('animation: none !important')
  })

  it('exposes an aria-label with name, archetype, age, temperature, and self marker', () => {
    expect(source).toContain("aria-label={ariaLabel}")
    expect(source).toContain("const ariaLabel")
    expect(source).toContain("isCurrentUser ? '我' : ''")
    expect(source).toContain('`默契：${temperatureWord}`')
  })

  it('mounts at the hidden start pose then flips to dealt for the entrance transition', () => {
    expect(source).toContain('const [entered, setEntered] = useState(alreadyDealtRef.current)')
    expect(source).toContain('const isDealt = dealt && entered')
    expect(source).toContain("isDealt ? 'tablemate-card--dealt'")
  })

  it('deals each hand only once per session via the dealKey cache', () => {
    expect(source).toContain('const dealtOnceKeys = new Set<string>()')
    expect(source).toContain('dealtOnceKeys.add(cacheKey)')
    expect(source).toContain('dealKey?: string')
    // The holo sheen is a one-shot show — cached re-deals must not replay it.
    expect(source).toContain('!alreadyDealtRef.current')
  })

  it('throttles tap haptics across card instances', () => {
    expect(source).toContain('CARD_HAPTIC_INTERVAL_MS')
    expect(source).toContain('lastCardHapticAt')
  })

  it('always deals a full 4-row face via the fallback hook pill', () => {
    expect(source).toContain("const fallbackHook = connectionPoint || interestHook ? '' : '打个招呼吧'")
    expect(source).toContain('<ConnectionPointPill text={interestHook || fallbackHook} rarity=\'common\' />')
  })

  it('pins the temperature chip inside the art zone as a corner badge', () => {
    const artIndex = source.indexOf("className='tablemate-card__art'")
    const tempIndex = source.indexOf("'tablemate-card__temp-chip'")
    const infoIndex = source.indexOf("className='tablemate-card__info'")
    expect(artIndex).toBeGreaterThanOrEqual(0)
    expect(tempIndex).toBeGreaterThan(artIndex)
    expect(tempIndex).toBeGreaterThanOrEqual(0)
    expect(infoIndex).toBeGreaterThan(tempIndex)
    expect(scssSource).toContain('position: absolute;\n    top: $spacing-sm;\n    right: $spacing-sm;')
  })

  it('fades card art in on load instead of popping', () => {
    expect(source).toContain("imageLoaded ? 'tablemate-card__art-img--loaded' : ''")
    expect(scssSource).toContain('&--loaded')
  })

  it('marks the viewer with an inline name-row chip, not an art-zone overlay badge', () => {
    expect(source).toContain("className='tablemate-card__me-chip'")
    expect(source).not.toContain('tablemate-card__me-badge')
    expect(scssSource).toContain('&__me-chip {')
  })

  it('tints the loading skeleton with the archetype colour via a CSS variable', () => {
    expect(source).toContain("'--tablemate-card-skeleton-color': accent.skeleton")
    expect(scssSource).toContain('background: var(--tablemate-card-skeleton-color);')
  })

  it('renders the mapped chemistry-tier icon on the temperature chip', () => {
    expect(source).toContain('CHEMISTRY_TIER_EMOJI[temperatureTier].emoji')
    expect(source).toContain("className='tablemate-card__temp-chip-icon'")
    expect(scssSource).toContain('&__temp-chip-icon {')
  })
})
