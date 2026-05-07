# Onboarding Flow Details

## Checkpoint recovery specifics

If `users.onboardingCheckpoint` is set **ahead** of the base-computed step (and still before `discover`), `auth.ts` may advance `nextStep` forward to the step after the checkpoint so users can resume safely after interruptions.

## Web + mini-program mapping details

Shared helpers live in `packages/shared/src/onboarding.ts` — same `nextStep` → step helpers for web + mini-program.

**Web routing:**
- `apps/user-client/src/features/onboarding/active/flow.ts` — web `nextStep` → route mapping
- `apps/user-client/src/features/onboarding/active/useOnboardingOrchestrator.ts` — progress hook

**Mini-program routing:**
- Parallel pages under `apps/mini-program/src/pages/onboarding/` (personality test, auth-gate, essential/extended/review)
- Must obey the same server `nextStep`; do not invent a separate progression model

## FormStepper / viewport density

**Input cap:** A single onboarding step must not contain **more than four (4)** text/numeric inputs (`input`, `textarea`, or bulky `select`). If the story needs five or more such fields, **split into additional steps**.

**Layout:** Full-height steps should compose with the [viewport-zero-scroll](../viewport-zero-scroll/SKILL.md) shell: **web** — `.no-scroll-container`, `@shared/ui/ResponsiveSpacer`; **mini-program (launch)** — `@include no-scroll-page-shell` / bounded `ScrollView`, `apps/mini-program/src/components/ui/ResponsiveSpacer.tsx`, and `100dvh`-aware mixins.

**Reference implementation:** Web — `EssentialDataPage.tsx` + `STEP_CONFIG`. Mini-program — `apps/mini-program/src/pages/onboarding/*` (split stages / single focus per route where possible); align field count and step boundaries with web when both ship the same journey.

## Legacy quarantine list

- Legacy onboarding surfaces stay under `apps/user-client/src/legacy/onboarding/`
- Do not add new routes, CTAs, or features to legacy onboarding pages
- `GuidePage` is retained for backward compatibility only — `guide` routes directly to `DiscoverPage`
- `ProfileSetupPage` in `legacy/` is unused — do not revive it
- Do not reintroduce `hasCompletedRegistration`, `needsRegistration`, or `registration_sessions` in new code

## nextStep compatibility values

| Value | Meaning |
|-------|---------|
| `onboarding` | Legacy fallback — `AuthenticatedRouter` redirects to `/personality-test` |
| `personality-test` | Pre-essential-data state; allows personality test + setup routes |
| `guide` | Currently routes directly to `DiscoverPage` (inline coach marks) |

These are handled for existing users. Do not create new features that depend on the `onboarding` fallback value.

## Server-owned completion semantics

- Completion flags (`hasCompletedPersonalityTest`, `hasCompletedInterestsCarousel`, `hasSeenProfileReview`, etc.) are set server-side via API calls
- `profileEssentialComplete` is not a persisted `users` table flag — it is a server-computed completion signal returned by `/api/auth/user`
- The client must not set these flags locally or compute its own onboarding position
- After each step completes, re-fetch `/api/auth/user` and use the updated `nextStep`
- `hasCompletedPersonalityTest` should only become true after the adaptive phase ends and both universal closing questions (`Q_PLAYFUL_SLIDER`, `Q_PLAYFUL_EMOJI`) have been answered

## Frontend excellence notes

- Onboarding screens should use JoyJoin token and typography guidance consistently
- Every onboarding step must define loading, error, empty, validation, disabled, and success states explicitly
- Use semantic form and page structure on web (`main`, `form`, `label`, `button`, `fieldset`) and equivalent Taro-native composition on mini-program
- Meet WCAG 2.1 AA expectations for labels, error association, focus order, target size, and readable status messaging
- Optimize for narrow mobile layouts first; avoid horizontal overflow and keep critical actions pinned within easy reach
- Follow shared frontend thresholds for minimum touch targets and long-list handling

## Routing loop troubleshooting

- **`nextStep` is stale** — the client is not re-fetching `/api/auth/user` after the step completion call. Invalidate the auth query and re-fetch before navigating.
- **Routing loop — user is redirected back to a step they already completed** — the completion flag is not being persisted on the server (check the POST handler), or the `nextStep` computation in `auth.ts` is not reflecting the updated flag.
- **Client is deriving onboarding position from local flags** — remove client-side step reconstruction. All routing decisions must come from the `nextStep` value returned by `GET /api/auth/user`.
