# Grill-Me — Onboarding State Architecture

> Stress-test onboarding flow assumptions. One question per turn.
> Routing loops are the #1 support burden. Every assumption is a potential loop.

## nextStep Computation

Ask when adding or modifying onboarding step:

**Q1:** Walk me through the exact server-side `nextStep` computation for a user at every checkpoint. Where could the logic produce a wrong step?
- Recommended: Mapped every checkpoint → nextStep transition. No ambiguous states. Only server computes `nextStep`.

**Q2:** What happens if a user skips a step? (E.g., directly navigates to `/discover` before completing onboarding.) Does the client redirect or the server?
- Recommended: Server always returns correct `nextStep`. Client router gates access: reads `nextStep` from auth response and redirects. Not local-state-based.

**Q3:** After completing a step, does the client re-fetch `GET /api/auth/user` before navigating? Or does it assume the next step?
- Recommended: Client invalidates auth query + re-fetches. Navigates to whatever `nextStep` the server returns. Never assumes.

## Completion Flags

Ask when adding a completion flag:

**Q4:** What column/field signals this step is complete? Is it persisted on the `users` table or computed?
- Recommended: Persisted column on `users` table. Server reads it in `nextStep` computation. Client never writes it directly.

**Q5:** If the completion POST succeeds but the re-fetch fails (network error), what state does the user see?
- Recommended: Client retries re-fetch with backoff. Shows "saving..." with loading state. User can retry manually. No navigation until re-fetch succeeds.

## Onboarding Restart

Ask when touching restart logic:

**Q6:** What data gets cleared on restart? What data survives? Is the restart counter checked?
- Recommended: Assessment sessions/answers cleared. WeChat identity + phone survive. Restart count checked against 5-lifetime limit. Idempotent — double-tap doesn't consume quota.

## Routing & Recovery

Ask when debugging stuck users:

**Q7:** User force-closes mid-onboarding and reopens. What state do they see? Does the checkpoint recover correctly?
- Recommended: Server returns correct `nextStep` from persisted checkpoint. Client shows the right step. No progress lost.

**Q8:** A user swipes back to a previous onboarding page (WeChat page stack). Does the old page's state cause a loop?
- Recommended: Swipe-back resets transient flags (`isSubmitting`, `isExiting`) on `useDidShow`. Server state is authoritative.

## Cross-Platform

Ask when touching shared onboarding logic:

**Q9:** Does this change affect both mini-program pages (`apps/mini-program/src/pages/onboarding/`) and the shared `nextStep` mapping?
- Recommended: Both surfaces verified. `packages/shared/src/onboarding.ts` aligned. `flow.ts` updated.

## Legacy Quarantine

Ask when writing new code:

**Q10:** Are there any legacy identifiers in this change? `hasCompletedRegistration`, `registration_sessions`, `guide` step, `hasSeenGuide`?
- Recommended: Zero legacy identifiers. `npm run guardrails` will catch them. All use current active identifiers.
