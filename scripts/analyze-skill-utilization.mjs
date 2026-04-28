#!/usr/bin/env node
/**
 * analyze-skill-utilization.mjs — Skill Utilization Gap Analysis
 *
 * Reads agent turn-summary events from .git/.orchestration/events.jsonl and
 * reports: skills never used (gaps), skills over-used (potential noise),
 * domain-to-skill coverage (% of tasks in domain X that loaded skill Y).
 *
 * Usage:
 *   node scripts/analyze-skill-utilization.mjs [--output=md|json] [--min-gap-tasks=3]
 *
 * Output:
 *   md  — human-readable markdown tables (default)
 *   json — machine-readable JSON summary
 */

import { readFileSync, existsSync } from "fs";
import path from "path";

const EVENTS_PATH = path.join(process.cwd(), ".git", ".orchestration", "events.jsonl");
const MIN_GAP_TASKS = parseInt(process.argv.find((a) => a.startsWith("--min-gap-tasks="))?.split("=")[1] || "3", 10);
const OUTPUT = process.argv.find((a) => a.startsWith("--output="))?.split("=")[1] || "md";

const DOMAIN_KEYWORDS = {
  payments: ["payment", "refund", "wechat pay", "credits", "entitlement", "event pack"],
  auth: ["auth", "login", "session", "gate this route", "admin only", "rbac"],
  matching: ["matching", "scoring", "group formation", "pair", "chemistry"],
  onboarding: ["onboarding", "registration", "profile", "nextStep", "setup"],
  personality: ["personality", "archetype", "trait", "assessment", "chemotype"],
  icebreaker: ["icebreaker", "social session", "warmup", "recap", "phase"],
  admin: ["admin", "dashboard", "rbac", "super_admin", "operator"],
  pools: ["event pool", "pool management", "registration", "capacity"],
  venues: ["venue", "location", "amap", "geocode", "time slot"],
  notifications: ["notification", "broadcast", "mark-read", "badge"],
  semantic: ["semantic", "embedding", "vector", "cosine similarity", "deepseek"],
  miniProgram: ["mini-program", "taro", "weapp", "wechat ui", "wxml"],
};

const DOMAIN_SKILL_MAP = {
  payments: ["payment-entitlement-authority", "reliability-and-state-integrity"],
  auth: ["auth-session-and-safety-boundaries", "admin-audit-and-rbac-governance"],
  matching: ["matching-domain", "event-pool-and-matching-operations"],
  onboarding: ["onboarding-state-architecture"],
  personality: ["personality-system"],
  icebreaker: ["social-icebreaker-domain", "game-design-icebreaker-compilation"],
  admin: ["admin-client-frontend", "admin-audit-and-rbac-governance"],
  pools: ["event-pool-and-matching-operations"],
  venues: ["venue-location-services"],
  notifications: ["notification-system"],
  semantic: ["semantic-matching-embeddings", "llm-runtime-safety-and-integration"],
  miniProgram: ["mini-program-frontend-excellence", "platform-coordination-protocol"],
};

function detectDomains(prompt) {
  if (!prompt) return ["unknown"];
  const lower = prompt.toLowerCase();
  const matches = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matches.push(domain);
    }
  }
  return matches.length > 0 ? matches : ["unknown"];
}

