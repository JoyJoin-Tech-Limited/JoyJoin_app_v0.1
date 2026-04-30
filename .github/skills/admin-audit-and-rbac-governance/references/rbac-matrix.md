# RBAC Matrix and Operational Details

## Endpoint-to-permission mapping

Treat [`docs/admin-rbac-matrix.md`](../../docs/admin-rbac-matrix.md) as the current permission table. Do not infer permissions from page names or menu placement.

| Middleware | Use case |
|------------|----------|
| `requireAdmin` | Validates an active admin session; baseline for all `/api/admin/*` routes |
| `requireOperatorOrAbove` | Write boundary for some operational actions; matrix documents where route-level enforcement is still catching up |
| `requireSuperAdmin` | Admin account management, role/status updates, password resets |

`viewer` exists in the role model but is not yet fully enforced as a read-only runtime role across all routes.

## Sensitive actions vocabulary

Keep action names aligned with `ADMIN_AUDIT_ACTIONS` whenever possible:

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

## Audit payload safety

`logAdminAudit` auto-generates `auditId` and `timestamp`, normalizes unknown actions to `OTHER`, and redacts sensitive keys in nested payloads.

Required fields:
- `action`
- `adminId`
- `adminRole`
- `targetEntityType`
- `targetEntityId`

Optional safe context:
- `before`, `after`, or `context` snapshot with the smallest useful business fields

Never pass passwords, secrets, tokens, cookies, or session material.

## Related files

- [`docs/admin-rbac-matrix.md`](../../docs/admin-rbac-matrix.md)
- [`docs/runbooks/admin-incident-handling.md`](../../docs/runbooks/admin-incident-handling.md)
- [`apps/server/src/lib/adminAuditLogger.ts`](../../apps/server/src/lib/adminAuditLogger.ts)
- [`apps/server/src/routes/domains/admin.ts`](../../apps/server/src/routes/domains/admin.ts)
