import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  flashEncounters,
  flashLocateBudgets,
  flashNpcLocationLinks,
  flashNpcRelationships,
  flashNpcTaskLinks,
  flashTaskAssignments,
  flashTaskDestinationLinks,
  flashTaskTemplates,
} from "@shared/schema";

function columnNames(table: PgTable): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

function checkNames(table: PgTable): string[] {
  return getTableConfig(table).checks.map((constraint) => constraint.name);
}

function hasLeadingIndex(table: PgTable, columnName: string): boolean {
  return getTableConfig(table).indexes.some((candidate) => {
    const firstColumn = candidate.config.columns[0] as { name?: string } | undefined;
    return firstColumn?.name === columnName;
  });
}

describe("formal Flash schema contract", () => {
  it("keeps lifecycle timestamps on link and locate-budget records", () => {
    for (const linkTable of [flashNpcLocationLinks, flashNpcTaskLinks, flashTaskDestinationLinks]) {
      expect(columnNames(linkTable)).toEqual(expect.arrayContaining(["created_at", "updated_at"]));
    }
    expect(columnNames(flashLocateBudgets)).toEqual(expect.arrayContaining(["created_at", "updated_at"]));
  });

  it("provides a leading index for reverse foreign-key lookups", () => {
    const requirements: Array<[PgTable, string]> = [
      [flashNpcLocationLinks, "location_id"],
      [flashNpcTaskLinks, "task_template_id"],
      [flashTaskDestinationLinks, "destination_id"],
      [flashEncounters, "shift_id"],
      [flashEncounters, "npc_id"],
      [flashEncounters, "offered_task_template_id"],
      [flashEncounters, "offered_destination_id"],
      [flashEncounters, "first_offered_task_template_id"],
      [flashLocateBudgets, "shift_id"],
      [flashTaskAssignments, "npc_id"],
      [flashTaskAssignments, "task_template_id"],
      [flashTaskAssignments, "destination_id"],
      [flashNpcRelationships, "npc_id"],
    ];

    for (const [table, columnName] of requirements) {
      expect(hasLeadingIndex(table, columnName), `${getTableConfig(table).name}.${columnName}`).toBe(true);
    }
  });

  it("enforces positive weights, bounded rerolls, counts and private-reply retention", () => {
    expect(checkNames(flashNpcLocationLinks)).toContain("ck_flash_npc_location_weight");
    expect(checkNames(flashNpcTaskLinks)).toContain("ck_flash_npc_task_weight");
    expect(checkNames(flashTaskDestinationLinks)).toContain("ck_flash_task_destination_weight");
    expect(checkNames(flashTaskTemplates)).toContain("ck_flash_task_templates_base_weight");
    expect(checkNames(flashEncounters)).toContain("ck_flash_encounters_reroll_count");
    expect(checkNames(flashNpcRelationships)).toContain("ck_flash_npc_relationships_counts");
    expect(checkNames(flashTaskAssignments)).toEqual(expect.arrayContaining([
      "ck_flash_assignments_private_reply_length",
      "ck_flash_assignments_private_reply_retention",
    ]));
  });
});
