#!/usr/bin/env node
/**
 * orchestration-routing-metrics.mjs — Agent Routing Quality Metrics
 *
 * Reads supervisor_turn_report and agent_turn_summary records from
 * .git/.orchestration/events.jsonl and computes routing quality KPIs.
 *
 * Metrics:
 *   1. Reroute Rate      — % of tasks requiring midstream reroute by Supervisor
 *   2. Handoff Completion — % of specialists that completed without reroute
 *   3. Skill-Loading Acc — % of domain-tagged tasks that loaded the expected skill
 *
 * Usage:
 *   node scripts/orchestration/orchestration-routing-metrics.mjs [--output=md|json]
 */

import { readFileSync, existsSync } from "fs";
import path from "path";

const EVENTS_PATH = path.join(process.cwd(), ".git", ".orchestration", "events.jsonl");
const OUTPUT = process.argv.find((a) => a.startsWith("--output="))?.split("=")[1] || "md";

const DOMAIN_EXPECTED_SKILL = {
  payment: "payment-entitlement-authority",
  refund: "payment-entitlement-authority",
  auth: "auth-session-and-safety-boundaries",
  login: "auth-session-and-safety-boundaries",
  session: "auth-session-and-safety-boundaries",
  matching: "matching-domain",
  onboarding: "onboarding-state-architecture",
  personality: "personality-system",
  archetype: "personality-system",
  icebreaker: "social-icebreaker-domain",
  admin: "admin-audit-and-rbac-governance",
  pool: "event-pool-and-matching-operations",
  venue: "venue-location-services",
  notification: "notification-system",
  semantic: "semantic-matching-embeddings",
  "mini-program": "mini-program-frontend-excellence",
  taro: "mini-program-frontend-excellence",
  websocket: "websocket-realtime",
};

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

function extractRoutingRecords(events) {
  const records = [];

  for (const event of events) {
    if (event.supervisor_turn_report) {
      records.push({
        type: "supervisor",
        agent: "Supervisor",
        data: event.supervisor_turn_report,
        timestamp: event.recordedAt || event.timestamp,
      });
    }

    if (event.agent_turn_summary) {
      const summary = event.agent_turn_summary;
      records.push({
        type: "agent",
        agent: summary.agent || "unknown",
        data: summary,
        timestamp: event.recordedAt || event.timestamp,
        prompt: summary.prompt || event.promptSummary || "",
        skills: summary.skills || summary.utilization?.skills || [],
        turnStatus: summary.turnStatus || "unknown",
      });
    }

    if (event.route || event.reroute) {
      records.push({
        type: "route",
        data: event,
        timestamp: event.recordedAt,
      });
    }
  }

  return records;
}

function computeRerouteRate(records) {
  const agentRecords = records.filter((r) => r.type === "agent");
  const totalAgentTurns = agentRecords.length;

  if (totalAgentTurns === 0) {
    return { totalTurns: 0, reroutes: 0, rate: null, perAgent: {} };
  }

  const perAgent = {};
  let reroutes = 0;

  for (const record of agentRecords) {
    const agent = record.agent;
    if (!perAgent[agent]) {
      perAgent[agent] = { turns: 0, completed: 0, rerouted: 0, unknown: 0 };
    }
    perAgent[agent].turns += 1;

    const status = record.turnStatus;
    if (status === "complete" || status === "ready") {
      perAgent[agent].completed += 1;
    } else if (status === "reroute" || status === "blocked") {
      perAgent[agent].rerouted += 1;
      reroutes += 1;
    } else if (status === "in_progress") {
      // in-progress turns are neither completed nor rerouted
    } else {
      perAgent[agent].unknown += 1;
    }
  }

  const rate = totalAgentTurns > 0 ? ((reroutes / totalAgentTurns) * 100).toFixed(1) : null;

  return { totalTurns: totalAgentTurns, reroutes, rate, perAgent };
}

function computeHandoffCompletion(records) {
  const agentRecords = records.filter((r) => r.type === "agent");
  const totalTurns = agentRecords.length;

  if (totalTurns === 0) {
    return { totalTurns: 0, completed: 0, rate: null, perAgent: {} };
  }

  const perAgent = {};
  let completed = 0;

  for (const record of agentRecords) {
    const agent = record.agent;
    if (!perAgent[agent]) {
      perAgent[agent] = { turns: 0, completed: 0 };
    }
    perAgent[agent].turns += 1;

    const status = record.turnStatus;
    if (status === "complete" || status === "ready") {
      perAgent[agent].completed += 1;
      completed += 1;
    }
  }

  const rate = totalTurns > 0 ? ((completed / totalTurns) * 100).toFixed(1) : null;

  return { totalTurns, completed, rate, perAgent };
}

