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

describe('MiniScriptConfigModal interaction and layout contract', () => {
  it('uses click activation rather than relying on touch-end selection', () => {
    expect(source).toContain("className='ms-card__hit-target'")
    expect(source).toContain("className='ms-genre-card__hit-target'")
    expect(source).toContain('onClick={() => handleSelectStyle(card.key)}')
    expect(source).toContain('onClick={() => handleToggleGenre(card.key as MiniScriptGenre)}')
    expect(source).not.toContain('onTouchStart=')
    expect(source).not.toContain('onTouchEnd=')
    expect(source).not.toContain('onTouchCancel=')
  })

  it('puts a dedicated tap target above native poster images', () => {
    expect(styles).toMatch(/&__hit-target\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?z-index:\s*3;/)
    expect(styles).toMatch(/&__thumb\s*\{[\s\S]*?pointer-events:\s*none;/)
  })

  it('escapes transformed and scrollable ancestors through the WeChat root portal', () => {
    expect(source).toContain("import { View, Text, Image, ScrollView, RootPortal } from '@tarojs/components'")
    expect(source).toContain('<RootPortal>')
    expect(source).toContain('</RootPortal>')
  })

  it('puts the card grids in a vertical ScrollView and uses full poster art', () => {
    expect(source).toContain("<ScrollView className='ms-modal__content' scrollY")
    expect(source).toContain('card.posterPath ? cdnAsset(card.posterPath) : undefined')
    expect(source).toContain('src={posterPath}')
  })

  it('starts with every PM-approved genre selected', () => {
    expect(source).toContain('initialGenres = [...MINI_SCRIPT_GENRES]')
  })

  it('allows the server-side generation pipeline to finish before timing out', () => {
    expect(sessionSource).toContain('const MINISCRIPT_GENERATION_TIMEOUT_MS = 35_000')
    expect(sessionSource).toMatch(/path:\s*'\/api\/miniscript\/generate',[\s\S]*?timeout:\s*MINISCRIPT_GENERATION_TIMEOUT_MS/)
  })
})
