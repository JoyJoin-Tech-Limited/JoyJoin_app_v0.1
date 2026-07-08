---
name: admin-audit-and-rbac-governance
description: >-
  Admin role hierarchy, endpoint-to-permission mapping, and mandatory audit logging
  for sensitive admin actions. Use when implementing or reviewing admin APIs,
  admin portal mutations, role checks, password resets, refunds, bans, attendance
  overrides, or missing audit trails. Trigger phrases: "add an admin route",
  "super_admin only", "audit-log this admin action", "attendance override",
  "refund payment", "ban user", "why is this admin getting 403".
---

# Admin Audit and RBAC Governance

**Core rule:** Keep admin work fail-closed and traceable. Classify the action, map it to the current RBAC matrix, and emit `logAdminAudit(...)` for every sensitive write.

## When to use this skill

Use this skill when you are:

- adding or changing an `/api/admin/*` route
- wiring an admin-client mutation that changes user, event, finance, or account state
- deciding whether an action should use `requireAdmin`, `requireOperatorOrAbove`, or `requireSuperAdmin`
- adding audit coverage for refunds, bans, password resets, attendance overrides, or admin account changes
- debugging missing `[AdminAudit]` lines or unexpected `403` responses in admin flows

## Role hierarchy overview

Three runtime middleware levels exist today:

1. **`requireAdmin`** — baseline for all admin routes; validates an active admin session
2. **`requireOperatorOrAbove`** — operational write boundary for some actions; the matrix documents where route-level enforcement is still catching up
3. **`requireSuperAdmin`** — account management only; creation, role/status updates, and password resets

`viewer` exists in the role model but is not yet fully enforced as a read-only runtime role across all routes. See [`references/rbac-matrix.md`](references/rbac-matrix.md) for the full endpoint mapping and action vocabulary.

## Audit logging overview

Sensitive writes — money, user access, attendance, content state, admin credentials — should emit `logAdminAudit(...)` by default. Keep payloads safe and minimal: include `action`, `adminId`, `adminRole`, `targetEntityType`, `targetEntityId`, and only the smallest useful `before`/`after` snapshot. Never pass passwords, secrets, tokens, cookies, or session material.

After implementing or changing an admin action, verify the route guard, the audit event, and the runbook-facing behavior together. Read-only data, operational writes, and account-management writes do not share the same risk — classify before writing code.

## Quick examples

- **Add an admin refund route**: apply the correct admin middleware, emit `PAYMENT_REFUND_INITIATED`, and log only safe refund context such as `paymentId` and `reason`.
- **Add a matching review approve/reject route**: gate behind `requireAdmin` + `requireOperatorOrAbove`, emit `MATCHING_REVIEW_APPROVED` / `MATCHING_REVIEW_REJECTED`, and include only safe context such as `poolId`, `groupCount`, and `reason`.
- **Add an attendance override button**: keep the route behind the documented admin middleware and emit `ATTENDANCE_OVERRIDE` with the new status, not a full user record dump.
- **Debug a `403` in admin accounts**: check whether the route requires `requireSuperAdmin` and whether the acting admin is using the expected RBAC session path.
- **Extend the audit action list**: when a new sensitive action does not fit the current vocabulary, add it to `ADMIN_AUDIT_ACTIONS` rather than hiding it under a vague context bag.

## Troubleshooting

**The admin action works but no audit line appears**
Verify that `logAdminAudit(...)` is actually called in the mutation path and search logs by the `[AdminAudit]` prefix rather than generic request logs.

**An action is using the wrong middleware**
Check the live route against [`docs/admin-rbac-matrix.md`](../../docs/admin-rbac-matrix.md) and [`references/rbac-matrix.md`](references/rbac-matrix.md). Do not trust an old assumption that every `/api/admin/*` write is equivalent.

**The audit record contains too much data**
Reduce `before`, `after`, and `context` to safe business fields only. Redaction is a safety net, not a license to pass large or sensitive objects.

**A viewer can still perform a write**
That may reflect the current beta enforcement gap rather than a router bug. Document the route's intended guard and tighten it deliberately instead of assuming the role label is enough.

**Audit log returns 500 on resolution**
Verify that `insertModerationLogSchema` matches the request body and that `adminId` is populated from the session, not the request body.

**Missing audit coverage on a new admin flow**
If the flow changes money, user access, attendance, content state, or admin credentials, it should emit `logAdminAudit(...)` by default.

## Review checklist

- [ ] The route or action uses the correct admin middleware for its risk level
- [ ] Sensitive admin writes emit `logAdminAudit(...)`
- [ ] Audit payloads exclude passwords, secrets, tokens, cookies, and session material
- [ ] `action`, `targetEntityType`, and `targetEntityId` are explicit and useful
- [ ] The implementation matches the current RBAC matrix rather than an inferred permission model
- [ ] The operational path is covered by logs or runbook verification steps
