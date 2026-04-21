# Open beta (wider) — risk addendum and execution contract

**Status:** Engineering companion to [`launch-risks.md`](./launch-risks.md) (internal beta).  
**Scope:** Self-serve signup with **immediate account**, **single server process** for this cohort, and **payments required** (`PAYMENTS_ENABLED=true` when live).

## Locked decisions

| Decision | Engineering implication |
|----------|---------------------------|
| Immediate account | Harden existing [`routes/domains/auth.ts`](../apps/server/src/routes/domains/auth.ts) and [`routes/domains/assessment.ts`](../apps/server/src/routes/domains/assessment.ts) flows; rate limits on public auth endpoints ([`rateLimiter.ts`](../apps/server/src/rateLimiter.ts)). |
| Exactly one process | **Ops contract:** max one Node replica for open beta. In-process [`abuseDetection.ts`](../apps/server/src/abuseDetection.ts), rate limiter, and [`inference/cache.ts`](../apps/server/src/inference/cache.ts) are **accepted only under this contract**. Document restart effects (soft counters reset). Scale-out requires Redis/DB per post-beta checklist in `launch-risks.md`. |
| Payments on | Satisfy [`LAUNCH_CONFIG.md`](./LAUNCH_CONFIG.md) WeChat Pay variables and startup validation; smoke web + mini-program pay paths before go-live. |

## Risk register delta (vs internal beta)

| ID | Internal beta note | Open beta (untrusted) |
|----|--------------------|-------------------------|
| R-01 | Single-node AI cache OK | Same **only** with single-replica contract; monitor cost after public volume. |
| R-02 | In-memory abuse state | Accepted **only** with single replica + runbook; abuse still enforced via DB-backed bans where applicable. |
| R-03 | Emergency auth debug | Stricter prod audit; see [`runbooks/emergency-auth-surfaces.md`](./runbooks/emergency-auth-surfaces.md). |
| R-04 | Viewer write exposure | **Mitigated:** mutating `/api/admin/*` routes require `requireOperatorOrAbove` after `requireAdmin` (see `adminAuth.ts`). |
| R-05 / R-06 | Admin sessions / legacy `users.isAdmin` | Legacy path **disabled in production** by default (see `adminAuth.ts`); migrate admins to `admin_accounts`. |
| R-07 | PII | Legal review required for open signup + payments — use [`legal-open-beta-checklist.md`](./legal-open-beta-checklist.md). |
| R-08 | Matching thresholds | Change-management: update thresholds only between match runs. |

**Single-replica runbook:** [`runbooks/open-beta-single-replica.md`](./runbooks/open-beta-single-replica.md)

## Environment matrix (checklist)

Copy for staging / production sign-off. **Do not** commit real secrets.

| Variable | Production (open beta) | Notes |
|----------|------------------------|--------|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | Set | Required at startup |
| `SESSION_SECRET` | ≥ 32 chars | Rotate after incident |
| `WECHAT_APPID` / `WECHAT_SECRET` | Set | Mini program |
| `PAYMENTS_ENABLED` | `true` | Required for this cohort |
| `WECHAT_PAY_*` | All set per LAUNCH_CONFIG | When payments on |
| `ALLOW_PRODUCTION_AUTH_DEBUG` | **Unset** | Never `1` in normal prod |
| `ENABLE_DEV_AUTH_TOOLS` | **Unset** | |
| `DEEPSEEK_API_KEY` / AI keys | As needed | Optional degradation |

## Public route audit (reference)

Unauthenticated and high-risk routes are owned by domain routers registered from [`routes.ts`](../apps/server/src/routes.ts). Primary surfaces:

- **Auth / registration:** [`routes/domains/auth.ts`](../apps/server/src/routes/domains/auth.ts) — phone/WeChat send-code and login; use `authEndpointLimiter` where applied.
- **Assessment registration:** [`routes/domains/assessment.ts`](../apps/server/src/routes/domains/assessment.ts) — `POST /api/user/register` and related.
- **Webhooks:** WeChat Pay webhook (signature per `LAUNCH_CONFIG.md`).

Re-audit when adding new `app.post`/`get` without session middleware. Last reviewed: see git history for `docs/open-beta-wider.md`.

## Go / no-go (open beta)

- Single-replica deploy attested.
- `PAYMENTS_ENABLED=true` with passing payment smoke on staging and production.
- Admin `viewer` cannot mutate (automated RBAC audit + integration tests).
- `npm run check:full` and `npm run test -w @joyjoin/server` green on release commit.
- Legal sign-off for open signup + payments ([`legal-open-beta-checklist.md`](./legal-open-beta-checklist.md)).
