import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { pool } from "../db";
import { logger } from "../lib/logger";
import {
  advanceStoryNode,
  answerStoryChoice,
  enterStoryEpisode,
  FLASH_V2_ECHO_MAX,
  FLASH_V2_ENDING_TIERS,
  getStoryNodeView,
  resolveV2EchoTier,
  resolveV2Ending,
  type FlashStoryRunState,
} from "../services/flashStoryEngine";

const PILOT_CODES = ["s1-p1-alang", "s1-p2-alang", "s1-p3-alang", "s1-p1-shiqi", "s1-p3-shiqi"];
const PENDING_SEASON1_CODES = ["s1-p1-lizi", "s1-p2-lizi", "s1-p3-lizi", "s1-p1-momo", "s1-p2-momo", "s1-p3-momo", "s1-p2-shiqi"];
const SEASON_CODE = "unnamed-objects-s1";
const EXPECTED_CONTENT_VERSION = 4;
const DEPTH_LIMIT = 60;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PILOT_PATH = path.resolve(SCRIPT_DIR, "../data/flashStoryPilot/v2-pilot.json");

type V2Content = Parameters<typeof enterStoryEpisode>[0];
type UnitRow = { code: string; content_version: number; phase: number; title: string; content: V2Content };

const pilotDoc = JSON.parse(readFileSync(PILOT_PATH, "utf8")) as { units: Array<{ code: string; content: V2Content }> };

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual(value, b[index]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    return (
      ka.length === kb.length &&
      ka.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
    );
  }
  return false;
}

function checkStructure(content: V2Content, failures: string[], code: string): void {
  const tag = `${code}/structure`;
  if (content.v !== 2) failures.push(`${tag}: v=${String(content.v)} expected 2`);
  if (typeof content.start !== "string" || !content.nodes[content.start]) {
    failures.push(`${tag}: start missing or unresolvable`);
  }
  if ("question" in content) failures.push(`${tag}: v2 content must not carry v1 'question' field`);
  for (const [nodeId, node] of Object.entries(content.nodes)) {
    if (node.id !== nodeId) failures.push(`${tag}: node key ${nodeId} id mismatch ${node.id}`);
    if (node.type !== "choice") {
      if (!Array.isArray(node.segments) || node.segments.length === 0) {
        failures.push(`${tag}: ${nodeId} (${node.type}) has no segments`);
      }
    } else if (!Array.isArray(node.choices) || node.choices.length === 0) {
      failures.push(`${tag}: choice node ${nodeId} has no choices`);
    }
    if (node.type === "closure" && typeof node.unlockFragment !== "string") {
      failures.push(`${tag}: closure ${nodeId} missing unlockFragment`);
    }
    if (node.next !== undefined && node.next !== null && !content.nodes[node.next]) {
      failures.push(`${tag}: ${nodeId} next -> missing ${node.next}`);
    }
    if (node.type === "choice") {
      for (const choice of node.choices ?? []) {
        if (typeof choice.id !== "string" || choice.id.length === 0) failures.push(`${tag}: ${nodeId} choice without id`);
        if (typeof choice.text !== "string" || choice.text.length === 0) failures.push(`${tag}: ${nodeId} choice without text`);
        if (!content.nodes[choice.next]) failures.push(`${tag}: ${nodeId} ${choice.id} next -> missing ${choice.next}`);
        const delta = choice.effect?.echo ?? 0;
        if (delta < 0 || delta > FLASH_V2_ECHO_MAX) failures.push(`${tag}: ${nodeId} ${choice.id} echo delta out of bounds ${delta}`);
      }
    }
  }
}

function walkUnit(content: V2Content, failures: string[], code: string): { branches: number; terminals: number } {
  const state = enterStoryEpisode(content, {
    echo: 0,
    flags: [],
    variables: {},
    currentNode: null,
    nodePath: [],
    lastChoiceId: null,
  });
  let branches = 0;
  let terminals = 0;

  function walk(run: FlashStoryRunState, depth: number): void {
    if (depth > DEPTH_LIMIT) {
      failures.push(`${code}/walk: recursion depth exceeded at ${run.currentNode ?? content.start}`);
      return;
    }
    const view = getStoryNodeView(content, run);
    if (!view) {
      failures.push(`${code}/walk: no view at ${run.currentNode ?? content.start}`);
      return;
    }
    if (view.type === "choice") {
      let advanceThrew = false;
      try {
        advanceStoryNode({ content, state: run });
      } catch (error) {
        advanceThrew = error instanceof Error && error.message.startsWith("FLASH_V2_CHOICE_EXPECTED");
        logger.info("qa-flash-v2-staging expected throw observed", {
          code,
          nodeId: run.currentNode,
          threwExpected: advanceThrew,
        });
      }
      if (!advanceThrew) failures.push(`${code}/walk: advance on choice node did not raise FLASH_V2_CHOICE_EXPECTED`);
      for (const choice of view.choices ?? []) {
        branches += 1;
        const expectedFlags = choice.effect?.flagsSet ?? [];
        const result = answerStoryChoice({ content, state: run, nodeId: run.currentNode!, choiceId: choice.id });
        for (const flag of expectedFlags) {
          if (!result.state.flags.includes(flag)) failures.push(`${code}/walk: ${choice.id} did not set flag ${flag}`);
        }
        if (result.state.echo < 0 || result.state.echo > FLASH_V2_ECHO_MAX) {
          failures.push(`${code}/walk: ${choice.id} echo out of bounds ${result.state.echo}`);
        }
        if (result.finished) {
          assertTerminal(content, result.state, result.view, failures, code, choice.id);
          terminals += 1;
        } else {
          walk(result.state, depth + 1);
        }
      }
      return;
    }
    const result = advanceStoryNode({ content, state: run });
    if (result.finished) {
      assertTerminal(content, result.state, result.view, failures, code, "linear");
      terminals += 1;
      return;
    }
    walk(result.state, depth + 1);
  }

  walk(state, 0);
  return { branches, terminals };
}

