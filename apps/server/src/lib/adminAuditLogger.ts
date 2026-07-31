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
import { db } from '../db';
import { adminAuditLogs } from '@joyjoin/shared';

// ── Action type vocabulary ──────────────────────────────────────────────────

/**
 * All recognizable sensitive admin action types.
 * Extend this union as new sensitive actions are added.
 */
export const ADMIN_AUDIT_ACTIONS = [
  // Admin account management
  'ADMIN_LOGIN',
  'ADMIN_ACCOUNT_CREATED',
  'ADMIN_ACCOUNT_UPDATED',
  'ADMIN_PASSWORD_RESET',
  // Feature flags / runtime config
  'FEATURE_FLAG_UPDATED',
  // User moderation
  'USER_BANNED',
  'USER_UNBANNED',
  'USER_DATA_DELETED',
  'USER_DETAIL_VIEWED',
  // Points / coins
  'ADMIN_POINTS_ADJUSTED',
  // Attendance
  'ATTENDANCE_OVERRIDE',
  // Financial
  'PAYMENT_REFUND_INITIATED',
  // Venue management
  'VENUE_CREATED',
  'VENUE_UPDATED',
  'VENUE_DELETED',
  'VENUE_MIGRATED',
  'VENUE_ASSIGNED',
  'VENUE_ONBOARDING_STATUS_CHANGED',
  // Event management
  'EVENT_STATUS_CHANGED',
  // Event pool management
  'EVENT_POOL_CREATED',
  'EVENT_POOL_UPDATED',
  'EVENT_POOL_MATCHED',
  'EVENT_POOL_STATUS_CHANGED',
  'MATCHING_REVIEW_APPROVED',
  'MATCHING_REVIEW_REJECTED',
  // Flash NPC operations
  'FLASH_CATALOG_SEEDED',
  'FLASH_NPC_CREATED',
  'FLASH_NPC_UPDATED',
  'FLASH_ENCOUNTER_LOCATION_CREATED',
  'FLASH_ENCOUNTER_LOCATION_UPDATED',
  'FLASH_TASK_DESTINATION_CREATED',
  'FLASH_TASK_DESTINATION_UPDATED',
  'FLASH_TASK_TEMPLATE_CREATED',
  'FLASH_TASK_TEMPLATE_UPDATED',
  'FLASH_SCHEDULE_DRAFT_GENERATED',
  'FLASH_SCHEDULE_DRAFT_UPDATED',
  'FLASH_SCHEDULE_PUBLISHED',
  'FLASH_SCHEDULE_REGENERATED',
  // Equipment and reward operations
  'EQUIPMENT_ITEM_CREATED',
  'EQUIPMENT_ITEM_UPDATED',
  'EQUIPMENT_POOL_CREATED',
  'EQUIPMENT_POOL_UPDATED',
  // Matching weights rollout
  'MATCHING_WEIGHTS_ACTIVATED',
  'MATCHING_WEIGHTS_DISABLED',
  'MATCHING_WEIGHTS_ROLLED_BACK',
  // Onboarding support (testing-only, not admin-gated; logged via application logger)
  // 'ONBOARDING_FORCE_SKIPPED',
  // Runtime fallback for malformed / untyped callers
  'OTHER',
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

// ── Record shape ────────────────────────────────────────────────────────────

export interface AdminAuditRecord {
  /** Auto-generated UUID for cross-system log correlation. */
  auditId: string;

  /** ISO-8601 timestamp of when the action was performed. */
  timestamp: string;

  /**
   * Identifier of the admin who performed the action.
   * Use the `adminAccount.id` from RBAC sessions; fall back to the legacy
   * `session.userId` when the action is performed via the older `isAdmin`
   * flag on the users table.
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
  const safeContext = redactSensitiveFields(fields.context);
  const normalizedAction = normalizeAction(fields.action);
  const record: AdminAuditRecord = {
    auditId: fields.auditId ?? randomUUID(),
    timestamp: fields.timestamp ?? new Date().toISOString(),
    adminId: normalizeRequiredString(fields.adminId, 'unknown'),
    adminRole: fields.adminRole,
    action: normalizedAction,
    targetEntityType: normalizeRequiredString(fields.targetEntityType, 'unknown'),
    targetEntityId: fields.targetEntityId,
    before: redactSensitiveFields(fields.before),
    after: redactSensitiveFields(fields.after),
    context: buildContextWithOriginalAction(normalizedAction, fields.action, safeContext),
  };

  // Strip undefined keys for compact output
  const compact = Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined),
  ) as AdminAuditRecord;

  console.log(`[AdminAudit] ${JSON.stringify(compact)}`);

  // Persist to DB asynchronously (fire-and-forget; never block the caller)
  Promise.resolve().then(async () => {
    try {
      await db.insert(adminAuditLogs).values({
        auditId: record.auditId,
        timestamp: new Date(record.timestamp),
        adminId: record.adminId,
        adminRole: record.adminRole,
        action: record.action,
        targetEntityType: record.targetEntityType,
        targetEntityId: record.targetEntityId,
        before: record.before,
        after: record.after,
        context: record.context,
      });
    } catch (err) {
      // If DB persistence fails, stdout log remains the source of truth
      console.error('[AdminAudit] DB persistence failed:', err);
    }
  });
}

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(password|secret|token|session|cookie|authorization|apikey|api_key)/i;

function redactSensitiveFields<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveFields(entry)) as T;
  }

  if (typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED_VALUE
        : redactSensitiveFields(entryValue),
    ]),
  ) as T;
}

function normalizeRequiredString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeAction(value: unknown): AdminAuditAction {
  if (typeof value !== 'string') {
    return 'OTHER';
  }

  const trimmed = value.trim();
  return isAdminAuditAction(trimmed) ? trimmed : 'OTHER';
}

function buildContextWithOriginalAction(
  normalizedAction: AdminAuditAction,
  originalAction: unknown,
  safeContext: AdminAuditRecord['context'],
): AdminAuditRecord['context'] {
  if (normalizedAction !== 'OTHER' || typeof originalAction !== 'string' || !originalAction.trim()) {
    return safeContext;
  }

  return {
    ...((safeContext ?? {}) as Record<string, unknown>),
    originalAction: originalAction.trim(),
  };
}

function isAdminAuditAction(value: string): value is AdminAuditAction {
  return (ADMIN_AUDIT_ACTIONS as readonly string[]).includes(value);
}
