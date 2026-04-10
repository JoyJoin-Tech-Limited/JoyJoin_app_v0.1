---
name: onboarding-state-architecture
description: >
  Server-driven nextStep model, active onboarding module ownership, routing authority, and legacy
  quarantine rules. Use when working on onboarding routing, completion flags, or any
  onboarding-related page. Trigger phrases: "user is stuck in onboarding", "add a new onboarding
  step", "why is nextStep wrong?", "onboarding routing loop", "modify completion flags".
---

# Onboarding State Architecture

**Core rule:** `nextStep` returned by `GET /api/auth/user` is the single source of truth for onboarding progress. The client reads state and navigates accordingly — it never reconstructs onboarding progress independently.

## When to use this skill

- Adding or modifying an onboarding step or route
- Changing a completion flag on the `users` table
- Debugging a user stuck in the onboarding flow
- Reviewing client-side routing logic for authenticated users

## Authority chain

```
GET /api/auth/user
  └─ apps/server/src/routes/domains/auth.ts (computes nextStep)
       └─ apps/user-client/src/hooks/useAuth.ts (exposes contract)
            └─ apps/user-client/src/App.tsx → AuthenticatedRouter (gates routes)
                 └─ apps/user-client/src/features/onboarding/active/
                      ├─ flow.ts (nextStep → route mapping)
                      └─ useOnboardingOrchestrator.ts (progress hook)
```

## Active onboarding steps

| nextStep value | Route | Component | Completion signal (source) |
|----------------|-------|-----------|----------------------------|
| `personality-test` | `/personality-test` | `PersonalityTestPage.tsx` | `hasCompletedPersonalityTest` (`users` table flag) |
| `essential-data` | `/onboarding/setup` | `EssentialDataPage.tsx` | `profileEssentialComplete` (server-computed field from `/api/auth/user`) |
| `extended-data` | `/onboarding/extended` | `ExtendedDataPage.tsx` | `hasCompletedInterestsCarousel` (`users` table flag) |
| `profile-review` | `/onboarding/review` | `FinalProfileReviewPage.tsx` | `hasSeenProfileReview` (`users` table flag) |
| `guide` / `discover` | `/discover` | `DiscoverPage.tsx` | `hasSeenGuide` (`users` table flag) |

All active onboarding pages live under `apps/user-client/src/features/onboarding/active/pages/`.

Pre-auth entry into the active flow is `/personality-test` → `/personality-test/results` → `/personality-test/auth-gate`. After auth, `nextStep` becomes the only authority for onward routing.

## Server-owned completion semantics

- Completion flags (`hasCompletedPersonalityTest`, `hasCompletedInterestsCarousel`, `hasSeenProfileReview`, etc.) are set server-side via API calls
- `profileEssentialComplete` is not a persisted `users` table flag — it is a server-computed completion signal returned by `/api/auth/user`
- The client must not set these flags locally or compute its own onboarding position
- After each step completes, re-fetch `/api/auth/user` and use the updated `nextStep`
- `hasCompletedPersonalityTest` should only become true after the adaptive phase ends and both universal closing questions (`Q_PLAYFUL_SLIDER`, `Q_PLAYFUL_EMOJI`) have been answered

## Legacy quarantine

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

## Client navigation pattern

```typescript
const { nextStep } = useAuth();
// Use server value — never compute your own
if (nextStep !== 'discover') {
  setLocation(getStepRoute(nextStep)); // from flow.ts
}
```

## Common mistakes to avoid

- Deriving `nextStep` from local flags instead of the server response
- Adding logic to `AuthenticatedRouter` that branches on `hasCompletedRegistration` (legacy field)
- Creating a new page in `apps/user-client/src/legacy/onboarding/pages/`
- Calling `POST /api/guide/complete` as part of a new onboarding step — `guide` is not a blocking step
- Reconstructing step order from `users` table flags on the client side

## Related files

- `apps/user-client/src/App.tsx` — `AuthenticatedRouter` switch
- `apps/user-client/src/hooks/useAuth.ts` — auth state including `nextStep`
- `apps/user-client/src/features/onboarding/active/flow.ts` — `nextStep` → route mapping
- `apps/user-client/src/features/onboarding/active/useOnboardingOrchestrator.ts` — progress hook
- `apps/user-client/src/features/onboarding/README.md` — module boundary docs
- `apps/server/src/routes/domains/auth.ts` — `nextStep` computation
- `apps/server/src/routes/domains/onboarding.ts` — onboarding completion endpoints
- `docs/onboarding-flow.md` — detailed flow documentation
- `docs/architecture/current-state.md` — authority chain and file placement

