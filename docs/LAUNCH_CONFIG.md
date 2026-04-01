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

In non-production environments, missing required variables emit a warning but do
**not** block startup.

---

## Optional Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek AI API key | _unset_ — AI features degrade gracefully |
| `MINIMAX_API_KEY` | MiniMax TTS API key | _unset_ — TTS cache warmup skipped |
| `MINIMAX_GROUP_ID` | MiniMax group identifier | _unset_ |
| `AMAP_API_KEY` | Amap reverse-geocoding API key | _unset_ — local bounding-box fallback used |
| `AMAP_SECURITY_KEY` | Amap security key | _unset_ |
| `COOKIE_DOMAIN` | Cookie domain for cross-subdomain sessions | _unset_ (auto-detected) |
| `PORT` | Server listen port | `5001` |

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
The `BlindBoxPaymentPage` reads this flag and shows a maintenance message when
payments are disabled.

> **Beta guidance**: Leave `PAYMENTS_ENABLED=false` during the initial internal
> beta unless live payments are explicitly in scope. When you are ready to enable
> payments, also configure the WeChat Pay variables below.

---

## WeChat Pay Variables (required when `PAYMENTS_ENABLED=true`)

| Variable | Description |
|---|---|
| `WECHAT_PAY_APP_ID` | WeChat Pay App ID |
| `WECHAT_PAY_MCH_ID` | WeChat Pay Merchant ID |
| `WECHAT_PAY_SERIAL_NO` | WeChat Pay certificate serial number |
| `WECHAT_PAY_PRIVATE_KEY` | WeChat Pay API v3 private key (PEM) |
| `WECHAT_PAY_APIV3_KEY` | WeChat Pay API v3 key (exactly 32 bytes). Used for AES-256-GCM webhook decryption and HMAC-SHA256 signature verification. |
| `WECHAT_PAY_PLATFORM_CERT` | (Recommended) WeChat Pay platform certificate (PEM). When set, enables RSA-SHA256 webhook signature verification instead of the HMAC fallback. |

### Webhook Signature Verification

The `/api/webhooks/wechat-pay` endpoint verifies incoming webhook signatures:

1. **RSA-SHA256** (production-grade): set `WECHAT_PAY_PLATFORM_CERT` to the PEM
   contents of the WeChat Pay platform certificate downloaded from the merchant
   console. See: https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_1.shtml

2. **HMAC-SHA256 fallback**: if `WECHAT_PAY_PLATFORM_CERT` is not set but
   `WECHAT_PAY_APIV3_KEY` is configured, the endpoint uses HMAC-SHA256 over the
   API v3 key. This protects against replay and tampering but is weaker than RSA.

3. **Development mode** (`NODE_ENV=development`): signature verification is
   skipped entirely to simplify local testing.

Webhooks with stale timestamps (> 5 minutes old) are always rejected regardless
of mode.

---

## Social Icebreaker Phase Flags

| Variable | Description | Default |
|---|---|---|
| `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | Enable auction phase (beta) | `false` |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA` | Enable mini-script beta phase | `false` |

---

## Rate Limiting

All rate limits are applied per user ID (or IP for anonymous requests) using an
in-memory sliding window. Limits are intentionally conservative for internal beta.

| Limiter | Endpoints | Window | Max requests |
|---|---|---|---|
| `authEndpointLimiter` | `/api/auth/wechat/*`, `/api/auth/phone/*` | 1 min | 20 |
| `paymentEndpointLimiter` | `POST /api/payments/create`, `POST /api/subscription/renew` | 1 min | 10 |
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

Use `/api/readyz` in deployment orchestrators (Fly.io, Kubernetes, Railway) to
gate traffic. The `HEALTHCHECK` in `apps/server/Dockerfile` already points at
`/api/health`.

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

- Replace HMAC-SHA256 webhook verification with RSA-SHA256 once the WeChat Pay
  platform certificate is available and loaded into `WECHAT_PAY_PLATFORM_CERT`.
- Integration-test the end-to-end AES-256-GCM decryption path against a real
  WeChat Pay sandbox environment (implementation is complete; requires merchant
  credentials and a real encrypted webhook payload to validate in staging).
- Move rate-limit store to Redis for multi-instance deployments (current store is
  in-memory and not shared across processes).
- Add structured logging backend (Batch 2 observability work).
- Add `/api/readyz` to deployment smoke tests / synthetic monitoring.
