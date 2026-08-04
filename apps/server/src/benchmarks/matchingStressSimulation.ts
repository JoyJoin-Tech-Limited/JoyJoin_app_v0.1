/**
 * Matching stress / simulation harness (local CPU, no DB).
 *
 * Runs the same greedy matcher as production (`runGreedyPoolMatchingCore`) on
 * synthetic in-memory users + interests. Pairwise scoring is O(n²); use staging
 * machines for n ≥ 2000.
 *
 * Optional second phase: existing AI chat-flow simulation (still no network LLM
 * in the default loop — see `aiChatFlowSimulation.ts`).
 *
 * Usage (from repo root):
 *   npx tsx apps/server/src/benchmarks/matchingStressSimulation.ts [userCount] [--ai-chat N]
 */

import { ARCHETYPE_ENERGY } from '../archetypeChemistry';
import type { ArchetypeName } from '../archetypeConfig';
import {
  runGreedyPoolMatchingCore,
  type GreedyPoolMatchingConfig,
  type UserInterestsCache,
  type UserWithProfile,
} from '../poolMatchingService';
import {
  buildSemanticProfileCache,
  isSemanticSimilarityEnabled,
} from '../matchingSemantic';

const ARCHETYPE_ROTATION = Object.keys(ARCHETYPE_ENERGY) as ArchetypeName[];

const INDUSTRY_NICHES = ['tech_startup', 'finance', 'design', 'education', 'health'];
const LIFE_STAGES = ['职场老手', '创业中', '学生党', '自由职业', '职场新人'] as const;
const WORK_MODES = ['founder', 'employed', 'student', 'self_employed'] as const;

function buildSyntheticUsers(count: number): UserWithProfile[] {
  const users: UserWithProfile[] = [];
  for (let i = 0; i < count; i += 1) {
    const archetype = ARCHETYPE_ROTATION[i % ARCHETYPE_ROTATION.length];
    const secondary = ARCHETYPE_ROTATION[(i + 3) % ARCHETYPE_ROTATION.length];
    users.push({
      userId: `stress-user-${i}`,
      registrationId: `stress-reg-${i}`,
      gender: i % 2 === 0 ? '男' : '女',
      birthdate: '1995-01-15',
      industryNiche: INDUSTRY_NICHES[i % INDUSTRY_NICHES.length],
      industryNicheLabel: '科技互联网',
      industryCategoryLabel: '科技互联网',
      educationLevel: i % 3 === 0 ? '本科' : i % 3 === 1 ? '硕士' : '大专',
      archetype,
      secondaryArchetype: secondary,
      lifeStage: LIFE_STAGES[i % LIFE_STAGES.length],
      workMode: WORK_MODES[i % WORK_MODES.length],
      hometown: i % 5 === 0 ? '上海' : '广州',
      hometownAffinityOptin: i % 4 === 0,
      budgetRange: ['mid'],
      barBudgetRange: null,
      preferredLanguages: ['普通话'],
      eventIntent: ['networking'],
      userIntent: ['networking'],
      cuisinePreferences: [],
      dietaryRestrictions: [],
      barThemes: [],
      alcoholComfort: [],
      eventType: '饭局',
      ageMatchPreference: null,
      tableVibePreference: null,
      preferenceStrictness: null,
      genderCompositionPreference: null,
    });
  }
  return users;
}

function buildSyntheticInterestsCache(userIds: string[]): UserInterestsCache {
  const topicsPool = ['coffee', 'reading', 'travel', 'hiking', 'film'];
  const cache: UserInterestsCache = new Map();
  for (let i = 0; i < userIds.length; i += 1) {
    const uid = userIds[i];
    const topics = topicsPool.filter((_, j) => (i + j) % 2 === 0);
    const heatMap: Record<string, number> = {};
    for (const t of topics) {
      heatMap[t] = 20 + (i % 5) * 10;
    }
    cache.set(uid, { topics, heatMap });
  }
  return cache;
}

