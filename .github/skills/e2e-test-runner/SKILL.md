---
name: e2e-test-runner
description: >-
  Flow-level verification for end-to-end journeys, smoke tests, and synthetic probes.
  Use when running or designing full-stack journey checks, post-deploy probes, or
  route-to-route validation across the active app surfaces. Trigger phrases: "run an E2E test",
  "end-to-end", "smoke test", "happy-path probe", "signup flow".
---

# E2E Test Runner

## Purpose

This skill covers flow-level validation across multiple layers of the app: smoke tests,
synthetic probes, and full user journeys. It owns end-to-end verification strategy, not unit
or invariant test placement.

## When to use this skill

Use this skill when you are:

- running or designing an end-to-end flow test
- validating a post-deploy smoke path or synthetic probe
- checking a multi-step user journey across API plus client behavior
- deciding how to verify a change beyond unit tests
- reviewing whether an existing flow-level script still matches the active product flow

## Core rules

1. Start from active flows, not legacy scripts.
   The repo has flow scripts, but some are stale. For example, `scripts/test-e2e-flow.ts`
   still targets a deprecated V2 personality flow and must not be treated as the source of truth.

2. Match the harness to the goal.
   Use synthetic probes for lightweight availability checks and fuller scripts for broader journey validation.

3. Be explicit about coverage gaps.
   If the repo lacks a realistic browser-driven harness for a flow, say so directly rather than implying it exists.

4. Keep E2E verification outcome-focused.
   Verify that the user can finish the flow or that the service stays healthy, not just that individual calls returned 200.

5. Record environment assumptions.
   Localhost, staging, production probe targets, seeded users, and feature flags all affect the meaning of an E2E result.

## Current repo anchors

- `scripts/synthetic/happy-path-probe.mjs` is the active lightweight production probe.
- `.github/workflows/synthetic-probe.yml` schedules the probe every 5 minutes.
- `scripts/test-e2e-flow.ts` exists but is explicitly marked as using a deprecated V2 assessment flow.

## Quick examples

- **Post-deploy verification**: run the synthetic probe or use `workflow_dispatch` to validate health, metrics, and auth response basics.
- **Full signup validation**: start from the active onboarding flow and call out that the existing `test-e2e-flow.ts` script is not yet V4-correct.
- **Smoke test after a risky change**: define the shortest realistic journey that proves the affected flow still works.

## Troubleshooting

**The script exists but tests an old flow**
Treat it as a migration candidate, not proof that the active flow is covered.

**A workspace test script says there are no tests**
That does not block E2E work, but it does mean you should describe the harness gap honestly.

**A synthetic probe passes but the user flow is still broken**
The probe may only cover service availability. Add or run a broader journey check.

**An E2E request works locally only**
Document the env assumptions, seeded data, and feature flags before trusting the result.

## Review checklist

- [ ] The chosen E2E or smoke harness matches the question being answered
- [ ] Active product flows are used as the source of truth instead of stale scripts
- [ ] Coverage gaps are called out explicitly
- [ ] Environment assumptions are documented
- [ ] Success is defined at the journey level, not only per request
- [ ] Post-deploy or production probes avoid unnecessary destructive behavior

## Related files

- `scripts/test-e2e-flow.ts`
- `scripts/synthetic/happy-path-probe.mjs`
- `.github/workflows/synthetic-probe.yml`
- `docs/onboarding-flow.md`
- `docs/runbooks/alerting.md`