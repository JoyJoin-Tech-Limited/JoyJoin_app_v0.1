import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(process.cwd(), 'src')

describe('Atuan first-arrival asset ownership', () => {
  it('keeps Alang subpackage assets out of shared main-package components', () => {
    const prelude = readFileSync(resolve(sourceRoot, 'components/alang/story-unit/AtuanArrivalPrelude.tsx'), 'utf8')
    const storyUnit = readFileSync(resolve(sourceRoot, 'components/alang/story-unit/FlashStoryUnit.tsx'), 'utf8')

    expect(prelude).not.toContain('pages/alang/assets')
    expect(storyUnit).not.toContain('pages/alang/assets')
  })

  it('loads the scene and both highlight layers from the Alang dialogue subpackage', () => {
    const dialoguePage = readFileSync(resolve(sourceRoot, 'pages/alang/dialogue/index.tsx'), 'utf8')

    expect(dialoguePage).toContain("../assets/ui/flash-atuan-park-clean-v2.webp")
    expect(dialoguePage).toContain("../assets/ui/flash-atuan-character-cutout-v2.webp")
    expect(dialoguePage).toContain("../assets/ui/flash-atuan-bag-cutout-v2.webp")
    expect(dialoguePage).toContain('atuanArrivalAssets={{')
  })
})
