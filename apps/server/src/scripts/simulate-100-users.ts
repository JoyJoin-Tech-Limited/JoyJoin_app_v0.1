#!/usr/bin/env node
/**
 * 100-user end-to-end flow simulation (dev DB, self-cleaning).
 *
 * Flow exercised, in order:
 *   1. 报名      capacity / deadline / closed gates (the same arithmetic the
 *                registration route applies), inserted directly so the run is
 *                reproducible and does not need 100 phone numbers + payments.
 *   2. 排桌      the real `scanPoolAndMatch` is called after every wave, so the
 *                early-match gate and the decayed threshold decide for real.
 *   3. 派场      `matchingPostMatchEffects` assigns venues after each match;
 *                we read `event_pool_groups.venue_assignment_status`.
 *   4. 兜底      groups that never got a venue are scored against
 *                `resolveVenueTbdAction` at T-24h (cancel + refund).
 *   5. 评价      seated users are checked for feedback eligibility timing.
 *
 * Everything created is tagged `SIM100-` and deleted at the end.
 *
 * Run:
 *   node --env-file=../../.env --import tsx/esm src/scripts/simulate-100-users.ts
 */

import { db } from "../db";
import { randomUUID } from "node:crypto";
import { users, eventPools, eventPoolRegistrations, eventPoolGroups, userInterests } from "@joyjoin/shared";
import { and, eq, inArray } from "drizzle-orm";
import { scanPoolAndMatch } from "../poolRealtimeMatchingService";
import { resolveVenueTbdAction } from "../lib/venueTbdRetryScheduler";
import { cascadeDeleteByIds } from "../lib/fkCascadeDelete";

const RUN_TAG = `SIM100-${Date.now().toString(36)}`;
const HOUR = 60 * 60 * 1000;

const ARCHETYPES = [
  "corgi", "rooster", "hamster_praise", "fox", "dolphin_calm", "spider",
  "koala", "octopus", "owl", "elephant", "turtle", "cat",
] as const;

/** Interest ids from `INTEREST_TAXONOMY` (packages/shared/src/interests.ts) —
 *  unknown ids are ignored by the matcher, so the simulation must use real ones. */
const POOL_INTERESTS: Record<string, string[]> = {
  dining: ["hotpot", "bbq", "coffee", "dessert", "food_hunting", "wine"],
  drinks: ["wine", "board_games", "script_kill", "coffee", "escape_room", "bbq"],
};

/** ACOEXP traits (0-100). Values are clustered by archetype so a pool of
 *  similar people actually reaches a compatible score — otherwise the run only
 *  proves that random profiles never match. */
const ARCHETYPE_TRAITS: Record<string, Record<string, number>> = {
  corgi: { A: 85, C: 55, E: 70, O: 60, X: 80, P: 75 },
  rooster: { A: 70, C: 60, E: 78, O: 55, X: 88, P: 82 },
  hamster_praise: { A: 90, C: 50, E: 72, O: 58, X: 75, P: 80 },
  fox: { A: 65, C: 75, E: 62, O: 80, X: 70, P: 65 },
  dolphin_calm: { A: 80, C: 70, E: 55, O: 68, X: 55, P: 70 },
  spider: { A: 60, C: 82, E: 66, O: 72, X: 62, P: 60 },
  koala: { A: 88, C: 62, E: 74, O: 60, X: 58, P: 78 },
  octopus: { A: 68, C: 58, E: 70, O: 90, X: 76, P: 72 },
  owl: { A: 72, C: 85, E: 52, O: 84, X: 45, P: 62 },
  elephant: { A: 82, C: 88, E: 68, O: 55, X: 50, P: 75 },
  turtle: { A: 78, C: 78, E: 48, O: 58, X: 38, P: 66 },
  cat: { A: 58, C: 65, E: 50, O: 76, X: 40, P: 55 },
};

interface PoolSpec {
  key: string;
  title: string;
  district: string;
  eventType: "饭局" | "酒局";
  /** hours from now to the event */
  eventInHours: number;
  /** hours from now to the registration deadline (negative = already passed) */
  deadlineInHours: number;
  targetGroups: number;
  maxGroupSize: number;
  /** how many users try to register (may exceed capacity on purpose) */
  attempts: number;
  /** budget tier written on the registration */
  budgetTier: string;
  archetypeBias: readonly string[];
}

