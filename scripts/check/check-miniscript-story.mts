#!/usr/bin/env node
// check-miniscript-story.mts — 迷你剧本杀 v2 catalog 质量门
// Sprint: miniscript-v2-p1-data-layer (AC-07)
// Pattern aligned with check-flash-story.mjs: exit 0=pass, 1=fatal, 2=warnings
// only (--ci treats warnings as pass). Deterministic structural checks always
// run; the LLM critic + auto-revise loop (≤2 rounds) is opt-in via --llm and
// requires DEEPSEEK_API_KEY (repo-root .env is loaded as a fallback).
// Default mode is a dry-run: nothing is written except the optional report.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import {
  MINISCRIPT_CURATED_STORIES,
  // @ts-expect-error — tsx resolves the TS source at runtime
} from '../../packages/shared/src/miniscriptCuratedStories.ts';
import {
  miniScriptStoryFrameworkSchema,
  // @ts-expect-error — tsx resolves the TS source at runtime
} from '../../packages/shared/src/miniscriptStoryFramework.ts';

const FATAL = 'fatal';
const WARN = 'warn';
const MAX_REVISE_ROUNDS = 2;
const REACTION_TARGET_MIN = 30;
const REACTION_TARGET_MAX = 60;
const REACTION_HARD_CAP = 120;

type Issue = [code: string, level: typeof FATAL | typeof WARN, message: string];

type StoryReport = {
  id: string;
  title: string;
  pass: boolean;
  rounds: number;
  violations: Array<{ code: string; level: string; message: string }>;
};

type Report = {
  generatedAt: string;
  mode: { llm: boolean; dryRun: boolean };
  stories: StoryReport[];
  totals: { stories: number; passed: number; failed: number; fatals: number; warnings: number };
};

// ─── Deterministic structural checks ─────────────────────────────────────────

function scanStory(raw: unknown, index: number): { issues: Issue[]; story: any } {
  const label = (raw as any)?.title ?? (raw as any)?.premise?.slice?.(0, 12) ?? `story#${index}`;
  const issues: Issue[] = [];

  const parsed = miniScriptStoryFrameworkSchema.safeParse(raw);
  if (!parsed.success) {
    issues.push(['E201', FATAL, `${label}: schema validation failed: ${parsed.error.message.slice(0, 200)}`]);
    return { issues, story: null };
  }
  const story = parsed.data as any;
  const roleSlots = story.characters.map((c: any) => c.slotIndex + 1);

  const motiveOptions = story.motiveOptions as string[] | undefined;
  if (!motiveOptions || motiveOptions.length < 3 || motiveOptions.length > 4) {
    issues.push(['E202', FATAL, `${label}: motiveOptions missing or outside 3-4 items`]);
  }

  const seenEvidenceIds = new Set<string>();
  story.act_flow.forEach((act: any, actIdx: number) => {
    const evidence = act.evidence as any[] | undefined;
    if (!evidence || evidence.length === 0) {
      issues.push(['E203', FATAL, `${label}: act ${act.actNumber ?? actIdx + 1} has no evidence[]`]);
      return;
    }
    for (const item of evidence) {
      if (seenEvidenceIds.has(item.id)) {
        issues.push(['E207', FATAL, `${label}: duplicate evidence id: ${item.id}`]);
      }
      seenEvidenceIds.add(item.id);
      const reactions = item.evidenceReactions as Record<string, string> | undefined;
      if (!reactions) {
        issues.push(['E204', FATAL, `${label}/${item.id}: missing evidenceReactions`]);
        continue;
      }
      for (const slot of roleSlots) {
        const text = reactions[String(slot)];
        if (!text) {
          issues.push(['E204', FATAL, `${label}/${item.id}: no reaction for roleSlot ${slot}`]);
          continue;
        }
        if (text.length > REACTION_HARD_CAP) {
          issues.push(['E205', FATAL, `${label}/${item.id}: reaction for roleSlot ${slot} exceeds ${REACTION_HARD_CAP} chars (${text.length})`]);
        } else if (text.length < REACTION_TARGET_MIN || text.length > REACTION_TARGET_MAX) {
          issues.push(['E206', WARN, `${label}/${item.id}: reaction for roleSlot ${slot} outside ${REACTION_TARGET_MIN}-${REACTION_TARGET_MAX} target (${text.length})`]);
        }
      }
    }
  });

  return { issues, story };
}

