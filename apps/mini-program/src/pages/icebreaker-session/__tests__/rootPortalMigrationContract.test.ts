import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSrc = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

/**
 * fixed-in-transformed-shell → RootPortal contract (sprint
 * icebreaker-uiux-wave2, AC-12 / plan #30). The phase shell keeps a transform
 * (entrance animation fill), which hijacks the containing block of any
 * position:fixed descendant and clips overlays to the shell box on device.
 * The six overlays below MUST render through `<RootPortal>` (precedent:
 * WarmupCelebrationOverlay / MiniScriptConfigModal). Their SCSS keeps
 * `position: fixed` — legal once portal-mounted (viewport-relative again).
 *
 * 门槛判据: every overlay root class appears inside a RootPortal span in its
 * component's TSX source.
 */
const PORTAL_TARGETS: Array<{ file: string; overlayClass: string; note: string }> = [
  {
    file: 'src/pages/icebreaker-session/phases/MiniScriptClueDrawer.tsx',
    overlayClass: "className='miniscript-clues'",
    note: 'clue drawer',
  },
  {
    file: 'src/pages/icebreaker-session/phases/MiniScriptEvidenceTray.tsx',
    overlayClass: "className='miniscript-evidence__picker-mask'",
    note: 'evidence picker sheet',
  },
  {
    file: 'src/pages/icebreaker-session/phases/MiniScriptEvidenceTray.tsx',
    overlayClass: "className='miniscript-evidence__reveal-mask'",
    note: 'evidence reaction reveal',
  },
  {
    file: 'src/pages/icebreaker-session/phases/RecapPhaseView.tsx',
    overlayClass: "className='icebreaker__moment-panel-backdrop'",
    note: 'recap moment panel',
  },
  {
    file: 'src/pages/icebreaker-session/phases/GroupMirrorHeroView.tsx',
    overlayClass: "className='group-mirror-hero__detail-backdrop'",
    note: 'group mirror detail backdrop',
  },
  {
    file: 'src/pages/icebreaker-session/phases/PersonalityDiceHeroView.tsx',
    overlayClass: "className='personality-dice-hero__fixed-action'",
    note: 'dice fixed CTA',
  },
  {
    file: 'src/pages/icebreaker-session/phases/AuctionHeroView.tsx',
    overlayClass: "className='auction-hero__bid-dock'",
    note: 'auction bid dock (2026-10-19 Class A fix — ladder pinned to viewport)',
  },
]

/** True when `needle` sits inside some `<RootPortal>…</RootPortal>` span. */
function insideRootPortal(source: string, needle: string): boolean {
  const at = source.indexOf(needle)
  if (at === -1) return false
  const openBefore = source.lastIndexOf('<RootPortal>', at)
  const closeBefore = source.lastIndexOf('</RootPortal>', at)
  return openBefore !== -1 && openBefore > closeBefore
}

describe('RootPortal migration · fixed overlays (wave2 AC-12 + 2026-10-19 auction bid dock)', () => {
  for (const target of PORTAL_TARGETS) {
    it(`${target.note} renders through <RootPortal>`, () => {
      const source = readSrc(target.file)
      expect(source).toContain('<RootPortal>')
      expect(insideRootPortal(source, target.overlayClass)).toBe(true)
    })
  }

  it('portal import comes from @tarojs/components in every migrated file', () => {
    const files = [...new Set(PORTAL_TARGETS.map((t) => t.file))]
    for (const file of files) {
      const source = readSrc(file)
      expect(source).toMatch(/import\s*\{[^}]*RootPortal[^}]*\}\s*from\s*'@tarojs\/components'/)
    }
  })
})
