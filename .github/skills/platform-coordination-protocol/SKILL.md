---
name: platform-coordination-protocol
description: >
  Mini-program and web coordination guidance for duplicated auth, API, and
  payment flows. Use when a task touches docs/PLATFORM_COORDINATION.md,
  apps/mini-program/src/lib/api/api.ts, apps/user-client/src/hooks/useAuth.ts, or
  the payment pages and asks whether sibling platform review is needed.
  Trigger phrases: "sibling platform", "platform coordination",
  "BlindBoxPaymentPage", "useAuth.ts", "mini-program api.ts".
---

# Platform Coordination Protocol

**Core rule:** For current duplicated auth/API/payment flows, use `docs/PLATFORM_COORDINATION.md` as the source of truth, treat the mini-program flow as the strongest reference for current payment mechanics, and review the matching web or shared surface before merging.

## When to use this skill

- Editing one of the duplicated cross-platform hotspots called out in `docs/PLATFORM_COORDINATION.md`
- Changing payment or auth/session logic that spans mini-program and web
- Updating `apps/mini-program/src/lib/api/api.ts`, `apps/user-client/src/hooks/useAuth.ts`, `apps/user-client/src/lib/queryClient.ts`, or either payment page
- Asking whether a sibling platform or shared package consumer also needs review
- Checking whether a change should stay local or be escalated to both clients

## Cross-platform parity overview

- **Mini Program reference surface** — strongest current reference for payment mechanics and WeChat-specific auth/api behavior
- **Web sibling surface** — matching user-facing flow that should be reviewed for parity when duplicated business intent changes
- **Shared package surface** — `packages/shared/src/` modules that both clients may consume today, especially `packages/shared/src/schema.ts` and shared utilities/constants

Today there is **no** dedicated shared payment/auth DTO module. `docs/PLATFORM_COORDINATION.md` is the canonical coordination reference for these mappings.

See [`references/coordination-details.md`](references/coordination-details.md) for the full coordinated areas table, mini-program file map, web client api.ts patterns, auth flow comparison, and payment page parity checklist.

## Sibling review rules

1. Read the relevant section of `docs/PLATFORM_COORDINATION.md` before deciding the change is platform-local
2. Identify whether the touched file is one of the duplicated hotspots
3. Review the sibling platform file with the same business intent before finalizing the change
4. If you touched `packages/shared/src/`, inspect both clients for consumers that could drift
5. Validate with the smallest existing checks that cover the touched surfaces
6. Record in the PR why no sibling-platform change was needed if you keep the change local

Use scope labels **`MINI_PROGRAM_ONLY`**, **`WEB_ONLY`**, or **`BOTH_REQUIRED`** as advisory guidance. If heuristics and the playbook disagree, default to **`BOTH_REQUIRED`** until verified.

## Quick examples

**User says:** "I changed `apps/mini-program/src/pages/blind-box-payment/index.tsx` — do I need to touch web too?"
**Apply this skill by:** Reading `docs/PLATFORM_COORDINATION.md`, reviewing `apps/user-client/src/pages/BlindBoxPaymentPage.tsx`, and deciding whether the change affects only mini-program runtime wiring or the shared payment behavior.
**Result:** Duplicated payment logic is treated as `BOTH_REQUIRED` unless the change is clearly mini-program-only.

---

**User says:** "I updated `apps/user-client/src/hooks/useAuth.ts`."
**Apply this skill by:** Comparing the auth/session assumptions against `apps/mini-program/src/lib/api/api.ts`, then checking whether the change also affects shared types or only web-side state wiring.
**Result:** Auth/session drift is caught before one client silently diverges.

---

**User says:** "I changed a shared type in `packages/shared/src/schema.ts`."
**Apply this skill by:** Inspecting both clients for imports of the changed type and reviewing the duplicated auth/payment hotspots listed in `docs/PLATFORM_COORDINATION.md` before merging.
**Result:** Shared type changes do not cause hidden drift between platforms.

## Troubleshooting

- **This looks platform-specific, but the playbook lists it as duplicated logic** — trust `docs/PLATFORM_COORDINATION.md` first and treat it as `BOTH_REQUIRED` until you confirm only renderer wiring changed.
- **I changed `packages/shared/src/` and I am not sure who consumes it** — inspect both clients for imports and review the duplicated auth/payment hotspots listed in the playbook before merging.
- **The web and mini-program files differ a lot already** — compare business intent, not syntax. If the same user-facing rule changed on one side, review the sibling side even if the implementations are structurally different.
- **The mini-program build is unavailable in my environment** — run the web or shared checks that exist (`npm run typecheck -w @joyjoin/user-client` or `npm run check:clients`) and note the mini-program validation gap in the PR.
- **I cannot tell whether this is business logic or renderer wiring** — default to `BOTH_REQUIRED` and explain in the PR why you kept or skipped the sibling change.
- **Payment behavior changed on one client but not the other** — treat mini-program payment intent flow as the strongest current reference. Review the sibling payment page whenever pricing assumptions, payment status handling, or post-payment behavior changes.

## Review checklist

- [ ] `docs/PLATFORM_COORDINATION.md` was reviewed before treating the change as platform-local
- [ ] The relevant sibling file was inspected for duplicated business intent
- [ ] `packages/shared/src/` consumers were reviewed when shared types or utilities changed
- [ ] The smallest existing validation for the touched client/shared surfaces was run
- [ ] The PR explains why a sibling-platform change was or was not required
