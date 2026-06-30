---
id: repo.payments.wechat-reconcile-fallback.2026-06-30
title: WeChat Pay reconciliation fallback
status: active
owner: joyjoin-payments
lastValidatedAt: 2026-06-30
tags:
  - payments
  - wechat-pay
  - webhook
  - reconciliation
  - staging
triggerTerms:
  - payment not fulfilled
  - webhook delayed
  - reconcile payment
  - WECHAT_PAY_PLATFORM_CERT
  - 微信支付公钥
relatedPaths:
  - apps/server/src/paymentService.ts
  - apps/server/src/routes/domains/payments.ts
  - apps/mini-program/src/pages/event-ticket-payment/index.tsx
  - packages/shared/src/api.ts
  - docs/operations/test-mode-operations.md
  - deployment/scripts/deploy-staging.sh
sources:
  - apps/server/src/paymentService.ts
  - apps/server/src/routes/domains/payments.ts
  - apps/mini-program/src/pages/event-ticket-payment/index.tsx
  - docs/operations/test-mode-operations.md
confidence: high
---

## WeChat Pay reconciliation fallback

- If a WeChat Pay charge succeeds but the registration/entitlement is not created (e.g. webhook delayed or dropped), the server exposes `POST /api/payments/:wechatOrderId/reconcile`. It queries WeChat Pay directly and fulfills the order if paid. Idempotent; returns `{ status, fulfilled }`.
- The mini-program `pages/event-ticket-payment` polls payment status 20 times at 1-second intervals, then falls back to the reconcile endpoint.
- `WECHAT_PAY_PLATFORM_CERT` supports raw PEM public key (微信支付公钥 mode), raw PEM platform certificate (legacy), or base64-encoded PEM. Base64 encoding is preferred in CI/staging env files to avoid multi-line corruption.
- `deployment/scripts/deploy-staging.sh` validates the cert/public key on every deploy and aborts if invalid.
- Last validated: 2026-06-30.
