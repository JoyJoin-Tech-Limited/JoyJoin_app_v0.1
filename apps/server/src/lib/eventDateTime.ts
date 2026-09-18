/**
 * Canonical event date/time handling for JoyJoin.
 *
 * `event_pools.date_time`, `blind_box_events.date_time` and `events.date_time` are
 * `timestamp without time zone` columns. All current writers persist through Drizzle
 * 0.39.1 `PgTimestamp.mapToDriverValue` (`value.toISOString()`), so PostgreSQL receives
 * a `Z`-suffixed ISO string, casts it into `timestamp without time zone` and drops the
 * zone suffix unchanged. The stored value is therefore a **true UTC wall clock**:
 *
 *   local 19:30 (UTC+8)  ->  instant 11:30Z  ->  stored `11:30`
 *
 * On read, Drizzle reconstructs the instant via `mapFromDriverValue`
 * (`new Date(value + "+0000")`), so consumers receive a true UTC `Date`.
 *
 * Business-local (UTC+8, `Asia/Shanghai` / `Asia/Hong_Kong`) calendar fields must
 * therefore be derived by shifting the instant by +8h — never by reading the host's
 * ambient timezone or the raw stored `HH:MM` substring.
 *
 * Everything here is pure and timezone-independent: no `Date#getHours()`-style local
 * getters and no `Intl`/ICU dependency, so output is identical regardless of the
 * server process's `TZ`.
 */

/**
 * Business timezone offset. `Asia/Shanghai` and `Asia/Hong_Kong` have both been
 * fixed at UTC+8 with no daylight-saving transitions since 1991, so a constant
 * offset is exact for every supported event date.
 */
export const BUSINESS_TIMEZONE_OFFSET_MINUTES = 8 * 60;

const MS_PER_MINUTE = 60_000;

export interface EventDateParts {
  /** Business-local calendar date, `YYYY-MM-DD`. */
  dateStr: string;
  /** Business-local wall-clock time, `HH:MM`. */
  timeStr: string;
  /** Business-local weekday, 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
}

/**
 * Shift an instant to a `Date` whose **UTC** getters read as the business-local wall
 * clock. The result is a carrier for UTC getters only — do not treat it as an instant.
 */
export function toBusinessLocalWallClock(instant: Date): Date {
  return new Date(instant.getTime() + BUSINESS_TIMEZONE_OFFSET_MINUTES * MS_PER_MINUTE);
}

/**
 * Inverse of {@link toBusinessLocalWallClock}: convert a business-local wall clock
 * (a `Date` whose UTC getters hold the local fields) back to a true UTC instant.
 */
export function fromBusinessLocalWallClock(wallClock: Date): Date {
  return new Date(wallClock.getTime() - BUSINESS_TIMEZONE_OFFSET_MINUTES * MS_PER_MINUTE);
}

/**
 * Parse an event `Date` (a true UTC instant coming from the DB or a writer) into the
 * business-local date, wall-clock time and weekday used by venue slot matching.
 */
export function parseEventDate(eventDateTime: Date): EventDateParts {
  const local = toBusinessLocalWallClock(eventDateTime);

  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes();

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return { dateStr, timeStr, dayOfWeek: local.getUTCDay() };
}
