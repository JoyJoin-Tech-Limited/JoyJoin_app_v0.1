import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = resolve(
  process.cwd(),
  'src/pages/icebreaker-session/overlays/MiniScriptConfigModal.tsx',
)
const source = readFileSync(sourcePath, 'utf8')
const styles = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.scss'),
  'utf8',
)
const sessionSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.tsx'),
  'utf8',
)
const generationHookSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/hooks/useMiniScriptGeneration.ts'),
  'utf8',
)

describe('MiniScriptConfigModal interaction and layout contract', () => {
  it('uses click activation rather than relying on touch-end selection', () => {
    expect(source).toContain("className='ms-card__hit-target'")
    expect(source).toContain('onClick={() => handleSelectStyle(card.key)}')
    expect(source).toContain('onClick={() => toggleGenre(genre.key as MiniScriptGenre)}')
    expect(source).not.toContain('onTouchStart=')
    expect(source).not.toContain('onTouchEnd=')
    expect(source).not.toContain('onTouchCancel=')
  })

  it('puts a dedicated tap target above native poster images', () => {
    expect(styles).toMatch(/&__hit-target\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?z-index:\s*3;/)
    expect(styles).toMatch(/&__thumb\s*\{[\s\S]*?pointer-events:\s*none;/)
  })

  it('escapes transformed and scrollable ancestors through the WeChat root portal', () => {
    expect(source).toContain("RootPortal, ScrollView")
    expect(source).toContain('<RootPortal>')
    expect(source).toContain('</RootPortal>')
  })

  it('puts the card grids in a vertical ScrollView and uses full poster art', () => {
    expect(source).toContain("<ScrollView className='ms-modal__content' scrollY")
    expect(source).toContain('card.posterPath ? cdnAsset(card.posterPath) : undefined')
    expect(source).toContain('src={poster}')
  })

  it('starts with every PM-approved genre selected', () => {
    expect(source).toContain('const DEFAULT_INITIAL_GENRES: MiniScriptGenre[] = [...MINI_SCRIPT_GENRES]')
    expect(source).toContain('initialGenres = DEFAULT_INITIAL_GENRES')
  })

  it('resets picker state only when the modal opens, never on re-renders', () => {
    // Regression guard: an inline spread default gave initialGenres a new identity
    // every render, retriggering the reset effect and wiping the selected style
    // before 生成新剧本 could fire (stuck style buttons, zero network traffic).
    expect(source).not.toContain('initialGenres = [...MINI_SCRIPT_GENRES]')
    expect(source).toContain('const wasOpenRef = useRef(false)')
    expect(source).toContain('const justOpened = open && !wasOpenRef.current')
  })

  it('shows genre selection as compact selected chips on the library page', () => {
    expect(source).toContain("' ms-library__genre--selected'")
    expect(styles).toMatch(/&__genre\s*\{[\s\S]*?&--selected\s*\{/)
  })

  it('offers an always-visible dismiss button (backdrop is display:none)', () => {
    expect(source).toContain("className='ms-modal__close'")
    expect(source).toContain("aria-label='关闭'")
    expect(source).toContain('onClick={onClose}')
    expect(styles).toMatch(/&__close\s*\{[\s\S]*?width:\s*88rpx;[\s\S]*?height:\s*88rpx;/)
  })

  it('allows the server-side generation pipeline to finish before timing out', () => {
    expect(generationHookSource).toContain('const MINISCRIPT_GENERATION_TIMEOUT_MS = 35_000')
    expect(generationHookSource).toMatch(/path:\s*'\/api\/miniscript\/generate',[\s\S]*?timeout:\s*MINISCRIPT_GENERATION_TIMEOUT_MS/)
  })
})
