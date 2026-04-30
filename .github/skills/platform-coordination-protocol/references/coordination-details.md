# Coordination Details and Platform File Map

## Current coordinated areas (full table)

| Area | Mini Program reference | Web sibling | Shared reference today |
|------|---------|-----------|--------|
| Payment flow | `apps/mini-program/src/pages/blind-box-payment/index.tsx` | `apps/user-client/src/pages/BlindBoxPaymentPage.tsx` | `docs/PLATFORM_COORDINATION.md` |
| Payment verification / pending order | `apps/mini-program/src/pages/payment-verification/index.tsx`; `lib/paymentPendingOrder.ts` | `apps/user-client/src/pages/BlindBoxConfirmationPage.tsx` | `docs/PLATFORM_COORDINATION.md` |
| WeChat login (mini-program) | `apps/mini-program/src/hooks/useWeChatLogin.ts`; `pages/login/index.tsx` (`/api/auth/wechat/login`); personality auth-gate uses `authenticateMiniProgramUserWithTest` (`/api/auth/wechat/login-with-test`) | `apps/user-client/src/hooks/useWeChatLogin.ts` (browser OAuth / web flows) | `docs/PLATFORM_COORDINATION.md` |
| Personality test | `apps/mini-program/src/pages/onboarding/personality-test/` | `apps/user-client/src/features/onboarding/active/pages/` (`PersonalityTestPage`, results, auth-gate) | `packages/shared/src/personality/`; `docs/PERSONALITY_TEST_SYSTEM.md` |
| Viewport / zero-scroll & onboarding density | `apps/mini-program/src/styles/_mixins.scss`, `components/ResponsiveSpacer.tsx`, onboarding pages under `pages/onboarding/` | `apps/user-client/src/styles/viewport-lockdown.css`, `App.tsx`, `packages/shared/src/ui/ResponsiveSpacer.tsx`, `features/onboarding/active/pages/` | [viewport-zero-scroll](../viewport-zero-scroll/SKILL.md); treat layout + **FormStepper (≤4 inputs/step)** changes as **`BOTH_REQUIRED`** when the same journey exists on both clients |
| Auth session bootstrap | `apps/mini-program/src/lib/api.ts` | `apps/user-client/src/hooks/useAuth.ts` | `docs/PLATFORM_COORDINATION.md` |
| API request wrapper | `apps/mini-program/src/lib/api.ts` | `apps/user-client/src/lib/queryClient.ts` | `docs/PLATFORM_COORDINATION.md` |

Today there is **no** dedicated shared payment/auth DTO module. `docs/PLATFORM_COORDINATION.md` is the canonical coordination reference for these mappings.

## Coordination workflow (detailed)

1. Read the relevant section of `docs/PLATFORM_COORDINATION.md` before deciding the change is platform-local
2. Identify whether the touched file is one of the duplicated hotspots listed above
3. Review the sibling platform file with the same business intent before finalizing the change
4. If you touched `packages/shared/src/`, inspect both clients for consumers that could drift
5. Validate with the smallest existing checks that cover the touched surfaces:
   - `npm run typecheck -w @joyjoin/user-client`
   - `npm run check:clients`
   - `npm run build:weapp -w mini-program` when mini-program tooling is available
6. Record in the PR why no sibling-platform change was needed if you keep the change local

## Smart scope classification (detailed)

Use these advisory scope labels before deciding whether a change stays local or needs coordination:

- **`MINI_PROGRAM_ONLY`** — mini-program-specific behavior such as `wx.*`, `Taro.*`, or mini-program page wiring with no duplicated business-rule drift
- **`WEB_ONLY`** — browser-only behavior such as DOM/UI wiring with no duplicated auth/payment/API rule change
- **`BOTH_REQUIRED`** — duplicated business logic, shared types/utilities, or coordinated auth/payment/api behavior where both clients must be reviewed

Decision order:
1. Check whether the file appears in `docs/PLATFORM_COORDINATION.md`
2. Check whether the file is one of the known duplicated surfaces in the table above
3. Check whether the file lives in `packages/shared/src/`
4. Check for obvious platform APIs (`wx.` / `Taro.` vs `window.*`, `document.*`)
5. Check whether the change alters business rules, request shapes, pricing assumptions, or auth/session state rather than only renderer wiring

Treat this classification as advisory only. If the heuristics and `docs/PLATFORM_COORDINATION.md` disagree, escalate the change to **`BOTH_REQUIRED`** until you have verified the sibling surface.

## Platform boundaries

- Keep truly shared types and utilities in `packages/shared/src/` rather than creating silent duplicate copies in client pages/hooks
- Review both `apps/mini-program/src/lib/api.ts` and `apps/user-client/src/hooks/useAuth.ts` when auth/session semantics move
- Review both payment pages when pricing assumptions, payment status handling, or post-payment behavior changes
- Treat mini-program payment intent flow as the strongest current reference; web must be reviewed whenever payment assumptions move

## Common mistakes to avoid

- Changing `apps/mini-program/src/lib/api.ts` or `apps/user-client/src/hooks/useAuth.ts` without checking the sibling auth flow
- Editing duplicated payment behavior in only one of the two payment pages
- Assuming `packages/shared/src/` already contains dedicated payment/auth DTO modules when the playbook explicitly says it does not today
- Treating web-only UI wiring as proof that payment or auth business rules are isolated
- Skipping `docs/PLATFORM_COORDINATION.md` and relying on memory for cross-platform ownership

## Related files

- `docs/PLATFORM_COORDINATION.md` — canonical platform coordination playbook
- `apps/mini-program/src/lib/api.ts` — current mini-program auth/API bootstrap surface
- `apps/user-client/src/hooks/useAuth.ts` — current web auth/session bootstrap surface
- `apps/user-client/src/lib/queryClient.ts` — current web API request wrapper
- `apps/user-client/src/pages/BlindBoxPaymentPage.tsx` — current web payment flow
- `apps/mini-program/src/pages/blind-box-payment/index.tsx` — current mini-program payment flow
- `apps/mini-program/src/pages/payment-verification/index.tsx` — mini-program post-`requestPayment` verification
- `apps/mini-program/src/hooks/useWeChatLogin.ts` — mini-program WeChat login (`Taro.login` + `/api/auth/wechat/login`)
- `apps/mini-program/src/pages/onboarding/personality-test/` — mini-program V4 personality test + auth-gate
- `docs/PERSONALITY_TEST_SYSTEM.md` — V4 system reference (web + mini-program surfaces)
