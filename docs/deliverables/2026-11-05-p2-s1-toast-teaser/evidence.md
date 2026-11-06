# P2-S1 Toast Adapter + Teaser Copy Evidence

Date: 2026-11-05
Sprint Contract: `.git/.orchestration/sprints/sprint-contract.p2-s1-toast-teaser.md` (accepted)

## Scope delivered

1. Added `apps/mini-program/src/lib/utils/toast.ts` as a thin native `Taro.showToast` adapter with `neutral | success | error` tones, native option forwarding, existing `TOAST_*` duration constants, and the native Promise returned unchanged.
2. Migrated exactly six navigation-failure toast calls in `apps/mini-program/src/lib/navigation/matchingNavigation.ts`; title 「跳转失败，请重试」, `icon: 'none'`, 2000ms duration, navigation and logging behavior remain unchanged.
3. Removed only the unsupported reminder promise 「正式上线时，第一时间告诉你」 from `apps/mini-program/src/pages/alang/teaser/index.tsx`. No reminder/subscription/API/CTA was added.

## Verification

- Targeted tests: **3 files / 24 tests PASS**
  - `src/lib/utils/__tests__/toast.test.ts`
  - `src/lib/navigation/__tests__/matchingNavigation.test.ts`
  - `src/pages/alang/teaser/__tests__/teaserCopy.test.ts`
- `npm run typecheck -w mini-program`: **PASS**
- `npm run guardrails`: **PASS** (background shell `sh_1ab27ec0e001QgyybyJqRj8ZDY`, exit 0)
- Isolated H5 build (`sh_1ab27ebdd001I6CM6jS3TRctyd`, API `:5003`, story mode): **exit 0**
- Raw native toast grep: **192 baseline lines → 190 after lines**; only the adapter retains `Taro.showToast` among touched production files.
  - Baseline: `toast-baseline.txt`
  - After: `toast-after.txt`
- Target-file `git diff --check`: **PASS**

## Rendered teaser evidence

- `flash-teaser-page-after.png` — 750×1624 valid PNG from the existing `flash-teaser-page` generator against isolated H5/mock `:5003` and screenshot server `:9002`.
- Visual inspection confirms:
  - 「内测中 / 盒子还没准备好 / 这座城市里藏着几位数字朋友 / 内测结束，就来见你」 remains;
  - unsupported 「正式上线时，第一时间告诉你」 is absent;
  - existing 「再逛逛」 return-to-discover action remains;
  - no new reminder CTA or product surface was introduced.

## Boundaries

- Native toast adapter only; no branded overlay, queue, dedupe service, timers, form-error replacement, or registration-success toast.
- No reminder delivery, notification permission, subscription template, schema, or API work.
- No center-hub, notification-list, celebration, checkout-upsell, payment, matching, entitlement, or unrelated copy/style changes.
- This is a code + isolated-H5 evidence closure, not real iOS/Android device approval.
