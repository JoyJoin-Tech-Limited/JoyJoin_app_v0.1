import { eq, and, sql, gte, lte, count, countDistinct } from "drizzle-orm";
import { db } from "../db.js";
import {
  userLocationSnapshots,
  userLocationAggregates,
  type InsertUserLocationSnapshot,
  type InsertUserLocationAggregate,
} from "@shared/schema/_definitions_extended.js";

export async function insertUserLocationSnapshot(
  data: InsertUserLocationSnapshot
): Promise<void> {
  await db.insert(userLocationSnapshots).values(data);
}

export async function upsertUserLocationAggregate(
  data: InsertUserLocationAggregate
): Promise<void> {
  await db
    .insert(userLocationAggregates)
    .values(data)
    .onConflictDoUpdate({
      target: [
        userLocationAggregates.date,
        userLocationAggregates.province,
        userLocationAggregates.city,
        userLocationAggregates.eventType,
      ],
      set: {
        uniqueHashedIps: data.uniqueHashedIps,
        totalSnapshots: data.totalSnapshots,
        anonymousSnapshots: data.anonymousSnapshots,
        updatedAt: new Date(),
      },
    });
}

export async function refreshAggregateForDateCityEvent(
  date: string,
  province: string,
  city: string,
  eventType: string
): Promise<void> {
  const [{ uniqueIps, total, anonymous }] = await db
    .select({
      uniqueIps: countDistinct(userLocationSnapshots.hashedIp),
      total: count(),
      anonymous: count(
        sql`CASE WHEN ${userLocationSnapshots.userId} IS NULL THEN 1 END`
      ),
    })
    .from(userLocationSnapshots)
    .where(
      and(
        eq(userLocationSnapshots.ipSaltDate, date),
        eq(userLocationSnapshots.province, province),
        eq(userLocationSnapshots.city, city),
        eq(userLocationSnapshots.eventType, eventType)
      )
    );

  await upsertUserLocationAggregate({
    date,
    province,
    city,
    eventType,
    uniqueHashedIps: Number(uniqueIps),
    totalSnapshots: Number(total),
    anonymousSnapshots: Number(anonymous),
  });
}

export interface HeatmapFilters {
  startDate?: string;
  endDate?: string;
  eventType?: string;
  province?: string;
  city?: string;
}

export async function getAggregatedHeatmap(filters: HeatmapFilters): Promise<{
  date: string;
  province: string;
  city: string;
  eventType: string;
  uniqueHashedIps: number;
  totalSnapshots: number;
  anonymousSnapshots: number;
}[]> {
  const conditions = [];
  if (filters.startDate) {
    conditions.push(gte(userLocationAggregates.date, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(userLocationAggregates.date, filters.endDate));
  }
  if (filters.eventType) {
    conditions.push(eq(userLocationAggregates.eventType, filters.eventType));
  }
  if (filters.province) {
    conditions.push(eq(userLocationAggregates.province, filters.province));
  }
  if (filters.city) {
    conditions.push(eq(userLocationAggregates.city, filters.city));
  }

  const rows: {
    date: string | Date;
    province: string;
    city: string;
    eventType: string;
    uniqueHashedIps: number;
    totalSnapshots: number;
    anonymousSnapshots: number;
  }[] = await db
    .select({
      date: userLocationAggregates.date,
      province: userLocationAggregates.province,
      city: userLocationAggregates.city,
      eventType: userLocationAggregates.eventType,
      uniqueHashedIps: userLocationAggregates.uniqueHashedIps,
      totalSnapshots: userLocationAggregates.totalSnapshots,
      anonymousSnapshots: userLocationAggregates.anonymousSnapshots,
    })
    .from(userLocationAggregates)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(userLocationAggregates.date, userLocationAggregates.province, userLocationAggregates.city);

  return rows.map((r) => ({
    ...r,
    date: typeof r.date === "string" ? r.date : r.date.toISOString().slice(0, 10),
  }));
}

export async function rollupSnapshotsForDate(date: string): Promise<void> {
  const rows = await db
    .select({
      province: userLocationSnapshots.province,
      city: userLocationSnapshots.city,
      eventType: userLocationSnapshots.eventType,
      hashedIp: userLocationSnapshots.hashedIp,
      userId: userLocationSnapshots.userId,
    })
    .from(userLocationSnapshots)
    .where(eq(userLocationSnapshots.ipSaltDate, date));

  const groups = new Map<
    string,
    {
      province: string;
      city: string;
      eventType: string;
      uniqueIps: Set<string>;
      total: number;
      anonymous: number;
    }
  >();

  for (const row of rows) {
    const province = row.province ?? "未知";
    const city = row.city ?? "未知";
    const key = `${province}|${city}|${row.eventType}`;
    const existing = groups.get(key);
    if (existing) {
      existing.uniqueIps.add(row.hashedIp);
      existing.total += 1;
      if (!row.userId) existing.anonymous += 1;
    } else {
      const set = new Set<string>();
      set.add(row.hashedIp);
      groups.set(key, {
        province,
        city,
        eventType: row.eventType,
        uniqueIps: set,
        total: 1,
        anonymous: row.userId ? 0 : 1,
      });
    }
  }

  for (const group of groups.values()) {
    await upsertUserLocationAggregate({
      date,
      province: group.province,
      city: group.city,
      eventType: group.eventType,
      uniqueHashedIps: group.uniqueIps.size,
      totalSnapshots: group.total,
      anonymousSnapshots: group.anonymous,
    });
  }
}

export async function deleteSnapshotsOlderThan(days: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const result = await db
    .delete(userLocationSnapshots)
    .where(lte(userLocationSnapshots.ipSaltDate, cutoffStr));
  return result.rowCount ?? 0;
}
