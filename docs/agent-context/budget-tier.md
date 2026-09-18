# Budget Tiers — Agent Context

> Deep context for the budget-tier system (venue assignment budget matching). Extracted from the budget-tier workstream, **code-complete 2026-09-16**.
>
> **Canonical docs:** `docs/design/budget-tier-architecture-spec-20260916.md` (locked design, Q1–Q11) · `docs/design/budget-tier-implementation-plan-20260916.md` (T0–T10) · sprint contracts under `.git/.orchestration/sprints/`.
> **Load `venue-location-services` + `matching-domain` skills when modifying this area.**

---

## 1. What it is

A single canonical budget vocabulary replacing **six divergent hardcoded copies**. A user's budget choice and a venue's budget capability now live in one ordered, namespaced, code-owned tier registry, so a cheap bracket can no longer hard-fail because the client invented a bracket no venue supports.

- **Registry:** `packages/shared/src/budgetTiers.ts` — **6 tiers, all `per_person`**, structured objects `{ id, eventType, label, unit, min, max, order }`.
  - Dining (`饭局`, `per_person`): `dining_150_below` → `dining_150_200` → `dining_200_300` → `dining_300_500` (`order` 0–3).
  - Drinks (`酒局`, `per_person`): `drinks_80_below` → `drinks_80_150` (`order` 0–1). **`drinks_150_200` is reserved (order 2, not yet registered)** — append without renumbering.
  - `id ≠ label` (storage decoupled from copy); `order` drives adjacency.
- **Namespace is in the id** (`dining_*` vs `drinks_*`) — there is no separate `event_type` column, and a bar can never hold a `dining_*` tier (this is what produced the 弥所 defect).

## 2. The six vocabularies it replaced

`flowConfig.ts` (client) · `venueConstants.ts` (admin) · `blind_box_events.budgetTier` (`"100-200"`, a third vocabulary — **B3 mapping still OPEN**) · `matchingTestService.ts:69` (`BUDGET_RANGES`, omitted `150以下`) · `venueMatchingService.ts:334` (legacy `budget/moderate/upscale/luxury`) · free-string validation.

## 3. Where budget data lives (post-migration)

| Concern | Location | Notes |
|---|---|---|
| Tier identity | `packages/shared/src/budgetTiers.ts` | code-owned; DB stays "dumb" (no CHECK, no lookup table) |
| Venue capability | `venues.budget_categories text[]` | canonical **ids** (retagged by migration **0093**) |
| Registration budgets | `event_pool_registrations.budget_range` (饭局) / `bar_budget_range` (酒局) | canonical **ids** (retagged **0094**); merging to one `budget_tier_ids` is **deferred** |
| The legacy single-value `price_range` / `bar_price_range` | `venues` | **deliberately left legacy** — spec §14.8 forbids dual-write |
| `blind_box_events.budget_tier` | varchar scalar | untouched; boundary normalized only |

## 4. Normalization layers (the order-safety key)

- **Write:** `apps/server/src/lib/budgetTierWrite.ts` (`normalizeBudgetRangeForWrite`) — tolerant: legacy→id, unmappable → preserved + `logger.warn` (never guessed). Wired at `eventPoolRegistration`, `paymentFulfillmentRepo`, `payments.ts`, `blindBoxEvents`.
- **Read:** `venueAssignmentService.ts` normalizes **both** group-consensus and venue sides (`normalizeTierIdsForComparison`) before comparing, so **legacy↔id mixes still match** — this is what makes the migration order safe.
- **`100-200` (blind-box) is unmappable and never coerced** (decision **B3 open**).

## 5. Validation (T6-strict)

- Strict allow-list `budgetTierIdSchema` in `packages/shared/src/schema/_definitions.ts` (ids only) + `venues.ts` admin schema.
- **`min(1)` required at the funnel/route boundary** (`lib/eventPoolRegistration.ts` throws `BudgetTierValidationError`). **No `max(1)` cap** — PRD:2286 documents multi-select.
- **Error codes actually reach the client**: `INVALID_BUDGET_TIER` / `BUDGET_TIER_REQUIRED` in `errorBaselines.ts` (union + `ERROR_TEMPLATES`); route surfaces `code` verbatim (`userEventPools.ts:957`). `registrationErrorCodes.test.ts` now scans the funnel lib too.
- Blind-box `100-200` stays tolerated.

## 6. Degradation (flag `budgetAdjacencyEnabled`, **default OFF**)

