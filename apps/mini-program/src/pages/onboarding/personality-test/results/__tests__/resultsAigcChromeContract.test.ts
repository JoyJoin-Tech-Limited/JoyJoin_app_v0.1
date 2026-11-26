/**
 * Source-lock: 气场揭晓 visual refresh + per-surface AIGC disclosure (2026-11-26).
 *
 * The inline "AI 生成内容" chips were removed. Each AI surface instead carries
 * one quiet 22rpx inline disclosure (hero quote, reading masthead), while the
 * detail-sheet footer keeps only the report affordance, gated on the same AIGC
 * meta. This is the product decision from the 2026-11-26 review: no chips, no
 * hidden-only footer disclosure.
 *
 * The reading body keeps a decorative rail without nudging the text off the
 * 40rpx container axis; the toggle follows four visible beats so readers meet
 * the content before the expansion control.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const STAGE_PATH = resolve(__dirname, '../FinalStage.tsx')
const SCSS_PATH = resolve(__dirname, '../index.scss')
const source = readFileSync(STAGE_PATH, 'utf8')
const scss = readFileSync(SCSS_PATH, 'utf8')

describe('personality results AIGC + reading chrome source-lock', () => {
  it('places one quiet disclosure on each AI surface, never in the footer', () => {
    const mounts = source.match(/<AIGCLabel/g) ?? []
    expect(mounts).toHaveLength(2)

    const heroIdx = source.indexOf("className='personality-results__hero-quote-aigc'")
    const readingIdx = source.indexOf("className='personality-results__detail-reading-aigc'")
    const footerIdx = source.indexOf("className='personality-results__detail-footer'")

    expect(heroIdx).toBeGreaterThan(-1)
    expect(readingIdx).toBeGreaterThan(heroIdx)
    expect(footerIdx).toBeGreaterThan(readingIdx)
    expect(source).not.toContain('detail-footer-aigc')
  })

  it('keeps the report affordance meta-gated and drops the masthead badge wrapper', () => {
    expect(source).toContain('<AIContentReportButton')
    expect(source).toContain('shouldShowAIGCLabel(xiaoyueAnalysis?.meta?.aigc)')
    expect(source).toContain('举报“人格测试结果解读”AI 生成内容')
    expect(source).not.toContain('detail-reading-badge')
    expect(scss).not.toContain('detail-reading-badge')
  })

  it('renders the reading toggle after four visible beats', () => {
    const beatsIdx = source.indexOf('readingBeats.slice(1, isDetailExpanded ? undefined : 4)')
    const toggleIdx = source.indexOf('readingBeats.length > 4')
    expect(beatsIdx).toBeGreaterThan(-1)
    expect(toggleIdx).toBeGreaterThan(beatsIdx)
  })

  it('keeps the reading rail non-displacing on the container edge', () => {
    expect(scss).toContain('margin-left: calc(-#{$spacing-md} - 2rpx);')
    expect(scss).toContain('padding-left: $spacing-md;')
    expect(scss).toContain('border-left: 2rpx solid transparent;')
  })

  it('keeps the footer report readable and both disclosures chrome-free', () => {
    // 0,3,0 so the page override wins over the component's 0,2,0 text rule
    // regardless of stylesheet import order.
    expect(scss).toContain('&__detail-footer &__detail-footer-report')
    expect(scss).toContain('.aigc-report-button__text')
    expect(scss).toContain('&__hero-quote-aigc')
    expect(scss).toContain('&__detail-reading-aigc')
  })
})