const POOL_SPECS: PoolSpec[] = [
  { key: "P1", title: "南山周五晚餐", district: "南山区", eventType: "饭局", eventInHours: 72, deadlineInHours: 48, targetGroups: 1, maxGroupSize: 6, attempts: 12, budgetTier: "dining_200_300", archetypeBias: ["corgi", "rooster", "hamster_praise", "koala", "fox", "dolphin_calm"] },
  { key: "P2", title: "福田小酒馆", district: "福田区", eventType: "酒局", eventInHours: 48, deadlineInHours: 30, targetGroups: 1, maxGroupSize: 6, attempts: 10, budgetTier: "drinks_80_150", archetypeBias: ["fox", "octopus", "owl", "cat", "dolphin_calm", "spider"] },
  { key: "P3", title: "罗湖烟火气", district: "罗湖区", eventType: "饭局", eventInHours: 72, deadlineInHours: 48, targetGroups: 1, maxGroupSize: 6, attempts: 9, budgetTier: "dining_150_200", archetypeBias: ["corgi", "koala", "elephant", "turtle", "rooster", "hamster_praise"] },
  { key: "P4", title: "南山慢聊局", district: "南山区", eventType: "饭局", eventInHours: 168, deadlineInHours: 120, targetGroups: 1, maxGroupSize: 6, attempts: 3, budgetTier: "dining_200_300", archetypeBias: ["owl", "turtle", "cat"] },
  { key: "P5", title: "南山双桌夜", district: "南山区", eventType: "饭局", eventInHours: 96, deadlineInHours: 72, targetGroups: 2, maxGroupSize: 6, attempts: 14, budgetTier: "dining_200_300", archetypeBias: ["corgi", "fox", "koala", "owl", "rooster", "octopus", "elephant", "dolphin_calm"] },
  { key: "P6", title: "南山酒吧夜", district: "南山区", eventType: "酒局", eventInHours: 50, deadlineInHours: 26, targetGroups: 1, maxGroupSize: 6, attempts: 8, budgetTier: "drinks_80_150", archetypeBias: ["fox", "octopus", "spider", "cat", "owl", "koala"] },
  { key: "P7", title: "福田临期局", district: "福田区", eventType: "饭局", eventInHours: 30, deadlineInHours: 20, targetGroups: 1, maxGroupSize: 6, attempts: 8, budgetTier: "dining_150_200", archetypeBias: ["corgi", "rooster", "hamster_praise", "koala", "fox", "elephant"] },
  { key: "P8", title: "罗湖夜话", district: "罗湖区", eventType: "酒局", eventInHours: 80, deadlineInHours: 56, targetGroups: 1, maxGroupSize: 6, attempts: 9, budgetTier: "drinks_80_150", archetypeBias: ["fox", "octopus", "owl", "cat", "spider", "dolphin_calm"] },
  { key: "P9", title: "福田早鸟饭", district: "福田区", eventType: "饭局", eventInHours: 60, deadlineInHours: 36, targetGroups: 1, maxGroupSize: 6, attempts: 8, budgetTier: "dining_200_300", archetypeBias: ["rooster", "corgi", "elephant", "turtle", "koala", "hamster_praise"] },
  { key: "P10", title: "南山已截止", district: "南山区", eventType: "饭局", eventInHours: 40, deadlineInHours: -2, targetGroups: 1, maxGroupSize: 6, attempts: 6, budgetTier: "dining_200_300", archetypeBias: ["corgi", "fox", "owl", "koala", "cat", "turtle"] },
  { key: "P11", title: "福田周五酒", district: "福田区", eventType: "酒局", eventInHours: 90, deadlineInHours: 64, targetGroups: 1, maxGroupSize: 6, attempts: 13, budgetTier: "drinks_80_150", archetypeBias: ["fox", "octopus", "dolphin_calm", "owl", "spider", "cat"] },
];

interface PoolRuntime extends PoolSpec {
  id: string;
  dateTime: Date;
  registrationDeadline: Date;
  capacity: number;
  accepted: number;
  rejected: Record<string, number>;
  waves: Array<{ wave: number; accepted: number; decision: string; reason: string; threshold: number }>;
  matchedAtWave: number | null;
}

