import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../..');

function readRepoFile(relativePath: string): string {
  try {
    return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
  } catch {
    return '';
  }
}

describe('single-test group finalization (单人调试局全链路)', () => {
  const serviceSource = readRepoFile('apps/server/src/services/singleTestService.ts');
  const matchingTestSource = readRepoFile('apps/server/src/services/matchingTestService.ts');
  const userEventPoolsSource = readRepoFile('apps/server/src/routes/domains/userEventPools.ts');

  it('creates events + eventAttendance + blind_box_events records on session start', () => {
    // Mirrors poolMatchingService steps 2.5-2.7 so squad-unboxing 确认出席
    // and the event-detail redirect work in single-test mode.
    expect(serviceSource).toContain('.insert(events).values({');
    expect(serviceSource).toContain('.insert(eventAttendance).values({');
    expect(serviceSource).toContain('.insert(blindBoxEvents).values({');
    expect(serviceSource).toContain('blindBoxEventId: blindBoxEventRecord?.id ?? null');
    expect(serviceSource).toContain('eventId: eventRecord.id');
  });

  it('refreshes the reused pool dateTime so the brief is never past-dated', () => {
    expect(serviceSource).toContain('nextDinnerDateTime()');
    expect(serviceSource).toContain('registrationDeadline: new Date(dinnerDateTime.getTime() - 24 * 60 * 60 * 1000)');
  });

  it('assigns a deterministic curated theme without an LLM call', () => {
    expect(serviceSource).toContain('SINGLE_TEST_GROUP_THEMES');
    expect(serviceSource).toContain('pickSingleTestGroupTheme(groupId)');
    expect(serviceSource).toContain('themeGeneratedAt: new Date()');
  });

  it('reserves the shared test venue via the ungated matching-test finalizer', () => {
    expect(matchingTestSource).toContain('export async function finalizeTestPoolGroups');
    expect(serviceSource).toContain('finalizeTestPoolGroups(poolId)');
    // The gated wrapper must keep its mode assertion for the matching-test route.
    expect(matchingTestSource).toContain('assertMatchingTestMode();');
  });

  it('cleanup removes the finalized records so re-runs never bind stale events', () => {
    expect(serviceSource).toContain('.delete(venueTimeSlotBookings)');
    expect(serviceSource).toContain('.delete(events).where(inArray(events.id, linkedEventIds))');
    expect(serviceSource).toContain('inArray(eventAttendance.blindBoxEventId, linkedBlindBoxEventIds)');
    // Safety net for pool-level blind_box_events rows without a group back-link.
    expect(serviceSource).toContain('.delete(blindBoxEvents).where(inArray(blindBoxEvents.id, staleBlindBoxEventIds))');
  });

  it('cleanup nulls group event back-links before deleting events/blind_box_events (NO ACTION FKs)', () => {
    // Regression: the 2026-07-26 finalization writes eventId + blindBoxEventId
    // onto groups; both columns are NO ACTION FKs. Cleanup must null them before
    // deleting the referenced rows or the second test run 500s.
    expect(serviceSource).toContain('.set({ eventId: null, blindBoxEventId: null })');
    const nullOutIndex = serviceSource.indexOf('.set({ eventId: null, blindBoxEventId: null })');
    const eventsDeleteIndex = serviceSource.indexOf('.delete(events).where(inArray(events.id, linkedEventIds))');
    const blindBoxDeleteIndex = serviceSource.indexOf('.delete(blindBoxEvents).where(inArray(blindBoxEvents.id, staleBlindBoxEventIds))');
    expect(nullOutIndex).toBeGreaterThan(-1);
    expect(eventsDeleteIndex).toBeGreaterThan(nullOutIndex);
    expect(blindBoxDeleteIndex).toBeGreaterThan(nullOutIndex);
  });

  it('event_attendance schema declares the partial unique index required by the confirm upsert', () => {
    // Regression: without idx_event_attendance_blind_box_user the ON CONFLICT
    // upsert in attendanceRepo throws 42P10 and confirm-attendance 500s. The
    // index must be declared in the Drizzle schema so db:push creates it.
    const schemaSource = readRepoFile('packages/shared/src/schema/_definitions.ts');
    expect(schemaSource).toContain('uniqueIndex("idx_event_attendance_blind_box_user")');
    expect(schemaSource).toContain('blind_box_event_id IS NOT NULL');
  });

  it('confirm-attendance prefers the group blind_box_events link over the pool lookup', () => {
    expect(userEventPoolsSource).toContain('group?.blindBoxEventId ?? null');
    expect(userEventPoolsSource).toContain('if (!blindBoxEventId && group?.poolId)');
  });
});
