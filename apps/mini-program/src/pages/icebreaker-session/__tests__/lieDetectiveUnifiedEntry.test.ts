import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const phaseFile = path.resolve(__dirname, '../phases/LieDetectiveHeroView.tsx')
const phaseStyles = path.resolve(__dirname, '../phases/LieDetectiveHeroView.scss')

/**
 * Lie Detective compose flow (sprint icebreaker-uiux-wave2, AC-04 / plan #19).
 * Two-step减负: AI-first one-tap compose with per-sentence editing, handwrite
 * demoted to a secondary entry, and the lie pick split into its own screen
 * AFTER the three sentences are set — never tiled beside the editor.
 */
describe('Lie Detective two-step compose (wave2 AC-04)', () => {
  it('defaults to the AI one-tap path with handwrite as a secondary entry', () => {
    const source = fs.readFileSync(phaseFile, 'utf8')

    expect(source).toContain('悦仔帮我写三句')
    expect(source).toContain('自己写三句')
    // Per-sentence editing stays after generation (逐句可改)
    expect(source).toContain('aiPrefillRef')
    expect(source).toContain('updateCustomStatement')
  })

  it('splits the lie pick into a separate step, not beside the editor', () => {
    const source = fs.readFileSync(phaseFile, 'utf8')

    expect(source).toContain("useState<'choose' | 'edit' | 'lie'>('choose')")
    expect(source).toContain("composeStep === 'lie'")
    expect(source).toContain('哪句是谎言')
    // The lie step only renders reachable content after the edit step
    expect(source.indexOf("composeStep === 'edit'")).toBeGreaterThan(-1)
    expect(source.indexOf("composeStep === 'lie'")).toBeGreaterThan(-1)
    // The old same-screen lie picker is gone
    expect(source).not.toContain('__lie-picker')
    expect(source).not.toContain('设为谎言</Text>')
  })

  it('keeps the tag helper as progressive disclosure (one row at a time)', () => {
    const source = fs.readFileSync(phaseFile, 'utf8')

    expect(source).toContain('assistOpenRow')
    expect(source).toContain('帮我写这句')
    expect(source).toContain('标签生成')
    expect(source).toContain('请换一个 20 字以内的友好标签')
    expect(source).not.toContain('V1 自填三句话')
    expect(source).not.toContain('V2 标签生成')
    expect(source).not.toContain('onSubmitTags')
  })

  it('settles the final submit only on our exact set (vote-signature precedent)', () => {
    const source = fs.readFileSync(phaseFile, 'utf8')

    expect(source).toContain('lieSubmitSigRef')
    expect(source).toContain('myStatementsSignature')
  })

  it('keeps the label helper and sentence editor inside a bounded row layout', () => {
    const styles = fs.readFileSync(phaseStyles, 'utf8')

    expect(styles).toContain('&__assist-row')
    expect(styles).toContain('min-width: 0')
    expect(styles).toContain('flex: 1')
    expect(styles).toContain('min-height: 88rpx')
    expect(styles).toContain('color: $color-text-white')
    expect(styles).not.toContain('opacity: 0.48')
  })

  it('styles the new ghost entries with press feedback + 88rpx targets', () => {
    const styles = fs.readFileSync(phaseStyles, 'utf8')

    expect(styles).toContain('&__ghost-entry')
    expect(styles).toContain('&__assist-toggle')
    // pressed variants are authored as nested &--pressed under each block
    const ghostBlock = styles.slice(styles.indexOf('&__ghost-entry'))
    expect(ghostBlock).toContain('&--pressed')
    expect(styles).toContain('min-height: 88rpx')
  })
})
