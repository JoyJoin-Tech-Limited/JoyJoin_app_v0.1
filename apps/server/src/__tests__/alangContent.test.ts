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
