import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/pages/alang/teaser/index.tsx'), 'utf8')

describe('alang teaser copy contract', () => {
  it('does not promise a reminder that has no delivery mechanism', () => {
    expect(source).not.toContain('正式上线时，第一时间告诉你')
    expect(source).not.toContain('requestSubscribeMessage')
    expect(source).not.toContain('Taro.request')
  })

  it('keeps the existing static teaser content and back navigation', () => {
    expect(source).toContain('内测中')
    expect(source).toContain('盒子还没准备好')
    expect(source).toContain('内测结束，就来见你')
    expect(source).toContain('再逛逛')
    expect(source).toContain('Taro.navigateBack')
    expect(source).toContain('/pages/discover/index')
  })
})