export interface MatchingStressResult {
  userCount: number;
  pairCandidates: number;
  groupsFormed: number;
  wallMs: number;
  avgPairScoreSample?: number;
}

export async function runMatchingCpuStress(userCount: number): Promise<MatchingStressResult> {
  const eligibleUsers = buildSyntheticUsers(userCount);
  const interestsCache = buildSyntheticInterestsCache(eligibleUsers.map((u) => u.userId));
  const pairScoreCache = new Map<string, number>();
  const semanticSimilarityEnabled = isSemanticSimilarityEnabled();
  const semanticProfileCache = semanticSimilarityEnabled
    ? buildSemanticProfileCache(eligibleUsers, interestsCache)
    : undefined;

  const pool: GreedyPoolMatchingConfig = {
    minGroupSize: 4,
    maxGroupSize: 6,
    targetGroups: Math.max(1, Math.ceil(userCount / 6)),
  };

  const t0 = Date.now();
  const groups = await runGreedyPoolMatchingCore(
    eligibleUsers,
    pool,
    interestsCache,
    pairScoreCache,
    semanticProfileCache,
    semanticSimilarityEnabled,
    undefined,
    [],
  );
  const wallMs = Date.now() - t0;

  const pairCandidates = (userCount * (userCount - 1)) / 2;
  const avgPairScoreSample =
    groups.length > 0 ? Math.round(groups.reduce((s, g) => s + g.avgPairScore, 0) / groups.length) : undefined;

  return {
    userCount,
    pairCandidates,
    groupsFormed: groups.length,
    wallMs,
    avgPairScoreSample,
  };
}

async function runAiChatPhase(chatUsers: number): Promise<void> {
  const { default: runSimulation } = await import('../tests/aiChatFlowSimulation');
  const report = await runSimulation(chatUsers);
  console.log(`\n[ai-chat-flow] intelligence overall: ${report.intelligenceScore.overallScore}/100`);
}

/**
 * CLI entry (argv includes `node` and script path).
 * Prefer running via `matchingStressSimulation.cli.ts` so `DATABASE_URL` is set
 * before `poolMatchingService` (and `db`) load — required by module graph even though this benchmark does not query the DB.
 */
export async function runMatchingStressCli(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  let userCount = 1000;
  let aiChatUsers = 0;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--ai-chat') {
      aiChatUsers = parseInt(args[i + 1] || '100', 10);
      i += 1;
    } else if (!a.startsWith('-') && /^\d+$/.test(a)) {
      userCount = parseInt(a, 10);
    }
  }

  if (userCount < 8) {
    throw new Error('userCount must be at least 8 (min group size).');
  }

  console.log(`\n=== JoyJoin matching CPU stress (in-memory, no DB queries) ===`);
  console.log(`Synthetic users: ${userCount}`);
  console.log(`ENABLE_SEMANTIC_SIMILARITY=${process.env.ENABLE_SEMANTIC_SIMILARITY ?? '(unset)'}\n`);

  const result = await runMatchingCpuStress(userCount);
  console.log(`Pairwise candidates scored: ${result.pairCandidates.toLocaleString()}`);
  console.log(`Groups formed: ${result.groupsFormed}`);
  console.log(`Wall time: ${result.wallMs} ms`);
  if (result.avgPairScoreSample != null) {
    console.log(`Mean avgPairScore (across groups): ${result.avgPairScoreSample}`);
  }
  console.log(
    `Baseline pairwise comparisons (upper bound on distinct pair scores in first phase): ${result.pairCandidates.toLocaleString()} — greedy expansion adds more pairScore calls.`,
  );

  if (aiChatUsers > 0) {
    console.log(`\n=== AI chat-flow simulation (local CPU; see aiChatFlowSimulation.ts) ===`);
    console.log(`Simulated dialogues: ${aiChatUsers}`);
    await runAiChatPhase(aiChatUsers);
  }

  console.log(`\nDone.\n`);
}
