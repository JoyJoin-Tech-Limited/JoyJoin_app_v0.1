---
name: platform-coordination-protocol
description: >
  Mini-program coordination guidance for auth, API, and payment flows. The
  web client (apps/user-client) was archived. Use when a task touches
  apps/mini-program/src/lib/api/api.ts, docs/PLATFORM_COORDINATION.md, or
  payment pages and asks whether cross-platform review is needed.
  Trigger phrases: "sibling platform", "platform coordination",
  "mini-program api.ts".
---

# Platform Coordination Protocol

**Core rule:** `apps/mini-program` is the only active user-facing client. The web client (`apps/user-client`) was archived to `archived/workspaces/user-client/`. This skill primarily concerns mini-program ↔ shared package coordination. Cross-surface rules (mini-program ↔ admin-client) follow `docs/PLATFORM_COORDINATION.md`.

## When to use this skill

- Editing mini-program auth/API/payment flows that share logic with the server or shared package
- Changing mini-program payment or auth/session logic that interacts with the server API
- Updating `apps/mini-program/src/lib/api/api.ts` or mini-program payment pages
- Asking whether a shared package consumer also needs review

See [`references/coordination-details.md`](references/coordination-details.md) for the archived web ↔ mini-program coordination table, mini-program file map, auth flow comparison, and payment page notes.

## Sibling review rules

1. Read the relevant section of `docs/PLATFORM_COORDINATION.md` before deciding the change is platform-local
2. Identify whether the touched file is one of the duplicated hotspots
3. Review the sibling platform file with the same business intent before finalizing the change
4. If you touched `packages/shared/src/`, inspect both clients for consumers that could drift
5. Validate with the smallest existing checks that cover the touched surfaces
6. Record in the PR why no sibling-platform change was needed if you keep the change local

Use scope labels **`MINI_PROGRAM_ONLY`**, **`WEB_ONLY`**, or **`BOTH_REQUIRED`** as advisory guidance. If heuristics and the playbook disagree, default to **`BOTH_REQUIRED`** until verified.

## Quick examples

**User says:** "I changed `apps/mini-program/src/pages/blind-box-payment/index.tsx` — do I need to touch anything else?"
**Apply this skill by:** Reading `docs/PLATFORM_COORDINATION.md` and deciding whether the change affects only mini-program runtime wiring or payment behavior shared with the server and `packages/shared`.
**Result:** Shared payment behavior is coordinated with the server/shared package; clearly mini-program-only wiring stays local.

---

**User says:** "I updated the auth handling in `apps/mini-program/src/lib/api/api.ts`."
**Apply this skill by:** Comparing the auth/session assumptions against the shared types in `packages/shared/src/` and `docs/PLATFORM_COORDINATION.md`, then checking whether the change also affects shared types or only mini-program-side state wiring.
**Result:** Auth/session drift is caught before the client silently diverges from the shared contract.

---

**User says:** "I changed a shared type in `packages/shared/src/schema.ts`."
**Apply this skill by:** Inspecting both clients for imports of the changed type and reviewing the duplicated auth/payment hotspots listed in `docs/PLATFORM_COORDINATION.md` before merging.
**Result:** Shared type changes do not cause hidden drift between platforms.

## Troubleshooting

- **This looks platform-specific, but the playbook lists it as duplicated logic** — trust `docs/PLATFORM_COORDINATION.md` first and treat it as `BOTH_REQUIRED` until you confirm only renderer wiring changed.
- **I changed `packages/shared/src/` and I am not sure who consumes it** — inspect both clients for imports and review the duplicated auth/payment hotspots listed in the playbook before merging.
- **The mini-program and shared/server implementations differ a lot already** — compare business intent, not syntax. If the same user-facing rule changed on one side, review the other side even if the implementations are structurally different.
- **The mini-program build is unavailable in my environment** — run the shared checks that exist (`npm run typecheck -w @joyjoin/shared` or `npm run typecheck -w @joyjoin/server`) and note the mini-program validation gap in the PR.
- **I cannot tell whether this is business logic or renderer wiring** — default to `BOTH_REQUIRED` and explain in the PR why you kept or skipped the sibling change.
- **Payment behavior changed in the mini-program** — treat the mini-program payment intent flow as the strongest current reference. Review shared payment types and the server payment routes whenever pricing assumptions, payment status handling, or post-payment behavior changes.

## Review checklist

- [ ] `docs/PLATFORM_COORDINATION.md` was reviewed before treating the change as platform-local
- [ ] The relevant sibling file was inspected for duplicated business intent
- [ ] `packages/shared/src/` consumers were reviewed when shared types or utilities changed
- [ ] The smallest existing validation for the touched client/shared surfaces was run
- [ ] The PR explains why a sibling-platform change was or was not required
