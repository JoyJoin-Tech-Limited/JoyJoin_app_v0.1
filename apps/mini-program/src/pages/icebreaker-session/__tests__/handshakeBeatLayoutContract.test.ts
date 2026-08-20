import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(
  resolve(__dirname, '../styles/_glance-stack.scss'),
  'utf8',
)

describe('handshake countdown panel layout contract', () => {
  it('uses a non-shrinking explicit height on WeChat', () => {
    const rule = styles.match(/\.handshake-beat\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

    expect(rule).toContain('flex: 0 0 640rpx;')
    expect(rule).toContain('height: 640rpx;')
    expect(rule).toContain('width: 100%;')
  })
})
