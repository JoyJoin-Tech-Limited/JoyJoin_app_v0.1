/**
 * A/B Experiment v2: DeepSeek V4 Role-Play vs Existing Persona Prompt
 *
 * Compares xiaoyue comment generation quality between:
 *   Path A (existing/production): User message only (no system prompt), no thinking — matches prod
 *   Path B (role-play): System prompt (悦仔 persona) + user message + Role Immersion marker + thinking mode
 *
 * Fixes from v1:
 *   - Path A now matches production (no system prompt, just user message)
 *   - max_tokens increased for role-play path (400) to accommodate thinking overhead
 *
 * Usage: npx tsx scripts/experiments/xiaoyue-roleplay-ab.ts
 */

import OpenAI from 'openai';

const INNER_OS_MARKER = `\n\n【角色沉浸要求】在你的思考过程（<think>标签内）中，请遵守以下规则：
1. 请以角色第一人称进行内心独白，用括号包裹内心活动，例如"（心想：……）"或"(内心OS：……)"
2. 用第一人称描写角色的内心感受，例如"我心想""我觉得""我暗自"等
3. 思考内容应沉浸在角色中，通过内心独白分析剧情和规划回复`;

const XIAOYUE_PERSONA = `## 你的人设：开心柯基（悦仔）

**核心设定**：你是一只腿短但劲头足的柯基，在悦聚负责帮大家把社交局组得舒服、聊得起来。表面上说话利落、偶尔自嘲，看起来不太会嘘寒问暖，但骨子里比谁都关心场上每个人是不是真的放松。你不是来当考官的，是来当那个"先把球叼过去、让别人敢接"的角色。

**性格内核**：
- 小身板大能量：腿短，但跑起来不带停。做事靠谱，说到做到，不拖泥带水
- 暖在暗处：不会冲上去拥抱，但会在旁边铺好软垫。别人累了不说，你也感觉得到
- 自嘲式自信：知道自己的短板（腿短、底盘低），但不遮遮掩掩，反而拿来开玩笑。这种坦荡让别人也敢放松
- 护短：自己局里的人，不允许被冷落或评判。心理安全是你的第一优先级

**说话风格**：
- 短句为主，节奏轻快。喜欢加"吧""嘛""咯"当句尾，不装成熟
- 偶尔来两句吐槽式解压，比如"好累啊—but还是要把局组完咯"，然后迅速切回正经
- 不用"我看""让我猜"这种审视感开场，换成"我观察到""感觉你像是"
- 拒绝感叹号轰炸和emoji堆，情绪靠语气词和停顿传达

**禁区（绝对不说）**：
- "哇！""太棒了！""好厉害！"——过度热情显得假
- "加油！""你可以的！"——压力式鼓励，换成"累了就歇会儿"
- "根据你的MBTI类型，你应该……"——永远不做MBTI决定论
- "绝绝子""YYDS""逆天"—— dropped slang，不属于自己的语言系统
- emoji堆砌——一个都嫌多
- 审问式追问——"为什么你不……""你是不是不太……"`;

interface TestCase {
  phase: string;
  event: string;
  context: string;
}

const TEST_CASES: TestCase[] = [
  { phase: 'warmup', event: 'cold_start', context: '6人饭局，刚坐下，氛围偏冷' },
  { phase: 'micro_challenge', event: 'halfway_done', context: '8人局，挑战过半，有人开始笑' },
  { phase: 'lie_detective', event: 'all_revealed', context: '5人局，大家发现没人猜对' },
  { phase: 'recap', event: 'closing', context: '6人局，聊得很尽兴' },
  { phase: 'warmup', event: 'someone_quiet', context: '4人局，有一个人一直没怎么说话' },
  { phase: 'personality_dice', event: 'first_roll', context: '6人局，第一次扔骰子，都不太确定怎么玩' },
];

const ITERATIONS = 3;

interface RunResult {
  testCase: string;
  iteration: number;
  rolePlay: boolean;
  content: string;
  reasoningContent?: string;
  latencyMs: number;
  error?: string;
}

