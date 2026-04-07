import { describe, it, expect } from "vitest";
import {
  getArchetypeWaitingCopy,
  GENERIC_ARCHETYPE_WAITING_COPY,
} from "../archetypeWaitingCopy";

describe("getArchetypeWaitingCopy", () => {
  it("returns generic copy for null archetype", () => {
    expect(getArchetypeWaitingCopy(null)).toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns generic copy for undefined archetype", () => {
    expect(getArchetypeWaitingCopy(undefined)).toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns generic copy for unknown archetype", () => {
    expect(getArchetypeWaitingCopy("未知角色")).toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns high_energy copy for 开心柯基", () => {
    const copy = getArchetypeWaitingCopy("开心柯基");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
    expect(copy.headline).toContain("能量");
  });

  it("returns high_energy copy for 太阳鸡", () => {
    const copy = getArchetypeWaitingCopy("太阳鸡");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns high_energy copy for 夸夸豚", () => {
    const copy = getArchetypeWaitingCopy("夸夸豚");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns connector copy for 机智狐", () => {
    const copy = getArchetypeWaitingCopy("机智狐");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
    expect(copy.headline).toContain("魅力");
  });

  it("returns warmth copy for 暖心熊", () => {
    const copy = getArchetypeWaitingCopy("暖心熊");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
    expect(copy.headline).toContain("温暖");
  });

  it("returns steady copy for 沉思猫头鹰", () => {
    const copy = getArchetypeWaitingCopy("沉思猫头鹰");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
    expect(copy.headline).toContain("就位");
  });

  it("all known archetypes return non-generic copy", () => {
    const knownArchetypes = [
      "开心柯基", "太阳鸡", "夸夸豚",
      "机智狐", "淡定海豚", "织网蛛",
      "暖心熊", "灵感章鱼",
      "沉思猫头鹰", "定心大象", "稳如龟", "隐身猫",
    ];
    for (const archetype of knownArchetypes) {
      expect(getArchetypeWaitingCopy(archetype)).not.toBe(
        GENERIC_ARCHETYPE_WAITING_COPY,
      );
    }
  });

  it("each cluster returns a copy object with required fields", () => {
    const samples = ["开心柯基", "机智狐", "暖心熊", "稳如龟"];
    for (const archetype of samples) {
      const copy = getArchetypeWaitingCopy(archetype);
      expect(typeof copy.headline).toBe("string");
      expect(typeof copy.subtext).toBe("string");
      expect(typeof copy.badgeGradient).toBe("string");
    }
  });
});
