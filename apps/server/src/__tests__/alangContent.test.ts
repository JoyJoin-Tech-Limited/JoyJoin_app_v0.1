import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { missionContentSchema } from "@shared/alang/contentSchema";

const storyPath = fileURLToPath(new URL("../../content/alang/stories/demo-story.json", import.meta.url));
const assetRoot = fileURLToPath(new URL("../../../mini-program/src/assets/lovart/", import.meta.url));
const story = JSON.parse(readFileSync(storyPath, "utf8"));

describe("Alang demo story", () => {
  it("passes the canonical mission-content schema", () => {
    const parsed = missionContentSchema.safeParse(story);
    expect(parsed.success, parsed.success ? undefined : JSON.stringify(parsed.error.flatten())).toBe(true);
  });

  it("publishes the reviewed natural-dialogue revision without changing branch ids", () => {
    expect(story.version).toBe("1.1");
    const firstRound = story.nodes.find((node: { id: string }) => node.id === "dialogue_1");
    const thirdRound = story.nodes.find((node: { id: string }) => node.id === "dialogue_3");
    expect(firstRound.content.body).toBe("你也常等人吗？");
    expect(firstRound.choices[0]).toMatchObject({
      label: "会。只是很少有人等我。",
      nextNodeId: "dialogue_2",
      moodShift: "共鸣",
    });
    expect(thirdRound.choices[1].response).not.toContain("一个人走得快，两个人走得远");
    expect(thirdRound.choices.every((choice: { nextNodeId: string }) => (
      choice.nextNodeId === "companion_start"
    ))).toBe(true);
  });

  it("normalizes persisted legacy lat/lng JSON at the content boundary", () => {
    const legacy = structuredClone(story);
    const target = legacy.meta.defaultTargetLocation;
    const companion = legacy.meta.defaultCompanionEndLocation;
    legacy.meta.defaultTargetLocation = {
      lat: target.latitude,
      lng: target.longitude,
      radiusMeters: target.radiusMeters,
    };
    legacy.meta.defaultCompanionEndLocation = {
      lat: companion.latitude,
      lng: companion.longitude,
      radiusMeters: companion.radiusMeters,
    };
    for (const node of legacy.nodes) {
      if (!node.gpsTrigger) continue;
      node.gpsTrigger = {
        lat: node.gpsTrigger.latitude,
        lng: node.gpsTrigger.longitude,
        radiusMeters: node.gpsTrigger.radiusMeters,
      };
    }

    const parsed = missionContentSchema.parse(legacy);
    expect(parsed.meta?.defaultTargetLocation).toMatchObject({
      latitude: target.latitude,
      longitude: target.longitude,
    });
    expect(parsed.meta?.defaultCompanionEndLocation).toMatchObject({
      latitude: companion.latitude,
      longitude: companion.longitude,
    });
    for (const node of parsed.nodes.filter((item) => item.gpsTrigger)) {
      expect(node.gpsTrigger).toHaveProperty("latitude");
      expect(node.gpsTrigger).toHaveProperty("longitude");
      expect(node.gpsTrigger).not.toHaveProperty("lat");
      expect(node.gpsTrigger).not.toHaveProperty("lng");
    }
  });

  it("normalizes every configured arrival radius to the fixed five metres", () => {
    const widened = structuredClone(story);
    widened.meta.defaultTargetLocation.radiusMeters = 500;
    widened.meta.defaultCompanionEndLocation.radiusMeters = 250;
    for (const node of widened.nodes) {
      if (node.gpsTrigger) node.gpsTrigger.radiusMeters = 100;
    }

    const parsed = missionContentSchema.parse(widened);

    expect(parsed.meta?.defaultTargetLocation?.radiusMeters).toBe(5);
    expect(parsed.meta?.defaultCompanionEndLocation?.radiusMeters).toBe(5);
    for (const node of parsed.nodes.filter((item) => item.gpsTrigger)) {
      expect(node.gpsTrigger?.radiusMeters).toBe(5);
    }
  });

  it("has a closed node graph and exactly three dialogue rounds", () => {
    const nodeIds = new Set(story.nodes.map((node: { id: string }) => node.id));
    expect(nodeIds.has(story.startNodeId)).toBe(true);

    for (const node of story.nodes) {
      if (node.nextNodeId) expect(nodeIds.has(node.nextNodeId), `${node.id} -> ${node.nextNodeId}`).toBe(true);
      for (const choice of node.choices ?? []) {
        expect(nodeIds.has(choice.nextNodeId), `${node.id} choice -> ${choice.nextNodeId}`).toBe(true);
      }
    }

    const dialogueNodes = story.nodes.filter((node: { type: string }) => node.type === "dialogue");
    expect(dialogueNodes).toHaveLength(3);
    for (const node of dialogueNodes) {
      expect(node.choices.length).toBeGreaterThanOrEqual(2);
      expect(node.choices.length).toBeLessThanOrEqual(3);
    }
  });

  it("resolves every referenced imageKey to a bundled WebP", () => {
    const imageKeys = story.nodes
      .map((node: { content?: { imageKey?: string } }) => node.content?.imageKey)
      .filter((value: unknown): value is string => typeof value === "string");

    for (const imageKey of imageKeys) {
      expect(existsSync(join(assetRoot, `${imageKey}.webp`)), imageKey).toBe(true);
    }
  });

  it("ships the three declared placeholder assets as WebP files", () => {
    const names = [
      "alang-event-card-placeholder.webp",
      "alang-found-scene-placeholder.webp",
      "alang-result-placeholder.webp",
    ];

    for (const name of names) {
      const path = join(assetRoot, name);
      expect(existsSync(path), path).toBe(true);
      const header = readFileSync(path).subarray(0, 12).toString("ascii");
      expect(header.startsWith("RIFF"), name).toBe(true);
      expect(header.slice(8, 12), name).toBe("WEBP");
    }
  });
});
