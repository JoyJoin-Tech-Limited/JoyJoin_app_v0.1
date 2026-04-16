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
    expect(landingPageStyleSource).not.toMatch(/--[A-Za-z0-9_-]+\s*:/)
    expect(landingPageStyleSource).not.toMatch(/var\(--/)
  })

  it('uses a glow treatment instead of a solid white plate behind the logo', () => {
    expect(landingPageSource).toContain('className="logo-aura"')
    expect(landingPageSource).not.toContain('className="logo-bg"')
    expect(landingPageStyleSource).toContain('.logo-aura')
    expect(landingPageStyleSource).toMatch(/radial-gradient\(/)
    expect(landingPageStyleSource).not.toContain('background: rgba(255, 255, 255, 0.72);')
  })
})