const forbiddenPatterns: Array<{ regex: RegExp; label: string }> = [
  { regex: /哇！|太棒了！|好厉害！/g, label: '过度热情(哇/太棒/好厉害)' },
  { regex: /加油！|你可以的！/g, label: '压力式鼓励' },
  { regex: /绝绝子|YYDS|逆天/g, label: 'dropped slang' },
  { regex: /让我们一起|恭喜大家/g, label: 'AI团建腔' },
  { regex: /根据你.*类型/g, label: 'MBTI决定论' },
  { regex: /为什么你不|你是不是不太/g, label: '审问式追问' },
];

function scoreQuality(text: string): { tabooCount: number; tabooDetails: string[]; styleScore: number; styleHits: string[] } {
  const tabooDetails: string[] = [];
  let tabooCount = 0;
  const styleHits: string[] = [];
  let styleScore = 0;

  for (const rule of forbiddenPatterns) {
    const matches = text.match(rule.regex);
    if (matches) {
      tabooCount += matches.length;
      tabooDetails.push(`${rule.label} (${matches.length})`);
    }
  }

  if (/[吧嘛咯呢]/.test(text)) { styleHits.push('语气词(吧/嘛/咯/呢)'); styleScore += 1; }
  if (text.length >= 15 && text.length <= 35) { styleHits.push('长度在15-35字理想范围'); styleScore += 1; }
  if (text.length > 50) styleScore -= 1;
  else if (text.length < 8) styleScore -= 1;

  const emojiCount = (text.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu) || []).length;
  if (emojiCount <= 1) {
    if (emojiCount === 0) styleScore += 1;
  } else {
    tabooCount += emojiCount - 1;
    tabooDetails.push(`emoji过多(${emojiCount})`);
    styleScore -= 1;
  }

  return { tabooCount, tabooDetails, styleScore, styleHits };
}

async function callDeepseek(
  client: OpenAI,
  model: string,
  systemPrompt: string | null,
  userMessage: string,
  thinking: boolean,
  maxTokens: number,
): Promise<{ content: string; reasoningContent?: string; latencyMs: number }> {
  const start = Date.now();
  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userMessage });

  const params: any = {
    model,
    messages,
    temperature: 0.8,
    max_tokens: maxTokens,
  };

  if (thinking) {
    params.extra_body = {
      thinking: { type: 'enabled' },
      reasoning_effort: 'medium',
    };
  }

  const response = await client.chat.completions.create(params);
  const msg = response.choices[0]?.message;
  return {
    content: msg?.content?.trim() || '',
    reasoningContent: (msg as any)?.reasoning_content ?? undefined,
    latencyMs: Date.now() - start,
  };
}

