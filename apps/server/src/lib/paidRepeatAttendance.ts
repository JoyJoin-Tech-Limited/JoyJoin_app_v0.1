/**
 * Participant-level 30-day paid repeat-attendance.
 *
 * Canonical definition (not second-payment conversion):
 *
 *   eligible attendance = paid access + attended + non-staff/non-bot/non-test/
 *                         non-refunded/non-cancelled
 *   paid access         = completed single-event payment linked by pool id or
 *                             canonical legacy event/blind-box event id
 *                         OR non-refunded event-credit redemption backed by a
 *                             completed event-pack payment
 *                         OR subscription entitlement covering registration
 *                             time, backed by a completed subscription payment
 *   D0                  = MIN(Asia/Shanghai event-start calendar day) over a
 *                         participant's complete eligible-attendance history
 *   repeat              = another eligible attendance whose event day is in
 *                         [D0 + 1 calendar day, D0 + 30 calendar days]
 *   participant rate    = participants in the D0 cohort with >=1 repeat
 *                         / all participants whose D0 is in the cohort window
 *
 * Canonical aggregate shape (the executable SQL below is the authority):
 *
 *   WITH eligible_attendances AS (...),
 *   anchors AS (
 *     SELECT user_id, MIN(event_day) AS d0
 *     FROM eligible_attendances
 *     GROUP BY user_id
 *     HAVING MIN(event_day) BETWEEN :cohort_start AND :cohort_end
 *   )
 *   SELECT COUNT(*) AS eligible_participants,
 *          COUNT(first_repeat_day) AS repeat_participants
 *   FROM (
 *     SELECT a.user_id, MIN(e.event_day) AS first_repeat_day
 *     FROM anchors a
 *     LEFT JOIN eligible_attendances e
 *       ON e.user_id = a.user_id
 *      AND e.event_day > a.d0
 *      AND e.event_day <= a.d0 + 30
 *     GROUP BY a.user_id
 *   ) outcomes;
 *
 * There is deliberately no second-payment join/count: one subscription or one
 * event-pack purchase can pay for both D0 and the repeat attendance.
 *
 * Data honesty / known source limits (2026-10-26 schema review):
 * - `attendance_status='confirmed'|'late'` is the existing commitment/arrival
 *   proxy. `docs/operations/attendance-baseline.md` states that it is captured
 *   pre-event and is not proof of physical arrival. `status='attended'` is also
 *   accepted where present; any `absent` or cancelled row excludes the group/
 *   user attendance. Until ops marks every no-show, this is not a production
 *   physical-attendance claim.
 * - There is no general participant staff table. The SQL excludes the schema-
 *   backed staff signals `users.is_admin` and `events.host_id`. Staff represented
 *   only in `admin_accounts` cannot be linked to a participating user. A governed
 *   staff roster is required before claiming complete staff exclusion.
 * - Canonical event-pack consumption is recoverable through
 *   `event_credit_redemptions`. The legacy fallback that only decrements
 *   `users.event_credits` leaves no per-registration redemption row, so those
 *   historical credit attendances cannot be attributed exactly without a
 *   separately reviewed backfill. No such history is silently invented here.
 *
 * Query/index review:
 * - Existing indexes available to the planner include registration pool/user/
 *   assigned-group indexes, group event/blind-box links (migration 0065),
 *   `payments(user_id)` (0096), and credit redemption registration/user-pool
 *   indexes. All paid-access checks are EXISTS probes, so duplicate payments
 *   cannot multiply participants.
 * - `event_attendance` has only the partial unique
 *   `idx_event_attendance_blind_box_user(blind_box_event_id,user_id)` index;
 *   there is no general `(event_id,user_id)` or standalone `user_id` index.
 *   Before a large production backfill, review EXPLAIN and consider a concurrent
 *   `(event_id,user_id)` index (and subscription time-window indexing if the
 *   plan shows it is needed). No migration is added by this metric task.
 * - The helper requires an explicit complete-history lower bound and a fully
 *   observed cohort (cohortEnd + 30 days <= asOfDay). It makes one aggregate DB
 *   call and never loops over users. Right-censored participants are rejected
 *   rather than silently counted as non-repeaters.
 */

import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { parseEventDate } from "./eventDateTime";

export const PAID_REPEAT_ATTENDANCE_TIME_ZONE = "Asia/Shanghai";
export const PAID_REPEAT_ATTENDANCE_WINDOW_DAYS = 30;

