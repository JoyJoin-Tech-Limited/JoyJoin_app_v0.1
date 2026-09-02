import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.resolve(__dirname, 'ArchetypeSpritesheet.tsx'),
  'utf8',
)

describe('ArchetypeSpritesheet first paint', () => {
  it('keeps the cropped sheet hidden until WeChat finishes decoding it', () => {
    expect(source).toContain('opacity: imgLoaded ? 1 : 0')
    expect(source).toContain('onLoad={() => setImgLoaded(true)}')
    expect(source).toContain('lazyLoad={false}')
  })

  it('restores the placeholder before retrying the CDN sheet', () => {
    expect(source).toContain('setImgLoaded(false)')
    expect(source).toContain('setUseCdn(true)')
  })
})

describe('ArchetypeSpritesheet decode shimmer (WS-4)', () => {
  it('mounts the shimmer overlay while the sheet is still decoding', () => {
    expect(source).toContain('archetype-spritesheet__shimmer')
    expect(source).toContain('{!imgLoaded && !imgFailed ? (')
  })

  it('unmounts the shimmer once the sheet has decoded', () => {
    // The shimmer mount condition requires !imgLoaded, so a successful
    // onLoad (setImgLoaded(true)) removes the overlay.
    expect(source).toContain('onLoad={() => setImgLoaded(true)}')
    expect(source).toMatch(/!imgLoaded && !imgFailed[\s\S]*archetype-spritesheet__shimmer/)
  })

  it('keeps the shimmer running during the CDN-fallback retry', () => {
    // On local failure the component flips to the CDN sheet WITHOUT setting
    // the terminal imgFailed flag, so !imgLoaded && !imgFailed stays true
    // and the shimmer keeps pulsing through the retry.
    expect(source).toContain('setUseCdn(true)')
    expect(source).toContain('setImgFailed(true)')
    expect(source).toMatch(/if \(useCdn\) \{[\s\S]*setImgFailed\(true\)[\s\S]*\} else \{[\s\S]*setUseCdn\(true\)/)
  })
})