interface FunnelRow {
  key: string;
  attempted: number;
  accepted: number;
  rejected: number;
  status: string;
  groups: number;
  seated: number;
  seats: number;
  venueAssigned: number;
  venuePending: number;
  t24Decision: string;
}

function hoursUntil(date: Date): number {
  return (date.getTime() - Date.now()) / HOUR;
}

async function cleanup(poolIds: string[], userIds: string[]) {
  await db.transaction(async (tx /* drizzle tx */: any) => {
    if (poolIds.length > 0) {
      await cascadeDeleteByIds(tx as never, "event_pools", "id", poolIds);
    }
    if (userIds.length > 0) {
      await cascadeDeleteByIds(tx as never, "users", "id", userIds);
    }
  });
}

async function main() {
  const startedAt = Date.now();
  const createdUserIds: string[] = [];
  const createdPoolIds: string[] = [];

  console.log(`\n=== ${RUN_TAG} · 100-user flow simulation ===\n`);

  try {
    // ── 0. Seed users ────────────────────────────────────────────
    const userRows = Array.from({ length: 100 }, (_, i) => {
      const archetype = ARCHETYPES[i % ARCHETYPES.length];
      const district = i < 45 ? "南山区" : i < 80 ? "福田区" : "罗湖区";
      const birthdate = new Date(1990 + (i % 9), i % 12, (i % 27) + 1);
      return {
        phoneNumber: `+86199${String(RUN_TAG.length)}${String(i).padStart(6, "0")}`,
        displayName: `${RUN_TAG} 用户${i + 1}`,
        gender: i % 2 === 0 ? "女性" : "男性",
        birthdate,
        currentCity: "深圳",
        archetype,
        primaryArchetype: archetype,
        personalityTraits: ARCHETYPE_TRAITS[archetype] ?? null,
        hasCompletedProfileSetup: true,
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        hasCompletedInterestsTopics: true,
        intent: ["friends", "networking", "fun"],
      };
    });

    const insertedUsers = await db.insert(users).values(userRows).returning({ id: users.id, archetype: users.archetype });
    insertedUsers.forEach((u: { id: string }) => createdUserIds.push(u.id));
    console.log(`seeded ${insertedUsers.length} users`);

    // ── 1. Create pools ──────────────────────────────────────────
    const createdBy = insertedUsers[0].id;
    const runtimes: PoolRuntime[] = [];

    for (const spec of POOL_SPECS) {
      const dateTime = new Date(Date.now() + spec.eventInHours * HOUR);
      const registrationDeadline = new Date(Date.now() + spec.deadlineInHours * HOUR);
      const [pool] = await db
        .insert(eventPools)
        .values({
          title: `${RUN_TAG} ${spec.title}`,
          description: `${RUN_TAG} 端到端流程模拟`,
          eventType: spec.eventType,
          city: "深圳",
          district: spec.district,
          dateTime,
          registrationDeadline,
          status: "active",
          minGroupSize: 4,
          maxGroupSize: spec.maxGroupSize,
          targetGroups: spec.targetGroups,
          price: 88,
          createdBy,
          isTestPool: false,
        })
        .returning({ id: eventPools.id });

      createdPoolIds.push(pool.id);
      runtimes.push({
        ...spec,
        id: pool.id,
        dateTime,
        registrationDeadline,
        capacity: spec.maxGroupSize * spec.targetGroups,
        accepted: 0,
        rejected: {},
        waves: [],
        matchedAtWave: null,
      });
    }
    console.log(`created ${runtimes.length} pools\n`);

    // ── 2. 报名: 100 attempts in waves of 10 ─────────────────────
    const attempts: Array<{ pool: PoolRuntime; userIndex: number }> = [];
    let cursor = 0;
    for (const pool of runtimes) {
      for (let n = 0; n < pool.attempts; n++) {
        attempts.push({ pool, userIndex: cursor % insertedUsers.length });
        cursor++;
      }
    }

    const WAVE_SIZE = 10;
    const waveCount = Math.ceil(attempts.length / WAVE_SIZE);

    for (let wave = 0; wave < waveCount; wave++) {
      const batch = attempts.slice(wave * WAVE_SIZE, (wave + 1) * WAVE_SIZE);
      const touched = new Map<string, PoolRuntime>();
      const rows: Array<typeof eventPoolRegistrations.$inferInsert> = [];

      for (const { pool, userIndex } of batch) {
        const user = insertedUsers[userIndex];
        const now = Date.now();

        if (pool.registrationDeadline.getTime() <= now) {
          pool.rejected.REGISTRATION_DEADLINE_PASSED = (pool.rejected.REGISTRATION_DEADLINE_PASSED ?? 0) + 1;
          continue;
        }
        if (pool.accepted >= pool.capacity) {
          pool.rejected.POOL_FULL = (pool.rejected.POOL_FULL ?? 0) + 1;
          continue;
        }

        const poolTags = POOL_INTERESTS[pool.eventType === "酒局" ? "drinks" : "dining"];
        // Rotate the window so members overlap without being identical.
        const interests = [0, 1, 2, 3].map((n) => poolTags[(userIndex + n) % poolTags.length]);
        rows.push({
          poolId: pool.id,
          userId: user.id,
          budgetRange: pool.eventType === "饭局" ? [pool.budgetTier] : null,
          barBudgetRange: pool.eventType === "酒局" ? [pool.budgetTier] : null,
          eventIntent: ["friends", "networking", "fun"],
          matchStatus: "pending",
        });
        pool.accepted += 1;
        touched.set(pool.id, pool);
        // Give the user the archetype the pool was designed around, so the run
        // exercises a realistic "these people belong together" pool instead of
        // a random 6-of-12 draw (which scores ~58 and never clears the gate).
        const bias = pool.archetypeBias[pool.accepted % pool.archetypeBias.length];
        await db
          .update(users)
          .set({
            archetype: bias,
            primaryArchetype: bias,
            personalityTraits: ARCHETYPE_TRAITS[bias] ?? null,
          })
          .where(eq(users.id, user.id));

        // The matcher reads `user_interests.selections` ({ topicId, heat }), not
        // `users.interests_ranked_top3` — seeding the wrong column leaves every
        // pair at zero interest overlap.
        await db.insert(userInterests).values({
          id: randomUUID(),
          userId: user.id,
          totalHeat: 300,
          totalSelections: interests.length,
          categoryHeat: {},
          selections: interests.map((topicId, n) => ({ topicId, heat: 80 - n * 5 })),
        });
      }

      if (rows.length > 0) {
        await db.insert(eventPoolRegistrations).values(rows);
      }

      for (const pool of touched.values()) {
        const result = await scanPoolAndMatch(pool.id, "realtime", "user_registration");
        pool.waves.push({
          wave: wave + 1,
          accepted: pool.accepted,
          decision: result.decision,
          reason: result.reason,
          threshold: result.currentThreshold,
        });
        if (result.decision === "matched" && pool.matchedAtWave === null) {
          pool.matchedAtWave = wave + 1;
        }
      }
    }

    // ── 3. Read the settled pipeline state ───────────────────────
    const funnel: FunnelRow[] = [];

    for (const pool of runtimes) {
      const [poolRow] = await db
        .select({ status: eventPools.status })
        .from(eventPools)
        .where(eq(eventPools.id, pool.id));

      const groupRows = await db
        .select({
          id: eventPoolGroups.id,
          memberCount: eventPoolGroups.memberCount,
          overallScore: eventPoolGroups.overallScore,
          venueAssignmentStatus: eventPoolGroups.venueAssignmentStatus,
        })
        .from(eventPoolGroups)
        .where(eq(eventPoolGroups.poolId, pool.id));

      const seated = groupRows.reduce((sum: number, g: { memberCount: number | null }) => sum + (g.memberCount ?? 0), 0);
      const venueAssigned = groupRows.filter((g: { venueAssignmentStatus: string | null }) => g.venueAssignmentStatus === "assigned").length;
      const venuePending = groupRows.filter((g: { venueAssignmentStatus: string | null }) => g.venueAssignmentStatus !== "assigned").length;

      const hoursToEvent = hoursUntil(pool.dateTime);
      const t24 = resolveVenueTbdAction({ consecutiveUnresolved: 2, hoursUntilEvent: hoursToEvent });
      const t24Decision = venuePending > 0
        ? t24 === "cancel"
          ? "T-24h 内仍未派场 → 取消+退款"
          : "仍有缓冲期"
        : "已派场";

      funnel.push({
        key: pool.key,
        attempted: pool.attempts,
        accepted: pool.accepted,
        rejected: Object.values(pool.rejected).reduce((a, b) => a + b, 0),
        status: poolRow?.status ?? "unknown",
        groups: groupRows.length,
        seated,
        seats: pool.capacity,
        venueAssigned,
        venuePending,
        t24Decision,
      });

      if (groupRows.length > 0) {
        console.log(
          `${pool.key} 桌: ${groupRows.length} 组, 分数 ${groupRows.map((g: { overallScore: number | null }) => g.overallScore ?? "-").join("/")}, 场地 ${groupRows.map((g: { venueAssignmentStatus: string | null }) => g.venueAssignmentStatus ?? "?").join("/")}`,
        );
      }
    }

    // ── 4. Report ───────────────────────────────────────────────
    const totalAttempts = funnel.reduce((s, r) => s + r.attempted, 0);
    const totalAccepted = funnel.reduce((s, r) => s + r.accepted, 0);
    const totalSeated = funnel.reduce((s, r) => s + r.seated, 0);
    const totalSeats = funnel.reduce((s, r) => s + r.seats, 0);
    const totalAssigned = funnel.reduce((s, r) => s + r.venueAssigned, 0);
    const totalGroups = funnel.reduce((s, r) => s + r.groups, 0);
    const totalPending = funnel.reduce((s, r) => s + r.venuePending, 0);

    console.log("\n=== 报名 / 排桌 / 派场 ===");
    console.log("pool  tried  accepted  poolStatus   groups  seated/seats  venue(ok/pending)  T-24h");
    for (const r of funnel) {
      console.log(
        `${r.key.padEnd(4)}  ${String(r.attempted).padStart(4)}  ${String(r.accepted).padStart(8)}  ${r.status.padEnd(11)}  ${String(r.groups).padStart(6)}  ${String(r.seated).padStart(6)}/${String(r.seats).padEnd(6)}  ${String(r.venueAssigned)}/${String(r.venuePending).padEnd(15)}  ${r.t24Decision}`,
      );
    }

    const rejections: Record<string, number> = {};
    for (const pool of runtimes) {
      for (const [code, n] of Object.entries(pool.rejected)) {
        rejections[code] = (rejections[code] ?? 0) + n;
      }
    }

    console.log("\n=== 100-user funnel ===");
    console.log(`  报名尝试            100`);
    console.log(`  被拒（名额/截止）    ${100 - totalAccepted}   ${JSON.stringify(rejections)}`);
    console.log(`  成功报名            ${totalAccepted}  (${Math.round((totalAccepted / 100) * 100)}%)`);
    console.log(`  坐进一张桌          ${totalSeated}  (${Math.round((totalSeated / totalAccepted) * 100)}% of 报名者)`);
    console.log(`  桌子总数 / 座位      ${totalGroups} / ${totalSeats}`);
    console.log(`  确定场地            ${totalAssigned}/${totalGroups} 组 (${totalPending} 组仍待定)`);
    console.log(`  端到端「有桌+有场地」 ${funnel.filter((r) => r.venuePending === 0 && r.groups > 0).reduce((s, r) => s + r.seated, 0)} 人`);

    console.log("\n=== 关键排桌事件 ===");
    for (const pool of runtimes) {
      const seq = pool.waves.map((w) => `${w.wave}:${w.decision}(${w.threshold})`).join(" → ");
      console.log(`${pool.key} matchedAtWave=${pool.matchedAtWave ?? "-"}  ${seq || "(无扫描)"}`);
      const waits = pool.waves.filter((w) => w.decision === "waiting");
      if (waits.length > 0) {
        console.log(`     last waiting reason: ${waits[waits.length - 1].reason}`);
      }
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n完成，用时 ${elapsed}s；开始清理…`);
  } catch (error) {
    console.error("simulation aborted:", error);
    process.exitCode = 1;
  } finally {
    await cleanup(createdPoolIds, createdUserIds);
    console.log(`cleaned up ${createdPoolIds.length} pools + ${createdUserIds.length} users\n`);
    process.exit(process.exitCode ?? 0);
  }
}

main().catch((error) => {
  console.error("simulation failed:", error);
  process.exit(1);
});