/** Printed by the contract test so reviewers see the definition in test output. */
export const PAID_REPEAT_ATTENDANCE_SQL_DEFINITION = `
30-day paid repeat-attendance (participant-level, no production value implied):
  D0 := MIN((event_start_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date)
        over all eligible paid attendances for the participant.
  repeat := EXISTS another eligible paid attendance e
            WHERE e.event_day > D0 AND e.event_day <= D0 + 30 days.
  rate := COUNT(participants with repeat) / COUNT(participants whose D0 is in cohort).
Eligible paid access includes completed event payment, subscription entitlement,
and non-refunded event-credit redemption; no second event payment is required.
Staff, bots, test pools/sessions, refunded, cancelled, unattended and no-show
attendances are excluded. Empty cohort rate is NULL. D0 and D31 are not repeats;
D1 and D30 are repeats. This is NOT second-payment SQL.
`.trim();

export type PaidAttendanceAccessKind =
  | "single_event_payment"
  | "subscription_entitlement"
  | "event_credit_redemption"
  | "free_or_unpaid";

export type PaidAttendancePaymentState =
  | "completed"
  | "pending"
  | "failed"
  | "refund_pending"
  | "refunded";

export type PaidAttendanceStatus = "pending" | "confirmed" | "late" | "absent";
export type PaidAttendanceLifecycleStatus = "confirmed" | "attended" | "cancelled" | null;

/** Pure fixture/input shape; it is not a new persistence model. */
export interface PaidAttendanceFact {
  attendanceId: string;
  userId: string;
  eventStartAt: Date | string;
  accessKind: PaidAttendanceAccessKind;
  /** State of the purchase backing this access (pack/subscription included). */
  paymentState: PaidAttendancePaymentState;
  attendanceStatus: PaidAttendanceStatus;
  lifecycleStatus: PaidAttendanceLifecycleStatus;
  isStaff?: boolean;
  isBot?: boolean;
  isTestPool?: boolean;
  isTestSession?: boolean;
  /** Optional evidence only; no second/distinct payment id is required. */
  paymentId?: string | null;
}

export type PaidAttendanceExclusion =
  | "staff"
  | "bot"
  | "test_pool"
  | "test_session"
  | "refunded"
  | "not_paid"
  | "unattended";

export interface PaidRepeatAttendanceCohort {
  /** Inclusive YYYY-MM-DD bounds on participants' first eligible D0. */
  cohortStartDay: string;
  cohortEndDay: string;
}

export interface PaidRepeatAttendanceParticipant {
  userId: string;
  anchorDay: string;
  firstRepeatDay: string | null;
  hasRepeat: boolean;
}

export interface PaidRepeatAttendanceRate {
  eligibleParticipants: number;
  repeatParticipants: number;
  /** Null for an empty cohort; zero must never be fabricated for no denominator. */
  rate: number | null;
}

export interface PaidRepeatAttendanceSummary extends PaidRepeatAttendanceRate {
  participants: PaidRepeatAttendanceParticipant[];
}

export interface PaidRepeatAttendanceQueryParams extends PaidRepeatAttendanceCohort {
  /**
   * Inclusive lower bound for first-ever anchoring. It must be on/before the
   * first retained eligible attendance; using a recent lookback would redefine
   * the metric and is therefore rejected when it postdates cohortStartDay.
   */
  historyStartDay: string;
  /** Inclusive observation day; must cover cohortEndDay + 30 calendar days. */
  asOfDay: string;
}

export interface PaidRepeatAttendanceMetric extends PaidRepeatAttendanceRate, PaidRepeatAttendanceQueryParams {}

