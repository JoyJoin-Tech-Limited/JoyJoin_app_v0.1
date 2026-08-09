import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../migrations/20260809010000_naturalize_flash_story_dialogue.sql", import.meta.url),
);
const journalPath = fileURLToPath(
  new URL("../../migrations/meta/_journal.json", import.meta.url),
);

describe("Flash story dialogue content migration", () => {
  it("is an idempotent, value-guarded content patch", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql.trimStart().startsWith("BEGIN;")).toBe(true);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(sql).toContain("to_regclass('public.flash_story_episodes')");
    expect(sql).toContain("s.code = 'unnamed-objects-s1'");
    expect(sql).not.toMatch(/\b(?:CREATE|ALTER|DELETE|TRUNCATE|DROP)\b/i);

    for (const [optionId, oldLabel, approvedLabel] of [
      ["notice-action", "它刚才做的动作", "我想问：你为什么这样做？"],
      ["notice-object", "这件旧物留下的痕迹", "我想看看：旧物还留下了什么？"],
      ["notice-relationship", "它没有直接说出的关系", "等等，这件旧物和谁有关？"],
    ]) {
      expect(sql).toContain(`option_value->>'id' = '${optionId}'`);
      expect(sql).toContain(`option_value->>'label' = '${oldLabel}'`);
      expect(sql).toContain(approvedLabel);
    }

    for (const episodeCode of ["s1-p1-shiqi", "s1-p2-shiqi", "s1-p3-shiqi"]) {
      expect(sql).toContain(`'${episodeCode}'`);
    }
    expect(sql).toContain("你先留意了那个动作。有时候，动作比解释更诚实。");
    expect(sql).toContain("e.motion #>> '{ambient}' = 'none'");
  });

  it("is registered in the migration journal", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    expect(journal.entries.some((entry: { tag: string }) => (
      entry.tag === "20260809010000_naturalize_flash_story_dialogue"
    ))).toBe(true);
  });
});
