/**
 * Connections Repository — N+1-free bulk queries for user connections
 *
 * Why a dedicated repository?
 *   - The admin route (adminUsers.ts) does raw inline queries.
 *   - The Connections Predictive Shell needs a reusable, testable data layer.
 *   - Following the repository pattern: isolated DB access, no logic in routes.
 */

import { and, eq, or, desc, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { connections, users, events, eventFeedback } from "@shared/schema";
import { formatAgeRangeBand } from "@shared/utils";
import { POSITIVE_IMPRESSION_TAG_PRESETS } from "@shared/api";

export interface ConnectionSummary {
  id: string;
  peerName: string | null;
  peerArchetype: string | null;
  eventTitle: string | null;
  wechatId: string | null;
  peerCity: string | null;
  peerBio: string | null;
  peerAgeRange: string | null;
  /**
   * Top 1–2 positive preset impression tags the peer gave this user in the
   * event-feedback wrapup step (印象标签回流, 2026-10-16 spec #18). null when
   * the peer left no tags — the connections tab renders nothing.
   */
  peerImpressionTags: string[] | null;
}

export interface PendingRequestSummary {
  id: string;
  peerName: string | null;
  peerArchetype: string | null;
  eventTitle: string | null;
}

const CONNECTIONS_QUERY_LIMIT = 200;
const PENDING_REQUESTS_QUERY_LIMIT = 50;

/** Max impression tags surfaced per connection (spec: Top 1–2). */
const MAX_PEER_IMPRESSION_TAGS = 2;

/**
 * Raw feedback row shape consumed by aggregatePeerImpressionTags. Mirrors the
 * event_feedback.attendee_traits jsonb:
 *   { [attendeeUserId]: { displayName, tags: string[], ... } }
 */
export interface PeerImpressionFeedbackRow {
  giverId: string;
  attendeeTraits: unknown;
}

/**
 * Aggregate the positive preset impression tags a set of peers gave ONE user
 * (印象标签回流, 2026-10-16 premium-uplift spec #18).
 *
 * Read-side only aggregation over event_feedback.attendee_traits:
 *   - keeps only tags addressed to `targetUserId` (the jsonb key)
 *   - keeps only POSITIVE_IMPRESSION_TAG_PRESETS members — the 悄悄话 note and
 *     any crafted non-preset strings never surface
 *   - ranks by frequency desc, tie-breaks by preset order (deterministic)
 *   - returns Top 1–2 per giver; givers with no valid tags are absent
 *
 * Exported as a pure function for unit tests (no DB).
 */
export function aggregatePeerImpressionTags(
  rows: PeerImpressionFeedbackRow[],
  targetUserId: string,
): Map<string, string[]> {
  const presetOrder = new Map<string, number>(
    POSITIVE_IMPRESSION_TAG_PRESETS.map((tag, index) => [tag, index] as const),
  );
  // giverId -> (tag -> count)
  const countsByGiver = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const traits = row.attendeeTraits;
    if (!traits || typeof traits !== "object") continue;
    const entry = (traits as Record<string, { tags?: unknown }>)[targetUserId];
    if (!entry || !Array.isArray(entry.tags)) continue;
    for (const tag of entry.tags) {
      if (typeof tag !== "string") continue;
      const order = presetOrder.get(tag);
      if (order === undefined) continue;
      let counts = countsByGiver.get(row.giverId);
      if (!counts) {
        counts = new Map<string, number>();
        countsByGiver.set(row.giverId, counts);
      }
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const result = new Map<string, string[]>();
  for (const [giverId, counts] of countsByGiver) {
    const ranked = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]; // frequency desc
      // deterministic tie-break: preset order asc
      return (presetOrder.get(a[0]) ?? 0) - (presetOrder.get(b[0]) ?? 0);
    });
    const top = ranked.slice(0, MAX_PEER_IMPRESSION_TAGS).map(([tag]) => tag);
    if (top.length > 0) result.set(giverId, top);
  }
  return result;
}

/**
 * Fetch mutual connections for a user, capped for shell performance.
 * N+1-free: one round-trip for connections (peer identity via conditional
 * joins) plus ONE batched round-trip for the peer-given impression tags
 * (印象标签回流), regardless of connection count.
 */
export async function getUserConnections(userId: string): Promise<ConnectionSummary[]> {
  // Single query that resolves peer identity via CASE expressions.
  // peer_id   = the OTHER user in the connection
  // peer_name = displayName of the peer (via LEFT JOIN users)
  // peer_archetype = archetype of the peer
  // wechat_id = the peer's WeChat ID snapshot from the connection row, with a
  //   COALESCE fallback to the peer's live value (2026-10-16, spec
  //   docs/design/wechat-id-collection-spec-20261016.md §5) — an ID set AFTER
  //   the mutual flip (revealed-page remedy card) otherwise stays invisible
  //   here forever. Set-once semantics mean the fallback only ever upgrades
  //   null → value; it can never change or revoke a shared value.
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
    .orderBy(desc(connections.createdAt))
    .limit(CONNECTIONS_QUERY_LIMIT);

  // 印象标签回流 (2026-10-16 spec #18): ONE batched query for the positive
  // preset tags each peer gave THIS user in event feedback. The
  // `attendee_traits ? userId` jsonb key-existence filter keeps the row set
  // minimal; frequency ranking + preset filtering live in the pure helper.
  // Bare sql<string> select fields surface as `unknown` under this drizzle
  // version (the existing map below only ever applies `?? null` to them) —
  // the CASE expression always yields a user id, so the cast is sound.
  const peerIdSet = new Set<string>();
  for (const row of rows) {
    peerIdSet.add(row.peerId as string);
  }
  const peerIds = [...peerIdSet];
  const impressionRows: PeerImpressionFeedbackRow[] = peerIds.length === 0
    ? []
    : await db
        .select({
          giverId: eventFeedback.userId,
          attendeeTraits: eventFeedback.attendeeTraits,
        })
        .from(eventFeedback)
        .where(
          and(
            inArray(eventFeedback.userId, peerIds),
            sql`${eventFeedback.attendeeTraits} ? ${userId}`
          )
        );
  const impressionTagsByPeer = aggregatePeerImpressionTags(impressionRows, userId);

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
    peerImpressionTags: impressionTagsByPeer.get(row.peerId) ?? null,
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
    .orderBy(desc(connections.createdAt))
    .limit(PENDING_REQUESTS_QUERY_LIMIT);

  return rows.map((row: typeof rows[number]) => ({
    id: row.id,
    peerName: row.peerName ?? null,
    peerArchetype: row.peerArchetype ?? null,
    eventTitle: row.eventTitle ?? null,
  }));
}
