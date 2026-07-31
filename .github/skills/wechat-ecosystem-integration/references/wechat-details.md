# WeChat Details Reference

## jscode2session specifics

JoyJoin uses a **single `WECHAT_APPID`** for Mini Program (subtype ①) and Official Account web OAuth (subtype ②), bound under the same WeChat Open Platform account for shared UnionID.

| Subtype | Flow | Server function | Endpoint |
|---------|------|-----------------|----------|
| ① Mini Program | `Taro.login()` → code → `jscode2session` | `getWechatOpenId()` | `POST /api/auth/wechat/login` |
| ② OA web OAuth | `wx.login()` or redirect → `sns/oauth2/access_token` | `getWechatOAuthOpenId()` | `GET /api/auth/wechat/oauth/start` → `/callback` |
| ③ Open Platform QR | `qrconnect` → `open.weixin.qq.com` | **Not used** | — |

### Dev mock behavior

In `development` (`NODE_ENV === 'development'`), both `getWechatOpenId` and `getWechatOAuthOpenId` accept mock codes and return synthetic `openid`s so the flow can be exercised without real WeChat credentials. This is gated by `canUseMockWechatAuth()` in `apps/server/src/auth/policy.ts`.

### Session persistence

- Mini Program: server creates an Express session; cookies are carried by `Taro.request({ enableCookie: true })`.
- Web OAuth: session is created in the callback handler, then browser is redirected back to the frontend origin.

## JSAPI/H5 payment details

| Surface | Server method | Client launch | Route |
|---------|---------------|---------------|-------|
| Mini Program JSAPI | `paymentService.createMiniProgramPayment()` | `Taro.requestPayment({ timeStamp, nonceStr, package, signType, paySign })` | `POST /api/payments/miniprogram/create` |
| Browser H5 | `paymentService.createPayment()` | Redirect to `h5Url` | `POST /api/payments/create` |
| Webhook | `paymentService.handleWebhook()` | — | `POST /api/webhooks/wechat-pay` |

### Payment config safety

- `WECHAT_PAY_APP_ID` must match `WECHAT_APPID` for the direct mini-program JSAPI flow. `configValidation.ts` enforces this at startup when `PAYMENTS_ENABLED=true`.
- Webhook signature verification uses RSA-SHA256 with `WECHAT_PAY_PLATFORM_CERT` (or `WECHAT_PAY_PLATFORM_PUBLIC_KEY`). Verification is skipped in development.
- Webhook resource decryption uses `WECHAT_PAY_APIV3_KEY` (exactly 32 bytes) with AEAD_AES_256_GCM.

## Taro.login patterns

### API transport

`apps/mini-program/src/lib/api/api.ts` wraps `Taro.request` with:
- Cookie-enabled requests (`enableCookie: true`)
- 304 cache-bust retry for GET
- Domain-list / SSL / timeout error translation
- 401 → `handleMiniProgramUnauthorized()` → redirect to login

### Auth bootstrap

1. `Taro.login()` → code
2. `POST /api/auth/wechat/login` (or `/login-with-test` with answers)
3. `GET /api/auth/user` → `nextStep`
4. `seedMiniProgramAuthSession()` writes React Query cache
5. `navigateToMiniProgramNextStep()` routes by `nextStep`

### Payment launch

1. `POST /api/payments/miniprogram/create` → `PaymentIntentResponse`
2. Persist pending order context (`Taro.setStorageSync`)
3. `Taro.requestPayment(...)`
4. On return, navigate to verification page and poll `GET /api/payments/:wechatOrderId/status`

## session_key handling

- `session_key` is exchanged during `jscode2session` and used for encrypted-data decryption
- Never log or expose `session_key` to clients
- Store securely server-side only

## Cross-platform coordination

- Mini Program is the **launch-primary** and only active user-facing client.
- The web client (`apps/user-client`) was archived to `archived/workspaces/user-client/` (2026-05-07).
  Formerly it used a hybrid WeChat OAuth2 / `wx.login()` path — no longer active.
- Any change to shared auth/payment contracts must be reviewed against `docs/PLATFORM_COORDINATION.md`.

## Canonical References

- `apps/server/src/wechatAuth.ts` — `getWechatOpenId`, `getWechatOAuthOpenId`, `findOrCreateWechatUser`, OAuth routes
- `apps/server/src/paymentService.ts` — `PaymentService`, JSAPI/H5 creation, webhook handling, signature verification
- `apps/server/src/routes/domains/payments.ts` — payment routes + webhook
- `apps/server/src/routes/domains/auth.ts` — WeChat login routes
- `apps/server/src/lib/configValidation.ts` — `WECHAT_APPID` validation
- `apps/mini-program/src/lib/api/api.ts` — `Taro.request` wrapper
- `apps/mini-program/src/hooks/auth/useWeChatLogin.ts` — Mini Program login hook
- `apps/mini-program/src/pages/blind-box-payment/index.tsx` — `Taro.requestPayment` launch
- `archived/workspaces/user-client/src/hooks/useWeChatLogin.ts` — Archived Web OAuth / `wx.login()` hybrid hook
- `docs/PLATFORM_COORDINATION.md` — Cross-platform auth/payment coordination playbook
- `docs/wechat-mini-program-reference.md` — Low-level WeChat API and rpx reference
