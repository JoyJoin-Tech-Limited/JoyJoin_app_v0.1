/**
 * Admin Audit Logger
 * 管理员操作审计日志模块
 *
 * Emits structured, machine-readable audit records to stdout as single JSON lines
 * prefixed with `[AdminAudit]`.  Mirrors the design of `aiTraceLogger.ts`:
 *   - No plaintext passwords or secrets are ever logged.
 *   - `auditId` and `timestamp` are auto-populated when not supplied.
 *   - Records are compact (undefined keys stripped) for log-aggregator efficiency.
 *
 * Usage:
 *   import { logAdminAudit } from '../lib/adminAuditLogger';
 *
 *   logAdminAudit({
 *     action: 'ADMIN_ACCOUNT_CREATED',
 *     adminId: req.adminAccount.id,
 *     adminRole: req.adminAccount.role,
 *     targetEntityType: 'admin_account',
 *     targetEntityId: newAccount.id,
 *     context: { username: newAccount.username, role: newAccount.role },
 *   });
 */

import { randomUUID } from 'node:crypto';

// ── Action type vocabulary ──────────────────────────────────────────────────

/**
 * All recognizable sensitive admin action types.
 * Extend this union as new sensitive actions are added.
 */
export type AdminAuditAction =
  // Admin account management
  | 'ADMIN_LOGIN'
  | 'ADMIN_ACCOUNT_CREATED'
  | 'ADMIN_ACCOUNT_UPDATED'
  | 'ADMIN_PASSWORD_RESET'
  // User moderation
  | 'USER_BANNED'
  | 'USER_UNBANNED'
  // Points / coins
  | 'ADMIN_POINTS_ADJUSTED'
  // Attendance
  | 'ATTENDANCE_OVERRIDE'
  // Financial
  | 'PAYMENT_REFUND_INITIATED'
  // Generic fallback for one-off sensitive mutations
  | string;

// ── Record shape ────────────────────────────────────────────────────────────

export interface AdminAuditRecord {
  /** Auto-generated UUID for cross-system log correlation. */
  auditId: string;

  /** ISO-8601 timestamp of when the action was performed. */
  timestamp: string;

  /**
   * Identifier of the admin who performed the action.
   * Use the `adminAccount.id` from RBAC sessions; fall back to `'legacy_user'`
   * when the action is performed via the older `isAdmin` flag on the users table.
   */
  adminId: string;

  /** Role of the acting admin at the time of the action (e.g. `'super_admin'`). */
  adminRole?: string;

  /** Vocabulary action type — see `AdminAuditAction`. */
  action: AdminAuditAction;

  /**
   * The kind of entity being acted on.
   * Examples: `'admin_account'`, `'user'`, `'event_attendance'`, `'payment'`
   */
  targetEntityType: string;

  /**
   * Primary-key identifier of the target entity.
   * Leave as `undefined` when there is no single target (e.g. list queries).
   */
  targetEntityId?: string;

  /**
   * Before-state snapshot for update operations (safe fields only).
   * MUST NOT include passwords, secrets, or PII beyond what is needed for audit.
   */
  before?: Record<string, unknown>;

  /**
   * After-state or mutation delta for update operations (safe fields only).
   * MUST NOT include passwords, secrets, or PII beyond what is needed for audit.
   */
  after?: Record<string, unknown>;

  /**
   * Free-form context bag for action-specific metadata that doesn't fit
   * `before`/`after` (e.g. adjustment `reason`, `adjustmentDelta`).
   * Keep values non-PII and non-sensitive.
   */
  context?: Record<string, unknown>;
}

// ── Emit helper ─────────────────────────────────────────────────────────────

/**
 * Emit a structured admin audit record to stdout as a single JSON line.
 *
 * The line is prefixed with `[AdminAudit]` so log-processing tooling can
 * identify audit lines by prefix without a full JSON parse on every log line.
 *
 * @param fields  Audit fields. `auditId` and `timestamp` are auto-populated
 *                when not provided.
 */
export function logAdminAudit(
  fields: Omit<AdminAuditRecord, 'auditId' | 'timestamp'> &
    Partial<Pick<AdminAuditRecord, 'auditId' | 'timestamp'>>,
): void {
  const record: AdminAuditRecord = {
    auditId: fields.auditId ?? randomUUID(),
    timestamp: fields.timestamp ?? new Date().toISOString(),
    adminId: fields.adminId,
    adminRole: fields.adminRole,
    action: fields.action,
    targetEntityType: fields.targetEntityType,
    targetEntityId: fields.targetEntityId,
    before: fields.before,
    after: fields.after,
    context: fields.context,
  };

  // Strip undefined keys for compact output
  const compact = Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined),
  ) as AdminAuditRecord;

  console.log(`[AdminAudit] ${JSON.stringify(compact)}`);
}
