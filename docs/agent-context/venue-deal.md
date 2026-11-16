# Venue partner deals (门店专属优惠)

> Shipped 2026-11-16 in PR #669 (`ce0347abe`). Two DB-backed flags, both **default `false`** — the whole surface is dark until an operator enables it per environment. Design canon: `docs/design/venue-deal/README.md` + `implementation-plan.md` (slices S0–S6, QA verdicts). This file is the agent-facing summary; read the implementation plan before changing binding or guarantee logic.

## Two touchpoints, two flags

| Touchpoint | Surface | Flag | Default |
|---|---|---|---|
| 触点 2 · 成局后兑现 | `VenueDealCard` on the pool-group detail page + 同桌凭证出示页 | `venueDealsEnabled` (`VENUE_DEALS_ENABLED`) | `false` |
| 触点 1 · 报名期承诺 | 收银台/报名页「费用包含」第五格 + teaser + 费用边界行 | `venueDealPromiseEnabled` (`VENUE_DEAL_PROMISE_ENABLED`) | `false` |

`venueDealPromiseEnabled` is **not independent**: the fifth tile renders only when BOTH flags are on and the pool carries a server-computed `hasGuaranteedDeal === true`. Turning off `venueDealsEnabled` therefore also removes the registration promise — a promise without the redeem path is a broken promise. The admin flag copy records this dependency.

## Data model (migration `0106_venue_deal_foundation.sql`)

Additive, nullable, idempotent (`ADD COLUMN IF NOT EXISTS`, `pg_constraint` existence checks), no backfill:

- `venue_deals.set_menu_price_cents` / `venue_deals.set_menu_original_price_cents` — 定制套餐一口价 / 划线原价 (must be `> ` 一口价).
- `event_pools.guaranteed_venue_id` / `event_pools.guaranteed_deal_id` — 方案 B 保底：建池即锁定的场地与权益；`NULL` = 无保底承诺.
- Both new FKs are `ON DELETE RESTRICT`: deleting a venue or deal can never silently dissolve a guarantee. Unbinding must go through the explicit admin flow.

**Deployment order is a hard constraint** — migration first, code second (`validateDbSchema()` fails fast on missing columns). Status: **applied on staging 2026-11-16** (Deploy Staging run `43843591828`); **not yet applied to production** (see `docs/runbooks/production-migration-0104-0105.md`).

## Server

- `apps/server/src/lib/venueDealBinding.ts` — validates a `(venueId, dealId)` pair against the full venue-catalog eligibility used by the assigner (city / district / eventType / onboarding / partner / contract / type) plus `isRedeemableVenueDeal`. **After matching, rebinding/unbinding is locked**: PATCH returns `409 POOL_GUARANTEE_LOCKED_AFTER_MATCHING`, and the admin picker is disabled.
- `apps/server/src/lib/venueDealVisibility.ts` — decides what a viewer may see; reading failure never masquerades as "no deal".
- `apps/server/src/repositories/venueDealsRepo.ts` — `computeHasGuaranteedDeal`, `getGroupVenueDeal`, deal CRUD.
- Routes: `GET /api/admin/venues/:venueId/deals` (admin list), `GET /api/venues/:venueId/deals` (public, event-detail), pool create/PATCH carries `guaranteedVenueId` / `guaranteedDealId` (`routes/domains/adminEventPools.ts`), and the pool-group payload attaches `venueDeal` via `getGroupVenueDeal` (`routes/domains/userEventPools.ts`). Admin UI lives on the venue detail page and the event-pool editor.

## Mini-program

- `apps/mini-program/src/components/VenueDealCard/index.tsx` — the only deal card. Six states resolved by `lib/matching/venueDealCardState.ts` `resolveVenueDealCardState` → `hidden | ticket | locked | adjusted | error` (plus the pre-match locked render). **`adjusted` ≠ `error`**: an assigned-but-now-invalid entitlement renders 「已调整」, while `error` is a real read failure with retry — do not merge them.
- `apps/mini-program/src/pages/pool-group-detail/credential/index` — 同桌凭证出示页 (custom nav, screen-awake + brightness boost on entry, restore on hide/unload). Navigation carries **only** `groupId`; the deal and code are never in the URL.
- Copy is centralized in `packages/shared/src/copy/venueDealCopy.ts` (fee boundary line 「订座费不含餐费，餐费到店与门店另结」, locked hint, rule line 「仅限本场活动 · 本桌使用」, admin validation strings). Do not inline these strings in components.
- Analytics: `deal_card_impression`, `deal_card_tap`, `redeem_page_open`, `deal_credential_present` (with `dealId` / `method` / `secondsFromOpen`). North star: 出示率 = `redeem_page_open` ÷ `deal_card_impression`.

## Copy and safety rules

- 「独家」 is **not** used by default — only a real, contracted exclusivity may claim it.
- The fee boundary line is mandatory wherever a deal is promised at registration; without it the discount reads as a discount on the whole bill.
- No guaranteed deal ⇒ 触点 1 does not render at all (legacy four-tile layout, unchanged pixel-wise).

## Rollout gates still open

1. **Production 0106 migration** (staging is done).
2. S4 device gate AC-08: iOS + Android WeChat brightness boost / keep-awake / `onHide` / unload restore, in-store readability, low-end Android frame rate (drop animation if it janks; reduce-motion goes straight to the final frame, no haptic).
3. S5 Lovart/CDN asset for the fifth tile (currently the registered 🎫 JoyJoinIcon) and a real Step 0 acceptance pass.
4. Staging verification that the four analytics events land with correct metadata and no PII.
5. Only then may `venueDealsEnabled` (and afterwards `venueDealPromiseEnabled`) be enabled — production first, never both flags in one jump.
