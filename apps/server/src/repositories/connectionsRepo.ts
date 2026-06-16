/**
 * Connections Repository — N+1-free bulk queries for user connections
 *
 * Why a dedicated repository?
 *   - The admin route (adminUsers.ts) does raw inline queries.
 *   - The Connections Predictive Shell needs a reusable, testable data layer.
 *   - Following the repository pattern: isolated DB access, no logic in routes.
 */

import { and, eq, or, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { connections, users, events } from "@shared/schema";
import { formatAgeRangeBand } from "@shared/utils";

export interface ConnectionSummary {
  id: string;
  peerName: string | null;
  peerArchetype: string | null;
  eventTitle: string | null;
  wechatId: string | null;
  peerCity: string | null;
  peerBio: string | null;
  peerAgeRange: string | null;
}

export interface PendingRequestSummary {
  id: string;
  peerName: string | null;
  peerArchetype: string | null;
  eventTitle: string | null;
}

/**
 * Fetch all mutual connections for a user.
 * N+1-free: single round-trip with conditional joins for peer resolution.
 */
export async function getUserConnections(userId: string): Promise<ConnectionSummary[]> {
  // Single query that resolves peer identity via CASE expressions.
  // peer_id   = the OTHER user in the connection
  // peer_name = displayName of the peer (via LEFT JOIN users)
  // peer_archetype = archetype of the peer
  // wechat_id = the peer's WeChat ID snapshot from the connection row
  const rows = await db
    .select({
      id: connections.id,
      peerId: sql<string>`
        CASE
          WHEN ${connections.userAId} = ${userId} THEN ${connections.userBId}
          ELSE ${connections.userAId}
        END
      `,
      peerWechatId: sql<string | null>`
        CASE
          WHEN ${connections.userAId} = ${userId} THEN ${connections.userBWechatId}
          ELSE ${connections.userAWechatId}
        END
      `,
      peerName: users.displayName,
      peerArchetype: users.archetype,
      peerCity: users.currentCity,
      peerBio: users.bio,
      peerBirthdate: users.birthdate,
      peerAgeVisibility: users.ageVisibility,
      eventTitle: events.title,
    })
    .from(connections)
    .leftJoin(
      users,
      eq(
        users.id,
        sql<string>`
          CASE
            WHEN ${connections.userAId} = ${userId} THEN ${connections.userBId}
            ELSE ${connections.userAId}
          END
        `
      )
    )
    .leftJoin(events, eq(connections.eventId, events.id))
    .where(
      and(
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
        eq(connections.status, "mutual")
      )
    )
    .orderBy(desc(connections.createdAt));

  return rows.map((row: typeof rows[number]) => ({
    id: row.id,
    peerName: row.peerName ?? null,
    peerArchetype: row.peerArchetype ?? null,
    eventTitle: row.eventTitle ?? null,
    wechatId: row.peerWechatId ?? null,
    peerCity: row.peerCity ?? null,
    // Bio is only returned for mutual (post-event) connection-card viewers.
    peerBio: row.peerBio ?? null,
    // Align with schema default `show_age_range` while keeping privacy-first fallback.
    peerAgeRange: formatAgeRangeBand(row.peerBirthdate, row.peerAgeVisibility ?? "show_age_range"),
  }));
}

/**
 * Fetch pending incoming connection requests for a user.
 * A pending request is a connection where:
 *   - status = 'pending'
 *   - the user is one of the two parties
 *   - the user is NOT the initiator (someone else initiated)
 *
 * N+1-free: single round-trip.
 */
export async function getUserPendingRequests(userId: string): Promise<PendingRequestSummary[]> {
  const rows = await db
    .select({
      id: connections.id,
      peerId: sql<string>`
        CASE
          WHEN ${connections.userAId} = ${userId} THEN ${connections.userBId}
          ELSE ${connections.userAId}
        END
      `,
      peerName: users.displayName,
      peerArchetype: users.archetype,
      eventTitle: events.title,
    })
    .from(connections)
    .leftJoin(
      users,
      eq(
        users.id,
        sql<string>`
          CASE
            WHEN ${connections.userAId} = ${userId} THEN ${connections.userBId}
            ELSE ${connections.userAId}
          END
        `
      )
    )
    .leftJoin(events, eq(connections.eventId, events.id))
    .where(
      and(
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
        eq(connections.status, "pending"),
        sql`${connections.initiatorId} != ${userId}`
      )
    )
    .orderBy(desc(connections.createdAt));

  return rows.map((row: typeof rows[number]) => ({
    id: row.id,
    peerName: row.peerName ?? null,
    peerArchetype: row.peerArchetype ?? null,
    eventTitle: row.eventTitle ?? null,
  }));
}