function assertTerminal(
  content: V2Content,
  state: FlashStoryRunState,
  view: ReturnType<typeof getStoryNodeView>,
  failures: string[],
  code: string,
  label: string,
): void {
  const ending = resolveV2Ending(state);
  const tier = resolveV2EchoTier(state.echo);
  if (!view) {
    failures.push(`${code}/end: ${label} terminal has no view`);
    return;
  }
  if (view.type !== "closure" && view.type !== "ending") {
    failures.push(`${code}/end: ${label} finished on ${view.type} instead of closure/ending`);
  }
  if (state.lastChoiceId === null) failures.push(`${code}/end: ${label} terminal without lastChoiceId`);
  if (!FLASH_V2_ENDING_TIERS.some((entry) => entry.code === ending)) {
    failures.push(`${code}/end: ${label} unknown ending code ${ending}`);
  }
  if (tier !== "彻" && tier !== "深" && tier !== "轻") {
    failures.push(`${code}/end: ${label} unknown echo tier ${tier}`);
  }
  if (view.type === "closure" && typeof view.unlockFragment !== "string") {
    failures.push(`${code}/end: ${label} closure without unlockFragment`);
  }
}

async function main(): Promise<void> {
  const failures: string[] = [];
  const summary: Array<Record<string, unknown>> = [];

  const { rows } = await pool.query<UnitRow>(
    `SELECT e.code, e.content_version, e.phase, e.title, e.content
     FROM flash_story_episodes e
     JOIN flash_story_seasons s ON s.id = e.season_id
     WHERE s.code = $1 AND e.code = ANY($2)
     ORDER BY e.code`,
    [SEASON_CODE, PILOT_CODES],
  );
  const byCode = new Map(rows.map((row) => [row.code, row]));

  for (const code of PILOT_CODES) {
    const row = byCode.get(code);
    if (!row) {
      failures.push(`${code}: episode missing on staging DB`);
      continue;
    }
    if (row.content_version !== EXPECTED_CONTENT_VERSION) {
      failures.push(`${code}: content_version=${row.content_version} expected ${EXPECTED_CONTENT_VERSION}`);
    }
    const fileUnit = pilotDoc.units.find((unit) => unit.code === code);
    if (!fileUnit) {
      failures.push(`${code}: missing in v2-pilot.json`);
      continue;
    }
    if (!deepEqual(row.content, fileUnit.content)) {
      failures.push(`${code}: DB content differs from v2-pilot.json`);
    }
    checkStructure(row.content, failures, code);
    const walk = walkUnit(row.content, failures, code);
    summary.push({
      code,
      title: row.title,
      phase: row.phase,
      content_version: row.content_version,
      choices: walk.branches,
      terminals: walk.terminals,
      matchesPilotFile: deepEqual(row.content, fileUnit.content),
    });
  }

  const pending = await pool.query<{ code: string; content_version: number; is_v2: boolean }>(
    `SELECT e.code, e.content_version, (e.content->>'v')::int = 2 AS is_v2
     FROM flash_story_episodes e
     JOIN flash_story_seasons s ON s.id = e.season_id
     WHERE s.code = $1 AND e.code = ANY($2)
     ORDER BY e.code`,
    [SEASON_CODE, PENDING_SEASON1_CODES],
  );
  const pendingReport = pending.rows.map((row) => ({
    code: row.code,
    content_version: row.content_version,
    staysV1: !row.is_v2,
  }));
  for (const row of pending.rows) {
    if (row.is_v2) failures.push(`${row.code}: pending season1 unit unexpectedly v2 on staging`);
  }

  const flag = await pool.query<{ key: string; value: unknown }>(
    `SELECT key, value FROM feature_flags WHERE key = $1`,
    ["flashStoryV2Enabled"],
  );
  const flagEnabled = flag.rows.length > 0 && String(flag.rows[0].value).toLowerCase() === "true";

  process.stdout.write(
    `${JSON.stringify(
      { pilotUnits: summary, pendingSeason1Units: pendingReport, flashStoryV2Enabled: flagEnabled, failures },
      null,
      2,
    )}\n`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    logger.error("qa-flash-v2-staging failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });