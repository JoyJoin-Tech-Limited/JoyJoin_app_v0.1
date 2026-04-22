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
- Handling `jscode2session`, `openid`, `session_key`, `unionid`, or encrypted-data decryption
- Integrating `Taro` WeChat-specific APIs (`Taro.login`, `Taro.requestPayment`, `Taro.request`, `Taro.showToast`)
- Deciding whether a WeChat-specific change needs sibling-platform review

## When NOT to use this skill

- Generic React/Vite web UI that does not touch WeChat APIs or payment flows
- Admin-only features with no WeChat integration surface
- Purely cosmetic mini-program UI work without auth/payment/WeChat API impact (use `mini-program-frontend-excellence`)
- Database schema design unrelated to WeChat (use `backend-models-standards`)

## Auth subtypes at a glance

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

## WeChat Pay surfaces

| Surface | Server method | Client launch | Route |
|---------|---------------|---------------|-------|
| Mini Program JSAPI | `paymentService.createMiniProgramPayment()` | `Taro.requestPayment({ timeStamp, nonceStr, package, signType, paySign })` | `POST /api/payments/miniprogram/create` |
| Browser H5 | `paymentService.createPayment()` | Redirect to `h5Url` | `POST /api/payments/create` |
| Webhook | `paymentService.handleWebhook()` | — | `POST /api/webhooks/wechat-pay` |

### Payment config safety

- `WECHAT_PAY_APP_ID` must match `WECHAT_APPID` for the direct mini-program JSAPI flow. `configValidation.ts` enforces this at startup when `PAYMENTS_ENABLED=true`.
- Webhook signature verification uses RSA-SHA256 with `WECHAT_PAY_PLATFORM_CERT` (or `WECHAT_PAY_PLATFORM_PUBLIC_KEY`). Verification is skipped in development.
- Webhook resource decryption uses `WECHAT_PAY_APIV3_KEY` (exactly 32 bytes) with AEAD_AES_256_GCM.

## Taro / Mini Program patterns

### API transport

`apps/mini-program/src/lib/api.ts` wraps `Taro.request` with:
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

## Cross-platform coordination

- Mini Program is the **launch-primary** client; treat it as the strongest reference for WeChat-specific flows.
- Web (`user-client`) uses a hybrid path: `wx.login()` when `wx` global exists, otherwise WeChat OAuth2 web redirect.
- Any change to shared auth/payment contracts must be reviewed against `docs/PLATFORM_COORDINATION.md`.
- Payment plan IDs, coupon payloads, and status strings must stay aligned across both clients.

## Quick Examples

### Add a new Mini Program auth gate after login

```typescript
// apps/mini-program/src/lib/api.ts
export async function authenticateMiniProgramUserWithTest(input: {
  testAnswers?: ImportedMiniProgramAssessmentAnswer[]
  anonymousSessionId?: string | null
}): Promise<void> {
  await postMiniProgramWeChatLogin(
    '/api/auth/wechat/login-with-test',
    {
      testAnswers: input.testAnswers ?? [],
      anonymousSessionId: input.anonymousSessionId ?? undefined,
    },
    '无法导入测试结果并建立微信登录会话',
  )
}
```

Call `authenticateMiniProgramUserWithTest()` from the personality-test auth-gate, then `getUserState()` to read `nextStep` and route via `navigateToMiniProgramNextStep()`.

### Create a Mini Program payment intent

```typescript
// server side: POST /api/payments/miniprogram/create
const paymentResult = await paymentService.createMiniProgramPayment({
  userId,
  paymentType: 'event',
  relatedId: eventId,
  originalAmount: amountInCents,
  openid: user.wechatOpenId,
  clientIp: getRequestClientIp(req),
})
```

Return `timeStamp`, `nonceStr`, `package`, `signType`, `paySign` to the client. The client calls `Taro.requestPayment({ ... })`. Never construct `paySign` on the client.

## Troubleshooting