function computeSkillLoadingAccuracy(records) {
  const agentRecords = records.filter((r) => r.type === "agent" && r.prompt && r.prompt.length > 0);
  const total = agentRecords.length;

  if (total === 0) {
    return { totalTasks: 0, accurate: 0, rate: null, matches: [] };
  }

  let accurate = 0;
  const matches = [];

  for (const record of agentRecords) {
    const prompt = record.prompt.toLowerCase();
    const skills = record.skills.map((s) => s.toLowerCase());

    let expectedSkill = null;
    for (const [keyword, skill] of Object.entries(DOMAIN_EXPECTED_SKILL)) {
      if (prompt.includes(keyword)) {
        expectedSkill = skill;
        break;
      }
    }

    if (expectedSkill && skills.includes(expectedSkill)) {
      accurate += 1;
      matches.push({ prompt: record.prompt.slice(0, 80), expected: expectedSkill, loaded: true });
    } else if (expectedSkill) {
      matches.push({ prompt: record.prompt.slice(0, 80), expected: expectedSkill, loaded: false, actualSkills: record.skills });
    }
  }

  const rate = total > 0 ? ((accurate / total) * 100).toFixed(1) : null;

  return { totalTasks: total, accurate, rate, matches };
}

function outputMarkdown({ rerouteRate, handoffCompletion, skillAccuracy }) {
  const lines = [];

  lines.push("# Agent Routing Quality Metrics");
  lines.push("");

  const totalTurns = rerouteRate.totalTurns + (rerouteRate.totalTurns === 0 && handoffCompletion.totalTurns === 0 ? 0 : 0);
  const actualTurns = Math.max(rerouteRate.totalTurns, handoffCompletion.totalTurns);

  if (actualTurns === 0) {
    lines.push("> No agent turn-summary data found in events.jsonl. Run more agent sessions to populate routing metrics.");
    lines.push("> Once data exists, `record-summary` events with `turnStatus` and `skills` fields will feed these metrics.");
    console.log(lines.join("\n"));
    return;
  }

  lines.push(`**Agent turns analyzed:** ${actualTurns}`);
  lines.push("");

  lines.push("## 1. Reroute Rate");
  lines.push("");
  if (rerouteRate.rate === null) {
    lines.push("Insufficient data.");
  } else {
    lines.push(`- **Overall reroute rate:** ${rerouteRate.rate}% (${rerouteRate.reroutes} reroutes / ${rerouteRate.totalTurns} turns)`);
    lines.push("");
    lines.push("| Agent | Turns | Rerouted | Reroute % |");
    lines.push("|-------|-------|----------|-----------|");
    for (const [agent, stats] of Object.entries(rerouteRate.perAgent).sort()) {
      const pct = stats.turns > 0 ? ((stats.rerouted / stats.turns) * 100).toFixed(1) : "0.0";
      lines.push(`| ${agent} | ${stats.turns} | ${stats.rerouted} | ${pct}% |`);
    }
  }
  lines.push("");

  lines.push("## 2. Handoff Completion Rate");
  lines.push("");
  if (handoffCompletion.rate === null) {
    lines.push("Insufficient data.");
  } else {
    lines.push(`- **Overall completion rate:** ${handoffCompletion.rate}% (${handoffCompletion.completed} completed / ${handoffCompletion.totalTurns} turns)`);
    lines.push("");
    lines.push("| Agent | Turns | Completed | Completion % |");
    lines.push("|-------|-------|-----------|-------------|");
    for (const [agent, stats] of Object.entries(handoffCompletion.perAgent).sort()) {
      const pct = stats.turns > 0 ? ((stats.completed / stats.turns) * 100).toFixed(1) : "0.0";
      lines.push(`| ${agent} | ${stats.turns} | ${stats.completed} | ${pct}% |`);
    }
  }
  lines.push("");

  lines.push("## 3. Skill-Loading Accuracy");
  lines.push("");
  if (skillAccuracy.rate === null) {
    lines.push("Insufficient data.");
  } else {
    lines.push(`- **Overall accuracy:** ${skillAccuracy.rate}% (${skillAccuracy.accurate} accurate / ${skillAccuracy.totalTasks} domain-tagged tasks)`);
    lines.push("");
    if (skillAccuracy.matches.length > 0) {
      lines.push("| Task | Expected Skill | Loaded |");
      lines.push("|------|---------------|--------|");
      for (const match of skillAccuracy.matches.slice(0, 20)) {
        lines.push(`| ${match.prompt} | \`${match.expected}\` | ${match.loaded ? "yes" : "no" + (match.actualSkills ? " (got: " + match.actualSkills.join(", ") + ")" : "")} |`);
      }
    }
  }

  console.log(lines.join("\n"));
}

function outputJson({ rerouteRate, handoffCompletion, skillAccuracy }) {
  const result = {
    rerouteRate,
    handoffCompletion,
    skillAccuracy,
  };
  console.log(JSON.stringify(result, null, 2));
}

function main() {
  const events = loadEvents();
  const records = extractRoutingRecords(events);

  const rerouteRate = computeRerouteRate(records);
  const handoffCompletion = computeHandoffCompletion(records);
  const skillAccuracy = computeSkillLoadingAccuracy(records);

  if (OUTPUT === "json") {
    outputJson({ rerouteRate, handoffCompletion, skillAccuracy });
  } else {
    outputMarkdown({ rerouteRate, handoffCompletion, skillAccuracy });
  }
}

main();
