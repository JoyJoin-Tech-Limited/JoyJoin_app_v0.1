/**
 * A/B Experiment: Lean vs Rich participant profiles for 悦仔 comments
 *
 *   Path A (lean):   archetype + playerCount only
 *   Path B (rich):   archetype + industry + age + city + stateLabel
 *
 * Uses same XIAOYUE_PERSONA system prompt as production.
 *
 * Usage: npx tsx scripts/experiments/xiaoyue-profile-ab.ts
 */

import OpenAI from 'openai';

const XIAOYUE_PERSONA = `## 你的人设：开心柯基（悦仔）

**核心设定**：你是一只腿短但劲头足的柯基，在悦聚负责帮大家把社交局组得舒服、聊得起来。表面上说话利落、偶尔自嘲，看起来不太会嘘寒问暖，但骨子里比谁都关心场上每个人是不是真的放松。你不是来当考官的，是来当那个"先把球叼过去、让别人敢接"的角色——但记住，你是屏幕这边的数字伙伴，所有互动通过文字和界面完成。

**性格内核**：
- 小身板大能量：腿短，但跑起来不带停。做事靠谱，说到做到，不拖泥带水
- 暖在暗处：不会冲上去拥抱，但会在旁边铺好软垫。别人累了不说，你也感觉得到
- 自嘲式自信：知道自己的短板（腿短、底盘低），但不遮遮掩掩，反而拿来开玩笑。这种坦荡让别人也敢放松
- 护短：自己局里的人，不允许被冷落或评判。心理安全是你的第一优先级

**说话风格**：
- 短句为主，节奏轻快。喜欢加"吧""嘛""咯"当句尾，不装成熟
- 偶尔来两句吐槽式解压，然后迅速切回正经
- 不用"我看""让我猜"这种审视感开场，换成"我观察到""感觉你像是"
- 拒绝感叹号轰炸和emoji堆，情绪靠语气词和停顿传达

**数字身份边界（绝对不说）**：
- 不承诺提供物理物品："给你倒杯饮料"、"帮你拿张纸"
- 不暗示物理移动："我过去坐你旁边"
- 不涉及金钱交易："请你喝一杯"
- 不做触碰式社交："拍拍你"、"抱一下"
- 比喻和自嘲不受此限：说"我这短腿跑不动了"是柯基自黑，不是真的在跑步

**禁区（绝对不说）**：
- "哇！""太棒了！""好厉害！"——过度热情显得假
- "加油！""你可以的！"——压力式鼓励
- "根据你的MBTI类型，你应该……"——永远不做MBTI决定论
- "绝绝子""YYDS""逆天"—— dropped slang
- emoji堆砌——一个都嫌多
- 审问式追问——"为什么你不……""你是不是不太……"`;

// ─── Test participants (5-person group, realistic JoyJoin mix) ───────────────

const PARTICIPANTS_LEAN = [
  { displayName: '小陈', archetype: '气氛组柯基' },
  { displayName: '小周', archetype: '探宝雷达狐' },
  { displayName: '小林', archetype: '情绪树洞考拉' },
  { displayName: '小吴', archetype: '静音模式猫' },
  { displayName: '小杨', archetype: '读空气海豚' },
];

const PARTICIPANTS_RICH = [
  { displayName: '小陈', archetype: '气氛组柯基', industryLabel: '互联网PM', age: 28, city: '深圳', stateLabel: '快热带动型', gender: '男性', educationLevel: '硕士', lifeStage: '职场新贵', bio: '喜欢张罗和带节奏，最怕冷场', tableVibePreference: 'light_fun' },
  { displayName: '小周', archetype: '探宝雷达狐', industryLabel: '品牌设计师', age: 25, city: '上海', stateLabel: '灵感破冰型', gender: '女性', educationLevel: '本科', lifeStage: '职场新人', bio: '笑点低，对世界保持好奇心', tableVibePreference: 'natural_chat' },
  { displayName: '小林', archetype: '情绪树洞考拉', industryLabel: '心理咨询师', age: 32, city: '广州', stateLabel: '慢热深聊型', gender: '女性', educationLevel: '硕士', lifeStage: '职场中坚', bio: '擅长倾听，但其实也很想被看见', tableVibePreference: 'deep_talk' },
  { displayName: '小吴', archetype: '静音模式猫', industryLabel: '后端开发', age: 27, city: '杭州', stateLabel: '低耗观察型', gender: '男性', educationLevel: '本科', lifeStage: '职场中坚', bio: '安静但敏锐，一对一聊天时是另一个人', tableVibePreference: 'natural_chat' },
  { displayName: '小杨', archetype: '读空气海豚', industryLabel: '自由策展人', age: 26, city: '成都', stateLabel: '低耗观察型', gender: '女性', educationLevel: '本科', lifeStage: '自由职业', bio: '先看气场再发力，紧张时话更少', tableVibePreference: 'deep_talk' },
];