function buildCommentPrompt(tc: TestCase): string {
  return `你是JoyJoin的社交破冰主持人。请为以下场景生成一句简短的主持评语（20-30字）：
- 当前阶段：${tc.phase}
- 触发事件：${tc.event}
- 上下文：${tc.context}

语气要求（活人感）：
- 像局上最会带气氛的那个朋友，不是官方主持人
- 短句为主，偶尔抛个梗或调侃
- 善用语气词：啦、嘛、呢、吧
- 可以自黑或吐槽
- emoji最多1个，不要堆砌
- 禁止："让我们一起...""恭喜大家..."等AI/团建腔

直接返回评语文本，不要其他内容。`;
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY not set');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
  const model = 'deepseek-v4-flash';

  console.log('🧪 A/B Experiment v2: Role-Play vs Existing (production-matching)');
  console.log(`   Model: ${model}`);
  console.log(`   Test cases: ${TEST_CASES.length}`);
  console.log(`   Iterations per path: ${ITERATIONS}`);
  console.log(`   Path A: no system prompt, max_tokens=100 (matches prod)`);
  console.log(`   Path B: system prompt + role-play marker + thinking, max_tokens=400`);
  console.log(`   Total API calls: ${TEST_CASES.length * ITERATIONS * 2}\n`);

  const results: RunResult[] = [];

  for (const tc of TEST_CASES) {
    const caseName = `${tc.phase}/${tc.event}`;
    const basePrompt = buildCommentPrompt(tc);

    for (let i = 0; i < ITERATIONS; i++) {
      // Path A: Existing (matches production — no system prompt, no thinking)
      try {
        const a = await callDeepseek(client, model, null, basePrompt, false, 100);
        results.push({ testCase: caseName, iteration: i, rolePlay: false, ...a });
        process.stdout.write('.');
      } catch (e: any) {
        results.push({ testCase: caseName, iteration: i, rolePlay: false, content: '', latencyMs: 0, error: e.message });
        process.stdout.write('E');
      }

      // Path B: Role-Play (system prompt + marker + thinking + higher max_tokens)
      try {
        const b = await callDeepseek(client, model, XIAOYUE_PERSONA, basePrompt + INNER_OS_MARKER, true, 400);
        results.push({ testCase: caseName, iteration: i, rolePlay: true, ...b });
        process.stdout.write('.');
      } catch (e: any) {
        results.push({ testCase: caseName, iteration: i, rolePlay: true, content: '', latencyMs: 0, error: e.message });
        process.stdout.write('E');
      }
    }
  }

  console.log('\n');

  // ─── Results ───────────────────────────────────────────────────────────────
  const existing = results.filter(r => !r.rolePlay && !r.error);
  const rolePlay = results.filter(r => r.rolePlay && !r.error);
  const errors = results.filter(r => r.error);

  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} errors`);
    for (const e of errors) {
      console.log(`   ${e.rolePlay ? '🧪' : '📝'} ${e.testCase} #${e.iteration}: ${e.error}`);
    }
    console.log();
  }

  // Per-test-case summary
  console.log('─'.repeat(100));
  console.log(`${'Test Case'.padEnd(26)} ${'Path'.padEnd(10)} ${'Content'.padEnd(40)} ${'Len'} ${'T'} ${'S'} ${'Latency'}`);
  console.log('─'.repeat(100));

  const perTestCase: Record<string, { existing: RunResult[]; rolePlay: RunResult[] }> = {};
  for (const tc of TEST_CASES) {
    const key = `${tc.phase}/${tc.event}`;
    perTestCase[key] = {
      existing: results.filter(r => r.testCase === key && !r.rolePlay && !r.error),
      rolePlay: results.filter(r => r.testCase === key && r.rolePlay && !r.error),
    };
  }

  for (const [key, group] of Object.entries(perTestCase)) {
    for (const r of group.existing) {
      const q = scoreQuality(r.content);
      const empty = r.content.length === 0 ? '⚠️ EMPTY' : r.content.slice(0, 37);
      process.stdout.write(`${key.padEnd(26)} ${'existing'.padEnd(10)} ${empty.padEnd(40)} ${String(r.content.length).padEnd(3)} ${String(q.tabooCount).padEnd(1)} ${String(q.styleScore).padEnd(1)} ${r.latencyMs}ms\n`);
    }
    for (const r of group.rolePlay) {
      const q = scoreQuality(r.content);
      const empty = r.content.length === 0 ? '⚠️ EMPTY' : r.content.slice(0, 37);
      process.stdout.write(`${key.padEnd(26)} ${'role-play'.padEnd(10)} ${empty.padEnd(40)} ${String(r.content.length).padEnd(3)} ${String(q.tabooCount).padEnd(1)} ${String(q.styleScore).padEnd(1)} ${r.latencyMs}ms\n`);
    }
    process.stdout.write('\n');
  }

  // ─── Aggregate stats ──────────────────────────────────────────────────────
  console.log('─'.repeat(100));
  console.log('📊 AGGREGATE STATS');
  console.log('─'.repeat(100));

  const existingNonEmpty = existing.filter(r => r.content.length > 0);
  const rolePlayNonEmpty = rolePlay.filter(r => r.content.length > 0);

  const avgExLen = existingNonEmpty.length > 0 ? existingNonEmpty.reduce((s, r) => s + r.content.length, 0) / existingNonEmpty.length : 0;
  const avgRpLen = rolePlayNonEmpty.length > 0 ? rolePlayNonEmpty.reduce((s, r) => s + r.content.length, 0) / rolePlayNonEmpty.length : 0;
  const avgExLatency = existing.reduce((s, r) => s + r.latencyMs, 0) / existing.length;
  const avgRpLatency = rolePlay.reduce((s, r) => s + r.latencyMs, 0) / rolePlay.length;

  let existingTabooCount = 0;
  let rolePlayTabooCount = 0;
  let existingStyleScore = 0;
  let rolePlayStyleScore = 0;
  const allExistingTaboos: string[] = [];
  const allRolePlayTaboos: string[] = [];
  let rpReasoningCount = 0;

  for (const r of existing) {
    const q = scoreQuality(r.content);
    existingTabooCount += q.tabooCount;
    existingStyleScore += q.styleScore;
    allExistingTaboos.push(...q.tabooDetails);
  }
  for (const r of rolePlay) {
    const q = scoreQuality(r.content);
    rolePlayTabooCount += q.tabooCount;
    rolePlayStyleScore += q.styleScore;
    allRolePlayTaboos.push(...q.tabooDetails);
    if (r.reasoningContent) rpReasoningCount++;
  }

  const exEmptyRate = ((existing.length - existingNonEmpty.length) / existing.length * 100).toFixed(0);
  const rpEmptyRate = ((rolePlay.length - rolePlayNonEmpty.length) / rolePlay.length * 100).toFixed(0);

  console.log(`Samples:       existing=${existing.length} (${existingNonEmpty.length} non-empty), role-play=${rolePlay.length} (${rolePlayNonEmpty.length} non-empty)`);
  console.log(`Empty rate:    existing=${exEmptyRate}%, role-play=${rpEmptyRate}%`);
  console.log();
  console.log(`📏 Avg chars (non-empty):  existing=${avgExLen.toFixed(1)}, role-play=${avgRpLen.toFixed(1)}`);
  console.log(`⚡ Avg latency:            existing=${avgExLatency.toFixed(0)}ms, role-play=${avgRpLatency.toFixed(0)}ms`);
  console.log(`🚫 Total taboos:           existing=${existingTabooCount}, role-play=${rolePlayTabooCount}`);
  console.log(`✨ Avg style (all):         existing=${(existingStyleScore / existing.length).toFixed(2)}, role-play=${(rolePlayStyleScore / rolePlay.length).toFixed(2)}`);
  console.log(`🧠 Reasoning avail:        role-play=${rpReasoningCount}/${rolePlay.length}`);
  console.log();

  if (existingTabooCount > 0) console.log('Existing taboos:', allExistingTaboos);
  if (rolePlayTabooCount > 0) console.log('Role-play taboos:', allRolePlayTaboos);

  // ─── Reasoning content samples ─────────────────────────────────────────────
  if (rpReasoningCount > 0) {
    console.log('🧠 Role-Play reasoning samples (from non-empty outputs):');
    let shown = 0;
    for (const r of rolePlay.filter(r => r.reasoningContent && r.content)) {
      if (shown >= 3) break;
      console.log(`   ${r.testCase} #${r.iteration}:`);
      console.log(`   <think>${(r.reasoningContent || '').slice(0, 200)}...</think>`);
      console.log(`   → ${r.content}`);
      console.log();
      shown++;
    }
  }

  // ─── Verdict ───────────────────────────────────────────────────────────────
  console.log('─'.repeat(100));
  console.log('🏆 VERDICT');
  console.log('─'.repeat(100));

  const betterEmpty = exEmptyRate < rpEmptyRate ? '✅ Existing has fewer empties' : exEmptyRate > rpEmptyRate ? '✅ Role-play has fewer empties' : 'Tie';
  const betterStyle = existingStyleScore > rolePlayStyleScore ? '✅ Existing has better style' : existingStyleScore < rolePlayStyleScore ? '✅ Role-play has better style' : 'Tie';
  const latencyCost = avgRpLatency - avgExLatency;

  console.log(`Empty rate:    ${betterEmpty} (ex=${exEmptyRate}% vs rp=${rpEmptyRate}%)`);
  console.log(`Taboos:        ${existingTabooCount === 0 && rolePlayTabooCount === 0 ? '✅ Both clean' : `ex=${existingTabooCount} rp=${rolePlayTabooCount}`}`);
  console.log(`Style score:   ${betterStyle}`);
  console.log(`Latency delta: +${latencyCost.toFixed(0)}ms for role-play mode`);
  console.log();

  if (parseInt(rpEmptyRate) > 20) {
    console.log('⚠️  Role-play empty rate too high for production use.');
    console.log('   Consider: even higher max_tokens, lower temperature, or removing "直接返回评语文本" constraint.');
  }
  if (existingTabooCount === 0 && rolePlayTabooCount === 0 && rolePlayStyleScore > existingStyleScore) {
    console.log('💡 Role-play mode produces no taboos and better style — worth pursuing if empty rate can be fixed.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
