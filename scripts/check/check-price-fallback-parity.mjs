#!/usr/bin/env node
/**
 * Price-fallback parity guard (2026-10-09).
 *
 * Why: the 2026-08-05 incident — client hardcoded price fallbacks drifted
 * from server/seed values, so checkout displayed prices that did not match
 * what the server would charge. This check extracts per-plan cents from
 * THREE sources and fails when any plan present in 2+ sources disagrees:
 *
 *   1. Mini-program payment page fallbacks
 *      (apps/mini-program/src/pages/payments/event-ticket-payment/index.tsx)
 *      — `const xPlan = pricingPlans.find(... planType === '<id>')` lookups
 *        paired with `xPlan?.priceInCents ?? <cents>` fallbacks.
 *   2. Server fallback constants
 *      (apps/server/src/routes/domains/payments.ts)
 *      — EVENT_PACK_PRICE_FALLBACKS / SUBSCRIPTION_PRICE_FALLBACKS entries,
 *        plus the inline `eventSinglePlan?.priceInCents ?? <cents>` fallback
 *        sites (event_single has no constant-object entry).
 *   3. Canonical DB seed
 *      (apps/server/migrations/seed_pricing_plans_20260805.sql)
 *      — pricing_settings INSERT rows; positional columns
 *        (plan_type, display_name, display_name_en, description,
 *         price_in_cents, ...).
 *
 * Rules:
 *   - Plans present in ≥2 sources must agree on cents → mismatch = FAIL.
 *   - Plans present in only 1 source are reported as WARNINGS, not failures
 *     (e.g. a server-only fallback the client never renders).
 *   - Multiple DISTINCT cents values for the same plan within one source
 *     (e.g. two inline server fallbacks drifting apart) = FAIL.
 *   - Unreadable source files or zero extraction = FAIL (a guard that cannot
 *     read its sources must be loud, never silently green).
 *
 * Deliberately out of scope (same-shaped fallbacks, not client-visible
 * checkout prices — extend SOURCE_FILES if they ever drift):
 *   - apps/server/src/subscriptionService.ts (renewal-amount fallback)
 *   - apps/server/src/routes/domains/userEventPools.ts (refund originalAmount
 *     fallback)
 *
 * Exit code: 0 = all shared plans agree, 1 = drift / unreadable sources.
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath is required on Windows: URL.pathname returns `/D:/...`, which
// path.join interprets as a relative segment and produces `D:\D:\...`.
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

const CLIENT_PAYMENT_PAGE = join(
  REPO_ROOT,
  'apps/mini-program/src/pages/payments/event-ticket-payment/index.tsx',
)
const SERVER_PAYMENTS_ROUTE = join(REPO_ROOT, 'apps/server/src/routes/domains/payments.ts')
const SEED_SQL = join(REPO_ROOT, 'apps/server/migrations/seed_pricing_plans_20260805.sql')

/**
 * Mini-program extraction, two passes:
 *   1. `const <var> = pricingPlans.find(... planType === '<planId>')`
 *      binds a lookup variable to a plan id.
 *   2. `<var>?.priceInCents ?? <cents>` gives that plan's fallback cents.
 * Returns Map<planId, cents[]> (array so same-source drift is detectable).
 * Pure and exported for tests.
 */
export function extractClientFallbacks(sourceText) {
  const planByVar = new Map()
  const lookupRe = /\b(\w+)\s*=\s*pricingPlans\.find\([\s\S]{0,300}?\bplanType\s*===\s*['"]([\w]+)['"]/g
  for (const match of sourceText.matchAll(lookupRe)) {
    planByVar.set(match[1], match[2])
  }

  const fallbacks = new Map()
  for (const [varName, planId] of planByVar) {
    const fallbackRe = new RegExp(`\\b${varName}\\?\\.priceInCents\\s*\\?\\?\\s*(\\d+)\\b`, 'g')
    for (const match of sourceText.matchAll(fallbackRe)) {
      pushValue(fallbacks, planId, Number(match[1]))
    }
  }
  return fallbacks
}

/**
 * Server extraction from routes/domains/payments.ts:
 *   - EVENT_PACK_PRICE_FALLBACKS / SUBSCRIPTION_PRICE_FALLBACKS object entries
 *     (`pack_3: 21100,`).
 *   - Inline `eventSinglePlan?.priceInCents ?? <cents>` sites (the event_single
 *     fallback lives inline at the checkout/route sites, not in a constant).
 * Returns Map<planId, cents[]>.
 * Pure and exported for tests.
 */
export function extractServerFallbacks(sourceText) {
  const fallbacks = new Map()

  const objectRe = /\b(?:EVENT_PACK_PRICE_FALLBACKS|SUBSCRIPTION_PRICE_FALLBACKS)\s*=\s*\{([^}]*)\}/g
  for (const objectMatch of sourceText.matchAll(objectRe)) {
    const entryRe = /\b(\w+)\s*:\s*(\d+)\b/g
    for (const entryMatch of objectMatch[1].matchAll(entryRe)) {
      pushValue(fallbacks, entryMatch[1], Number(entryMatch[2]))
    }
  }

  const inlineRe = /\beventSinglePlan\?\.priceInCents\s*\?\?\s*(\d+)\b/g
  for (const match of sourceText.matchAll(inlineRe)) {
    pushValue(fallbacks, 'event_single', Number(match[1]))
  }

  return fallbacks
}

/**
 * Seed extraction: pricing_settings INSERT rows with positional columns
 * (plan_type, display_name, display_name_en, description, price_in_cents, ...).
 * Returns Map<planId, cents[]>.
 * Pure and exported for tests.
 */
export function extractSeedFallbacks(sourceText) {
  const fallbacks = new Map()
  const rowRe = /\(\s*'([\w]+)'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*(\d+)\s*,/g
  for (const match of sourceText.matchAll(rowRe)) {
    pushValue(fallbacks, match[1], Number(match[2]))
  }
  return fallbacks
}

function pushValue(map, key, value) {
  const existing = map.get(key)
  if (existing) {
    existing.push(value)
  } else {
    map.set(key, [value])
  }
}

function readSource(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`price-fallback-parity: ${label} source not found: ${relative(REPO_ROOT, filePath)}`)
  }
  return readFileSync(filePath, 'utf8')
}