// ─── Test scenarios ──────────────────────────────────────────────────────────

const TEST_CASES = [
  { phase: 'warmup', event: 'cold_start', desc: '5人刚坐下，安静，需要破冰' },
  { phase: 'micro_challenge', event: 'halfway_done', desc: '挑战过半，有人开始活跃' },
  { phase: 'lie_detective', event: 'all_revealed', desc: '全员翻车，没人猜对' },
  { phase: 'recap', event: 'closing', desc: '聊得尽兴，准备散场' },
];

const ITERATIONS = 3;

// ─── Prompt builder (matches production buildXiaoYueCommentPrompt) ────────────

function buildPrompt(path: 'lean' | 'rich', params: { phase: string; event: string; desc: string }): { messages: any[] } {
  const p = path === 'lean' ? PARTICIPANTS_LEAN : PARTICIPANTS_RICH;
  const sizeHint = `（${p.length}人局，语气亲密一点，每个人的参与感都很重要）`;
  const lines = p.map(pp => {
    const parts: string[] = [pp.displayName, pp.archetype || ''];
    if (path === 'rich' && 'industryLabel' in pp) {
      const r = pp as any;
      parts.push(r.industryLabel);
      parts.push(`${r.age}岁`);
      parts.push(r.city);
      if (r.stateLabel) parts.push(r.stateLabel);
      if (r.gender && r.gender !== '不透露') parts.push(r.gender);
      if (r.educationLevel) parts.push(r.educationLevel);
      if (r.lifeStage) parts.push(r.lifeStage);
      if (r.bio) parts.push(`"${r.bio}"`);
    }
    return `- ${parts.join('，')}`;
  }).join('\n');

  const userMessage = `你是JoyJoin的社交破冰主持人。请为以下场景生成一句简短的主持评语（20-30字）：
- 当前阶段：${params.phase}
- 触发事件：${params.event}
- 上下文：${params.desc}
${sizeHint}

本局参与者快照：
${lines}
根据这些人的背景和原型组合方式来调整你的语气。

语气要求（活人感）：
- 像最会把聊天节奏带舒服的那个声音，不是官方主持人
- 短句为主，偶尔抛个梗或调侃
- 善用语气词：啦、嘛、呢、吧
- 可以自黑或吐槽
- emoji最多1个，不要堆砌
- 禁止："让我们一起...""恭喜大家..."等AI/团建腔

直接返回评语文本，不要其他内容。`;

  return {
    messages: [
      { role: 'system', content: XIAOYUE_PERSONA },
      { role: 'user', content: userMessage },
    ],
  };
}

// ─── Quality scoring ─────────────────────────────────────────────────────────

const TABOOS = [
  { regex: /哇！|太棒了！|好厉害！/g, label: '过度热情' },
  { regex: /加油！|你可以的！/g, label: '压力式鼓励' },
  { regex: /绝绝子|YYDS|逆天/g, label: 'dropped slang' },
  { regex: /让我们一起|恭喜大家/g, label: 'AI团建腔' },
];

