import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = resolve(
  process.cwd(),
  'src/pages/icebreaker-session/overlays/MiniScriptConfigModal.tsx',
)
const source = readFileSync(sourcePath, 'utf8')

describe('MiniScriptConfigModal interaction and layout contract', () => {
  it('uses click activation rather than relying on touch-end selection', () => {
    expect(source).toContain('onClick={() => handleSelectStyle(card.key)}')
    expect(source).toContain('onClick={() => handleToggleGenre(card.key as MiniScriptGenre)}')
    expect(source).not.toContain('onTouchEnd={() => {')
  })

  it('puts the card grids in a vertical ScrollView and uses full poster art', () => {
    expect(source).toContain("<ScrollView className='ms-modal__content' scrollY")
    expect(source).toContain('card.posterPath ? cdnAsset(card.posterPath) : undefined')
    expect(source).toContain('src={posterPath}')
  })

  it('starts with every PM-approved genre selected', () => {
    expect(source).toContain('initialGenres = [...MINI_SCRIPT_GENRES]')
  })
})
