/**
 * Unit tests for the Admin Audit Logger
 *
 * Verifies that logAdminAudit emits well-formed structured records
 * consistent with the [AdminAudit] log format.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logAdminAudit, type AdminAuditRecord } from '../lib/adminAuditLogger';

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
    expect(() => new Date(record.timestamp)).not.toThrow();
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
      targetEntityId: 'user-5',
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
});
