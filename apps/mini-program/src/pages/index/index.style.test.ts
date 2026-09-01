// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const landingPageSource = readFileSync(new URL('./LandingPage.tsx', import.meta.url), 'utf8')
const landingPageStyleSource = readFileSync(new URL('./index.scss', import.meta.url), 'utf8')

describe('mini-program landing page styles', () => {
  it('avoids web-only CSS features that WeChat devtools handles unreliably', () => {
    expect(landingPageStyleSource).not.toMatch(/\baspect-ratio\s*:/)
    expect(landingPageStyleSource).not.toMatch(/background-clip\s*:\s*text/)
    expect(landingPageStyleSource).not.toMatch(/text-fill-color\s*:\s*transparent/)
    expect(landingPageStyleSource).not.toMatch(/\bfilter\s*:/)
    expect(landingPageStyleSource).not.toMatch(/--[A-Za-z0-9_-]+\s*:[^:]/)
    expect(landingPageStyleSource).not.toMatch(/var\(--/)
  })

  it('renders BrandLogo component instead of solid white plate behind the logo', () => {
    expect(landingPageSource).toContain('BrandLogo')
    expect(landingPageSource).not.toContain('className="logo-bg"')
    expect(landingPageStyleSource).not.toContain('background: rgba(255, 255, 255, 0.72);')
  })

  it('keeps a visible spinner in offline and auth-timeout feedback states', () => {
    expect(landingPageSource.match(/landing-page__auth-timeout-spinner/g)?.length).toBeGreaterThanOrEqual(2)
    expect(landingPageStyleSource).toContain('.landing-page__auth-timeout-spinner')
    expect(landingPageStyleSource).toContain('animation: auth-spinner-rotate 0.7s linear infinite;')
  })

  it('shows a visible legal-gate hint when the CTA is tapped before accepting', () => {
    expect(landingPageSource).toContain('landing-page__legal-hint')
    expect(landingPageSource).toContain('setShowLegalHint')
    expect(landingPageStyleSource).toContain('.landing-page__legal-hint')
    expect(landingPageStyleSource).toContain('legal-hint-in')
    expect(landingPageStyleSource).toContain('legal-hint-out')
  })

  it('compacts short (<700px) and mid (700–880px) windows so the hero copy never clips', () => {
    // Tier thresholds (2026-09-01): short raised 640 → 700px; mid tier added
    // for the 700–880px band (iPhone 12/13/14, 11 Pro, 12 mini) where the
    // default ~1733rpx composition clipped the hero text behind the CTA.
    expect(landingPageSource).toContain('setIsShortScreen(windowHeightPx < 700)')
    expect(landingPageSource).toContain('setIsMidScreen(windowHeightPx >= 700 && windowHeightPx < 880)')
    expect(landingPageSource).toContain('"landing-page--mid"')
    expect(landingPageSource).not.toContain('< 640')
    // The spacer collapses with the short tier and slims to 24rpx in mid.
    expect(landingPageSource).toContain('heightRpx={isMidScreen ? 24 : 64}')
    expect(landingPageSource).toContain('collapseBelow={700}')
    // Both compaction tiers exist in the stylesheet with scaled hero stages.
    // Scales are sized against WeChat's nav-exclusive windowHeight: the
    // usable budget is ~1448rpx in the mid band and ~1206rpx on iPhone 8,
    // not the full-screen rpx figures.
    expect(landingPageStyleSource).toContain('.landing-page--mid')
    expect(landingPageStyleSource).toContain('.landing-page--short')
    expect(landingPageStyleSource).toMatch(/\.landing-page--mid\s*\{[\s\S]*?transform:\s*scale\(0\.82\);/)
    expect(landingPageStyleSource).toMatch(/\.landing-page--short\s*\{[\s\S]*?transform:\s*scale\(0\.68\);/)
  })

  it('keeps test login retired and the agreement row in normal flow under the CTA stack', () => {
    expect(landingPageSource).not.toContain('测试账号登录')
    expect(landingPageSource).not.toContain('TestLoginSheet')
    expect(landingPageStyleSource).not.toContain('landing-page__test-login')
    // The old -108rpx/top:108rpx overlay hack (leftover from the retired
    // test-login slot) produced a large gap between the CTAs and the
    // agreement row on standard-height devices; the row now sits in normal
    // flow with its plain 8rpx top margin.
    expect(landingPageStyleSource).not.toMatch(
      /\.landing-page__legal-row\s*\{[\s\S]*?margin-bottom:\s*-108rpx;/,
    )
    expect(landingPageStyleSource).not.toMatch(
      /\.landing-page__legal-row\s*\{[\s\S]*?top:\s*108rpx;/,
    )
    expect(landingPageStyleSource).toContain(
      'padding-bottom: calc(40rpx + env(safe-area-inset-bottom));',
    )
  })
})
