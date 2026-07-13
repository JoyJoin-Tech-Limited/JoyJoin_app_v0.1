# Launch Configuration Guide

This document describes the environment variables and feature flags introduced in
**PR Batch 1: Launch-Critical Reliability & Security**.

---

## Required Environment Variables

These variables are **validated at startup**. In production (`NODE_ENV=production`),
the server exits immediately with a descriptive error if any are missing or invalid.

| Variable | Description | Validation |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Must start with `postgresql://` or `postgres://` |
| `SESSION_SECRET` | Express session signing secret | Must be ≥ 32 characters |
| `WECHAT_APPID` | WeChat Mini Program App ID | Required |
| `WECHAT_SECRET` | WeChat Mini Program App Secret | Required |

In non-production environments, the central validation emits warnings instead of
exiting, but other components (for example, the database connection and session
middleware) may still fail to initialize if required variables like
`DATABASE_URL` or `SESSION_SECRET` are missing.

---

## Optional Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek AI API key | _unset_ — AI features degrade gracefully |
| `MINIMAX_API_KEY` | MiniMax TTS API key | _unset_ — TTS cache warmup skipped |
| `MINIMAX_GROUP_ID` | MiniMax group identifier | _unset_ |
| `TENCENT_MAP_KEY` | Tencent Maps WebService API key for server-side reverse geocoding and IP定位 | _unset_ — geo endpoints return degraded fallback |
| `TENCENT_MAP_JS_KEY` | Tencent Maps JavaScript API key for admin portal MapPicker | _unset_ — admin venue picker shows degraded fallback |
| `COOKIE_DOMAIN` | Cookie domain for cross-subdomain sessions | _unset_ (auto-detected) |
| `PORT` | Server listen port | `5001` |

### Social / icebreaker AI (recommended vs degraded)

| Posture | Keys / env | Behaviour |
| --- | --- | --- |
| **Recommended (production)** | `MINIMAX_API_KEY` **and** `DEEPSEEK_API_KEY` | [`socialModelRouter`](../apps/server/src/ai/socialModelRouter.ts): MiniMax-first for most social functions; DeepSeek fallback on failure; MiniScript framework JSON can recover via DeepSeek `json_object` if MiniMax returns unusable JSON. Optional: `MINIMAX_MODEL`, `MINIMAX_BASE_URL`, `SOCIAL_AI_PROVIDER` (`hybrid` default; `minimax` or `deepseek` force). |
| **Degraded (MiniMax-only)** | `MINIMAX_API_KEY` set, **no** `DEEPSEEK_API_KEY` | Router falls back to DeepSeek only where required (e.g. `analyzeComplexSemantics`) may **throw** if DeepSeek is missing; MiniScript has **no** DeepSeek recovery path—orchestrator may use deterministic stub after LLM failure. |

See also: [`AI_FEATURE_INVENTORY.md`](./AI_FEATURE_INVENTORY.md), [`production-ai-surfaces.md`](../.github/skills/social-icebreaker-domain/references/production-ai-surfaces.md), [Icebreaker AI observability (Prometheus / alerts)](./ops/icebreaker-ai-observability.md).

---

## Payment Feature Flag

**`PAYMENTS_ENABLED`** — controls whether the payment system is active.

| Value | Behaviour |
|---|---|
| `false` (default) | Payment creation endpoints return `503 PAYMENTS_DISABLED`. The client shows a maintenance screen instead of the payment UI. |
| `true` | Payment system is fully active. |

Set this flag in your environment:

```bash
# Enable payments
PAYMENTS_ENABLED=true

# Disable payments (kill switch)
PAYMENTS_ENABLED=false
```

The flag is exposed to the client via `/api/auth/user` as `paymentsEnabled`.

---

## Payment Ritual V2 Feature Flag

**`PAYMENT_RITUAL_V2_ENABLED`** — hardcoded client-side gate (in `apps/mini-program/src/pages/blind-box-payment/index.tsx`). Controls whether the Payment Ritual V2 emotional flow (3-act stage machine, real DB-backed community stats, A/B variant assignment) is active.

| Gate | Behaviour |
|---|---|
| `PAYMENT_RITUAL_V2_ENABLED = false` (current) | Legacy payment flow — plan selector + CTA, no ritual staging |
| `PAYMENT_RITUAL_V2_ENABLED = true` + `user.features.paymentRitualV2 !== false` | Ritual V2 flow — Act I (anticipation), Act II (revelation), Act III (choice) with archetype theming, community pulse, hesitation nudge, celebration handoff |

