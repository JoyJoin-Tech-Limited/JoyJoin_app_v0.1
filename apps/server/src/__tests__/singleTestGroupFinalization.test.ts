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

  it('confirm-attendance prefers the group blind_box_events link over the pool lookup', () => {
    expect(userEventPoolsSource).toContain('group?.blindBoxEventId ?? null');
    expect(userEventPoolsSource).toContain('if (!blindBoxEventId && group?.poolId)');
  });
});
