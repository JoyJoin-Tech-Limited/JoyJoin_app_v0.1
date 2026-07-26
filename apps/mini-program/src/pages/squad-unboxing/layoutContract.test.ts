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
  it('keeps reveal-all directly above attendance without restoring retired actions', () => {
    expect(pageSource).toContain('squad-unboxing__confirm-btn')
    expect(pageSource).not.toContain('截图保存记忆')
    expect(pageSource).not.toContain('查看活动详情')
    expect(pageSource).not.toContain('稍后再看')
    expect(pageSource).toContain("className='squad-unboxing__reveal-chip'")
    expect(pageSource.indexOf("className='squad-unboxing__reveal-chip'"))
      .toBeLessThan(pageSource.indexOf('squad-unboxing__confirm-btn'))
  })

  it('locks the revealed state to the viewport instead of enabling page scroll', () => {
    expect(pageSource).toContain("scrollY={flowState !== 'revealed'}")
    expect(pageConfig).toContain('disableScroll: true')
    expect(pageStyles).toMatch(/&__scroll--revealed\s*\{[\s\S]*?overflow:\s*hidden;/)
    expect(pageStyles).toMatch(/&__scroll-content--revealed\s*\{[\s\S]*?justify-content:\s*center;/)
  })

  it('keeps the scaled card fan below the navigation bar', () => {
    // 2026-07-24 wow pass: fan scale raised 0.75 → 0.85 (stage clamp grew
    // 560 → 640rpx to absorb the taller scaled two-row fan).
    expect(pageStyles).toContain('transform: translateY(-16rpx) scale(0.85);')
    expect(pageStyles).not.toContain('transform: translateY(-88rpx) scale(0.85);')
  })
})
