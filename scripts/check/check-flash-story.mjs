#!/usr/bin/env node
// check-flash-story.mjs — 街头盲盒 story episode v2 质量门
// Contract: .github/skills/flash-story-writing/references/validator-interface.md
// Only scans content->>'v'='2' rows. Exit 0=pass, 1=fatal, 2=warnings only (--ci treats warnings as pass).
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const FATAL = "fatal";
const WARN = "warn";

function loadEpisodes() {
  if (process.env.DATABASE_URL) {
    // Prefer a deterministic offline source when a DB is unavailable:
    // --source=<path> JSON [{code, content}]. DB mode is intentionally not
    // implemented here — schema reads belong to the server repo layer.
  }
  return null;
}

function scanUnit(unit) {
  const issues = [];
  const content = unit.content;
  if (!content || typeof content !== "object") return [["E101", FATAL, `${unit.code}: content is not an object`]];
  if (content.v !== 2) return issues;
  const nodes = content.nodes;
  if (!content.start || !nodes || typeof nodes !== "object") {
    issues.push(["E101", FATAL, `${unit.code}: missing v=2 start/nodes`]);
    return issues;
  }
  const nodeIds = new Set(Object.keys(nodes));
  const start = content.start;
  if (!nodeIds.has(start)) issues.push(["E102", FATAL, `${unit.code}: start node missing: ${start}`]);

  const reachable = new Set();
  const walk = (id) => {
    if (reachable.has(id)) return;
    const node = nodes[id];
    if (!node) return;
    reachable.add(id);
    if (node.variants?.length) {
      for (const variant of node.variants) {
        if (variant.next) walk(variant.next);
        for (const choice of variant.choices ?? []) walk(choice.next);
      }
      return;
    }
    if (node.next) walk(node.next);
    for (const choice of node.choices ?? []) walk(choice.next);
  };
  walk(start);

  for (const [id, node] of Object.entries(nodes)) {
    if (!reachable.has(id)) issues.push(["E103", FATAL, `${unit.code}: unreachable node: ${id}`]);
    const variants = node.variants ?? [];
    const hasVariants = variants.length > 0;
    const defaultVariant = hasVariants && variants.some((v) => v.when === "default");
    if (hasVariants && !defaultVariant) issues.push(["E104", WARN, `${unit.code}/${id}: variants without default fallback`]);
    const isTerminal = node.type === "ending" || node.type === "closure";
    const hasNext = Boolean(node.next) || variants.some((v) => v.next) || (node.choices ?? []).length > 0;
    if (!isTerminal && !hasNext) issues.push(["E104", FATAL, `${unit.code}/${id}: dead-end node`]);
    if (node.type === "choice") {
      const choices = node.choices ?? [];
      if (choices.length === 0 && !hasVariants) issues.push(["E109", FATAL, `${unit.code}/${id}: choice node without options`]);
      for (const choice of choices) {
        if (/^(说|问|让|声明|表达|回应)/.test(choice.text)) {
          issues.push(["E106", FATAL, `${unit.code}/${id}: option format violation: ${choice.text}`]);
        }
        if (choice.effect && !node.next) {
          const target = nodes[choice.next];
          if (!target || target.type !== "callback" || !(target.segments ?? []).length) {
            issues.push(["E109", FATAL, `${unit.code}/${id}: effect without callback segments (${choice.next})`]);
          }
        }
      }
    }
    const metaWords = ["玩家", "用户", "分支", "任务", "传话", "选项A", "节点", "系统提示"];
    const texts = [
      ...(node.segments ?? []).map((s) => s.text),
      ...(node.choices ?? []).map((c) => c.text),
      ...(variants.flatMap((v) => [...(v.segments ?? []).map((s) => s.text), ...(v.choices ?? []).map((c) => c.text)])),
    ].join(" ");
    for (const word of metaWords) {
      if (texts.includes(word)) issues.push(["E107", FATAL, `${unit.code}/${id}: meta word "${word}"`]);
    }
    const psychoWords = ["意识到", "承认", "决定", "其实", "本质"];
    for (const word of psychoWords) {
      if (texts.includes(word)) issues.push(["E108", WARN, `${unit.code}/${id}: possible psycho word "${word}"`]);
    }
    const flatSegments = [...(node.segments ?? []), ...(variants.flatMap((v) => v.segments ?? []))];
    if (flatSegments.length > 5) issues.push(["E111", WARN, `${unit.code}/${id}: >5 segments without interaction`]);
  }

  const allChoices = Object.values(nodes).flatMap((node) => node.choices ?? []);
  const kinds = { attitude: 0, path: 0, destiny: 0 };
  for (const choice of allChoices) kinds[choice.kind ?? "attitude"] += 1;
  const total = allChoices.length;
  if (total > 0) {
    const attitudeRatio = kinds.attitude / total;
    if (attitudeRatio < 0.5 || attitudeRatio > 0.75) issues.push(["E110", WARN, `${unit.code}: attitude ratio ${(attitudeRatio * 100).toFixed(0)}% outside 50-75%`]);
  }

  const knownFlags = new Set();
  for (const node of Object.values(nodes)) {
    for (const choice of node.choices ?? []) {
      for (const flag of choice.effect?.flagsSet ?? []) knownFlags.add(flag);
    }
  }
  for (const node of Object.values(nodes)) {
    for (const variant of node.variants ?? []) {
      for (const flag of variant.when !== "default" ? (variant.when.flags ?? []) : []) {
        if (!knownFlags.has(flag) && !flag.startsWith("s1-")) {
          issues.push(["E113", FATAL, `${unit.code}: condition references unset flag: ${flag}`]);
        }
      }
    }
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    options: { unit: { type: "string" }, source: { type: "string" }, ci: { type: "boolean" } },
  });
  const episodes = [];
  if (values.source) {
    const raw = readFileSync(values.source, "utf8");
    const parsed = JSON.parse(raw);
    episodes.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }
  if (values.unit) {
    const selected = episodes.filter((episode) => episode.code === values.unit);
    episodes.length = 0;
    episodes.push(...selected);
  }
  if (episodes.length === 0) {
    // No DB read path here; CI without DB exits 0 (see validator-interface.md).
    console.log("check-flash-story: no v2 units supplied; skipped (exit 0)");
    process.exit(0);
  }

  const issues = [];
  for (const episode of episodes) {
    const content = episode.content;
    if (!content || content.v !== 2) continue;
    issues.push(...scanUnit(episode));
  }

  const fatals = issues.filter(([, level]) => level === FATAL);
  const warnings = issues.filter(([, level]) => level === WARN);
  for (const [code, level, message] of issues) {
    console.log(`[${level.toUpperCase()}] ${code} ${message}`);
  }
  if (fatals.length > 0) {
    console.log(`check-flash-story: FAIL (${fatals.length} fatal, ${warnings.length} warnings)`);
    process.exit(1);
  }
  if (warnings.length > 0 && !values.ci) {
    console.log(`check-flash-story: WARN (${warnings.length} warnings)`);
    process.exit(2);
  }
  console.log(`check-flash-story: PASS (${warnings.length} warnings ${values.ci ? "tolerated" : ""})`);
  process.exit(0);
}

main();