Prerequisites for enabling:
1. `GET /api/payments/ritual-context` returns real data (city-scoped community stats)
2. `POST /api/analytics/payment` accepts ritual events (dedicated endpoint, not discover)
3. `paymentRitualEvents` table exists in production (schema in `packages/shared/src/schema/_definitions_extended.ts`)
4. No fabricated metrics — all social-proof numbers are DB-backed (verified by brand compliance)
The `BlindBoxPaymentPage` reads this flag and shows a maintenance message when
payments are disabled.

> **Beta guidance**: Leave `PAYMENTS_ENABLED=false` during the initial internal
> beta unless live payments are explicitly in scope. When you are ready to enable
> payments, also configure the WeChat Pay variables below.

### Open beta (self-serve, payments required)

For the **wider open beta** cohort, product requires **`PAYMENTS_ENABLED=true`**. Before turning it on in any environment:

1. Set **all** WeChat Pay variables in the table below; confirm `WECHAT_PAY_APP_ID` matches `WECHAT_APPID` in production.
2. Run **staging** end-to-end: mini-program (and web if in scope) create payment → verify → entitlement; exercise `/api/webhooks/wechat-pay` with a valid signature path (see webhook section above).
3. Confirm **`GET /api/readyz`** returns `200` after deploy; add `/api/readyz` and `/api/metrics` to synthetic monitoring (see [Follow-ups](#follow-ups-for-later-batches)).
4. Record sign-off in [`open-beta-wider.md`](./open-beta-wider.md) go/no-go table.

---

## WeChat Pay Variables (required when `PAYMENTS_ENABLED=true`)

| Variable | Description |
|---|---|
| `WECHAT_PAY_APP_ID` | WeChat Pay App ID. In the current direct mini-program JSAPI setup, this must match `WECHAT_APPID`. |
| `WECHAT_PAY_MCH_ID` | WeChat Pay Merchant ID |
| `WECHAT_PAY_SERIAL_NO` | WeChat Pay certificate serial number |
| `WECHAT_PAY_PRIVATE_KEY` | WeChat Pay API v3 private key (PEM) |
| `WECHAT_PAY_APIV3_KEY` | WeChat Pay API v3 key (exactly 32 bytes). Used for AES-256-GCM webhook decryption. |
| `WECHAT_PAY_PLATFORM_CERT` | WeChat Pay platform certificate or public-key PEM for webhook signature verification. Supports raw PEM public key (微信支付公钥 mode), raw PEM platform certificate (legacy), and base64-encoded PEM. |
| `WECHAT_PAY_NOTIFY_URL` | Optional override for WeChat Pay webhook notify URL. Defaults to `APP_URL/api/webhooks/wechat-pay` if unset. |

When `PAYMENTS_ENABLED=true`, startup validation fails in production if `WECHAT_PAY_APP_ID`
and `WECHAT_APPID` differ. JoyJoin's current mini-program JSAPI flow assumes a direct-merchant
setup where the login appid and payment appid are the same mini-program subject.

### Webhook Signature Verification

The `/api/webhooks/wechat-pay` endpoint verifies incoming webhook signatures:

1. **RSA-SHA256** (production-grade): set `WECHAT_PAY_PLATFORM_CERT` to the PEM
   contents of the WeChat Pay platform certificate or public key downloaded from the merchant
   console. The value may be supplied as raw PEM (beginning with `-----BEGIN PUBLIC KEY-----` or
   `-----BEGIN CERTIFICATE-----`) or as a base64-encoded PEM string, which is recommended for
   docker-compose `env_file` values to avoid multi-line corruption. See:
   https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_1.shtml

2. **Development mode** (`NODE_ENV=development`): signature verification is
   skipped entirely to simplify local testing.

If a payment confirmation is delayed or a webhook is missed, clients can call
`POST /api/payments/:wechatOrderId/reconcile` to query WeChat Pay directly and
fulfill the order. The endpoint is idempotent and returns `{ status, fulfilled }`.

In non-development environments, webhooks with stale timestamps (> 5 minutes
old) are rejected alongside signature verification. In
`NODE_ENV=development`, both signature and timestamp validation are skipped for
local testing.

---

## Matching Feature Flags

### `ENABLE_SEMANTIC_SIMILARITY`

Controls whether the **7th scoring dimension** (semantic similarity) is applied during pool matching.

| Value | Behaviour |
|---|---|
| `false` (default) | Standard 6D pair scoring — chemistry 28% / interest 28% / socialAffinity 20% / backgroundDiversity 15% / preference 5% / language 4%. Behavior is identical to pre-feature code. |
| `true` | 7D pair scoring — weights shift conservatively to accommodate a bounded semantic similarity score at 6%: chemistry 26% / interest 26% / socialAffinity 19% / backgroundDiversity 14% / preference 5% / language 4% / semanticSimilarity 6%. |

```bash
# Enable semantic similarity (7D scoring)
ENABLE_SEMANTIC_SIMILARITY=true

# Disable semantic similarity (default 6D scoring)
ENABLE_SEMANTIC_SIMILARITY=false
```

**Profile source:** The semantic score is built from cached, deterministic profile fields
(`archetype`, `workMode`, `educationLevel`, `industryNiche`, `hometown`, `preferredLanguages`,
`eventIntent`, bar preferences) plus `user_interests` topic and heat data. It does **not** read
`user_interest_signals` — that boundary is enforced by the signal boundary invariant test.

**Score bounds:** Semantic similarity is clamped to `[35, 100]`. If both profiles are missing or
empty, the score falls back to `50` (neutral); if exactly one side is missing or empty, it falls
back to `45` (slightly conservative). The 6% weight keeps the maximum possible score shift to
≤3.9 points, preserving group formation stability.

**Admin visibility:** The admin dashboard (`/admin`) shows the 🧠 语义匹配观测 panel with
real-time average semantic score, pair-score deltas, and flag status. Prometheus metrics are
available at the `/api/metrics` endpoint.

> **Status:** Enabled in production since 2026-05-09. Semantic profile quality was validated
> against live pool data before enabling. Monitor the admin dashboard 🧠 语义匹配观测 panel
> for unexpected score shifts during the first week of active 7D scoring.

---

## Social Icebreaker Phase Flags

| Variable | Description | Default |
|---|---|---|
| `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE` | Enable personality dice phase (roster-sized challenges) | `true` |
| `PERSONALITY_DICE_CHOOSE_MODE_ENABLED` | When `true`, generates 3 dares per player (easy/medium/hard); player picks one | `true` |
| `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | Enable auction phase (virtual-coin lots + bidding) | `true` |
| `SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR` | Enable group mirror phase (群像镜像) | `true` |
| `SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD` | Enable undercover word phase (谁是卧底) | `true` |
| `SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE` | Enable quip battle phase (机智对决) | `true` |
| `SOCIAL_ICEBREAKER_ENABLE_SPEED_FRIENDING` | Enable speed friending phase (round-robin timed 1-on-1 rotations) — backend implemented 2026-05-27 | `true` |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` | Enable **迷你剧本杀** (`mini_script`) phase | `true` |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA` | Legacy alias for `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` | `false` |
| `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER` | Enable server-rendered moment card PNG (`GET /:id/moment-card.png`) | `true` |
| `RUN_PLAN_TEMPLATES_ENABLED` | Enable template-driven run plan compiler **and** the 3×3 vibe grid UX (深聊/均衡/暢玩). When `false`, legacy `compileAgentRunPlan()` runs unchanged and clients hide the vibe selector. When `true`, the server queries DB templates and falls back to the rule engine; clients show the vibe selector. | `true` |

## Social Icebreaker LLM Kill Switches

| Variable | Description | Default |
|---|---|---|
| `SOCIAL_WARMUP_LLM_ENABLED` | When `true`, `generateWarmupTopics` calls the model; when `false`, curated fallback topics | `true` |
| `SOCIAL_MICRO_CHALLENGE_LLM_ENABLED` | When `true`, `generateMicroChallenges` calls the model; when `false`, deterministic selector baseline | `true` |
| `SOCIAL_LIE_DETECTIVE_LLM_ENABLED` | When `true`, lie-detective statement generation calls the model; when `false`, curated fallback sets | `true` |
| `SOCIAL_AUCTION_LLM_ENABLED` | When `true`, `generateAuctionLots` calls the model; when `false`, curated fallback lots only | `true` |
| `SOCIAL_PERSONALITY_DICE_LLM_ENABLED` | When `true`, personality-dice dare generation calls the model; when `false`, archetype dare bank | `true` |
| `SOCIAL_GROUP_MIRROR_LLM_ENABLED` | When `true`, `generateGroupMirrorQuestions` calls the model; when `false`, curated fallback questions | `true` |
| `SOCIAL_UNDERCOVER_WORD_LLM_ENABLED` | When `true`, `generateUndercoverWordPair` calls the model; when `false`, curated fallback pair | `true` |
| `SOCIAL_QUIP_BATTLE_LLM_ENABLED` | When `true`, `generateQuipBattlePrompts` calls the model; when `false`, curated fallback prompts | `true` |
| `SOCIAL_MINISCRIPT_LLM_ENABLED` | When `true`, mini-script framework generation calls the model; when `false`, catalog/stub fallback | `true` |
| `SOCIAL_RECAP_LLM_ENABLED` | When `true`, `generateRecapSummary` calls the model; when `false`, deterministic default recap | `true` |
| `SOCIAL_ICEBREAKER_LLM_GAME_SELECTION` | Enable LLM-enhanced phase ranking in `compileAgentRunPlan()` | `false` |

---

## Onboarding & Matching Feature Flags

| Variable | Description | Default |
|---|---|---|
| `RESTART_ONBOARDING_ENABLED` | Allow returning users to reset onboarding data via `POST /api/auth/onboarding/restart`. Burns one of 5 lifetime restarts. | `false` |
| `SMART_PROFESSION_V1_ENABLED` | AI-driven profession understanding with reveal card and auto-classification. When `false`, uses legacy 184-keyword reaction system. | `true` |
| `ONBOARDING_FORCE_SKIP_ENABLED` | Show a "跳过" force-skip button on onboarding steps for stuck users (admin kill-switch). | `false` |
| `MATCHING_LIVE_REVEAL_ENABLED` | Show live reveal overlay in matching status before group detail. When `false`, skips overlay. | `true` |
| `VENUE_ASSIGNMENT_ENABLED` | Auto-assign venues to groups after pool matching. When `false`, manual assignment required. | `true` |

---

## Internal Alang NPC Prototype

`ALANG_ENABLED` is the environment fallback for the DB-backed `alangEnabled`
feature flag. Its safe default is `false`. When enabled, every authenticated
tester in that environment receives `features.alangEnabled=true`; entry points
do not depend on a special local account or on `APP_MODE=test`.

For staging validation, apply the Alang migration first, then set:

```bash
APP_MODE=staging
ALANG_ENABLED=true
ENABLE_SINGLE_TEST_MODE=true
```

`ENABLE_SINGLE_TEST_MODE=true` is required only for the Alang debug endpoints
and coordinate overrides. Those capabilities are hard-disabled when
`APP_MODE=production`. To roll back immediately, set the DB flag (preferred) or
`ALANG_ENABLED=false`; the server and mini-program entry points fail closed.

---

## Discover UI Feature Flag

### `ORACLE_CARD_CORNER_STAT_ENABLED`

Controls whether the Discover `OracleCard` shows a **top-right registration-count badge** (`X 人已报名` and event-type-aware variants) on each pool card.

| Value | Behaviour |
|---|---|
| `true` (default) | Badge renders when `currentParticipants > 0` and the pool is not full. Copy adapts to event type: `饭局` → "X 人入座中", `酒局` → "X 人已入席", others → "X 位伙伴已加入". |
| `false` | Badge is hidden; cards revert to the pre-badge visual layout. |

```bash
# Show the corner participant-count badge (default)
ORACLE_CARD_CORNER_STAT_ENABLED=true

# Hide the corner participant-count badge (kill switch)
ORACLE_CARD_CORNER_STAT_ENABLED=false
```

**Client exposure:** The flag is exposed via `/api/auth/user` as `features.oracleCardCornerStatEnabled` and consumed by `pages/discover/index.tsx`, which forwards it to `OracleCard`. The component defaults to `true` if the flag is absent.

**Analytics:** When enabled, the card emits `corner_badge_impression` once per mount (if count > 0) and `corner_badge_live_update` whenever the count changes while the card is mounted. The `pool_card_tap` event includes `hasCornerCount` and `cornerCount` context.

---

## Pool Registration Persona Snapshot

| Env var | `PERSONA_SNAPSHOT_ENABLED` |
|---|---|
| **Default** | `true` |
| **Flag key** | `personaSnapshotEnabled` |
| **Type** | Client-facing kill switch |
| **Exposed in** | `GET /api/auth/user` → `features.personaSnapshotEnabled` |

Controls whether the aggregate "persona 拼图卡" preview card is rendered on the first screen of pool registration. When enabled, the card shows a live, algorithmically-sorted puzzle metaphor of current registrants across five dimensions (social archetype, industry background, event intent, age distribution, gender ratio). When disabled, the card is not rendered and no snapshot request is made.

| Value | Behavior |
|---|---|
| `true` (default) | Card renders on pool-registration step 0; `GET /api/event-pools/:id/persona-snapshot` is available. |
| `false` | Card is hidden; registration flow unchanged. |

```bash
# Show the persona snapshot preview card (default)
PERSONA_SNAPSHOT_ENABLED=true

# Hide the persona snapshot preview card
PERSONA_SNAPSHOT_ENABLED=false
```

**Client exposure:** The flag is exposed via `/api/auth/user` as `features.personaSnapshotEnabled` and consumed by `pages/pool-registration/index.tsx`. The component defaults to `true` if the flag is absent.

**Analytics:** When enabled, the card emits `persona_snapshot_impression` on first view, `persona_snapshot_expand_sheet` when the bottom sheet opens, `persona_snapshot_dimension_tap` when a dimension pill is tapped, `persona_snapshot_new_registrant_banner_shown` when the registrant count grew since the last view, `persona_snapshot_refresh_tap` on explicit refresh (future), `persona_snapshot_state_band` carrying the computed `stateBand`, `persona_snapshot_load_error` when the snapshot fails to load, and `persona_snapshot_user_archetype_impression` when the user's own archetype is shown in the preview.

---

## Rate Limiting

All rate limits are applied per user ID (or IP for anonymous requests) using an
in-memory sliding window. Limits are intentionally conservative for internal beta.

| Limiter | Endpoints | Window | Max requests |
|---|---|---|---|
| `authEndpointLimiter` | `/api/auth/wechat/*`, `/api/auth/phone/*` | 1 min | 20 |
| `paymentEndpointLimiter` | `POST /api/subscription/renew`, `POST /api/coupons/validate`, `POST /api/payments/create`, `POST /api/payments/miniprogram/create` | 1 min | 10 |
| `webhookEndpointLimiter` | `POST /api/webhooks/wechat-pay` | 1 min | 120 |
| `aiEndpointLimiter` | AI-heavy routes | 1 min | 10 |
| `kpiEndpointLimiter` | KPI / analytics routes | 1 min | 30 |

Clients that exceed a limit receive `429 Too Many Requests` with a `Retry-After`
header.

---

## Health & Readiness Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Liveness check — always returns `200 { status: "ok" }` when the server is running. |
| `GET /healthz` | Alias for `/api/health` (Kubernetes / Docker compatibility). |
| `GET /api/readyz` | Readiness check — returns `200 { status: "ready" }` when DB connectivity and critical config are valid. Returns `503 { status: "not_ready", checks: { database, config } }` on failure. |
| `GET /readyz` | Redirects to `/api/readyz`. |

Use `/api/readyz` in deployment orchestrators (for example the current SSH + Docker Compose + Nginx deployment, Kubernetes, or Railway) to
gate traffic. The `HEALTHCHECK` in `apps/server/Dockerfile` points at
`/api/health` and now respects the `PORT` environment variable (default `5000`);
it uses `127.0.0.1` to avoid IPv6 `localhost` ambiguity.

---

## Error Response Shape

All API errors now follow a consistent envelope:

```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

- Raw exception messages and stack traces are **never** sent to clients in
  production.
- The optional `code` field enables client-side error handling (e.g.
  `PAYMENTS_DISABLED`).

---

## Session Expiry Recovery (Client)

When a mutation or action receives a `401 Unauthorized` response (session
expired), the user client:

1. Clears the React Query cache (drops all stale user data).
2. Redirects to `/` (landing page) via a full-page navigation to ensure a clean
   application reset.

This prevents users from getting stuck in loading loops or broken states when
their session expires mid-flow.

---

## Follow-ups for Later Batches

- Automate WeChat Pay platform certificate rotation / selection by
  `Wechatpay-Serial` once the merchant certificate management flow is wired in.
- Integration-test the end-to-end AES-256-GCM decryption path against a real
  WeChat Pay sandbox environment (implementation is complete; requires merchant
  credentials and a real encrypted webhook payload to validate in staging).
- Move rate-limit store to Redis for multi-instance deployments (current store is
  in-memory and not shared across processes).
- Add structured logging backend (Batch 2 observability work).
- Add `/api/readyz` to deployment smoke tests / synthetic monitoring (required for open beta per [`open-beta-wider.md`](./open-beta-wider.md)).
