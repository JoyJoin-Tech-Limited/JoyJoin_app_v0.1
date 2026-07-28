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
})
