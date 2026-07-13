import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { missionContentSchema } from "@shared/alang/contentSchema";
import { resolveAlangArrivalTarget } from "../lib/alang/alangTargetResolver";

const storyPath = fileURLToPath(
  new URL("../../content/alang/stories/demo-story.json", import.meta.url),
);
const content = missionContentSchema.parse(
  JSON.parse(readFileSync(storyPath, "utf8")),
);

describe("Alang arrival target resolver", () => {
  it("uses the persisted companion endpoint for both route and GPS contexts", () => {
    const persisted = { latitude: 22.52, longitude: 113.95, radiusMeters: 500 };
    const mission = {
      targetLocation: { latitude: 22.51, longitude: 113.94, radiusMeters: 5 },
      companionEndLocation: persisted,
    };
    const companionNode = content.nodes.find((node) => node.type === "companion_move");

    const routeTarget = resolveAlangArrivalTarget({
      mission,
      content,
      kind: "companion",
    });
    const gpsTarget = resolveAlangArrivalTarget({
      mission,
      content,
      kind: "companion",
      currentNode: companionNode,
    });

    expect(routeTarget).toEqual({
      latitude: persisted.latitude,
      longitude: persisted.longitude,
    });
    expect(gpsTarget).toEqual(routeTarget);
  });

  it("falls back to validated content when an older row has no persisted point", () => {
    const searchNode = content.nodes.find((node) => node.type === "search_gate");
    const target = resolveAlangArrivalTarget({
      mission: {},
      content,
      kind: "search",
      currentNode: searchNode,
    });

    expect(target).toEqual({
      latitude: searchNode?.gpsTrigger?.latitude,
      longitude: searchNode?.gpsTrigger?.longitude,
    });
  });
});
