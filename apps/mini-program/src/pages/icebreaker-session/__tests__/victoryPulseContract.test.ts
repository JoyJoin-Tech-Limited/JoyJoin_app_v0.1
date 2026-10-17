import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SESSION_DIR = resolve(process.cwd(), 'src/pages/icebreaker-session')
const readSrc = (rel: string) => readFileSync(resolve(SESSION_DIR, rel), 'utf8')

const motionSource = readSrc('styles/_phase-motion.scss')

/**
 * Wave 3 (icebreaker-uiux-wave3, contract AC-09 / plan #35): the unified
 * 「胜利脉冲」 vocabulary. Hard constraints verified here:
 *   - transform/opacity ONLY inside the keyframes;
 *   - every application ≤500ms and riding cubic-bezier(0.22, 1, 0.36, 1);
 *   - exactly ONE reduced-motion block in the mixin, collapsing the pulse
 *     to a 150ms static settle;
 *   - ≥3 win moments consume the SHARED vocabulary (no bespoke per-surface
 *     victory keyframes): 骰子揭晓 / 落槌 / 投票命中.
 */
describe('victory pulse vocabulary (wave3 AC-09)', () => {
  it('defines exactly one shared ice-victory-pulse keyframe block', () => {
    const defs = motionSource.match(/@keyframes ice-victory-pulse/g) ?? []
    expect(defs).toHaveLength(1)
  })

  it('keyframes animate transform/opacity only', () => {
    const block = motionSource.match(/@keyframes ice-victory-pulse\s*\{([\s\S]*?)\n\}/)
    expect(block).not.toBeNull()
    const declarations = block![1].match(/^\s*([a-z-]+)\s*:/gm) ?? []
    expect(declarations.length).toBeGreaterThan(0)
    for (const decl of declarations) {
      const prop = decl.trim().replace(/:$/, '')
      expect(['opacity', 'transform']).toContain(prop)
    }
  })

  it('the mixin locks the entrance easing and a ≤500ms default', () => {
    const mixin = motionSource.match(/@mixin ice-victory-pulse\(([^)]*)\)\s*\{([\s\S]*?)\n\}/)
    expect(mixin).not.toBeNull()
    expect(mixin![1]).toContain('$duration: 420ms')
    expect(mixin![2]).toContain('$motion-entrance-ease')
    // The easing token itself is the sanctioned cubic-bezier(0.22, 1, 0.36, 1).
    expect(motionSource).toContain('$motion-entrance-ease: cubic-bezier(0.22, 1, 0.36, 1)')
  })

  it('carries exactly ONE reduced-motion block, collapsed to a 150ms settle', () => {
    const mixin = motionSource.match(/@mixin ice-victory-pulse\(([^)]*)\)\s*\{([\s\S]*?)\n\}/)
    expect(mixin).not.toBeNull()
    const rmBlocks = mixin![2].match(/@media \(prefers-reduced-motion: reduce\)/g) ?? []
    expect(rmBlocks).toHaveLength(1)
    expect(mixin![2]).toContain('animation-duration: 150ms')
    expect(mixin![2]).toContain('animation-name: none')
  })

  it('no application exceeds the 500ms pulse ceiling', () => {
    const calls = [
      ...motionSource.matchAll(/ice-victory-pulse\((\d+)ms/g),
      ...readSrc('phases/QuipBattleHeroView.scss').matchAll(/ice-victory-pulse\((\d+)ms/g),
      ...readSrc('phases/PersonalityDiceHeroView.scss').matchAll(/ice-victory-pulse\((\d+)ms/g),
      ...readSrc('phases/AuctionHeroView.scss').matchAll(/ice-victory-pulse\((\d+)ms/g),
    ]
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(Number(call[1])).toBeLessThanOrEqual(500)
    }
  })
})

describe('victory pulse applications (wave3 AC-09 — ≥3 moments)', () => {
  it('投票命中: winning quip answer pulses (QuipBattle)', () => {
    const scss = readSrc('phases/QuipBattleHeroView.scss')
    expect(scss).toContain("@use '../styles/phase-motion' as *;")
    const winner = scss.match(/&--winner\s*\{[\s\S]*?@include ice-victory-pulse\(400ms\);[\s\S]*?\}/)
    expect(winner).not.toBeNull()
  })

  it('骰子揭晓: reveal cards pulse with a light seat-order stagger (PersonalityDice)', () => {
    const scss = readSrc('phases/PersonalityDiceHeroView.scss')
    expect(scss).toContain("@use '../styles/phase-motion' as *;")
    // Capture the whole &__reveal-card block (2-space indented close).
    const card = scss.match(/&__reveal-card\s*\{[\s\S]*?\n  \}/)
    expect(card).not.toBeNull()
    expect(card![0]).toContain('@include ice-victory-pulse(420ms);')
    // Stagger rides animation-delay only — the pulse duration never grows.
    expect(card![0]).toContain('animation-delay')
  })

  it('落槌: the lot frame pulses when a hammer falls (Auction)', () => {
    const scss = readSrc('phases/AuctionHeroView.scss')
    expect(scss).toContain("@use '../styles/phase-motion' as *;")
    expect(scss).toMatch(/&--go\s*\{\s*@include ice-victory-pulse\(420ms\);/)
    // The tsx fires the class on lot close (idx advance) AND final close
    // (allClosed), then lifts it inside the 500ms ceiling.
    const tsx = readSrc('phases/AuctionHeroView.tsx')
    expect(tsx).toContain('auction-hero__pulse-frame--go')
    expect(tsx).toContain('fireHammerPulse()')
    expect(tsx).toContain('}, 500)')
  })

  it('no NEW bespoke victory keyframes outside the shared vocabulary', () => {
    // The three surface SCSS files may reference the shared pulse but must
    // not define their own *victory*/*pulse* keyframes.
    for (const file of [
      'phases/QuipBattleHeroView.scss',
      'phases/PersonalityDiceHeroView.scss',
      'phases/AuctionHeroView.scss',
    ]) {
      const scss = readSrc(file)
      expect(scss).not.toMatch(/@keyframes\s+\w*(victory|hammer-pulse|win-pulse)\w*/i)
    }
  })
})