// ─── LLM critic + auto-revise (opt-in) ───────────────────────────────────────

function loadEnvKey(): string | undefined {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*DEEPSEEK_API_KEY\s*=\s*(.+)\s*$/);
    if (match) return match[1]!.replace(/^["']|["']$/g, '');
  }
  return undefined;
}

async function deepseekJson(apiKey: string, system: string, user: string, maxTokens: number): Promise<any> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      // Top-level thinking control — NEVER extra_body (docs/ai/AI_MODEL_ROUTING_STRATEGY.md).
      thinking: { type: 'disabled' },
    }),
  });
  if (!res.ok) throw new Error(`deepseek http ${res.status}`);
  const data = (await res.json()) as any;
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  const fence = content.match(/```json\s*([\s\S]*?)```/) || content.match(/```\s*([\s\S]*?)```/);
  return JSON.parse(fence?.[1]?.trim() ?? content);
}

function collectReactions(story: any): Array<{ evidenceId: string; roleSlot: string; text: string }> {
  const out: Array<{ evidenceId: string; roleSlot: string; text: string }> = [];
  for (const act of story.act_flow) {
    for (const item of act.evidence ?? []) {
      for (const [roleSlot, text] of Object.entries(item.evidenceReactions ?? {})) {
        out.push({ evidenceId: item.id, roleSlot, text: text as string });
      }
    }
  }
  return out;
}

async function criticPass(apiKey: string, story: any): Promise<Array<{ type: string; detail: string }>> {
  const reactions = collectReactions(story)
    .map((r) => `- [${r.evidenceId}→角色${r.roleSlot}] ${r.text}`)
    .join('\n');
  const user =
    `【真相（仅你可见）】当事人：${story.solution.who}；做了什么：${story.solution.what}；真实动机：${story.solution.why}\n\n` +
    `【证物反应文本】\n${reactions || '（无）'}\n\n` +
    `【动机选项（公开）】\n${(story.motiveOptions ?? []).map((o: string, i: number) => `${i + 1}. ${o}`).join('\n') || '（无）'}\n\n` +
    `检测：1) leak 反应文本确认/排除当事人或泄露真相，动机干扰项蕴含真动机，选项标注正确性；` +
    `2) violence 暴力/死亡/血腥；3) tone 高压对抗基调（只允许低压力小误会）。\n` +
    `输出 {"violations":[{"type":"leak|violence|tone","detail":"≤40字"}]}，无违规则 {"violations":[]}`;
  const parsed = await deepseekJson(
    apiKey,
    'You are a content safety reviewer for a light social mystery party game. Reply with one JSON object only.',
    user,
    600,
  );
  return Array.isArray(parsed?.violations) ? parsed.violations : [];
}

