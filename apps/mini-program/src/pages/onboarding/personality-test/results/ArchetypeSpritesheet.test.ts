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
    expect(source).toContain('setImgError(true)')
  })
})