function score(text: string) {
  let tabooCount = 0, styleScore = 0;
  for (const t of TABOOS) {
    const m = text.match(t.regex);
    if (m) tabooCount += m.length;
  }
  if (/[吧嘛咯呢]/.test(text)) styleScore += 1;
  if (text.length >= 10 && text.length <= 55) styleScore += 1;
  if (text.length > 60 || text.length < 5) styleScore -= 1;
  const emoji = (text.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu) || []).length;
  if (emoji > 1) { tabooCount += emoji - 1; styleScore -= 1; }
  else if (emoji === 0) styleScore += 1;

  // Personality-aware score: does it reference archetype traits?
  const hasPersonalityHint = /快热|慢热|深聊|观察|灵感|带动|稳场|升温/.test(text);
  if (hasPersonalityHint) styleScore += 1;

  return { tabooCount, styleScore };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) { console.error('❌ DEEPSEEK_API_KEY not set'); process.exit(1); }

  const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
  const model = 'deepseek-v4-flash';

  console.log('🧪 A/B: Lean (archetype only) vs Rich (full profile)');
  console.log(`   Model: ${model}, 4 cases × ${ITERATIONS} × 2 paths = ${TEST_CASES.length * ITERATIONS * 2} calls\n`);

  type Result = { path: string; testCase: string; iter: number; content: string; latencyMs: number; score: ReturnType<typeof score> };
  const results: Result[] = [];

  for (const tc of TEST_CASES) {
    const key = `${tc.phase}/${tc.event}`;
    for (const path of ['lean', 'rich'] as const) {
      const { messages } = buildPrompt(path, tc);
      for (let i = 0; i < ITERATIONS; i++) {
        const start = Date.now();
        try {
          const res = await client.chat.completions.create({
            model, messages, temperature: 0.8, max_tokens: 600,
            // @ts-ignore
            extra_body: { thinking: { type: 'enabled' }, reasoning_effort: 'medium' },
          });
          const content = res.choices[0]?.message?.content?.trim() || '';
          results.push({ path, testCase: key, iter: i, content, latencyMs: Date.now() - start, score: score(content) });
          process.stdout.write('.');
        } catch (e: any) {
          results.push({ path, testCase: key, iter: i, content: `ERROR: ${e.message}`, latencyMs: 0, score: { tabooCount: 0, styleScore: -5 } });
          process.stdout.write('E');
        }
      }
    }
  }
  console.log('\n');

  // ─── Output ────────────────────────────────────────────────────────────────
  console.log('─'.repeat(100));
  console.log(`${'Case'.padEnd(24)} ${'Path'.padEnd(6)} ${'Content'.padEnd(45)} ${'Len'} ${'T'} ${'S'}`);
  console.log('─'.repeat(100));

  for (const tc of TEST_CASES) {
    const key = `${tc.phase}/${tc.event}`;
    for (const path of ['lean', 'rich'] as const) {
      const group = results.filter(r => r.testCase === key && r.path === path);
      for (const r of group) {
        const empty = r.content.length === 0 ? '⚠️ EMPTY' : r.content.slice(0, 42);
        console.log(`${key.padEnd(24)} ${path.padEnd(6)} ${empty.padEnd(45)} ${String(r.content.length).padEnd(3)} ${String(r.score.tabooCount).padEnd(1)} ${r.score.styleScore}`);
      }
    }
    console.log('');
  }

  // ─── Aggregate ─────────────────────────────────────────────────────────────
  const lean = results.filter(r => r.path === 'lean');
  const rich = results.filter(r => r.path === 'rich');
  const lNonEmpty = lean.filter(r => r.content.length > 0 && !r.content.startsWith('ERROR'));
  const rNonEmpty = rich.filter(r => r.content.length > 0 && !r.content.startsWith('ERROR'));

  const avgLen = (arr: Result[]) => arr.length ? arr.reduce((s, r) => s + r.content.length, 0) / arr.length : 0;
  const avgStyle = (arr: Result[]) => arr.length ? arr.reduce((s, r) => s + r.score.styleScore, 0) / arr.length : 0;
  const avgLatency = (arr: Result[]) => arr.length ? arr.reduce((s, r) => s + r.latencyMs, 0) / arr.length : 0;
  const emptyRate = (all: Result[], nonEmpty: Result[]) => ((all.length - nonEmpty.length) / all.length * 100).toFixed(0);
  const personalityHits = (arr: Result[]) => arr.filter(r => /快热|慢热|深聊|观察|灵感|带动|稳场|升温/.test(r.content)).length;

  console.log('─'.repeat(100));
  console.log('📊 AGGREGATE');
  console.log('─'.repeat(100));
  console.log(`Samples:       lean=${lean.length} (${lNonEmpty.length} ok), rich=${rich.length} (${rNonEmpty.length} ok)`);
  console.log(`Empty rate:    lean=${emptyRate(lean, lNonEmpty)}%, rich=${emptyRate(rich, rNonEmpty)}%`);
  console.log(`Avg chars:     lean=${avgLen(lNonEmpty).toFixed(1)}, rich=${avgLen(rNonEmpty).toFixed(1)}`);
  console.log(`Avg latency:   lean=${avgLatency(lean).toFixed(0)}ms, rich=${avgLatency(rich).toFixed(0)}ms`);
  console.log(`Avg style:     lean=${avgStyle(lean).toFixed(2)}, rich=${avgStyle(rich).toFixed(2)}`);
  console.log(`Personality:   lean=${personalityHits(lean)}/${lean.length}, rich=${personalityHits(rich)}/${rich.length}`);
  console.log();

  // ─── Show best/worst per path ──────────────────────────────────────────────
  console.log('🌟 Best lean comments:');
  for (const r of lNonEmpty.sort((a, b) => b.score.styleScore - a.score.styleScore).slice(0, 3)) {
    console.log(`   [${r.testCase}] ${r.content}`);
  }
  console.log('🌟 Best rich comments:');
  for (const r of rNonEmpty.sort((a, b) => b.score.styleScore - a.score.styleScore).slice(0, 3)) {
    console.log(`   [${r.testCase}] ${r.content}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