async function revisePass(apiKey: string, story: any, violations: Array<{ type: string; detail: string }>): Promise<any> {
  const user =
    `以下迷你剧本杀剧本 JSON 的 evidenceReactions / motiveOptions 未通过质检：\n` +
    violations.map((v) => `- ${v.type}: ${v.detail}`).join('\n') +
    `\n\n【真相】当事人：${story.solution.who}；做了什么：${story.solution.what}；真实动机：${story.solution.why}\n\n` +
    `【剧本 JSON】\n${JSON.stringify(story)}\n\n` +
    `只修改 evidenceReactions 与 motiveOptions 使违规消除：反应文本每条 30-60 字、不得确认/排除当事人、不得泄露真相；` +
    `动机选项 3-4 个、干扰项不得蕴含真动机、不得标注正确性。其余字段原样保留。输出完整剧本 JSON。`;
  return deepseekJson(
    apiKey,
    'You are a MiniScript story editor for a light social mystery party game. Reply with one JSON object only.',
    user,
    3500,
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      fixture: { type: 'string' },
      report: { type: 'string' },
      llm: { type: 'boolean' },
      ci: { type: 'boolean' },
    },
  });

  let stories: unknown[];
  if (values.fixture) {
    const parsed = JSON.parse(readFileSync(values.fixture, 'utf8'));
    stories = Array.isArray(parsed) ? parsed : [parsed];
  } else {
    stories = [...MINISCRIPT_CURATED_STORIES];
  }
  if (stories.length === 0) {
    console.log('check-miniscript-story: no stories supplied; skipped (exit 0)');
    process.exit(0);
  }

  const apiKey = values.llm ? loadEnvKey() : undefined;
  if (values.llm && !apiKey) {
    console.log('check-miniscript-story: --llm requires DEEPSEEK_API_KEY (env or repo-root .env)');
    process.exit(1);
  }

  const reports: StoryReport[] = [];
  let anyFatal = false;
  let anyWarn = false;

  for (let i = 0; i < stories.length; i++) {
    let { issues, story } = scanStory(stories[i], i);
    let rounds = 0;

    if (story && apiKey) {
      // LLM critic + auto-revise loop (≤2 rounds). Revised candidates must
      // still pass the deterministic scan before acceptance.
      while (rounds <= MAX_REVISE_ROUNDS) {
        let llmViolations: Array<{ type: string; detail: string }> = [];
        try {
          llmViolations = await criticPass(apiKey, story);
        } catch (error) {
          issues.push(['E209', WARN, `${story.title}: llm critic unavailable (${error instanceof Error ? error.message : String(error)})`]);
          break;
        }
        if (llmViolations.length === 0) break;
        if (rounds >= MAX_REVISE_ROUNDS) {
          for (const v of llmViolations) {
            issues.push(['E208', FATAL, `${story.title}: llm critic violation after ${MAX_REVISE_ROUNDS} revise rounds — ${v.type}: ${v.detail}`]);
          }
          break;
        }
        rounds += 1;
        try {
          const revised = await revisePass(apiKey, story, llmViolations);
          const rescan = scanStory(revised, i);
          if (rescan.story && !rescan.issues.some(([, level]) => level === FATAL)) {
            story = rescan.story;
            issues = rescan.issues;
          } else {
            issues.push(['E210', WARN, `${story.title}: revise round ${rounds} output failed deterministic rescan; kept original`]);
          }
        } catch (error) {
          issues.push(['E209', WARN, `${story.title}: llm revise failed (${error instanceof Error ? error.message : String(error)})`]);
          break;
        }
      }
    }

    for (const [, level] of issues) {
      if (level === FATAL) anyFatal = true;
      if (level === WARN) anyWarn = true;
    }
    for (const [code, level, message] of issues) {
      console.log(`[${level.toUpperCase()}] ${code} ${message}`);
    }
    reports.push({
      id: `story-${i}`,
      title: story?.title ?? `story#${i}`,
      pass: !issues.some(([, level]) => level === FATAL),
      rounds,
      violations: issues.map(([code, level, message]) => ({ code, level, message })),
    });
  }

  const fatals = reports.reduce((n, r) => n + r.violations.filter((v) => v.level === FATAL).length, 0);
  const warnings = reports.reduce((n, r) => n + r.violations.filter((v) => v.level === WARN).length, 0);
  const report: Report = {
    generatedAt: new Date().toISOString(),
    mode: { llm: Boolean(apiKey), dryRun: true },
    stories: reports,
    totals: {
      stories: reports.length,
      passed: reports.filter((r) => r.pass).length,
      failed: reports.filter((r) => !r.pass).length,
      fatals,
      warnings,
    },
  };
  if (values.report) {
    writeFileSync(values.report, JSON.stringify(report, null, 2));
    console.log(`check-miniscript-story: report written to ${values.report}`);
  }

  if (anyFatal) {
    console.log(`check-miniscript-story: FAIL (${fatals} fatal, ${warnings} warnings)`);
    process.exit(1);
  }
  if (anyWarn && !values.ci) {
    console.log(`check-miniscript-story: WARN (${warnings} warnings)`);
    process.exit(2);
  }
  console.log(`check-miniscript-story: PASS (${warnings} warnings${values.ci ? ' tolerated' : ''})`);
  process.exit(0);
}

main().catch((error) => {
  console.error(`check-miniscript-story: unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