1. **Mini Program login fails with "domain list" error**
   - The API origin is not in the Mini Program's **request合法域名** whitelist. Add it in the WeChat MP admin console, then clear cache in DevTools.

2. **Payment intent creation fails with `PAYMENT_CONFIG_ERROR`**
   - Check `WECHAT_PAY_APP_ID` matches `WECHAT_APPID`. Run `npm run dev:server` and watch startup logs from `configValidation.ts`.

3. **Web OAuth redirect loops or `invalid_state`**
   - Ensure `APP_URL` matches the registered **网页授权域名** in the WeChat OA backend. Verify `req.session.oauthState` is persisted before the redirect and cleared after callback validation.

4. **Webhook signature verification fails in production**
   - Confirm `WECHAT_PAY_PLATFORM_CERT` is set to the PEM contents (not a file path). Check that the raw body is captured before Express JSON parsing (`req.rawBody`).

5. **Mini Program gets 401 after successful login**
   - Verify `Taro.request` is called with `enableCookie: true`. Check that the server session cookie domain matches the Mini Program request origin (same domain or correct `COOKIE_DOMAIN`).

## Review checklist

- [ ] `WECHAT_APPID` / `WECHAT_SECRET` are read from `process.env` and validated at startup
- [ ] Mock auth paths are gated by `NODE_ENV === 'development'` or `canUseMockWechatAuth()`
- [ ] Webhook signatures are verified in production (fail-closed)
- [ ] `paySign` is generated server-side only; client only forwards it to `Taro.requestPayment`
- [ ] Mini Program `Taro.request` uses `enableCookie: true` for session-carrying requests
- [ ] Payment config validation checks `WECHAT_PAY_APP_ID === WECHAT_APPID` when JSAPI is active
- [ ] Auth callback handlers validate CSRF `state` before exchanging codes
- [ ] Any change to shared auth/payment DTOs is reviewed against `docs/PLATFORM_COORDINATION.md`

## Related skills

| Skill | When to hand off |
|-------|------------------|
| `platform-coordination-protocol` | Deciding whether a WeChat change needs sibling-platform review |
| `mini-program-frontend-excellence` | Taro UI implementation, pixel precision, DevTools verification |
| `payment-entitlement-authority` | Payment creation, refunds, event-pack credits, entitlement gating |
| `auth-session-and-safety-boundaries` | Auth policy, session contracts, dev-only auth surfaces, fail-closed gating |
| `server-domain-architecture` | Adding new API routes or repositories on the server |
| `llm-runtime-safety-and-integration` | Adding AI-generated content inside WeChat flows |

## Canonical References

- `apps/server/src/wechatAuth.ts` — `getWechatOpenId`, `getWechatOAuthOpenId`, `findOrCreateWechatUser`, OAuth routes
- `apps/server/src/paymentService.ts` — `PaymentService`, JSAPI/H5 creation, webhook handling, signature verification
- `apps/server/src/routes/domains/payments.ts` — `POST /api/payments/miniprogram/create`, `POST /api/payments/create`, `POST /api/webhooks/wechat-pay`
- `apps/server/src/routes/domains/auth.ts` — `POST /api/auth/wechat/login`, `POST /api/auth/wechat/login-with-test`, OAuth start/callback
- `apps/server/src/lib/configValidation.ts` — `WECHAT_APPID` validation, `getDirectMiniProgramAppIdConsistencyIssue`
- `apps/mini-program/src/lib/api.ts` — `Taro.request` wrapper, `authenticateMiniProgramUser`, `getUserState`
- `apps/mini-program/src/hooks/useWeChatLogin.ts` — Mini Program login hook
- `apps/mini-program/src/pages/blind-box-payment/index.tsx` — `Taro.requestPayment` launch, pending order, verification
- `apps/user-client/src/hooks/useWeChatLogin.ts` — Web OAuth / `wx.login()` hybrid hook
- `docs/PLATFORM_COORDINATION.md` — Cross-platform auth/payment coordination playbook
- `docs/wechat-mini-program-reference.md` — Low-level WeChat API and rpx reference
