# Platform Coordination Protocol

This is a monorepo with two coordinated frontend clients:
- `apps/mini-program`: **PRIMARY** for beta-launch payment and auth session work. WeChat Mini Program.
- `apps/user-client`: **SECONDARY** for the mirrored web journey. Keep it functional and review it whenever PRIMARY logic changes.

## Critical Rule for Code Changes

Before editing a coordinated file, check the nearest `.platform` marker and `scripts/platform-map.json`.

- **PRIMARY**: Source of truth. Any logic or contract change must be reviewed in the mapped `SECONDARY` counterpart and shared API types.
- **SECONDARY**: Derived implementation. Keep platform-specific rendering here, but push business-logic changes back to the `PRIMARY` side.
- **SHARED**: Contract or shared logic. Review every mapped consumer before merging.

Current coordinated roots:
- `apps/mini-program/src/pages/blind-box-payment` ↔ `apps/user-client/src/pages/BlindBoxPaymentPage`
- `apps/mini-program/src/lib/api` ↔ `apps/user-client/src/hooks/useAuth`
- `packages/shared/src/api-types` for shared request/response contracts

## Platform API Boundaries

- Never call `wx.*`, `Taro.*`, or `window.location` inside files annotated with `/* @platform-agnostic */`.
- Shared API request/response contracts belong in `packages/shared/src/api-types/`.
- Coordinated payment flow: Mini Program owns the WeChat payment intent flow; Web must be reviewed whenever payment contracts or pricing assumptions change.

## File Naming Convention

- `.platform` marker in a directory defines its coordination role.
- `*.mp.ts(x)` = Mini Program specific
- `*.web.ts(x)` = Web specific
- `*.shared.ts(x)` = Platform-agnostic

## Impact Check Script

Run one of these before or after editing a coordinated area:

```bash
npm run impact-check -- apps/mini-program/src/pages/blind-box-payment/index.tsx
npm run impact-check:staged
```

`npm run guardrails:platform -- --changed <base> <head>` is the CI-safe enforcement check for coordinated files.

## Hook Setup

Enable the non-blocking warning hook locally with:

```bash
git config core.hooksPath .githooks
```
