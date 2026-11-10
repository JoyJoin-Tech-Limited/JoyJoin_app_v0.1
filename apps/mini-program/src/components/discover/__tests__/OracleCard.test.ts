// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../OracleCard.tsx', import.meta.url), 'utf8')
const scssSource = readFileSync(new URL('../../../pages/discover/index.scss', import.meta.url), 'utf8')

describe('OracleCard area de-duplication', () => {
  it('splits the pool title into theme + area so the area is stated once', () => {
    expect(source).toContain('const rawTitleLabel = (pool.title || \'悦聚活动\').trim()')
    expect(source).toContain('const titleAreaMatch = rawTitleLabel.match(/^(.*)\\s*·\\s*(.+)$/)')
    expect(source).toContain('const titleLabel = titleAreaMatch ? titleAreaMatch[1] : rawTitleLabel')
    expect(source).toContain("const areaLabel = titleAreaMatch?.[2] || pool.district || ''")
  })

  it('renders the where-line from city + the single resolved area label', () => {
    expect(source).toContain("className='oracle-card__fact-location'")
    expect(source).toContain('{pool.city}{areaLabel ? ` ${areaLabel}` : \'\'}')
    // The raw district must not be printed a second time.
    expect(source).not.toContain('{pool.district ? ` ${pool.district}` : \'\'}')
  })
})

describe('OracleCard phone legibility', () => {
  it('keeps the event name and location readable instead of fine print', () => {
    expect(scssSource).toMatch(/&__title\s*\{[^}]*font-size:\s*30rpx/)
    expect(scssSource).toMatch(/&__fact-location\s*\{[^}]*font-size:\s*28rpx/)
  })

  it('uses the brand numeric face for the time run', () => {
    expect(scssSource).toMatch(/&__fact-time\s*\{[^}]*@include type-en-brand-numeric/)
  })
})

describe('status rail composition', () => {
  it('groups the participant count and the deadline inside one chip', () => {
    expect(source).toContain("className='oracle-card__status-rail'")
    expect(source).toContain("className='oracle-card__status-chip'")
    expect(source).toContain("className='oracle-card__status-count'")
    expect(source).toContain('oracle-card__status-deadline')
  })

  it('no longer pins a floating corner badge to the vignette', () => {
    expect(source).not.toContain('oracle-card__corner-stat')
    expect(source).not.toContain('oracle-card--has-corner-stat')
    expect(scssSource).not.toContain('&__corner-stat')
    expect(scssSource).not.toContain('$oracle-badge-clearance')
  })

  it('gives both chips the same shell so the rail reads as one header', () => {
    expect(scssSource).toMatch(/&__status-pill,\s*&__status-chip\s*\{/)
  })
})

describe('people row composition', () => {
  it('moves the chemistry badge beside the seat count, off the date line', () => {
    const factRowAt = source.indexOf("className='oracle-card__fact-when-row'")
    const peopleRowAt = source.indexOf("className='oracle-card__people-row'")
    const badgeAt = source.indexOf("className='oracle-card__celebration-badge'")

    expect(factRowAt).toBeGreaterThan(-1)
    expect(peopleRowAt).toBeGreaterThan(factRowAt)
    expect(badgeAt).toBeGreaterThan(peopleRowAt)
    expect(scssSource).toMatch(/&__people-row\s*\{/)
  })

  it('renders a face per seated member instead of an early overflow counter', () => {
    const stripSource = readFileSync(new URL('../ParticipantPresenceStrip.tsx', import.meta.url), 'utf8')
    expect(stripSource).toContain('const MAX_VISIBLE_COINS = 10')
    // Never show more faces than there are people, even if the sample array is longer.
    expect(stripSource).toContain('Math.min(MAX_VISIBLE_COINS, totalPresence)')
  })
})
