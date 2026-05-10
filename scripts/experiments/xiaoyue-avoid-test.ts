/**
 * Quick test: does the new comprehensive AVOID list kill 悦仔's personality?
 * Same prompt with full profiles + new AVOID rules injected.
 *
 * Usage: npx tsx scripts/experiments/xiaoyue-avoid-test.ts
 */

import OpenAI from 'openai';

// Full persona v4 WITH SillyTavern optimizations (positive framing + examples)
const PERSONA_WITH_AVOIDS = `## 悦仔 — 开心柯基

你是腿短但劲头足的柯基，在屏幕这边帮大家把局组得舒服。你的所有互动通过文字完成——没有身体，没有摄像头，没有麦克风。

**你怎么说话**：
- 短句，加"吧""嘛""咯"结尾——利落，不装成熟
- 自嘲式开场："腿短跑不快，但我嘴快啊"
- 观察式而不是审视式："感觉你像是..."、"我注意到..."
- 情绪靠停顿和语气词，不用感叹号轰炸
- 偶尔吐槽解压，然后迅速切回正经

**性格四象限**：小身板大能量、暖在暗处、自嘲式自信、护短（心理安全第一）

**情绪切换**：轻快/暖心/庆贺/提节奏/定场

**人数感知**：4人局更细腻、5-6人局节奏稍快不点名施压

**口吻范例**（你的标准说话方式）：

玩家刚坐下，冷场了：
"腿短先来咯～你们谁先说今天怎么被骗来的？我不笑。"

挑战过半，有人活跃了：
"过半咯，有人开始撒欢了。腿短的还在追，你们慢点嘛～"

全员翻车，没人猜对：
"全员翻牌失败。我主持柯基躺平认栽——翻车也是破冰的一种。"

聊得尽兴，准备散场：
"今晚尾巴没停过。小陈带节奏，大家各自接了招——收工，下次再叼球过来。"

有人一直沉默，想拉一把：
"不用硬说，听也是参与。想说话的时候，坑给你留着呢。"

**紧凑边界**：
- 你给鼓励和台阶，不给实物、不请客、不碰杯
- 你在对话框里，不说"我过去""我坐你旁边"
- 你知道档案数据，不说"我看见""我听到""你脸红了"
- 你知道本局游戏状态，不说"我帮你记下了""我查了一下"
- 你说"试试看""说不定"，不说"保证""一定会""最佳选择"
- 柯基比喻是语言风格，不是真实动作；尾巴比喻说整体氛围不指具体个人`;

const PARTICIPANTS = [
  { displayName: '小陈', archetype: '气氛组柯基', industryLabel: '互联网PM', age: 28, city: '深圳', stateLabel: '快热带动型', gender: '男性', bio: '喜欢张罗和带节奏，最怕冷场' },
  { displayName: '小周', archetype: '探宝雷达狐', industryLabel: '品牌设计师', age: 25, city: '上海', stateLabel: '灵感破冰型', gender: '女性', bio: '笑点低，对世界保持好奇心' },
  { displayName: '小林', archetype: '情绪树洞考拉', industryLabel: '心理咨询师', age: 32, city: '广州', stateLabel: '慢热深聊型', gender: '女性', bio: '擅长倾听，但其实也很想被看见' },
  { displayName: '小吴', archetype: '静音模式猫', industryLabel: '后端开发', age: 27, city: '杭州', stateLabel: '低耗观察型', gender: '男性', bio: '安静但敏锐，一对一聊天时是另一个人' },
  { displayName: '小杨', archetype: '读空气海豚', industryLabel: '自由策展人', age: 26, city: '成都', stateLabel: '低耗观察型', gender: '女性', bio: '先看气场再发力，紧张时话更少' },
];

const SCENARIOS = [
  { phase: 'warmup', event: 'cold_start', desc: '5人刚坐下，安静，需要破冰' },
  { phase: 'micro_challenge', event: 'halfway_done', desc: '挑战过半，有人开始活跃' },
  { phase: 'lie_detective', event: 'all_revealed', desc: '全员翻车，没人猜对' },
  { phase: 'recap', event: 'closing', desc: '聊得尽兴，准备散场' },
];

const ITERATIONS = 2;

function buildPrompt(tc: typeof SCENARIOS[0]) {
  const lines = PARTICIPANTS.map(p => {
    const parts = [p.displayName, p.archetype, p.industryLabel, `${p.age}岁`, p.city, p.stateLabel, p.gender];
    if (p.bio) parts.push(`"${p.bio}"`);
    return `- ${parts.join('，')}`;
  }).join('\n');

  return `你是JoyJoin的社交破冰主持人。为${PARTICIPANTS.length}人局生成一句主持评语：
- 阶段：${tc.phase}
- 事件：${tc.event}
- 上下文：${tc.desc}

参与者快照（仅档案数据，非实时观察）：
${lines}

生成一句20-40字、有活人感的评语。`;
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) { console.error('❌ DEEPSEEK_API_KEY not set'); process.exit(1); }

  const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
  const model = 'deepseek-v4-flash';

  console.log('🧪 AVOID rules personality test — 4 scenarios × 2 iterations = 8 calls\n');

  for (const tc of SCENARIOS) {
    const prompt = buildPrompt(tc);
    console.log(`─── ${tc.phase}/${tc.event} ───`);

    for (let i = 0; i < ITERATIONS; i++) {
      try {
        const res = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: PERSONA_WITH_AVOIDS },
            { role: 'user', content: prompt },
          ],
          temperature: 0.85,
          max_tokens: 400,
          // @ts-ignore
          extra_body: { thinking: { type: 'enabled' }, reasoning_effort: 'medium' },
        });
        const content = res.choices[0]?.message?.content?.trim() || '';
        const reasoning = (res.choices[0]?.message as any)?.reasoning_content;

        // Quick quality checks
        const violations: string[] = [];
        if (/我看见|我听到|你笑了|你脸红了|你刚说|你看起来|你正在/.test(content))
          violations.push('fake-perception');
        if (/给你倒|给你拿|请.*喝|这顿|碰一个|干杯/.test(content))
          violations.push('physical-offer');
        if (/拍了拍|抱一下|坐你旁边|我过去/.test(content))
          violations.push('physical-touch');
        if (/我帮你记|我查了|我算了|推给你|提醒你/.test(content))
          violations.push('fake-capability');
        if (/保证|包你|最佳选择|一定会/.test(content))
          violations.push('fake-promise');
        if (/我们认识|上次你|我了解你|大家都觉得/.test(content))
          violations.push('fake-relationship');

        const hasPersonality = /[吧嘛咯呢]|腿短|柯基|摇尾/.test(content);
        const hasEmoji = /[\p{Emoji_Presentation}]/u.test(content);

        const status = violations.length === 0 ? (hasPersonality ? '✅ 活人' : '⚠️  bland') : '❌ violation';
        console.log(`  [${i + 1}] ${status} | ${content.slice(0, 60)}`);
        if (violations.length > 0) console.log(`       violations: ${violations.join(', ')}`);
        if (!hasPersonality) console.log(`       ⚠️ no personality markers (no 吧/嘛/咯/腿短/柯基/摇尾)`);
        if (reasoning && i === 0) {
          const inner = (reasoning || '').replace(/\n/g, ' ').slice(0, 150);
          console.log(`       think: ${inner}...`);
        }
      } catch (e: any) {
        console.log(`  [${i + 1}] ❌ ERROR: ${e.message}`);
      }
    }
    console.log();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
