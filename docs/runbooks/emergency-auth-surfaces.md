# Emergency auth surfaces — audit and rotation

**Audience:** Engineering + on-call for **open beta** and production.

## Surfaces

| Surface | Location | Production default |
|---------|----------|---------------------|
| Production auth debug | [`apps/server/src/auth/policy.ts`](../../apps/server/src/auth/policy.ts) — `ALLOW_PRODUCTION_AUTH_DEBUG`, `ENABLE_DEV_AUTH_TOOLS` | **Unset** (fail-closed) |
| CLI bypass login | [`apps/server/src/cli/bypassLogin.ts`](../../apps/server/src/cli/bypassLogin.ts) | Requires explicit env + secret per policy; not for routine use |
| Session | `SESSION_SECRET` | Rotate after any suspected leak or emergency drill |

## Procedure

1. **Quarterly / pre-release:** Confirm production env has no `ALLOW_PRODUCTION_AUTH_DEBUG=1`, no `ENABLE_DEV_AUTH_TOOLS=1`.
2. **After any bypass use:** Rotate `ADMIN_CREATE_SECRET_KEY` (if used), `SESSION_SECRET` if session integrity questioned, and WeChat secrets if tokens exposed.
3. **Incident:** Follow [`admin-incident-handling.md`](./admin-incident-handling.md); disable compromised `admin_accounts` first (blocks at middleware).

## Single-replica reminder

Restart clears in-process abuse counters and rate-limit buckets ([`abuseDetection.ts`](../../apps/server/src/abuseDetection.ts), [`rateLimiter.ts`](../../apps/server/src/rateLimiter.ts)). Document in deploy runbook; see [`open-beta-wider.md`](../open-beta-wider.md).