## Quick examples

**User says:** "A user is stuck on the personality-test screen after completing it."
**Apply this skill by:** Checking that `POST /api/auth/complete-personality-test` correctly sets `hasCompletedPersonalityTest = true` on the `users` table, and that the client re-fetches `/api/auth/user` after completion so `nextStep` updates. Do not fix by client-side state override.
**Result:** Server state drives the step transition; the client follows the updated `nextStep`.

---

**User says:** "Add a `photo-upload` step after `essential-data`."
**Apply this skill by:** Adding a `nextStep` value (`'photo-upload'`) to the server computation in `routes/domains/auth.ts`, adding a `hasCompletedPhotoUpload` flag to the `users` table, adding the route/page under `features/onboarding/active/pages/`, and updating `flow.ts` with the new step → route mapping.
**Result:** Step is fully server-driven; the client reads the new `nextStep` and routes accordingly.

## Frontend Excellence Notes

### Platform Applicability

- Applies to both Web and Taro mini-program onboarding flows wherever the client consumes `nextStep` and renders step-specific UI.
- Web is the current primary implementation surface, but mini-program onboarding should follow the same server-owned routing authority and state semantics.

### UI/UX & Aesthetic Guidance

- Onboarding screens should use JoyJoin token and typography guidance consistently so progression feels like one coherent flow rather than a set of disconnected forms.
- Every onboarding step must define loading, error, empty, validation, disabled, and success states explicitly; auth fetches and step submissions cannot leave the user guessing.
- Use semantic form and page structure on web (`main`, `form`, `label`, `button`, `fieldset`) and the equivalent Taro-native composition on mini-program surfaces.
- Interaction feedback should be immediate and specific: pressed CTA state, validation copy near the field, and a clear transition once the server confirms the new `nextStep`.

### Web-Specific Considerations

- Maintain deliberate hover and `:focus-visible` treatments for onboarding controls, especially primary CTAs, segmented choices, and multi-step progress affordances.
- Optimize for narrow mobile layouts first, since onboarding is a one-thumb flow; avoid horizontal overflow and keep critical actions pinned within easy reach.
- Use the [shared frontend thresholds reference](../design-system-governance/references/frontend-excellence-thresholds.md) when deciding when long interest, trait, or preference lists should virtualize or progressively reveal.

### Taro-Specific Considerations

- Follow the [shared frontend thresholds reference](../design-system-governance/references/frontend-excellence-thresholds.md) for minimum touch targets and long-list handling, use `View`, `Text`, `Button`, `Input`, and `ScrollView`, and do not port DOM-only controls directly into mini-program onboarding.
- Use `hover-class` only where pressed feedback adds clarity, keep onboarding route clusters and heavy assets subpackage-aware, and adopt `VirtualList` for long selectors or question banks.
- Preserve the same `nextStep` authority model in Taro rather than introducing page-local progression logic.

### Accessibility & Performance Notes

- Meet WCAG 2.1 AA expectations for labels, error association, focus order, target size, and readable status messaging throughout the flow.
- Protect LCP and INP on onboarding entry routes by keeping auth bootstrapping lightweight, avoiding layout shift between states, and deferring non-essential decoration.
- On mini-program surfaces, prioritize smooth scroll and fast input echo over elaborate animation during step transitions.

## Troubleshooting

- **`nextStep` is stale — client shows old step after completing a step** — the client is not re-fetching `/api/auth/user` after the step completion call. Invalidate the auth query and re-fetch before navigating.
- **Routing loop — user is redirected back to a step they already completed** — the completion flag is not being persisted on the server (check the POST handler), or the `nextStep` computation in `auth.ts` is not reflecting the updated flag.
- **Client is deriving onboarding position from local flags** — remove client-side step reconstruction. All routing decisions must come from the `nextStep` value returned by `GET /api/auth/user`.
- **Legacy quarantine identifier (`hasCompletedRegistration`) appearing in new code** — remove it immediately; this will also fail the `npm run guardrails` check. Use only the active completion flags listed in this skill.

## Review checklist

- [ ] `nextStep` is computed server-side in `routes/domains/auth.ts` — never derived on the client
- [ ] New completion flag is a persisted column on the `users` table, not client-local state
- [ ] Client re-fetches `/api/auth/user` after each step completes before navigating
- [ ] New pages are placed under `features/onboarding/active/pages/`, not `legacy/`
- [ ] `flow.ts` step → route mapping is updated for any new `nextStep` value
- [ ] No legacy identifiers (`hasCompletedRegistration`, `registration_sessions`, etc.) in new code
