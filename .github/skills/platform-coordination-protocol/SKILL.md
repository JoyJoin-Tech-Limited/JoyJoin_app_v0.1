---
name: platform-coordination-protocol
description: >
  Mini-program and web coordination rules for PRIMARY, SECONDARY, and SHARED
  ownership, sibling-platform review, shared API contracts, and platform
  guardrails. Use when a task touches a .platform-marked area, needs
  impact-check, changes platform-map.json coordination, or asks whether a
  sibling platform or shared api contract must be updated. Trigger phrases:
  "check sibling platform", "run impact-check", ".platform marker",
  "PRIMARY vs SECONDARY", "shared api contract".
---

# Platform Coordination Protocol

**Core rule:** For any coordinated feature, the mini-program PRIMARY side owns business logic, the web SECONDARY side must be reviewed for parity, and SHARED contracts in `packages/shared/src/api-types/` must stay authoritative.

## When to use this skill

- Editing a file inside a directory that contains a `.platform` marker
- Changing payment or auth/session logic that spans mini-program and web
- Updating `scripts/platform-map.json`, `scripts/impact-check.js`, or `scripts/check-platform-guardrails.mjs`
- Asking whether a sibling platform or shared contract also needs review
- Investigating `npm run impact-check` or `npm run guardrails:platform` output

## Coordination roles

- **PRIMARY** — source of truth for business logic in the coordinated area; review the mapped SECONDARY side and shared contracts before merging
- **SECONDARY** — mirrored implementation; keep platform-specific rendering here, but push shared logic decisions back to PRIMARY
- **SHARED** — request/response contracts and platform-agnostic coordination logic; review every mapped consumer when these files change

## Current coordinated areas

| Area | PRIMARY | SECONDARY | SHARED |
|------|---------|-----------|--------|
| Payment flow | `apps/mini-program/src/pages/blind-box-payment/` | `apps/user-client/src/pages/BlindBoxPaymentPage/` | `packages/shared/src/api-types/payment.ts` |
| Auth session | `apps/mini-program/src/lib/api/` | `apps/user-client/src/hooks/useAuth/` | `packages/shared/src/api-types/auth.ts` |

Use `scripts/platform-map.json` as the machine-readable source of truth for these mappings.

## Coordination workflow

1. Check the nearest `.platform` marker and confirm whether you are in a PRIMARY, SECONDARY, or SHARED area
2. Read the matching entry in `scripts/platform-map.json`
3. Review the sibling platform path and any listed shared dependencies before finalizing the change
4. Run `npm run impact-check -- <file>` or `npm run impact-check:staged` to confirm cross-platform impact
5. If you changed business logic or contracts, update the sibling implementation or explicitly record why no sibling change is required
6. Run `npm run guardrails:platform -- --changed <base> <head>` when validating a broader diff or CI-facing change

## Smart scope classification

Use these advisory scope labels before deciding whether a change stays local or needs coordination:

- **`MINI_PROGRAM_ONLY`** — mini-program-specific behavior such as `wx.*` or `Taro.*` usage with no shared-contract or platform-agnostic signals
- **`WEB_ONLY`** — web-specific behavior such as `window.*` or `document.*` usage with no shared-contract or platform-agnostic signals
- **`BOTH_REQUIRED`** — shared contracts, platform-agnostic logic, or coordinated areas where both clients must be reviewed

Decision order:

1. Check the nearest `.platform` marker
2. Check `scripts/platform-map.json`
3. Check whether the file lives in `packages/shared/src/api-types/`
4. Check for `@platform-agnostic`
5. Check for obvious platform APIs (`wx.` / `Taro.` vs `window.location`, `window.*`, `document.*`)

Treat this classification as advisory only. If heuristics disagree with `.platform`, `scripts/platform-map.json`, or `impact-check`, defer to the coordination metadata and escalate the change to **`BOTH_REQUIRED`** until proven otherwise.

## Platform boundaries

- Keep shared request/response contracts in `packages/shared/src/api-types/`
- Do not duplicate coordinated `*Request` or `*Response` types inside platform-owned files
- Never call `wx.*`, `Taro.*`, or `window.location` inside files marked `@platform-agnostic`
- Treat mini-program payment intent flow as the source of truth; web must be reviewed whenever pricing assumptions or payment contracts move

## Common mistakes to avoid

- Changing a PRIMARY file and forgetting to inspect the mapped SECONDARY path
- Editing `packages/shared/src/api-types/` without reviewing downstream consumers
- Adding inline coordinated API types outside the shared api-types folder
- Treating SECONDARY as an independent source of truth for business rules
- Ignoring `impact-check` or `guardrails:platform` output because only one platform changed visibly

## Related files

- `AGENTS.md` — repo-wide platform coordination instructions
- `scripts/platform-map.json` — authoritative coordination map
- `scripts/impact-check.js` — file/staged impact inspection
- `scripts/check-platform-guardrails.mjs` — CI/local enforcement
- `docs/COORDINATION_ROLLOUT.md` — adoption stages for the protocol

## Quick examples

**User says:** "I changed `apps/mini-program/src/pages/blind-box-payment/index.tsx` — do I need to touch web too?"
**Apply this skill by:** Checking the `.platform` marker, reading the `payment-flow` entry in `scripts/platform-map.json`, reviewing `apps/user-client/src/pages/BlindBoxPaymentPage/`, and running `npm run impact-check -- apps/mini-program/src/pages/blind-box-payment/index.tsx`.
**Result:** The PRIMARY change is reviewed against the SECONDARY counterpart before merge.

---

**User says:** "I updated `packages/shared/src/api-types/auth.ts`."
**Apply this skill by:** Treating the change as SHARED, reviewing the mapped auth-session consumers, and confirming both clients still match the new contract.
**Result:** Shared contract changes do not drift from either platform implementation.

## Troubleshooting

- **`impact-check` says a sibling platform needs review** — open the mapped path from `scripts/platform-map.json` and confirm whether the contract, copy, or behavior still matches. If no code change is needed, document the reason in the PR.
- **This looks platform-specific, but `impact-check` still asks for sibling review** — trust the `.platform` marker and `scripts/platform-map.json` first. A platform-specific API call does not override coordinated ownership or shared-contract dependencies; treat the change as `BOTH_REQUIRED` until you confirm the sibling path truly does not need an update.
- **`guardrails:platform` fails on inline request/response types** — move the coordinated contract into `packages/shared/src/api-types/` and update imports instead of suppressing the warning.
- **A `.platform` marker exists but the mapping is unclear** — inspect `scripts/platform-map.json`; if the area is missing, add the mapping before relying on ad-hoc coordination.
- **A supposedly platform-agnostic file needs `wx` or `window.location`** — split platform-specific behavior into `*.mp.ts(x)` or `*.web.ts(x)` files and keep the shared file platform-agnostic.

## Review checklist

- [ ] The changed coordinated path's `.platform` role was checked before editing
- [ ] The matching `scripts/platform-map.json` entry was reviewed
- [ ] Sibling platform and shared contract consumers were reviewed where required
- [ ] Coordinated request/response shapes still live in `packages/shared/src/api-types/`
- [ ] `impact-check` or `impact-check:staged` was used for coordinated changes
- [ ] `guardrails:platform` passes for the validated diff
