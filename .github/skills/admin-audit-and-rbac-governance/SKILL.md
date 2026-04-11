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

## Purpose

This skill keeps admin work fail-closed and traceable. It owns the current
admin role hierarchy, endpoint-to-permission mapping, and the audit-log
requirements for sensitive admin actions.

## When to use this skill

Use this skill when you are:

- adding or changing an `/api/admin/*` route
- wiring an admin-client mutation that changes user, event, finance, or account state
- deciding whether an action should use `requireAdmin`, `requireOperatorOrAbove`, or `requireSuperAdmin`
- adding audit coverage for refunds, bans, password resets, attendance overrides, or admin account changes
- debugging missing `[AdminAudit]` lines or unexpected `403` responses in admin flows

## Core workflow

1. Classify the action before writing code.
   Read-only admin data, operational writes, and account-management writes do not share the same risk.

2. Map the action to the current RBAC matrix.
   Treat [`docs/admin-rbac-matrix.md`](../../docs/admin-rbac-matrix.md) as the current permission table.
   Do not infer permissions from page names or menu placement.

3. Keep account management at `super_admin` level.
   Admin account creation, role/status updates, and password resets stay behind `requireSuperAdmin`.

4. Treat sensitive writes as audit-worthy by default.
   If an admin action changes money, user access, attendance, content state, or admin credentials, it should emit `logAdminAudit(...)`.

5. Keep audit payloads safe and minimal.
   Include `action`, `adminId`, `adminRole`, `targetEntityType`, `targetEntityId`, and only the smallest useful `before`, `after`, or `context` snapshot.
   Never pass passwords, secrets, tokens, cookies, or session material.

6. Verify the full operational path.
   After implementing or changing an admin action, verify the route guard, the audit event, and the runbook-facing behavior together.

## Current operational rules

- `requireAdmin` validates an active admin session.
- `requireSuperAdmin` is required for admin account management.
- `requireOperatorOrAbove` is the intended write boundary for some operational actions, but the matrix documents where route-level enforcement is still catching up.
- `viewer` exists in the role model, but it is not yet fully enforced as a read-only runtime role across all routes.
- `logAdminAudit` auto-generates `auditId` and `timestamp`, normalizes unknown actions to `OTHER`, and redacts sensitive keys in nested payloads.

## Sensitive actions that should stay explicit

Keep action names aligned with `ADMIN_AUDIT_ACTIONS` whenever possible. Current examples include:

- `ADMIN_LOGIN`
- `ADMIN_ACCOUNT_CREATED`
- `ADMIN_ACCOUNT_UPDATED`
- `ADMIN_PASSWORD_RESET`
- `USER_BANNED`
- `USER_UNBANNED`
- `ADMIN_POINTS_ADJUSTED`
- `ATTENDANCE_OVERRIDE`
- `PAYMENT_REFUND_INITIATED`
- `EVENT_POOL_STATUS_CHANGED`

If a new sensitive admin action does not fit the current vocabulary, extend the action list rather than hiding the action under a vague context bag.

## Quick examples

- **Add an admin refund route**: apply the correct admin middleware, emit `PAYMENT_REFUND_INITIATED`, and log only safe refund context such as `paymentId` and `reason`.
- **Add an attendance override button**: keep the route behind the documented admin middleware and emit `ATTENDANCE_OVERRIDE` with the new status, not a full user record dump.
- **Debug a `403` in admin accounts**: check whether the route requires `requireSuperAdmin` and whether the acting admin is using the expected RBAC session path.

## Troubleshooting

**The admin action works but no audit line appears**
Verify that `logAdminAudit(...)` is actually called in the mutation path and search logs by the `[AdminAudit]` prefix rather than generic request logs.

**An action is using the wrong middleware**
Check the live route against [`docs/admin-rbac-matrix.md`](../../docs/admin-rbac-matrix.md). Do not trust an old assumption that every `/api/admin/*` write is equivalent.

**The audit record contains too much data**
Reduce `before`, `after`, and `context` to safe business fields only. Redaction is a safety net, not a license to pass large or sensitive objects.

**A viewer can still perform a write**
That may reflect the current beta enforcement gap rather than a router bug. Document the route's intended guard and tighten it deliberately instead of assuming the role label is enough.

## Review checklist

- [ ] The route or action uses the correct admin middleware for its risk level
- [ ] Sensitive admin writes emit `logAdminAudit(...)`
- [ ] Audit payloads exclude passwords, secrets, tokens, cookies, and session material
- [ ] `action`, `targetEntityType`, and `targetEntityId` are explicit and useful
- [ ] The implementation matches the current RBAC matrix rather than an inferred permission model
- [ ] The operational path is covered by logs or runbook verification steps

## Related files

- [`docs/admin-rbac-matrix.md`](../../docs/admin-rbac-matrix.md)
- [`docs/runbooks/admin-incident-handling.md`](../../docs/runbooks/admin-incident-handling.md)
- [`apps/server/src/lib/adminAuditLogger.ts`](../../apps/server/src/lib/adminAuditLogger.ts)
- [`apps/server/src/routes/domains/admin.ts`](../../apps/server/src/routes/domains/admin.ts)
