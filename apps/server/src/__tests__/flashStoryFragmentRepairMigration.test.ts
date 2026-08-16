import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "migrations/20260816010000_repair_flash_story_fragments.sql",
);

describe("Flash story fragment repair migration", () => {
  it("repairs every completed episode idempotently and enforces one fragment per episode", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("flash_user_story_episodes");
    expect(sql).toContain("flash_user_story_fragments");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
    expect(sql).toContain("uq_flash_story_fragment_episode");
    expect(sql).toContain("fragment_count <> 1");
    expect(sql).toContain("completed_episode_count");
    expect(sql).not.toContain("s1-p2-atuan");
  });
});
