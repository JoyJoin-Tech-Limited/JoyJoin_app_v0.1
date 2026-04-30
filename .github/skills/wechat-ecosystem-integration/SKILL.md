---
name: wechat-ecosystem-integration
description: >
  WeChat auth, Mini Program APIs, Taro patterns, WeChat Pay v3, and cross-platform
  coordination for the JoyJoin WeChat ecosystem. Use when working with wx.login,
  Taro.login, jscode2session, OAuth2 web flows, JSAPI/H5 payments, webhook
  verification, or mini-program-specific transport and auth session wiring.
  Trigger phrases: "wechat auth", "wx.login", "Taro.login", "jscode2session",
  "WeChat Pay", "Taro.requestPayment", "mini-program payment", "wechat oauth",
  "openid", "session_key", "WECHAT_APPID", "WECHAT_PAY".
---

# wechat-ecosystem-integration

**Core rule:** JoyJoin's WeChat ecosystem spans three auth subtypes (Mini Program, Official Account web OAuth, Open Platform QR) and two payment surfaces (Mini Program JSAPI via `Taro.requestPayment` — **launch-primary**, browser H5 — **reference-only**). The server owns all token exchange, signature verification, and webhook handling; clients only exchange codes and launch payments.

## When to use this skill

- Adding or changing WeChat login, auth, or session-handling code on server or client
- Working with WeChat Pay v3: JSAPI, H5, Native, refunds, or webhooks
- Modifying mini-program API transport, auth bootstrap, or payment launch flow
- Configuring or debugging `WECHAT_APPID`, `WECHAT_SECRET`, `WECHAT_PAY_*` environment variables
- Integrating `Taro` WeChat-specific APIs
- Deciding whether a WeChat-specific change needs sibling-platform review

## Auth flow overview

JoyJoin uses a **single `WECHAT_APPID`** for Mini Program (subtype ①) and Official Account web OAuth (subtype ②), bound under the same WeChat Open Platform account for shared UnionID.

| Subtype | Flow | Server function | Endpoint |
|---------|------|-----------------|----------|
| ① Mini Program | `Taro.login()` → code → `jscode2session` | `getWechatOpenId()` | `POST /api/auth/wechat/login` |
| ② OA web OAuth | `wx.login()` or redirect → `sns/oauth2/access_token` | `getWechatOAuthOpenId()` | `GET /api/auth/wechat/oauth/start` → `/callback` |
| ③ Open Platform QR | `qrconnect` | **Not used** | — |

In `development`, both functions accept mock codes and return synthetic `openid`s (gated by `canUseMockWechatAuth()`).

## Payment overview

| Surface | Server method | Client launch | Route |
|---------|---------------|---------------|-------|
| Mini Program JSAPI | `paymentService.createMiniProgramPayment()` | `Taro.requestPayment(...)` | `POST /api/payments/miniprogram/create` |
| Browser H5 | `paymentService.createPayment()` | Redirect to `h5Url` | `POST /api/payments/create` |
| Webhook | `paymentService.handleWebhook()` | — | `POST /api/webhooks/wechat-pay` |

`WECHAT_PAY_APP_ID` must match `WECHAT_APPID` for JSAPI. Webhook signature verification uses RSA-SHA256; resource decryption uses AEAD_AES_256_GCM.

For jscode2session specifics, JSAPI/H5 payment details, webhook verification steps, Taro.login patterns, session_key handling, and cross-platform coordination — see [references/wechat-details.md](references/wechat-details.md).

## Quick examples

**Add a new Mini Program auth gate after login**
Call `authenticateMiniProgramUserWithTest()` from the personality-test auth-gate, then `getUserState()` to read `nextStep` and route via `navigateToMiniProgramNextStep()`.

**Create a Mini Program payment intent**
Server: `paymentService.createMiniProgramPayment({ userId, paymentType, relatedId, originalAmount, openid, clientIp })`. Return `timeStamp`, `nonceStr`, `package`, `signType`, `paySign`. Client calls `Taro.requestPayment({ ... })`. Never construct `paySign` on the client.

## Troubleshooting

1. **Mini Program login fails with "domain list" error** — The API origin is not in the Mini Program's **request合法域名** whitelist. Add it in the WeChat MP admin console, then clear cache in DevTools.

2. **Payment intent creation fails with `PAYMENT_CONFIG_ERROR`** — Check `WECHAT_PAY_APP_ID` matches `WECHAT_APPID`. Run `npm run dev:server` and watch startup logs from `configValidation.ts`.

3. **Web OAuth redirect loops or `invalid_state`** — Ensure `APP_URL` matches the registered **网页授权域名** in the WeChat OA backend. Verify `req.session.oauthState` is persisted before the redirect and cleared after callback validation.

4. **Webhook signature verification fails in production** — Confirm `WECHAT_PAY_PLATFORM_CERT` is set to the PEM contents (not a file path). Check that the raw body is captured before Express JSON parsing (`req.rawBody`).

5. **Mini Program gets 401 after successful login** — Verify `Taro.request` is called with `enableCookie: true`. Check that the server session cookie domain matches the Mini Program request origin.

## Review checklist

- [ ] `WECHAT_APPID` / `WECHAT_SECRET` are read from `process.env` and validated at startup
- [ ] Mock auth paths are gated by `NODE_ENV === 'development'` or `canUseMockWechatAuth()`
- [ ] Webhook signatures are verified in production (fail-closed)
- [ ] `paySign` is generated server-side only; client only forwards it to `Taro.requestPayment`
- [ ] Mini Program `Taro.request` uses `enableCookie: true` for session-carrying requests
- [ ] Payment config validation checks `WECHAT_PAY_APP_ID === WECHAT_APPID` when JSAPI is active
- [ ] Auth callback handlers validate CSRF `state` before exchanging codes
- [ ] Any change to shared auth/payment DTOs is reviewed against `docs/PLATFORM_COORDINATION.md`