export interface PaidRepeatAttendanceDatabase {
  execute(query: SQL): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const MS_PER_CALENDAR_DAY = 24 * 60 * 60 * 1000;
const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid event-start timestamp: ${String(value)}`);
  }
  return date;
}

/** Convert an instant to the event's Asia/Shanghai calendar day (YYYY-MM-DD). */
export function toShanghaiCalendarDay(eventStartAt: Date | string): string {
  return parseEventDate(toDate(eventStartAt)).dateStr;
}

function calendarDayToUtcMs(day: string): number {
  if (!CALENDAR_DAY_PATTERN.test(day)) {
    throw new Error(`Invalid calendar day (expected YYYY-MM-DD): ${day}`);
  }
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  if (Number.isNaN(ms) || toUtcCalendarDay(ms) !== day) {
    throw new Error(`Invalid calendar day: ${day}`);
  }
  return ms;
}

function toUtcCalendarDay(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addCalendarDays(day: string, days: number): string {
  return toUtcCalendarDay(calendarDayToUtcMs(day) + days * MS_PER_CALENDAR_DAY);
}

/**
 * Return 1…30 only for another calendar day inside the repeat window.
 * D0, D31 and earlier attendances all return null.
 */
export function getRepeatAttendanceDayOffset(
  anchorEventStartAt: Date | string,
  candidateEventStartAt: Date | string,
): number | null {
  const anchorDay = toShanghaiCalendarDay(anchorEventStartAt);
  const candidateDay = toShanghaiCalendarDay(candidateEventStartAt);
  const offset = Math.round(
    (calendarDayToUtcMs(candidateDay) - calendarDayToUtcMs(anchorDay)) / MS_PER_CALENDAR_DAY,
  );
  return offset >= 1 && offset <= PAID_REPEAT_ATTENDANCE_WINDOW_DAYS ? offset : null;
}

/** Deterministic exclusion authority shared by fixtures and the pure aggregator. */
export function getPaidAttendanceExclusion(fact: PaidAttendanceFact): PaidAttendanceExclusion | null {
  if (fact.isStaff) return "staff";
  if (fact.isBot) return "bot";
  if (fact.isTestPool) return "test_pool";
  if (fact.isTestSession) return "test_session";
  if (fact.paymentState === "refunded") return "refunded";
  if (fact.accessKind === "free_or_unpaid" || fact.paymentState !== "completed") return "not_paid";
  if (fact.lifecycleStatus === "cancelled" || fact.attendanceStatus === "absent") return "unattended";

  // `confirmed` is the user's own RSVP, not an arrival fact. Counting it as
  // attendance inflates the repeat-attendance KPI with people who said they
  // would come, so only operator/check-in written states count here.
  const attended = fact.lifecycleStatus === "attended"
    || fact.attendanceStatus === "late";
  return attended ? null : "unattended";
}

export function isEligiblePaidAttendance(fact: PaidAttendanceFact): boolean {
  return getPaidAttendanceExclusion(fact) === null;
}

/**
 * Pure reference implementation used by boundary fixtures. `facts` must cover
 * complete history through the observation day; filtering it to the cohort
 * before calling would move D0 and invalidate the metric.
 */
export function summarizePaidRepeatAttendance(
  facts: readonly PaidAttendanceFact[],
  cohort: PaidRepeatAttendanceCohort,
): PaidRepeatAttendanceSummary {
  calendarDayToUtcMs(cohort.cohortStartDay);
  calendarDayToUtcMs(cohort.cohortEndDay);
  if (cohort.cohortStartDay > cohort.cohortEndDay) {
    throw new Error("cohortStartDay must be on/before cohortEndDay");
  }

  const factsByUser = new Map<string, Array<{ fact: PaidAttendanceFact; eventDay: string }>>();
  for (const fact of facts) {
    if (!isEligiblePaidAttendance(fact)) continue;
    const rows = factsByUser.get(fact.userId) ?? [];
    rows.push({ fact, eventDay: toShanghaiCalendarDay(fact.eventStartAt) });
    factsByUser.set(fact.userId, rows);
  }

  const participants: PaidRepeatAttendanceParticipant[] = [];
  for (const [userId, userFacts] of factsByUser) {
    userFacts.sort((left, right) => {
      const byDay = left.eventDay.localeCompare(right.eventDay);
      if (byDay !== 0) return byDay;
      const byInstant = toDate(left.fact.eventStartAt).getTime() - toDate(right.fact.eventStartAt).getTime();
      if (byInstant !== 0) return byInstant;
      return left.fact.attendanceId.localeCompare(right.fact.attendanceId);
    });

    const anchor = userFacts[0];
    if (!anchor || anchor.eventDay < cohort.cohortStartDay || anchor.eventDay > cohort.cohortEndDay) {
      continue;
    }

    const repeat = userFacts.find((candidate) => (
      candidate.fact.attendanceId !== anchor.fact.attendanceId
      && getRepeatAttendanceDayOffset(anchor.fact.eventStartAt, candidate.fact.eventStartAt) !== null
    ));
    participants.push({
      userId,
      anchorDay: anchor.eventDay,
      firstRepeatDay: repeat?.eventDay ?? null,
      hasRepeat: repeat !== undefined,
    });
  }

  participants.sort((left, right) => (
    left.anchorDay.localeCompare(right.anchorDay) || left.userId.localeCompare(right.userId)
  ));
  const repeatParticipants = participants.filter((participant) => participant.hasRepeat).length;
  return {
    eligibleParticipants: participants.length,
    repeatParticipants,
    rate: participants.length === 0 ? null : repeatParticipants / participants.length,
    participants,
  };
}

function validateQueryWindow(params: PaidRepeatAttendanceQueryParams): void {
  calendarDayToUtcMs(params.historyStartDay);
  calendarDayToUtcMs(params.cohortStartDay);
  calendarDayToUtcMs(params.cohortEndDay);
  calendarDayToUtcMs(params.asOfDay);

  if (params.historyStartDay > params.cohortStartDay) {
    throw new Error("historyStartDay must be on/before cohortStartDay for first-ever D0");
  }
  if (params.cohortStartDay > params.cohortEndDay) {
    throw new Error("cohortStartDay must be on/before cohortEndDay");
  }
  const fullyObservedDay = addCalendarDays(
    params.cohortEndDay,
    PAID_REPEAT_ATTENDANCE_WINDOW_DAYS,
  );
  if (params.asOfDay < fullyObservedDay) {
    throw new Error(`30-day observation is incomplete until ${fullyObservedDay}`);
  }
}

function buildPaidRepeatAttendanceQuery(params: PaidRepeatAttendanceQueryParams): SQL {
  return sql`
    WITH attendance_candidates AS (
      SELECT
        r.id AS registration_id,
        ea.user_id,
        COALESCE(g.pool_id, bbe.pool_id) AS pool_id,
        r.registered_at,
        COALESCE(g.id, ea.event_id, ea.blind_box_event_id, ea.id) AS group_id,
        ea.event_id,
        ea.blind_box_event_id,
        (
          COALESCE(g.final_date_time, e.date_time, bbe.date_time, p.date_time)
            AT TIME ZONE 'UTC'
            AT TIME ZONE 'Asia/Shanghai'
        )::date AS event_day
      FROM event_attendance ea
      JOIN users u ON u.id = ea.user_id
      LEFT JOIN events e ON e.id = ea.event_id
      LEFT JOIN blind_box_events bbe ON bbe.id = ea.blind_box_event_id
      LEFT JOIN event_pool_groups g
        ON (ea.event_id IS NOT NULL AND g.event_id = ea.event_id)
        OR (ea.blind_box_event_id IS NOT NULL AND g.blind_box_event_id = ea.blind_box_event_id)
      LEFT JOIN event_pool_registrations r
        ON r.assigned_group_id = g.id
       AND r.user_id = ea.user_id
      LEFT JOIN event_pools p ON p.id = COALESCE(g.pool_id, bbe.pool_id)
      WHERE (
          ea.status = 'attended'
          OR ea.attendance_status IN ('confirmed', 'late')
        )
        AND ea.status IS DISTINCT FROM 'cancelled'
        AND ea.attendance_status IS DISTINCT FROM 'absent'
        -- Pool-derived attendance requires its matched/completed registration;
        -- standalone legacy events instead prove paid access by event id below.
        AND (
          g.id IS NULL
          OR (r.id IS NOT NULL AND r.match_status IN ('matched', 'completed'))
        )
        AND (g.id IS NULL OR g.status <> 'cancelled')
        AND (p.id IS NULL OR p.status NOT IN ('cancelled', 'archived'))
        AND p.is_test_pool IS NOT TRUE
        AND (e.id IS NULL OR e.status NOT IN ('cancelled', 'canceled'))
        AND (bbe.id IS NULL OR bbe.status NOT IN ('cancelled', 'canceled'))
        AND u.is_test_bot IS NOT TRUE
        AND u.is_admin IS NOT TRUE
        AND (e.host_id IS NULL OR e.host_id <> ea.user_id)
        AND NOT EXISTS (
          SELECT 1
          FROM social_icebreaker_sessions test_session
          WHERE test_session.icebreaker_session_id IN (g.id, ea.event_id, ea.blind_box_event_id)
            AND test_session.is_test_session = true
        )
        AND NOT EXISTS (
          SELECT 1
          FROM social_icebreaker_sessions participant_session
          JOIN social_icebreaker_participants test_participant
            ON test_participant.social_session_id = participant_session.id
          WHERE participant_session.icebreaker_session_id IN (g.id, ea.event_id, ea.blind_box_event_id)
            AND test_participant.user_id = ea.user_id
            AND test_participant.is_test_bot = true
        )
    ), eligible_attendances AS (
      SELECT c.registration_id, c.user_id, c.group_id, c.event_day
      FROM attendance_candidates c
      WHERE c.event_day >= ${params.historyStartDay}::date
        AND c.event_day <= ${params.asOfDay}::date
        -- Any absent/cancelled sibling row wins over a separate confirmed row.
        AND NOT EXISTS (
          SELECT 1
          FROM event_attendance excluded_attendance
          WHERE excluded_attendance.user_id = c.user_id
            AND (
              excluded_attendance.event_id = c.event_id
              OR excluded_attendance.blind_box_event_id = c.blind_box_event_id
            )
            AND (
              excluded_attendance.status = 'cancelled'
              OR excluded_attendance.attendance_status = 'absent'
            )
        )
        -- Completed only: pending/failed/refund_pending/refunded are excluded.
        -- These are paid-access probes, NOT a count of second payments.
        AND (
          EXISTS (
            SELECT 1
            FROM payments direct_payment
            WHERE direct_payment.user_id = c.user_id
              AND direct_payment.payment_type = 'event'
              AND direct_payment.status = 'completed'
              AND (
                direct_payment.related_id = c.pool_id
                OR direct_payment.related_id = c.event_id
                OR direct_payment.related_id = c.blind_box_event_id
              )
          )
          OR EXISTS (
            SELECT 1
            FROM event_credit_redemptions credit_redemption
            JOIN event_credit_grants credit_grant
              ON credit_grant.id = credit_redemption.grant_id
             AND credit_grant.refunded_at IS NULL
            JOIN payments pack_payment
              ON pack_payment.id = credit_grant.payment_id
             AND pack_payment.payment_type = 'event_pack'
             AND pack_payment.status = 'completed'
            WHERE credit_redemption.registration_id = c.registration_id
              AND credit_redemption.user_id = c.user_id
              AND credit_redemption.pool_id = c.pool_id
          )
          OR EXISTS (
            SELECT 1
            FROM subscriptions subscription
            JOIN payments subscription_payment
              ON subscription_payment.id = subscription.payment_id
             AND subscription_payment.payment_type IN ('subscription', 'event_bundle')
             AND subscription_payment.status = 'completed'
            WHERE subscription.user_id = c.user_id
              AND subscription.start_date <= c.registered_at
              AND subscription.end_date > c.registered_at
          )
        )
    ), anchors AS (
      SELECT eligible.user_id, MIN(eligible.event_day)::date AS d0
      FROM eligible_attendances eligible
      GROUP BY eligible.user_id
      HAVING MIN(eligible.event_day) >= ${params.cohortStartDay}::date
         AND MIN(eligible.event_day) <= ${params.cohortEndDay}::date
    ), participant_outcomes AS (
      SELECT
        a.user_id,
        a.d0,
        MIN(e.event_day)::date AS first_repeat_day
      FROM anchors a
      LEFT JOIN eligible_attendances e
        ON e.user_id = a.user_id
       AND e.event_day > a.d0
       AND e.event_day <= a.d0 + 30
      GROUP BY a.user_id, a.d0
    )
    SELECT
      COUNT(*)::int AS eligible_participants,
      COUNT(first_repeat_day)::int AS repeat_participants,
      CASE
        WHEN COUNT(*) = 0 THEN NULL
        ELSE COUNT(first_repeat_day)::numeric / COUNT(*)::numeric
      END AS rate
    FROM participant_outcomes
  `;
}

function toNonnegativeInteger(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function toRate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Execute the canonical participant-level aggregate in one DB round-trip.
 * No route/admin UI is attached; callers must not present the result as a
 * physical-attendance or content-uplift claim without the data caveats above.
 */
export async function getPaidRepeatAttendanceMetric(
  params: PaidRepeatAttendanceQueryParams,
  database: PaidRepeatAttendanceDatabase = db as unknown as PaidRepeatAttendanceDatabase,
): Promise<PaidRepeatAttendanceMetric> {
  validateQueryWindow(params);
  const result = await database.execute(buildPaidRepeatAttendanceQuery(params));
  const row = result.rows[0] ?? {};
  const eligibleParticipants = toNonnegativeInteger(row.eligible_participants);
  const repeatParticipants = toNonnegativeInteger(row.repeat_participants);
  return {
    ...params,
    eligibleParticipants,
    repeatParticipants,
    rate: eligibleParticipants === 0 ? null : toRate(row.rate),
  };
}
