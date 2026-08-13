import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  advanceStoryNode,
  answerStoryChoice,
  enterStoryEpisode,
  getStoryNodeView,
  type FlashStoryRunState,
} from "../services/flashStoryEngine";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PILOT_PATH = path.resolve(TEST_FILE_DIR, "../data/flashStoryPilot/v2-pilot.json");

type V2Content = Parameters<typeof enterStoryEpisode>[0];

interface PilotDoc {
  units: Array<{ code: string; content: V2Content }>;
}

const pilot = JSON.parse(readFileSync(PILOT_PATH, "utf8")) as PilotDoc;

function walkUnit(content: V2Content): { finished: boolean; echo: number } {
  let state: FlashStoryRunState = { echo: 0, flags: [], variables: {}, currentNode: null, nodePath: [] };
  state = enterStoryEpisode(content, state);
  let hops = 0;
  for (;;) {
    if (++hops > 50) throw new Error(`walk exceeded 50 hops`);
    const view = getStoryNodeView(content, state);
    if (!view) throw new Error(`no view at ${state.currentNode}`);
    if (view.type === "choice") {
      const first = view.choices?.[0];
      if (!first) throw new Error(`choice node without choices at ${state.currentNode}`);
      const result = answerStoryChoice({ content, state, nodeId: state.currentNode!, choiceId: first.id });
      state = result.state;
      if (result.finished) return { finished: true, echo: result.state.echo };
      continue;
    }
    const result = advanceStoryNode({ content, state });
    state = result.state;
    if (result.finished) return { finished: true, echo: result.state.echo };
  }
}

describe("pilot content × engine end-to-end", () => {
  it("walks all 5 pilot units to completion through the engine", () => {
    expect(pilot.units.length).toBe(5);
    for (const unit of pilot.units) {
      const { finished } = walkUnit(unit.content);
      expect(finished, `${unit.code} should complete`).toBe(true);
    }
  });

  it("lizi p3 cross-unit variant switches on s1-momo-invited flag", () => {
    const seasonPath = path.resolve(TEST_FILE_DIR, "../data/flashStoryPilot/v2-season1.json");
    const season = JSON.parse(readFileSync(seasonPath, "utf8")) as PilotDoc;
    const liziP3 = season.units.find((u) => u.code === "s1-p3-lizi");
    const momoP3 = season.units.find((u) => u.code === "s1-p3-momo");
    expect(liziP3).toBeTruthy();
    expect(momoP3).toBeTruthy();

    const momoState = enterStoryEpisode(momoP3!.content, {
      echo: 0, flags: [], variables: {}, currentNode: null, nodePath: [],
    });
    expect(momoState.flags).toContain("s1-momo-invited");

    let liziState = enterStoryEpisode(liziP3!.content, {
      echo: 0, flags: momoState.flags, variables: {}, currentNode: null, nodePath: [],
    });
    liziState = { ...liziState, currentNode: "n5_close", nodePath: [...liziState.nodePath, "n5_close"] };
    const view = getStoryNodeView(liziP3!.content, liziState);
    expect(view?.segments?.join("")).toContain("默默约了我下周");

    const fallbackState = { ...liziState, flags: [] };
    const fallback = getStoryNodeView(liziP3!.content, fallbackState);
    expect(fallback?.segments?.join("")).not.toContain("默默约了我下周");
  });
});
