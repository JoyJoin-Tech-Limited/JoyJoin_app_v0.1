/**
 * Source-lock: hooks must never live below the early returns on this page.
 *
 * Origin (2026-10-21): `ticketFooter` was a useMemo placed AFTER five
 * conditional early returns (loading / pageError / success / verifying /
 * terminal). A cold render (no warm query cache) renders the loading path
 * with M hooks, then the main render calls hook M+1 → React #310
 * "Rendered more hooks than during the previous render" → whole root
 * unmounts → white screen. Latent since 2026-08-17 (订座 ceremony),
 * masked in production by warm-cache navigation; exposed by the
 * screenshot pipeline's cold render. Same class as the gathering-room
 * freeze (2026-08-12): never place a hook below an early return.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE_PATH = resolve(__dirname, '../index.tsx')
const SHEET_PATH = resolve(__dirname, '../../../../components/event-ticket-payment/IcebreakerInclusionSheet.tsx')
const COST_PATH = resolve(__dirname, '../../../../components/event-ticket-payment/CostBreakdown.tsx')
const source = readFileSync(PAGE_PATH, 'utf8')
const sheetSource = readFileSync(SHEET_PATH, 'utf8')
const costSource = existsSync(COST_PATH) ? readFileSync(COST_PATH, 'utf8') : ''

const FIRST_EARLY_RETURN = 'if (isPageLoading)'
const HOOK_PATTERNS = ['useMemo(', 'useEffect(', 'useCallback(', 'useState(', 'useRef('] as const

describe('event-ticket-payment page structure source-lock', () => {
  it('keeps ticketFooter as a plain const (not a hook)', () => {
    expect(source).toContain('const ticketFooter = (')
    expect(source).not.toContain('const ticketFooter = useMemo(')
  })

  it('has zero hook calls below the first early return', () => {
    const returnIdx = source.indexOf(FIRST_EARLY_RETURN)
    expect(returnIdx).toBeGreaterThan(-1)
    const belowReturns = source.slice(returnIdx)
    for (const pattern of HOOK_PATTERNS) {
      expect(
        belowReturns.includes(pattern),
        `Found "${pattern}" below "${FIRST_EARLY_RETURN}" — hooks must run unconditionally above the early returns`,
      ).toBe(false)
    }
  })

  it('captures receipt provenance only from confirmed order responses', () => {
    expect(source).toContain('setSuccessReceipt(captureSameOrderReceipt(orderId, confirmedOrder))')
    expect(source).toContain("completeSuccess('poll', statusResp)")
    expect(source).toContain("completeSuccess('reconcile', reconcileResp)")

    const successStart = source.indexOf("if (payment.status === 'success')")
    const successEnd = source.indexOf('// Verifying state', successStart)
    expect(successStart).toBeGreaterThan(-1)
    expect(successEnd).toBeGreaterThan(successStart)
    const successSurface = source.slice(successStart, successEnd)
    expect(successSurface).toContain('receipt={successReceipt}')
    expect(successSurface).not.toContain('finalAmount={finalPrice}')
    expect(successSurface).not.toContain('finalAmount: finalPrice')
  })

  it('locks the same paidCents source and removes the old terms/budget-chip surfaces', () => {
    expect(source).toContain('const paidCents = finalPrice')
    expect(source).toContain('<CostBreakdown')
    expect(source).toContain('paidCents={paidCents}')
    expect(source).toContain('tonightTotalLabel={tonightTotalLabel}')
    expect(source).toContain('COST_ACTION_PURCHASE')
    expect(source).not.toContain('ticket-card__terms')
    expect(source).not.toContain("category: 'budget'")
    expect(source).not.toContain('ticket_terms_row_impression')
  })

  it('locks the sheet to the two approved read-only optional inputs in the same changeset', () => {
    expect(source).toContain('onSiteBudgetLabel={onSiteBudgetLabel}')
    expect(source).toContain('onSiteHint={onSiteHint}')
    expect(sheetSource).toContain('onSiteBudgetLabel?: string | null')
    expect(sheetSource).toContain('onSiteHint?: string')
    expect(sheetSource).toContain('onSiteBudgetLabel,')
    expect(sheetSource).toContain('onSiteHint,')
  })

  it('keeps budget authority out of the sheet and the cost block non-interactive', () => {
    for (const forbidden of ['BUDGET_TIER_BY_ID', 'normalizeBudgetTierIds', 'apiRequest', 'readStoredPaymentReturnContext']) {
      expect(sheetSource).not.toContain(forbidden)
    }
    expect(costSource).toContain('export default function CostBreakdown')
    expect(costSource).not.toContain('onClick=')
    expect(costSource).not.toContain('hoverClass=')
    expect(costSource).not.toContain('animation:')
  })
})