function loadEvents() {
  if (!existsSync(EVENTS_PATH)) {
    return [];
  }

  const raw = readFileSync(EVENTS_PATH, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function extractTurnSummaries(events) {
  const summaries = [];
  for (const event of events) {
    if (event.turnSummary) {
      summaries.push(event.turnSummary);
    }
    if (event.event === "record-summary" && event.summary) {
      summaries.push(event.summary);
    }
  }
  return summaries;
}

function gatherUtilization(summaries) {
  const skillUsage = {};
  const domainTaskCounts = {};
  const domainSkillCoverage = {};

  for (const summary of summaries) {
    const prompt = summary.prompt || summary.promptSummary || "";
    const skills = summary.skills || summary.utilization?.skills || [];
    const agent = summary.agent || "";

    for (const skill of skills) {
      if (!skillUsage[skill]) {
        skillUsage[skill] = 0;
      }
      skillUsage[skill] += 1;
    }

    const domains = detectDomains(prompt);
    for (const domain of domains) {
      if (!domainTaskCounts[domain]) {
        domainTaskCounts[domain] = 0;
        domainSkillCoverage[domain] = {};
      }
      domainTaskCounts[domain] += 1;

      for (const skill of skills) {
        if (!domainSkillCoverage[domain][skill]) {
          domainSkillCoverage[domain][skill] = 0;
        }
        domainSkillCoverage[domain][skill] += 1;
      }
    }
  }

  return { skillUsage, domainTaskCounts, domainSkillCoverage };
}

function findGaps(skillUsage, totalTurns) {
  if (totalTurns < MIN_GAP_TASKS) return [];
  
  const SKILLS = new Set([
    ...Object.keys(skillUsage),
    ...Object.values(DOMAIN_SKILL_MAP).flat(),
  ]);

  return [...SKILLS]
    .filter((skill) => !(skill in skillUsage) || skillUsage[skill] === 0)
    .sort();
}

function findOverused(skillUsage, totalTurns) {
  if (totalTurns < MIN_GAP_TASKS) return [];

  return Object.entries(skillUsage)
    .filter(([, count]) => count > totalTurns * 0.5)
    .map(([skill, count]) => ({ skill, count, pct: ((count / totalTurns) * 100).toFixed(0) }))
    .sort((a, b) => b.count - a.count);
}

function computeDomainCoverage(domainSkillCoverage, domainTaskCounts) {
  const results = {};
  for (const domain of Object.keys(DOMAIN_SKILL_MAP)) {
    const expectedSkills = DOMAIN_SKILL_MAP[domain];
    const taskCount = domainTaskCounts[domain] || 0;

    if (taskCount === 0) {
      results[domain] = { taskCount: 0, coverage: [], note: "no tasks in domain" };
      continue;
    }

    const coverage = expectedSkills.map((skill) => {
      const usedCount = domainSkillCoverage[domain]?.[skill] || 0;
      return {
        skill,
        usedCount,
        coveragePct: ((usedCount / taskCount) * 100).toFixed(0),
      };
    });

    results[domain] = { taskCount, coverage };
  }
  return results;
}

function outputMarkdown({ skillUsage, totalTurns, gaps, overused, domainCoverage }) {
  const lines = [];

  lines.push("# Skill Utilization Analysis");
  lines.push("");
  lines.push(`**Total turn-summary events analyzed:** ${totalTurns}`);
  lines.push("");

  if (totalTurns === 0) {
    lines.push("> No turn-summary data found in events.jsonl. Run more agent sessions to populate utilization data.");
    lines.push("");
    console.log(lines.join("\n"));
    return;
  }

  if (totalTurns < MIN_GAP_TASKS) {
    lines.push(`> Sample size (${totalTurns} turns) below analysis threshold (${MIN_GAP_TASKS}). Run more agent sessions.`);
    lines.push("");
    console.log(lines.join("\n"));
    return;
  }

  lines.push("## Skill Gaps (never used)");
  lines.push("");
  if (gaps.length === 0) {
    lines.push("No unused skills detected.");
  } else {
    lines.push("| Skill | Suggested Domain |");
    lines.push("|-------|-----------------|");
    for (const skill of gaps) {
      const domain = Object.entries(DOMAIN_SKILL_MAP).find(([, skills]) => skills.includes(skill))?.[0] || "unknown";
      lines.push(`| \`${skill}\` | ${domain} |`);
    }
  }
  lines.push("");

  lines.push("## Potentially Over-Used Skills (>50% of turns)");
  lines.push("");
  if (overused.length === 0) {
    lines.push("No over-used skills detected.");
  } else {
    lines.push("| Skill | Uses | % of Turns |");
    lines.push("|-------|------|-----------|");
    for (const { skill, count, pct } of overused) {
      lines.push(`| \`${skill}\` | ${count} | ${pct}% |`);
    }
  }
  lines.push("");

  lines.push("## Domain-to-Skill Coverage");
  lines.push("");
  lines.push("| Domain | Tasks | Expected Skill | Loaded | Coverage |");
  lines.push("|--------|-------|---------------|--------|----------|");
  for (const [domain, { taskCount, coverage, note }] of Object.entries(domainCoverage)) {
    if (note) {
      lines.push(`| ${domain} | 0 | — | — | ${note} |`);
      continue;
    }
    for (const { skill, usedCount, coveragePct } of coverage) {
      lines.push(`| ${domain} | ${taskCount} | \`${skill}\` | ${usedCount} | ${coveragePct}% |`);
    }
  }

  console.log(lines.join("\n"));
}

function outputJson({ skillUsage, totalTurns, gaps, overused, domainCoverage }) {
  const result = {
    totalTurns,
    analysisThreshold: MIN_GAP_TASKS,
    sufficientData: totalTurns >= MIN_GAP_TASKS,
    gaps,
    overused,
    domainCoverage,
    skillUsage,
  };
  console.log(JSON.stringify(result, null, 2));
}

function main() {
  const events = loadEvents();
  const summaries = extractTurnSummaries(events);
  const totalTurns = summaries.length;

  const { skillUsage, domainTaskCounts, domainSkillCoverage } = gatherUtilization(summaries);
  const gaps = findGaps(skillUsage, totalTurns);
  const overused = findOverused(skillUsage, totalTurns);
  const domainCoverage = computeDomainCoverage(domainSkillCoverage, domainTaskCounts);

  if (OUTPUT === "json") {
    outputJson({ skillUsage, totalTurns, gaps, overused, domainCoverage });
  } else {
    outputMarkdown({ skillUsage, totalTurns, gaps, overused, domainCoverage });
  }
}

main();
