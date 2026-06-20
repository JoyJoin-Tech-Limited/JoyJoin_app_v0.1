import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const componentPath = path.resolve(currentDir, 'PhaseIconCarousel.tsx')

describe('PhaseIconCarousel assets', () => {
  it('keeps explicit local image references so WeChat does not prune phase icons', () => {
    const source = readFileSync(componentPath, 'utf8')

    expect(source).toContain('<Image src="/assets/landing-phase-icons/phase-topic-card.png" />')
    expect(source).toContain('<Image src="/assets/landing-phase-icons/phase-quip-battle.png" />')
    expect(source.match(/<Image src="\/assets\/landing-phase-icons\/phase-[^"]+\.png" \/>/g)).toHaveLength(6)
  })
})