function formatCents(cents) {
  return `¥${(cents / 100).toFixed(2)} (${cents}¢)`
}

function main() {
  const sources = [
    { key: 'client', label: 'mini-program event-ticket-payment', path: CLIENT_PAYMENT_PAGE, extract: extractClientFallbacks },
    { key: 'server', label: 'server payments.ts', path: SERVER_PAYMENTS_ROUTE, extract: extractServerFallbacks },
    { key: 'seed', label: 'seed_pricing_plans_20260805.sql', path: SEED_SQL, extract: extractSeedFallbacks },
  ]

  const extracted = new Map() // sourceKey -> Map<planId, cents[]>
  for (const source of sources) {
    const text = readSource(source.path, source.label)
    const result = source.extract(text)
    if (result.size === 0) {
      throw new Error(
        `price-fallback-parity: extracted ZERO plan fallbacks from ${source.label} ` +
          `(${relative(REPO_ROOT, source.path)}) — the file layout changed; update the extractor.`,
      )
    }
    extracted.set(source.key, result)
  }

  const allPlanIds = new Set()
  for (const result of extracted.values()) {
    for (const planId of result.keys()) allPlanIds.add(planId)
  }

  const failures = []
  const warnings = []
  const lines = []

  for (const planId of [...allPlanIds].sort()) {
    // Collapse each source to a single value; distinct values within one
    // source are same-source drift (failure).
    const perSource = new Map() // sourceKey -> cents
    for (const source of sources) {
      const values = extracted.get(source.key)?.get(planId)
      if (!values || values.length === 0) continue
      const distinct = [...new Set(values)]
      if (distinct.length > 1) {
        failures.push(
          `${planId}: ${source.label} has ${distinct.length} DISTINCT fallback values for the same plan: ` +
            distinct.map(formatCents).join(' vs '),
        )
        continue
      }
      perSource.set(source.key, distinct[0])
    }

    if (perSource.size === 0) continue

    if (perSource.size === 1) {
      const [sourceKey, cents] = [...perSource.entries()][0]
      warnings.push(
        `${planId}: only found in ${sourceKey} (${formatCents(cents)}) — nothing to compare against`,
      )
      lines.push(`  ~ ${planId}: ${sourceKey}=${cents} (single source, warning)`)
      continue
    }

    const distinctAcross = [...new Set(perSource.values())]
    const detail = [...perSource.entries()].map(([key, cents]) => `${key}=${cents}`).join('  ')
    if (distinctAcross.length > 1) {
      failures.push(`${planId}: ${detail}`)
      lines.push(`  ✗ ${planId}: ${detail}`)
    } else {
      lines.push(`  ✓ ${planId}: ${detail}`)
    }
  }

  console.log(`price-fallback-parity: ${allPlanIds.size} plan id(s) across ${sources.length} sources`)
  for (const line of lines) console.log(line)

  for (const warning of warnings) {
    console.warn(`  ! warning: ${warning}`)
  }

  if (failures.length > 0) {
    console.error(
      `\n✗ price-fallback-parity: ${failures.length} plan(s) disagree across sources ` +
        '(client payment page vs server fallbacks vs pricing seed):',
    )
    for (const failure of failures) console.error(`  ${failure}`)
    console.error(
      '\nFallback cents must match the canonical pricing seed ' +
        '(apps/server/migrations/seed_pricing_plans_20260805.sql). Price changes need the\n' +
        'payment-entitlement-authority domain owner — update seed + server + client together.',
    )
    process.exitCode = 1
    return
  }

  console.log('✓ price-fallback-parity: all shared plans agree')
}

// Run main only when executed directly (tests can import the pure extractors
// without triggering a repo scan).
const invokedAsScript =
  process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedAsScript) {
  try {
    main()
  } catch (error) {
    console.error('price-fallback-parity: guard failed to run:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
