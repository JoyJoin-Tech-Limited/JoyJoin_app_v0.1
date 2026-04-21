# Launch Risks — Internal Beta

**Product:** JoyJoin  
**Scope:** Internal beta launch  
**Prepared:** 2026-04-01  
**Status:** 🔴 Requires sign-off before beta launch

---

## Risk Summary

The following caveats reflect **known MVP-level limitations** identified in the current codebase. They have been triaged and are accepted for the internal beta period only. Each risk must be re-evaluated before any public launch.

**Wider / open beta:** See [`open-beta-wider.md`](./open-beta-wider.md) for risk delta vs this document, the **single-replica** operations contract, payments-on pre-flight, and admin RBAC expectations for self-serve users.

---

## Risk Table

| # | Caveat | Affected File(s) | Impact | Likelihood | Risk Level | Mitigation | Beta Acceptance |
|---|--------|-----------------|--------|------------|------------|------------|-----------------|
| R-01 | **In-memory inference cache** — AI industry-classification results are cached in a `node-cache` (in-process, single-node). Cache is lost on every server restart or process recycle. | `apps/server/src/inference/cache.ts` | Increased latency and AI API cost after restarts; no cross-instance consistency if multiple replicas are run | High (restarts are frequent in Replit dev) | Medium | Acceptable for single-node beta. Pre-populate cache on startup if needed. Replace with Redis/DB cache before multi-node deployment. | ☐ Accepted by: _________  Date: _________ |
| R-02 | **In-memory abuse detection state** — Per-user conversation turn counts and message timing are stored in a `Map<string, UserAbuseState>` (in-process). State resets on server restart; abuse counters cannot persist across restarts or scale across replicas. | `apps/server/src/abuseDetection.ts` | Abusive users may reset their rate-limit state by waiting for a server restart. Cross-replica deployments would have no shared abuse state. | Low (single node, controlled beta cohort) | Low–Medium | Acceptable for internal beta with trusted users. Persist state to DB (e.g., add a `user_abuse_state` table) before public launch. | ☐ Accepted by: _________  Date: _________ |
| R-03 | **Emergency auth-debug override surface** — `apps/server/src/cli/bypassLogin.ts` is fail-closed in production by default and calls `assertProductionAuthDebugSurfaceAllowed(...)`. Production use requires both `ALLOW_PRODUCTION_AUTH_DEBUG=1` and `ADMIN_CREATE_SECRET_KEY`, so the residual beta risk is emergency override misuse rather than always-on production availability. | `apps/server/src/cli/bypassLogin.ts`, `apps/server/src/auth/policy.ts` | An operator with both the override flag and the secret key can mark a user as having completed the personality test. If those controls are enabled too broadly or the key leaks, unauthorized bypass is possible. | Low (multiple controls required; intended only for audited emergency use) | Low–Medium | Keep `ALLOW_PRODUCTION_AUTH_DEBUG` unset during normal production operation, rotate `ADMIN_CREATE_SECRET_KEY` after any emergency use, and consider removing the CLI entirely after beta if the surface is no longer needed. | ☐ Accepted by: _________  Date: _________ |
| R-04 | **Viewer role on mutating admin routes** — The `viewer` role must not call write endpoints. Mutating `/api/admin/*` and related admin tools use `requireOperatorOrAbove` after `requireAdmin` (or `requireSuperAdmin` for account management); enforced by `apps/server/src/__tests__/adminRbacCoverage.test.ts`. | `apps/server/src/adminAuth.ts`, `apps/server/src/routes.ts`, domain admin routers | A misconfigured route could still allow `viewer` mutation. | Low (guardrail tests + code review on new routes) | Medium | Keep the RBAC audit test updated when adding admin routes; provision `viewer` only after review. | ☐ Accepted by: _________  Date: _________ |
| R-05 | **No cross-session token revocation** — Admin sessions are stored in the PostgreSQL session table. Revoking a `super_admin`'s access requires disabling the account in `admin_accounts`, but existing sessions remain valid until they expire naturally or the session store is cleared. | `apps/server/src/routes.ts` (session setup), `apps/server/src/adminAuth.ts` | A compromised or offboarded admin's session remains valid until it naturally expires (default session TTL). | Low (short beta period, small team) | Low–Medium | Disable the account immediately via `PATCH /api/admin/accounts/:id { "status": "disabled" }`. The `requireAdmin` middleware checks the account status on every request, so a disabled account is blocked even with a valid session cookie. | ☐ Accepted by: _________  Date: _________ |
| R-06 | **Legacy user.isAdmin flag fallback in requireAdmin** — Non-production: `requireAdmin` may still accept `session.userId` with `users.isAdmin` for migration. **Production:** legacy phone admin login and userId-only admin sessions are **disabled** (`NODE_ENV=production`); use `admin_accounts` + `POST /api/admin/login`. | `apps/server/src/adminAuth.ts` | Legacy admin sessions bypassed in prod once disabled; staging still supports migration testing. | Low | Low–Medium | Ensure every production operator uses `admin_accounts`; remove remaining `users.isAdmin` flags after migration. | ☐ Accepted by: _________  Date: _________ |
| R-07 | **No formal data-at-rest encryption** — Database is hosted on Neon serverless PostgreSQL. Neon provides encryption at rest by default, but user PII (phone numbers, display names, personality scores) is stored in plaintext columns. No application-level encryption is applied. | `packages/shared/src/schema.ts` | PII exposure if Neon credentials are compromised. | Low (Neon platform-level encryption exists) | Low | Acceptable for internal beta. Review column-level encryption requirements before any public or commercial launch. | ☐ Accepted by: _________  Date: _________ |
| R-08 | **Matching lab threshold persistence is global** — Changes to matching thresholds via `PUT /api/admin/matching-thresholds` affect all pools immediately. There is no staging or per-pool override capability. | `apps/server/src/routes.ts` (matching-thresholds route) | Accidental threshold change during an active pool can affect in-flight match runs. | Low (small cohort, single operator) | Low | Document change-management procedure: only update thresholds between matching runs. A per-pool override is a post-beta improvement. | ☐ Accepted by: _________  Date: _________ |

---

## Internal Beta Risk Acceptance Statement

> We, the undersigned, acknowledge the risks listed above and explicitly accept them for the **internal beta** period as defined.  
> These risks are understood to be temporary and must be remediated before any general public or commercial launch.  
> This acceptance covers only the internal beta cohort (trusted team members and invited testers) and is not valid for broader deployment.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | _________________ | _________________ | _________________ |
| Product Lead | _________________ | _________________ | _________________ |
| Operations Lead | _________________ | _________________ | _________________ |

---

## Post-Beta Remediation Checklist

Before public launch, the following must be completed:

- [ ] R-01: Replace `node-cache` with Redis or DB-backed cache
- [ ] R-02: Persist abuse detection state to database
- [ ] R-03: Re-evaluate whether `bypassLogin.ts` should remain as an emergency override surface; keep production override disabled by default or remove the CLI entirely
- [ ] R-04: Add `requireOperatorOrAbove` to all write endpoints accessible to `viewer` role
- [ ] R-05: Implement session revocation on account disable (session store sweep)
- [ ] R-06: Migrate all admins to `admin_accounts` table; remove legacy `isAdmin` fallback
- [ ] R-07: Evaluate column-level PII encryption requirements
- [ ] R-08: Implement per-pool matching threshold overrides

---

*See also: [`docs/admin-rbac-matrix.md`](admin-rbac-matrix.md), [`docs/runbooks/admin-incident-handling.md`](runbooks/admin-incident-handling.md)*
