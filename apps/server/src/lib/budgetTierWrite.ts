import { normalizeBudgetTierIds, type BudgetEventType } from "@shared/budgetTiers";
import { logger } from "./logger";

/**
 * L1 (tolerant) write normalization for budget-tier values.
 *
 * Every server write boundary that persists a budget value into
 * `event_pool_registrations.budget_range` / `bar_budget_range` (or the
 * equivalent blind-box registration column) MUST funnel through this helper so
 * newly persisted values are canonical registry ids
 * (`packages/shared/src/budgetTiers.ts`).
 *
 * Tolerant by design for the migration window (spec §7 L1):
 *   - legacy labels are mapped to their namespaced id
 *   - already-canonical ids pass through
 *   - values with no registry counterpart (e.g. the blind-box `100-200`, or a
 *     dining label used in the 酒局 namespace) are PRESERVED verbatim and
 *     logged — never rejected, never guessed. Strict rejection is a later
 *     step (L2 `z.enum`), not this one.
 *
 * `unknown` is appended after `ids` (deterministic, idempotent: re-running the
 * output returns the same ids plus the same unknowns).
 */
export function normalizeBudgetRangeForWrite(
  raw: unknown,
  eventType: BudgetEventType,
  context: string,
): string[] {
  const { ids, unknown } = normalizeBudgetTierIds(raw, { eventType });

  if (unknown.length > 0) {
    logger.warn("Budget tier value(s) not mappable to a canonical id; preserving as-is", {
      context,
      eventType,
      unknown,
    });
  }

  return [...ids, ...unknown];
}

/**
 * Resolve the registry namespace for a request-scoped `eventType`.
 *
 * Used by channels whose payload is not bound to a fixed registration column
 * (blind box / generic event checkout). Defaults to the 饭局 namespace, which
 * is the only blind-box vocabulary today (`100-200`).
 */
export function resolveBudgetEventType(eventType: unknown): BudgetEventType {
  return eventType === "酒局" ? "酒局" : "饭局";
}
