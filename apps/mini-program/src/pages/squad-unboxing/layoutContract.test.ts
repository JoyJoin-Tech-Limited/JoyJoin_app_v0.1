// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const pageSource = readFileSync(resolve(here, 'index.tsx'), 'utf8')
const pageStyles = readFileSync(resolve(here, 'index.scss'), 'utf8')
const pageConfig = readFileSync(resolve(here, 'index.config.ts'), 'utf8')

describe('squad unboxing revealed layout contract', () => {
  it('keeps only the attendance action in the fixed bottom dock', () => {
    expect(pageSource).toContain("className='squad-unboxing__confirm-btn'")
    expect(pageSource).not.toContain('截图保存记忆')
    expect(pageSource).not.toContain('查看活动详情')
    expect(pageSource).not.toContain('稍后再看')
    expect(pageSource).not.toContain("className='squad-unboxing__reveal-chip'")
  })

  it('locks the revealed state to the viewport instead of enabling page scroll', () => {
    expect(pageSource).toContain("scrollY={flowState !== 'revealed'}")
    expect(pageConfig).toContain('disableScroll: true')
    expect(pageStyles).toMatch(/&__scroll--revealed\s*\{[\s\S]*?overflow:\s*hidden;/)
    expect(pageStyles).toMatch(/&__scroll-content--revealed\s*\{[\s\S]*?justify-content:\s*center;/)
  })
})
