/**
 * Unit tests for the Admin Audit Logger
 *
 * Verifies that logAdminAudit emits well-formed structured records
 * consistent with the [AdminAudit] log format.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logAdminAudit, ADMIN_AUDIT_ACTIONS, type AdminAuditRecord } from '../lib/adminAuditLogger';

describe('logAdminAudit', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  function captureAuditRecord(): AdminAuditRecord {
    expect(consoleSpy).toHaveBeenCalledOnce();
    const [line] = consoleSpy.mock.calls[0] as [string];
    expect(line).toMatch(/^\[AdminAudit\] /);
    return JSON.parse(line.replace('[AdminAudit] ', '')) as AdminAuditRecord;
  }

  it('should emit a line prefixed with [AdminAudit]', () => {
    logAdminAudit({
      action: 'ADMIN_LOGIN',
      adminId: 'admin-1',
      adminRole: 'super_admin',
      targetEntityType: 'admin_account',
      targetEntityId: 'admin-1',
    });
    const [line] = consoleSpy.mock.calls[0] as [string];
    expect(line.startsWith('[AdminAudit] ')).toBe(true);
  });

  it('should include required fields in the record', () => {
    logAdminAudit({
      action: 'ADMIN_ACCOUNT_CREATED',
      adminId: 'admin-1',
      adminRole: 'super_admin',
      targetEntityType: 'admin_account',
      targetEntityId: 'admin-2',
      context: { username: 'new-op', role: 'operator' },
    });

    const record = captureAuditRecord();
    expect(record.action).toBe('ADMIN_ACCOUNT_CREATED');
    expect(record.adminId).toBe('admin-1');
    expect(record.adminRole).toBe('super_admin');
    expect(record.targetEntityType).toBe('admin_account');
    expect(record.targetEntityId).toBe('admin-2');
    expect(record.context).toEqual({ username: 'new-op', role: 'operator' });
  });

  it('should auto-populate auditId and timestamp', () => {
    logAdminAudit({
      action: 'ADMIN_ACCOUNT_UPDATED',
      adminId: 'admin-1',
      targetEntityType: 'admin_account',
      targetEntityId: 'admin-2',
    });

    const record = captureAuditRecord();
    expect(typeof record.auditId).toBe('string');
    expect(record.auditId.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(record.timestamp))).toBe(false);
  });

  it('should accept explicit auditId and timestamp overrides', () => {
    logAdminAudit({
      auditId: 'fixed-id',
      timestamp: '2026-01-01T00:00:00.000Z',
      action: 'ADMIN_PASSWORD_RESET',
      adminId: 'admin-1',
      adminRole: 'super_admin',
      targetEntityType: 'admin_account',
      targetEntityId: 'admin-3',
    });

    const record = captureAuditRecord();
    expect(record.auditId).toBe('fixed-id');
    expect(record.timestamp).toBe('2026-01-01T00:00:00.000Z');
  });

  it('should include before/after for update operations', () => {
    logAdminAudit({
      action: 'ADMIN_ACCOUNT_UPDATED',
      adminId: 'admin-1',
      adminRole: 'super_admin',
      targetEntityType: 'admin_account',
      targetEntityId: 'admin-2',
      before: { role: 'operator' },
      after: { role: 'viewer' },
    });

    const record = captureAuditRecord();
    expect(record.before).toEqual({ role: 'operator' });
    expect(record.after).toEqual({ role: 'viewer' });
  });

  it('should include adjustment delta context for ADMIN_POINTS_ADJUSTED', () => {
    logAdminAudit({
      action: 'ADMIN_POINTS_ADJUSTED',
      adminId: 'admin-1',
      adminRole: 'super_admin',
      targetEntityType: 'user',
      targetEntityId: 'user-99',
      before: { experiencePoints: 100, joyCoins: 50, currentLevel: 1 },
      after: { experiencePoints: 200, joyCoins: 60, currentLevel: 2 },
      context: { xpAdjustment: 100, coinsAdjustment: 10, reason: 'beta tester bonus' },
    });

    const record = captureAuditRecord();
    expect(record.action).toBe('ADMIN_POINTS_ADJUSTED');
    expect(record.context?.xpAdjustment).toBe(100);
    expect(record.context?.reason).toBe('beta tester bonus');
    // Ensure no password fields are present
    expect(JSON.stringify(record)).not.toMatch(/password/i);
  });

  it('should include event context for ATTENDANCE_OVERRIDE', () => {
    logAdminAudit({
      action: 'ATTENDANCE_OVERRIDE',
      adminId: 'admin-1',
      targetEntityType: 'event_attendance',
      targetEntityId: 'evt-1:user-5',
      context: { eventId: 'evt-1', userId: 'user-5', newStatus: 'confirmed' },
    });

    const record = captureAuditRecord();
    expect(record.action).toBe('ATTENDANCE_OVERRIDE');
    expect(record.context?.newStatus).toBe('confirmed');
  });

  it('should not include undefined keys in the emitted JSON', () => {
    logAdminAudit({
      action: 'USER_BANNED',
      adminId: 'admin-1',
      targetEntityType: 'user',
      targetEntityId: 'user-7',
    });

    const record = captureAuditRecord();
    // Optional fields not provided should be absent
    expect('before' in record).toBe(false);
    expect('after' in record).toBe(false);
    expect('context' in record).toBe(false);
    expect('adminRole' in record).toBe(false);
  });

  it('should not log any plaintext password value', () => {
    // Simulate what should happen on password reset — no password value
    logAdminAudit({
      action: 'ADMIN_PASSWORD_RESET',
      adminId: 'admin-1',
      adminRole: 'super_admin',
      targetEntityType: 'admin_account',
      targetEntityId: 'admin-5',
      // NOTE: newPassword is intentionally NOT passed here
    });

    const record = captureAuditRecord();
    // The action name contains "password" (that's fine); but the record
    // must NOT contain any key or value that looks like a password field.
    const serialised = JSON.stringify(record);
    expect(serialised).not.toMatch(/"newPassword"/i);
    expect(serialised).not.toMatch(/"passwordHash"/i);
    expect(serialised).not.toMatch(/"password"\s*:/i);
  });

  it('should redact sensitive keys recursively from before/after/context', () => {
    logAdminAudit({
      action: 'ADMIN_ACCOUNT_UPDATED',
      adminId: 'admin-1',
      targetEntityType: 'admin_account',
      targetEntityId: 'admin-5',
      before: {
        passwordHash: 'hashed-secret',
        nested: { apiToken: 'abc123' },
      },
      after: {
        profile: {
          sessionCookie: 'cookie-value',
        },
      },
      context: {
        resetSecret: 'super-secret',
        safeValue: 'kept',
      },
    });

    const record = captureAuditRecord();
    expect(record.before).toEqual({
      passwordHash: '[REDACTED]',
      nested: { apiToken: '[REDACTED]' },
    });
    expect(record.after).toEqual({
      profile: { sessionCookie: '[REDACTED]' },
    });
    expect(record.context).toEqual({
      resetSecret: '[REDACTED]',
      safeValue: 'kept',
    });
  });

  it('should normalize missing required fields for untyped callers', () => {
    logAdminAudit({
      action: 'NOT_A_REAL_ACTION' as any,
      adminId: '' as any,
      targetEntityType: '' as any,
      targetEntityId: 'entity-1',
    });

    const record = captureAuditRecord();
    expect(record.action).toBe('OTHER');
    expect(record.adminId).toBe('unknown');
    expect(record.targetEntityType).toBe('unknown');
    expect(record.context).toEqual({ originalAction: 'NOT_A_REAL_ACTION' });
  });

  it('ADMIN_AUDIT_ACTIONS includes the venue and event management actions', () => {
    const required = [
      'VENUE_CREATED',
      'VENUE_UPDATED',
      'VENUE_DELETED',
      'EVENT_STATUS_CHANGED',
      'EVENT_POOL_STATUS_CHANGED',
      'MATCHING_WEIGHTS_ACTIVATED',
      'MATCHING_WEIGHTS_DISABLED',
      'MATCHING_WEIGHTS_ROLLED_BACK',
    ] as const;
    for (const action of required) {
      expect(ADMIN_AUDIT_ACTIONS).toContain(action);
    }
  });

  it('emits a valid record for VENUE_CREATED', () => {
    logAdminAudit({
      action: 'VENUE_CREATED',
      adminId: 'admin-1',
      adminRole: 'operator',
      targetEntityType: 'venue',
      targetEntityId: 'venue-42',
      context: { name: 'Sky Bar', city: '深圳', type: 'bar' },
    });

    const record = captureAuditRecord();
    expect(record.action).toBe('VENUE_CREATED');
    expect(record.targetEntityType).toBe('venue');
    expect(record.targetEntityId).toBe('venue-42');
    expect((record.context as any)?.name).toBe('Sky Bar');
  });

  it('emits a valid record for EVENT_POOL_STATUS_CHANGED with before/after', () => {
    logAdminAudit({
      action: 'EVENT_POOL_STATUS_CHANGED',
      adminId: 'admin-2',
      targetEntityType: 'event_pool',
      targetEntityId: 'pool-7',
      before: { status: 'active' },
      after: { status: 'matching' },
    });

    const record = captureAuditRecord();
    expect(record.action).toBe('EVENT_POOL_STATUS_CHANGED');
    expect((record.before as any)?.status).toBe('active');
    expect((record.after as any)?.status).toBe('matching');
  });
});
