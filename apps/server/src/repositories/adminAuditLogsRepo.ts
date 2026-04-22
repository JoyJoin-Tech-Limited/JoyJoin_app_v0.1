/**
 * Admin Audit Logs Repository
 *
 * Query interface for persisted admin audit records.
 * Write path is via adminAuditLogger.ts (stdout + DB dual-write).
 */

import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { adminAuditLogs } from "@joyjoin/shared";

export interface AuditLogQueryFilters {
  adminId?: string;
  action?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export async function queryAdminAuditLogs(filters: AuditLogQueryFilters = {}) {
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  const conditions = [];

  if (filters.adminId) {
    conditions.push(eq(adminAuditLogs.adminId, filters.adminId));
  }
  if (filters.action) {
    conditions.push(eq(adminAuditLogs.action, filters.action));
  }
  if (filters.targetEntityType) {
    conditions.push(eq(adminAuditLogs.targetEntityType, filters.targetEntityType));
  }
  if (filters.targetEntityId) {
    conditions.push(eq(adminAuditLogs.targetEntityId, filters.targetEntityId));
  }
  if (filters.startDate) {
    conditions.push(gte(adminAuditLogs.timestamp, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(adminAuditLogs.timestamp, filters.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(adminAuditLogs)
    .where(whereClause)
    .orderBy(desc(adminAuditLogs.timestamp))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(adminAuditLogs)
    .where(whereClause);

  return {
    rows,
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  };
}

export async function getAuditLogById(id: string) {
  const rows = await db
    .select()
    .from(adminAuditLogs)
    .where(eq(adminAuditLogs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAuditLogByAuditId(auditId: string) {
  const rows = await db
    .select()
    .from(adminAuditLogs)
    .where(eq(adminAuditLogs.auditId, auditId))
    .limit(1);
  return rows[0] ?? null;
}
