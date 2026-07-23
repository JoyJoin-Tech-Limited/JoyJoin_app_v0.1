import { describe, expect, it } from "vitest";

import { FLASH_LOCATION_OPERATIONS_NOTICE, FLASH_LOCATION_PRESETS } from "./flashLocationPresets";

describe("flash location presets", () => {
  it("keeps ten distinct public-space recommendations", () => {
    expect(FLASH_LOCATION_PRESETS).toHaveLength(10);
    expect(new Set(FLASH_LOCATION_PRESETS.map((item) => item.code)).size).toBe(10);
    expect(FLASH_LOCATION_PRESETS.every((item) => item.name.includes("公共") || item.name.includes("街区") || item.name.includes("外围"))).toBe(true);
  });

  it("maps every preset to at least one canonical NPC", () => {
    const slugs = new Set(["alang", "lizi", "momo", "shiqi", "atuan"]);
    expect(FLASH_LOCATION_PRESETS.every((item) => item.npcSlugs.length > 0)).toBe(true);
    expect(FLASH_LOCATION_PRESETS.flatMap((item) => item.npcSlugs).every((slug) => slugs.has(slug))).toBe(true);
  });

  it("keeps the no-purchase and manual-review rules visible to operations", () => {
    const notice = FLASH_LOCATION_OPERATIONS_NOTICE.join("");
    expect(notice).toContain("不得要求消费");
    expect(notice).toContain("腾讯地图");
    expect(notice).toContain("人工安全审核");
    expect(FLASH_LOCATION_PRESETS.every((item) => item.safetyNotes.includes("无需进店或消费"))).toBe(true);
  });
});

