import { FLASH_NPC_SEEDS } from "@shared/alang/flashCatalog";

const CANONICAL_WEEKDAYS_BY_SLUG = new Map(
  FLASH_NPC_SEEDS.map((npc) => [npc.slug, [...npc.eligibleWeekdays].sort((left, right) => left - right)]),
);

function sortedWeekdays(weekdays: readonly number[]): number[] {
  return [...weekdays].sort((left, right) => left - right);
}

export function isCanonicalFlashNpcSlug(slug: string): boolean {
  return CANONICAL_WEEKDAYS_BY_SLUG.has(slug);
}

export function matchesCanonicalFlashNpcWeekdays(slug: string, weekdays: readonly number[]): boolean {
  const expected = CANONICAL_WEEKDAYS_BY_SLUG.get(slug);
  if (!expected) return false;
  const actual = sortedWeekdays(weekdays);
  return actual.length === expected.length
    && actual.every((weekday, index) => weekday === expected[index]);
}

export function countCanonicalFlashNpcWeekdayMatches(
  rows: Array<{ slug: string; eligibleWeekdays: readonly number[]; isActive: boolean }>,
): number {
  return rows.filter((row) => (
    row.isActive && matchesCanonicalFlashNpcWeekdays(row.slug, row.eligibleWeekdays)
  )).length;
}
