---
name: security-scan
description: >-
  Security scanning and posture review for auth/debug surfaces, secret handling,
  dependency risk, CI guardrails, and production override exposure. Use when auditing
  a change for vulnerabilities or checking whether the repo's current security checks are
  sufficient. Trigger phrases: "security scan", "dependency vulnerability", "CodeQL",
  "npm audit", "secret leak", "production override".
---

# Security Scan

## Purpose

This skill covers how to scan or audit the current repo for security risk without inventing
security guarantees that do not exist. It focuses on current enforcement surfaces, dependency
risk, secret handling, and auth/debug exposure.

## When to use this skill

Use this skill when you are:

- asked to run a security scan or audit a change for security risk
- checking dependency vulnerabilities or CI security coverage
- reviewing auth-debug surfaces, secret handling, or production overrides
- validating whether a route, tool, or workflow fails closed
- summarizing the current security posture before launch or review

## Core rules

1. Report the current scan surface honestly.
   If CI does not run a dedicated CodeQL or dependency scan, call that gap out instead of implying a pass.

2. Start from current enforcement files.
   `apps/server/src/auth/policy.ts`, `scripts/check-guardrails.mjs`, `docs/launch-risks.md`,
   and `.github/workflows/cicd.yml` are better sources of truth than stale summary docs.

3. Treat secrets and debug overrides as trust-boundary issues.
   Review where secrets enter, where debug flags are allowed, and whether production fails closed by default.

4. Separate posture review from implementation.
   Use this skill to identify gaps, risks, and scan steps. Use domain skills such as
   `auth-session-and-safety-boundaries` to redesign or fix the vulnerable code path.

5. Prefer concrete evidence over generic checklists.
   Point to the actual route, script, flag, workflow, or dependency path that creates the risk.

## Current repo anchors

- `apps/server/src/auth/policy.ts` is the auth-debug policy source of truth.
- `scripts/check-guardrails.mjs` enforces env, secret, and legacy guardrails in CI.
- `.github/workflows/cicd.yml` currently runs guardrails, type checks, server tests, and simulation.
- `docs/launch-risks.md` and `docs/CLI_TOOLS.md` describe the current known-risk posture and debug-tool constraints.

## Quick examples

- **Check auth-debug exposure**: verify that production override surfaces require explicit flags and do not default open.
- **Review a launch branch for security gaps**: compare current CI checks to the risks called out in `docs/launch-risks.md`.
- **Run a dependency-focused audit**: combine package inspection with honest reporting about what CI does and does not already cover.

## Troubleshooting

**The repo has a historical doc claiming a security scan passed**
Verify whether the current workflow actually runs that scan today before repeating the claim.

**A debug tool is documented but should be disabled in production**
Check `apps/server/src/auth/policy.ts` and the current CLI or route behavior, not an old assumption.

**A route seems secure because it is behind admin auth**
That is not enough. Review role granularity, fail-closed behavior, and any lingering legacy fallback path.

**The scan result is hand-wavy**
List the concrete checks performed, the files reviewed, and any missing automation explicitly.

## Review checklist

- [ ] The review names the actual checks performed and the gaps that remain
- [ ] Current CI security coverage is described accurately
- [ ] Auth-debug and override surfaces are checked against current policy files
- [ ] Secret handling is reviewed at trust-boundary points, not only in docs
- [ ] Risks are tied to real files, flags, routes, or workflows
- [ ] Missing automation is reported as a gap, not a silent assumption

## Related files

- `apps/server/src/auth/policy.ts`
- `apps/server/src/cli/bypassLogin.ts`
- `scripts/check-guardrails.mjs`
- `.github/workflows/cicd.yml`
- `docs/launch-risks.md`
- `docs/CLI_TOOLS.md`