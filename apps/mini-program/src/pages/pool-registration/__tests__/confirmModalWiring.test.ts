import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Structural invariant: the confirmation modal must be a thin gate in front of
 * the existing registration path. If a future refactor bypasses the modal or
 * duplicates the submit logic inside it, this test fails.
 *
 * Guards against regression where:
 * - step-2 (final step) CTA stops opening the modal
 * - modal confirm does not call the existing handleRegister
 * - error-card retry skips the confirmation gate
 */
const PAGE_SOURCE = resolve(__dirname, '..', 'index.tsx')

describe('pool-registration confirmation modal wiring', () => {
  const source = readFileSync(PAGE_SOURCE, 'utf-8')

  it('wires the final-step footer CTA to open the confirmation modal', () => {
    expect(source).toContain('onRegister={handleConfirmCta}')
    expect(source).toContain("discoverAnalytics.track('registration_confirm_shown', poolId)")
    expect(source).toContain('setShowConfirmModal(true)')
  })

  it('routes modal confirm through the existing handleRegister', () => {
    expect(source).toContain('onConfirm={handleConfirmModalConfirm}')
    expect(source).toContain("discoverAnalytics.track('registration_confirm_confirmed', poolId)")
    // The confirm handler must delegate to handleRegister, not inline a new submit.
    expect(source).toContain('void handleRegister()')
  })

  it('keeps the error-card retry on the original handleRegister path', () => {
    expect(source).toContain('onRetry={handleRegister}')
  })

  it('closes the modal on cancel without submitting', () => {
    expect(source).toContain('onCancel={handleConfirmModalCancel}')
    expect(source).toContain('setShowConfirmModal(false)')
  })
})