- Adjacency by `order` distance: **distance 0 → 40, distance 1 → 20, distance ≥ 2 → not placeable** (the spec's `±2 → 8` band was **rejected** for B4's one-tier cap). Capacity is the **only** hard gate.
- Two-pass rescue only for **undecidable/missing** budget data (untagged/legacy-unmappable venues). A genuine ≥2-tier supply gap still ends `venue_tbd` — a product residual, not a code failure.
- Empty-consensus asymmetry (`:270-273` flat +40) removed; `budget_adjacent` disclosed in `reasons` (never in `unassignedBreakdown`).
- AC-9 proof: a test that **really executes `scoreVenueForGroup`** (the old suite re-implemented it — a false-negative).

## 7. City-level budget options resolver

- `apps/server/src/lib/budgetOptionsResolver.ts` — `resolveBudgetOptions(city, eventType)` returns **all** registry tiers for the event type **annotated** `available|sparse|none` (annotate, never hide).
- **City-level catalog coverage, NOT availability-aware** — slots stay in the assignment layer (`checkTimeSlotAvailability`).
- Shares the eligibility predicate with assignment via `lib/venueEligibility.ts` (single source).
- **Fail-open** to the full registry on any error/empty (never blocks or empties the registration step).
- Rides on **`GET /api/event-pools/:id`** as a `budgetOptions` field (`userEventPools.ts`). Cached by `city × eventType` (TTL). **Client consumption of this field is a pending follow-up.**

## 8. Timezone (B8 — was a real blocker)

- `event_pools.date_time` / `blind_box_events.date_time` are **`timestamp without time zone`**; Drizzle writes `toISOString()` → **stored value is true UTC** (19:30 CST → `11:30`).
- **Canonical helper:** `apps/server/src/lib/eventDateTime.ts` — derive business-local via **+8h + `getUTC*` getters** (TZ-independent, no ambient-TZ reliance, no ICU). `parseEventDate` re-exported from `venueAssignmentService`.
- Round-trip regression test goes through the **real** drizzle column mappers (re-implementing `parseEventDate` in a test hid the bug).
- **Legacy mixed-convention rows** (local wall clock stored raw) read as +8h-shifted until normalized per the contract's detection SQL — staging/prod unverified.

## 9. Security (N1 — was unauthenticated)

`/api/test/admin/*` previously had `requireAdmin` imported but never applied, registered unconditionally. Now: `requireAdmin, requireSuperAdmin` on the 5 routes, `requireAdmin` on the 2 social-icebreaker routes, 6 audit actions, and `/api/test/single-test/reset` (was anonymous) now requires auth. Regression lock `testAdminAuth.test.ts` (route introspection + source scan; new routes auto-covered). Root cause: `adminRbacCoverage.test.ts:102` only filtered `/api/admin`. **OQ-1 (keep in production?) is open.**

## 10. Current gaps / assumptions

| Item | Status |
|---|---|
| **深圳 dining** `150以下` / `150-200` / `300-500` | **no restaurant** (only T馆 `200-300`) → needs recruitment or a written whitelist |
| **深圳 drinks** `80以下` | no venue → whitelist |
| **香港** (selectable city) | **0 venues** for all tiers |
| 弥所 / Bruma / Max | **ASSUMED `drinks_80_150`** (`≤150 per-person`) — must be re-verified (spec `ASSUMED_PENDING_VERIFICATION`) |
| Dev `bar_budget_range = 150-200` | 16 rows unmappable (registry withholds `drinks_150_200`) — left untouched |
| **B3** blind-box `100-200` mapping | **OPEN** (product) |

## 11. Deployment notes

- **Deploy order:** server code first (read normalization tolerates every mix) → client → migrations (`0092/0093/0094`). Staging applies migrations manually (`psql`), then prod; both must be verified.
- Migrations: `0092_budget_tier_venue_activation` (flip `draft`→`active` + Batch & Co slot window 20:00–02:00 → same-day 20:00–23:59 + COMMENT), `0093_…_venue_categories_retag`, `0094_…_registration_retag`. All idempotent + reversible.
- **⚠️ A concurrent stream added `0095_misty_outlaw_kid` (subscribe-message) to the same `_journal.json`** — verify journal consistency before deploy.
- Before enabling `budgetAdjacencyEnabled`: dual-run comparison (`simulate:groups` precedent) per the spec.
