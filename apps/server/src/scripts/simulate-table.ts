/**
 * JoyJoin 饭局模拟器 — dev/QA harness.
 *
 * Six anonymized seat personas (one LLM call per seat) talk to each other for a
 * few rounds; deterministic heuristics plus one judge call flag the awkwardness.
 * Writes nothing to the database.
 *
 * Run:
 *   npm run simulate:table -w @joyjoin/server -- --fixture=corgi-mix --rounds=3
 *   npm run simulate:table -w @joyjoin/server -- --session-id=<socialSessionId> --json
 */

import { pool } from '../db';
import { getSession, listParticipants } from '../lib/socialIcebreakerStore';
import {
  DEFAULT_TABLE_SIMULATION_FIXTURE,
  TABLE_SIMULATION_FIXTURES,
  getFixture,
} from '../lib/tableSimulation/fixtures';
import { assertTableSimulationAllowed, replayTableTranscript, runTableSimulation, type SimulationLLMCaller } from '../lib/tableSimulation/simulateTable';
import type {
  ReplayTurnInput,
  SimulationSeatInput,
  TableSimulationReport,
} from '../lib/tableSimulation/types';

function readArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const withEquals = args.find((arg) => arg.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) {
    return args[index + 1];
  }
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function readNumberArg(name: string, fallback: number): number {
  const raw = readArg(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Zero-cost wiring check: every seat stays silent, so the run exercises the
 * transcript, heuristics and printing without touching a provider.
 */
const dryRunCaller: SimulationLLMCaller = async (call) => {
  if (call.callerTag === 'tableSimulationJudge') {
    return {
      content: JSON.stringify({ overallRead: 'dry-run：全员沉默', riskiestMoment: null, flags: [] }),
      provider: 'dry-run',
      model: 'dry-run',
      latencyMs: 0,
    };
  }
  return {
    content: JSON.stringify({ speak: false, innerThought: 'dry-run' }),
    provider: 'dry-run',
    model: 'dry-run',
    latencyMs: 0,
  };
};

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function printReport(report: TableSimulationReport): void {
  console.log('');
  console.log('=== JoyJoin 饭局模拟 ===');
  console.log(
    `来源: ${report.fixture ?? report.sessionId ?? 'inline'} | 座位: ${report.seatCount} | 轮次: ${report.rounds} | seed: ${report.seed}`,
  );
  console.log(
    `模式: ${report.mode} | provider: ${report.meta.providers.join(',') || 'n/a'} | model: ${report.meta.models.join(',') || 'n/a'} | 耗时: ${(report.meta.latencyMs / 1000).toFixed(1)}s`,
  );
  console.log('');

  console.log('座位画像');
  for (const persona of report.personas) {
    const interests = persona.interests.length ? persona.interests.join('/') : '—';
    console.log(`  ${persona.seat}  ${persona.archetypeLabel.padEnd(6, '　')}  ${persona.energy.padEnd(7)}  ${interests}  ${persona.vibe}`);
  }
  console.log('');

  console.log('对话记录');
  for (const turn of report.transcript) {
    if (turn.speak && turn.text) {
      console.log(`  R${turn.round} ${turn.seat}：${turn.text}`);
    } else {
      console.log(`  R${turn.round} ${turn.seat}：（沉默）`);
    }
  }
  console.log('');

  console.log(`尴尬点（${report.flags.length}）`);
  if (report.flags.length === 0) {
    console.log('  无');
  } else {
    for (const flag of report.flags) {
      console.log(`  [${flag.severity.toUpperCase()}] ${flag.code}  ${flag.seats.join(',')}  ${flag.evidence}`);
    }
  }
  console.log('');

  if (report.judge) {
    console.log('裁判');
    console.log(`  overallRead: ${report.judge.overallRead}`);
    console.log(`  riskiestMoment: ${report.judge.riskiestMoment ?? '—'}`);
    console.log('');
  }

  console.log(`尴尬指数: ${report.awkwardnessScore}/100`);
  console.log(`发言覆盖率: ${formatPercent(report.transcript.filter((turn) => turn.speak).length / Math.max(1, report.transcript.length))}`);
  for (const note of report.notes) {
    console.log(`note: ${note}`);
  }
  console.log('');
}

async function loadRosterFromSession(sessionId: string): Promise<SimulationSeatInput[]> {
  const state = await getSession(sessionId);
  if (!state) {
    throw new Error(`找不到可用的 social session: ${sessionId}`);
  }
  const participants = await listParticipants(sessionId);
  if (participants.length < 2) {
    throw new Error(`session ${sessionId} 只有 ${participants.length} 位参与者，无法模拟`);
  }
  return participants.map((participant) => ({
    archetype: participant.archetype ?? null,
    primaryArchetype: participant.primaryArchetype ?? null,
    interests: participant.interests ?? null,
    tableVibePreference: participant.profile?.tableVibePreference ?? null,
  }));
}

async function main(): Promise<void> {
  assertTableSimulationAllowed();

  const fixtureName = readArg('fixture');
  const sessionId = readArg('session-id');
  const rounds = readNumberArg('rounds', 3);
  const seed = readNumberArg('seed', 20261109);
  const judge = !hasFlag('no-judge') && !hasFlag('heuristic-only');
  const dryRun = hasFlag('dry-run');
  const asJson = hasFlag('json');
  const outPath = readArg('out');

  let roster: SimulationSeatInput[] = [];
  let fixture: string | undefined;

  const transcriptPath = readArg('transcript');
  let report: TableSimulationReport;

  if (transcriptPath) {
    const { readFile } = await import('node:fs/promises');
    const raw = JSON.parse(await readFile(transcriptPath, 'utf8')) as {
      roster?: SimulationSeatInput[];
      personas?: TableSimulationReport['personas'];
      transcript: ReplayTurnInput[];
      fixture?: string;
    };
    if (!Array.isArray(raw.transcript)) {
      throw new Error('transcript 文件需要包含 transcript 数组');
    }
    report = replayTableTranscript({
      roster: raw.roster,
      personas: raw.personas,
      transcript: raw.transcript,
      fixture: raw.fixture ?? fixtureName,
      seed,
    });
  } else {
    if (sessionId) {
      roster = await loadRosterFromSession(sessionId);
    } else {
      fixture = fixtureName ?? DEFAULT_TABLE_SIMULATION_FIXTURE;
      if (!TABLE_SIMULATION_FIXTURES[fixture]) {
        throw new Error(
          `未知 fixture: ${fixture}。可用：${Object.keys(TABLE_SIMULATION_FIXTURES).join(', ')}`,
        );
      }
      roster = getFixture(fixture).roster;
    }

    report = await runTableSimulation({
      roster,
      rounds,
      seed,
      judge,
      fixture,
      sessionId,
      ...(dryRun ? { callLLM: dryRunCaller } : {}),
    });
  }

  if (asJson || outPath) {
    const payload = JSON.stringify(report, null, 2);
    if (outPath) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(outPath, payload, 'utf8');
      console.log(`已写入 ${outPath}`);
    }
    if (asJson) console.log(payload);
  }

  if (!asJson) printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error('[SimulateTable] failed', error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end().catch(() => undefined);
    });
}
