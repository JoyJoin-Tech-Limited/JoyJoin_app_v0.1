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
    if (node.interaction) {
      if (node.interaction.fallbackNext) walk(node.interaction.fallbackNext);
      for (const result of node.interaction.results ?? []) walk(result.next);
    }
  };
  walk(start);

  for (const [id, node] of Object.entries(nodes)) {
    if (!reachable.has(id)) issues.push(["E103", FATAL, `${unit.code}: unreachable node: ${id}`]);
    const variants = node.variants ?? [];
    const hasVariants = variants.length > 0;
    const defaultVariant = hasVariants && variants.some((v) => v.when === "default");
    if (hasVariants && !defaultVariant) issues.push(["E104", WARN, `${unit.code}/${id}: variants without default fallback`]);
    const isTerminal = node.type === "ending" || node.type === "closure";
    const hasInteractionExits = node.type === "interaction" && Boolean(node.interaction);
    const hasNext = Boolean(node.next) || variants.some((v) => v.next) || (node.choices ?? []).length > 0 || hasInteractionExits;
    if (!isTerminal && !hasNext) issues.push(["E104", FATAL, `${unit.code}/${id}: dead-end node`]);
    if (node.type === "interaction") {
      const config = node.interaction;
      const KINDS = ["spacing", "pairing", "path", "overlay", "privacy"];
      if (!config || typeof config !== "object") {
        issues.push(["E123", FATAL, `${unit.code}/${id}: interaction node missing config`]);
      } else {
        if (!KINDS.includes(config.template)) {
          issues.push(["E123", FATAL, `${unit.code}/${id}: unknown interaction template: ${config.template}`]);
        }
        if (!config.goal || !String(config.goal).trim()) {
          issues.push(["E123", FATAL, `${unit.code}/${id}: interaction goal is empty`]);
        }
        if ((config.hints ?? []).length > 2) {
          issues.push(["E124", FATAL, `${unit.code}/${id}: more than 2 hints (${(config.hints ?? []).length})`]);
        }
        const results = Array.isArray(config.results) ? config.results : [];
        if (results.length < 1 || results.length > 3) {
          issues.push(["E125", FATAL, `${unit.code}/${id}: results count ${results.length} outside 1-3`]);
        }
        if (!results.some((result) => result.id === config.defaultResultId)) {
          issues.push(["E126", FATAL, `${unit.code}/${id}: defaultResultId not in results: ${config.defaultResultId}`]);
        }
        if (!nodeIds.has(config.fallbackNext)) {
          issues.push(["E127", FATAL, `${unit.code}/${id}: fallbackNext missing node: ${config.fallbackNext}`]);
        }
        for (const result of results) {
          const target = nodes[result.next];
          if (!target) {
            issues.push(["E127", FATAL, `${unit.code}/${id}: result ${result.id} missing node: ${result.next}`]);
          } else if (target.type !== "callback" || !(target.segments ?? []).length) {
            issues.push(["E128", FATAL, `${unit.code}/${id}: result ${result.id} without dedicated callback echo (${result.next})`]);
          }
        }
      }
    }
    if (node.type !== "interaction" && node.interaction) {
      issues.push(["E123", FATAL, `${unit.code}/${id}: interaction config on non-interaction node`]);
    }
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
      ...(node.interaction ? [node.interaction.goal ?? "", ...(node.interaction.hints ?? [])] : []),
    ].join(" ");
    for (const word of metaWords) {
      if (texts.includes(word)) issues.push(["E107", FATAL, `${unit.code}/${id}: meta word "${word}"`]);
    }
    const psychoWords = ["意识到", "承认", "决定", "其实", "本质"];
    for (const word of psychoWords) {
      if (texts.includes(word)) issues.push(["E108", WARN, `${unit.code}/${id}: possible psycho word "${word}"`]);
    }
    // —— 语感卡门禁（voice-card.md §3/§5）：只扫叙述层，引号内台词按风格指纹豁免 ——
    const narration = (t) => t.replace(/“[^”]*”/g, "");
    const nodeNarrations = [
      ...(node.segments ?? []).map((s) => narration(s.text)),
      ...variants.flatMap((v) => (v.segments ?? []).map((s) => narration(s.text))),
    ];
    for (const text of nodeNarrations) {
      if (/^第[一二三四五六七八九十]+轮/.test(text)) {
        issues.push(["E116", FATAL, `${unit.code}/${id}: meta opener "第X轮回" in prose: ${text}`]);
      }
      if (/^你想[^。！？]{0,18}[？?]$/.test(text.trim())) {
        issues.push(["E117", FATAL, `${unit.code}/${id}: narrator prompt "你想…？" in prose: ${text}`]);
      }
      if (/(非常|极其|极大|无比|十分|格外|分外|巨大|特别)/.test(text)) {
        issues.push(["E114", WARN, `${unit.code}/${id}: intensifier word in narration: ${text}`]);
      }
      if (/(温柔地|坚定地|冷静地|愤怒地|开心地|悲伤地|难过地|激动地|平静地|轻轻地|缓缓地|慢慢地|淡淡地|冷冷地)/.test(text)) {
        issues.push(["E115", FATAL, `${unit.code}/${id}: emotion adverb in narration: ${text}`]);
      }
      if (/(声音|语气|声线|话|嗓子)(不大|很轻|很淡|很平静|很温柔)，?(却|但)/.test(text)) {
        issues.push(["E121", FATAL, `${unit.code}/${id}: voice-contrast cliché: ${text}`]);
      }
      if (/不是[^。！？]{1,14}，?(而是|是)/.test(text)) {
        issues.push(["E122", FATAL, `${unit.code}/${id}: negation-parade sentence: ${text}`]);
      }
    }
    if (node.type === "closure" || node.type === "ending") {
      for (const text of nodeNarrations) {
        if (/(这(才|就|便|正)是|这一刻|从此|多年以后|人生(就|总是|不过)|命运(总|就是))/.test(text)) {
          issues.push(["E118", WARN, `${unit.code}/${id}: possible elevation/summary ending: ${text}`]);
        }
      }
    }
    const segLens = (node.segments ?? []).map((s) => s.text.length);
    for (let i = 0; i + 2 < segLens.length; i++) {
      const run = segLens.slice(i, i + 3);
      if (Math.max(...run) - Math.min(...run) <= 2) {
        issues.push(["E119", WARN, `${unit.code}/${id}: 3+ uniform-length segments (rhythm)`]);
        break;
      }
    }
    const baseSegments = node.segments ?? [];
    const variantMax = variants.reduce((max, v) => Math.max(max, (v.segments ?? []).length), 0);
    if (Math.max(baseSegments.length, variantMax) > 5) issues.push(["E111", WARN, `${unit.code}/${id}: >5 segments without interaction`]);
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

  // E120 句式重复：同一"名/代词+动词"开头在单元内出现 ≥3 次的叙述句
  const leadingCounts = new Map();
  for (const node of Object.values(nodes)) {
    for (const segment of node.segments ?? []) {
      const lead = segment.text.replace(/“[^”]*”/g, "").slice(0, 3);
      if (lead.length < 3) continue;
      leadingCounts.set(lead, (leadingCounts.get(lead) ?? 0) + 1);
    }
  }
  for (const [lead, count] of leadingCounts) {
    if (count >= 3) issues.push(["E120", WARN, `${unit.code}: sentence-start repetition "${lead}" x${count}`]);
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    options: { unit: { type: "string" }, source: { type: "string" }, ci: { type: "boolean" } },
  });
  const episodes = [];
  const sources = values.source
    ? [values.source]
    : [
        "apps/server/src/data/flashStoryPilot/v2-pilot.json",
        "apps/server/src/data/flashStoryPilot/v2-season1.json",
      ];
  for (const source of sources) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(source, "utf8"));
    } catch (error) {
      console.log(`check-flash-story: cannot read ${source} (${error.code ?? error.message}); skipped`);
      continue;
    }
    const units = Array.isArray(parsed) ? parsed : (parsed.units ?? (parsed.content ? [parsed] : []));
    episodes.push(...units);
  }
  if (values.unit) {
    const selected = episodes.filter((episode) => episode.code === values.unit);
    episodes.length = 0;
    episodes.push(...selected);
  }
  if (episodes.length === 0) {
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
