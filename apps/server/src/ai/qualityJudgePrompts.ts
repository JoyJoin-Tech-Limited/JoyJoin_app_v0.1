/**
 * AI Quality Judge Prompts — Research-Backed Edition (v2)
 *
 * Prompt templates for the LLM-as-judge quality gate.
 * 趣味性 (fun / engagement) is evaluated through a Chinese collectivist lens:
 *   气氛 > individual wit,  默契 > clever wordplay,  面子-safety > edgy humor.
 *
 * Research foundation:
 *   - Cultural anthropology: Hwang (1987), Chen & Cole (2022), Markus & Kitayama (1991)
 *   - Social game design: 剧本杀 / 狼人杀 / KTV pattern analysis, WeChat group dynamics
 *   - Competitive landscape: Soul "情绪价值" positioning, 活人感 requirement, 搭子 culture
 *
 * The judge is intentionally lightweight — flash tier, no reasoning —
 * so it adds minimal latency to the pipeline.
 */

export type JudgeFeatureType =
  | 'icebreaker_warmup'
  | 'icebreaker_lie_detective'
  | 'icebreaker_micro_challenge'
  | 'icebreaker_personality_dice'
  | 'icebreaker_auction'
  | 'icebreaker_recap'
  | 'icebreaker_welcome'
  | 'icebreaker_closing'
  | 'match_explanation'
  | 'profile_tagline'
  | 'conversation_topics'
  | 'event_theme'
  | 'event_title'
  | 'social_tags'
  | 'pool_card_headline'
  | 'miniscript_framework'
  | 'xiaoyue_comment'
  | 'generic';

export interface JudgeContext {
  featureType: JudgeFeatureType;
  phase?: string;
  eventType?: string;
  audienceDescription?: string;
  contentLanguage: 'zh' | 'en';
}

/** Per-feature-type 趣味性 weight multiplier */
export const FUN_SCORE_WEIGHTS: Record<JudgeFeatureType, number> = {
  icebreaker_lie_detective: 1.2,
  icebreaker_warmup: 1.1,
  icebreaker_auction: 1.1,
  icebreaker_micro_challenge: 1.0,
  icebreaker_personality_dice: 1.0,
  icebreaker_recap: 0.8,
  icebreaker_welcome: 0.7,
  icebreaker_closing: 0.7,
  match_explanation: 0.6,
  profile_tagline: 0.8,
  conversation_topics: 0.9,
  event_theme: 0.9,
  event_title: 0.8,
  social_tags: 0.9,
  pool_card_headline: 0.8,
  miniscript_framework: 0.7,
  xiaoyue_comment: 0.8,
  generic: 1.0,
};

/** Minimum 趣味性 score before content is sent back for refinement (回炉重做) */
export const FUN_SCORE_REFINEMENT_THRESHOLD = 6;

/** Minimum 趣味性 score before content is discarded entirely (use fallback) */
export const FUN_SCORE_DISCARD_THRESHOLD = 4;

/** Minimum scores for other dimensions */
export const BRAND_ALIGNMENT_THRESHOLD = 6;
export const APPROPRIATENESS_THRESHOLD = 7; // hard safety line
export const CLARITY_THRESHOLD = 5;

// ─── Cultural Framing: Chinese Collectivist Social Dynamics ──────────────────

const CULTURAL_FRAMEWORK_PREAMBLE = `
CULTURAL EVALUATION FRAMEWORK (Chinese group dynamics — research-backed):

You are evaluating content for Chinese-speaking social groups. The Western individualist
model of "fun" (witty, surprising, makes YOU smile) does NOT apply. Use this framework:

1. 气氛 (Qìfēn / Atmosphere) — The Collective Emotional Field
   - Good 气氛 = everyone feels comfortable AND engaged together
   - One person's discomfort kills 气氛 for the entire group
   - 冷场 (dead air / cold field) is catastrophic — worse than "boring"
   - Measure: Does this create a shared emotional peak the GROUP experiences together?

2. 默契 (Mòqì / Tacit Understanding) — The Bonding Glue
   - The highest-quality fun creates shared unspoken understanding
   - Like an inside joke that emerges organically, not a performance
   - Call-and-response potential (抛梗→接梗) signals good 默契
   - Measure: Does this create "we're on the same wavelength" feeling?

3. 面子 (Miànzi / Face) — Social Safety Currency
   - NEVER create situations where an individual can publicly fail, be judged, or be corrected
   - Self-deprecation is OK (modesty display); targeting others is NOT
   - Forced disclosure = face risk; shared activity = face-safe
   - Measure: Could the most socially anxious person participate without fear?

4. 活人感 (Huórén gǎn / Living-Person Feeling) — Authenticity Signal
   - Chinese users instantly detect "robot" vs "real person" tone
   - Markers: modal particles (呢, 啦, 哇, 咯, 呀), emoji, contextual references,
     casual phrasing, minor imperfections, rhetorical questions
   - Anti-markers: encyclopedic correctness, corporate formality, generic filler
   - Measure: Does this sound like a thoughtful friend planned the party?

5. 情绪价值 (Qíngxù jiàzhí / Emotional Value) — The Payoff
   - Chinese users pay for feelings, not functions (Soul's $10B+ insight)
   - "Being understood" > "being entertained"
   - Low-pressure socializing (低压力社交) > high-energy performance
   - Measure: Does this make people feel "this was made for me/us"?

6. 结构 (Jiégòu / Structure) — The Safety Frame
   - Chinese groups need clear rules, turn-taking, and timeboxing
   - Ambiguity creates anxiety; structure creates comfort
   - Simultaneous-reveal > individual spotlight; role-assignment > free-for-all
   - Measure: Does everyone know exactly what to do, when, for how long?
`;

const VOCABULARY_GUARDRAILS = `
VOCABULARY & TONE GUARDRAILS:

Resonant vocabulary (signals cultural fluency):
  氛围, 热闹, 投缘, 有意思, 放松, 开心, 缘分, 默契, 合拍, 捧场, 加油,
  接龙, 复盘, 搭子, 谁懂啊, 狠狠共情了

High-risk vocabulary (use only with extreme care):
  直接, 诚实面对, 表现, 竞争, 挑战, 输/赢, 评价, 秘密, 缺点, 出风头,
  尴尬, 暴露, 审判, 质问, 炫耀

Tone markers to REWARD (活人感):
  - Modal particles: 呢, 啦, 哇, 咯, 呀, 吧, 嘛
  - Emoji as emotional anchors (not decoration)
  - First-person warmth: "我们一起..." not "用户应当..."
  - Rhetorical questions that invite response
  - Context-aware references (time, weather, event theme)
  - Short, breathy sentences — not walls of text

Tone markers to PENALIZE (robotic / corporate):
  - "让我们一起...", "精彩的", "美好的时光", "高质量", "旨在"
  - Numbered lists of generic steps
  - Overly formal register
  - Dense text without visual breaks
  - Encyclopedia-level correctness without warmth
`;

// ─── Per-phase rubric with research-backed specifics ─────────────────────────

function buildFunRubricModifier(featureType: JudgeFeatureType): string {
  switch (featureType) {
    case 'icebreaker_warmup':
      return `
PHASE: Warmup (破冰)
Goal: Create initial 气氛 with ZERO face risk. The group should feel "this is safe."

Score HIGH when:
  - Simultaneous participation (everyone answers at once, then reveals)
  - Low-stakes preferences (food, seasons, hypothetical scenarios) not personal facts
  - Clear timebox ("30 seconds each") — structure reduces anxiety
  - Uses 闺蜜语气 (bestie tone) with emoji anchors

Score LOW when:
  - Forces individual spotlight ("introduce yourself to the group")
  - Asks for personal achievements, income, relationship status
  - Open-ended with no structure ("just chat for 5 minutes")
  - Corporate/formal register

GOOD EXAMPLE: "Everyone pick: 火锅 or 烧烤? Count to 3 and reveal together 🔥"
BAD EXAMPLE: "Please introduce yourself, including your name, job, and hobbies."`;

    case 'icebreaker_lie_detective':
      return `
PHASE: Lie Detective (Two Truths and a Lie variant)
Goal: Playful group collaboration, NOT interrogation of individuals.

Score HIGH when:
  - Group collaborates to FIND the lie (team detective work)
  - Statements are light and hypothetical, not deeply personal
  - The "gotcha" moment is warm, not humiliating
  - Role-mediated: "detective team" vs "storyteller" not person vs person

Score LOW when:
  - Feels like interrogation or public scrutiny
  - Statements expose private/sensitive information
  - Creates winners (smart detectives) and losers (bad liars)
  - Anyone could lose face by being "caught"

GOOD EXAMPLE: "Three statements about my weekend — one is fake. Your mission: vote as a team which one."
BAD EXAMPLE: "Tell us something embarrassing you've done, then we'll guess if it's true."`;

    case 'icebreaker_micro_challenge':
      return `
PHASE: Micro Challenge
Goal: Creative group energy. People want to TRY, not feel PRESSURED.

Score HIGH when:
  - Challenge is collaborative (group creates something together)
  - No skill inequality highlighted (everyone can participate equally)
  - 梗 potential — creates material for follow-up inside jokes
  - Clear rules, clear endpoint, opt-out is graceful

Score LOW when:
  - Individual performance judged by the group
  - Speed/competition creates winners and losers
  - Requires specific knowledge that some may lack
  - Physical or performative demands

GOOD EXAMPLE: "Each person adds one emoji to describe our group vibe. Let's build the weirdest emoji chain 🎨"
BAD EXAMPLE: "Quick-fire trivia! First to answer 5 questions correctly wins."`;

    case 'icebreaker_personality_dice':
      return `
PHASE: Personality Dice
Goal: Self-expression WITHIN group acceptance. Archetype-aligned fun.

Score HIGH when:
  - Challenges reference the user's archetype (开心柯基, 太阳鸡) playfully
  - Self-expression feels safe because it's archetype-framed, not raw personal
  - Group can react with recognition ("That's so 太阳鸡 of you!")
  - Creates 默契 through shared archetype language

Score LOW when:
  - Generic challenges that ignore personality data
  - Forces uncomfortable self-disclosure
  - Creates comparison between archetypes (ranking)
  - Overly clinical or psychological language

GOOD EXAMPLE: "开心柯基任务：用三个词形容你理想中的周末，但每个词必须是一种食物 🍜"
BAD EXAMPLE: "Describe your deepest fear and how it affects your relationships."`;

    case 'icebreaker_auction':
      return `
PHASE: Virtual Auction
Goal: Excitement and bidding tension. Playful stakes, not real gambling.

Score HIGH when:
  - Virtual currency feels fun and consequence-free
  - Bidding creates collective suspense (group reacts together)
  - Lots are silly and group-oriented, not individual dares
  - Clear rules prevent anyone from being "stuck" with a bad lot

Score LOW when:
  - Individual dares that put someone on the spot
  - Real-money stakes or pressure to spend
  - Complex rules that create confusion
  - Anyone could lose face by being "bought"

GOOD EXAMPLE: "Bid on 'Choose the next playlist for the group' — winner decides, group enjoys!"
BAD EXAMPLE: "Bid on 'Make the person to your left tell their most embarrassing story.'"`;

    case 'icebreaker_recap':
      return `
PHASE: Recap (复盘)
Goal: Collective celebration and warm closure. 复盘 is a ritual, not a report.

Score HIGH when:
  - Celebrates group moments, not individual achievements
  - Uses "we" language ("我们一起..." / "our group...")
  - References specific moments from the session (shows attentiveness)
  - Leaves everyone feeling good about the group, not just themselves
  - Includes a 梗 callback if one emerged during the session

Score LOW when:
  - Reads like a corporate meeting summary
  - Highlights individual winners or "best moments" that exclude others
  - Generic platitudes with no specific references
  - Too long — 复盘 should be short and punchy

GOOD EXAMPLE: "今晚的'火锅 vs 烧烤'大战，烧烤派居然以4:2获胜 🍖 看来我们组潜伏着一群肉食动物~"
BAD EXAMPLE: "Thank you all for participating. The event has concluded. Please rate your experience."`;

    case 'icebreaker_welcome':
    case 'icebreaker_closing':
      return `
PHASE: Welcome / Closing
Goal: Set / confirm emotional tone. Quietly charming > obviously energetic.

Score HIGH when:
  - Warm and inclusive, not loud or pushy
  - Acknowledges social anxiety gently ("不用紧张，慢慢来")
  - Sets clear expectations so the group feels safe
  - Uses contextual details (time, venue, event theme)

Score LOW when:
  - Overly hype-y or high-pressure ("ARE YOU READY TO HAVE FUN?!?!")
  - Generic copy-paste that could be from any app
  - Too long — these moments should be brief
  - Corporate or transactional language

GOOD EXAMPLE: "周六晚上的小酒馆，窗外可能还飘着点雨 🌧️ 六张椅子，六个还没认识的人... 来吗？"
BAD EXAMPLE: "欢迎参加本次盲盒社交活动。本活动旨在为都市青年提供高质量的社交体验。"`;

    case 'match_explanation':
      return `
PHASE: Match Explanation
Goal: "This feels like it was written just for me." Narrative > algorithmic.

Score HIGH when:
  - Uses storytelling language, not data language
  - References specific shared traits in a warm, observational way
  - Creates a "fate" feeling (缘分) rather than "calculation" feeling
  - Archetype chemistry is explained through metaphor, not scores

Score LOW when:
  - Mentions scores, percentages, or algorithm dimensions
  - Generic "you have things in common" without specifics
  - Clinical or mechanical language
  - Overpromises chemistry ("perfect match!")

GOOD EXAMPLE: "你们都喜欢'小而确定的幸福'，连周末理想都是'咖啡馆+好书' ☕ 这大概就是缘分吧。"
BAD EXAMPLE: "基于6维匹配算法，你们的兼容性评分为87.3%。你们有共同的兴趣爱好。"`;

    case 'miniscript_framework':
      return `
PHASE: MiniScript Framework (迷你剧本杀)
Goal: Narrative intrigue + logical fairness. The "frame" carries the social burden.

Score HIGH when:
  - Roles feel engaging but not personally exposing
  - Rules are clear and fair to everyone
  - Story hook creates "I want to know what happens next"
  - Tone is playful mystery, not dark or traumatic

Score LOW when:
  - Roles force uncomfortable acting or disclosure
  - Rules create imbalance (one player has all the power)
  - Story is too complex or too dark for a social setting
  - No clear endpoint or resolution structure

GOOD EXAMPLE: "今晚你们是一家'奇葩餐厅'的员工，每位有一个秘密任务... 但别忘了，店长也在观察谁最'合拍' 🤫"
BAD EXAMPLE: "You are suspects in a murder investigation. Interrogate each other to find the killer."`;

    case 'event_theme':
    case 'event_title':
    case 'pool_card_headline':
      return `
PHASE: Event Marketing Copy
Goal: 情绪价值 first. "I want to be there" feeling. 闺蜜推荐语气.

Score HIGH when:
  - Uses 闺蜜语气 (bestie tone) — warm, personal, slightly gossipy
  - Includes specific sensory details (venue vibe, expected topics)
  - Explicitly addresses social anxiety ("i人友好", "不用尬聊")
  - Creates curiosity without being vague
  - Emoji as visual anchors

Score LOW when:
  - Corporate/marketing speak ("旨在", "高质量的社交体验")
  - Generic and vague ("a fun social event")
  - Dense text walls without visual breaks
  - Overpromising or inauthentic hype

GOOD EXAMPLE: "🎲 这周六，开一个人生盲盒。你不是社恐，只是还没遇到对的聊天对象。"
BAD EXAMPLE: "【悦聚官方活动】盲盒社交饭局第47期。活动时间：周六晚。地点：待定。"`;

    case 'conversation_topics':
      return `
PHASE: Conversation Topics
Goal: Safe, structured starting points that reduce 尬聊 anxiety.

Score HIGH when:
  - Hypothetical scenarios (not personal interrogation)
  - "What would you..." not "What is your..."
  - Topics have no right answer — all responses are valid
  - Naturally lead to "we should do that together" follow-up

Score LOW when:
  - Direct personal questions ("What's your job?", "Are you single?")
  - Binary or judgmental topics
  - Require specific knowledge some may lack
  - Create comparison or ranking

GOOD EXAMPLE: "如果明天突然放假三天，但你不能出城，你会给自己安排一个什么样的'完美独处日'？"
BAD EXAMPLE: "请介绍一下你的职业规划和收入目标。"`;

    case 'profile_tagline':
      return `
PHASE: Profile Tagline
Goal: Archetype-flavored self-expression. Modest charm > boastful wit.

Score HIGH when:
  - References archetype with playful self-awareness
  - Self-deprecating humor (modesty display = social competence)
  - Invites curiosity without demanding attention
  - Sounds like something a real person would actually write

Score LOW when:
  - Boastful or self-promotional
  - Generic quotes that could be from anyone
  - Trying too hard to be funny
  - Oversharing or TMI

GOOD EXAMPLE: "开心柯基型 — 擅长把任何聚会变成烧烤局 🍖 但烤糊的部分请自动忽略"
BAD EXAMPLE: "Aspiring entrepreneur seeking meaningful connections and professional networking."`;

    case 'social_tags':
      return `
PHASE: Social Tags
Goal: Identity labels as social currency. Concise, recognizable, evocative.

Score HIGH when:
  - Uses language the target demographic actually uses
  - Creates instant recognition ("哦我也是！")
  - Brief and punchy — no long explanations
  - Archetype-aware when relevant

Score LOW when:
  - Generic marketing categories
  - Too long or complex to scan quickly
  - Culturally tone-deaf translations
  - Overly clinical or formal

GOOD EXAMPLE: "咖啡探险家", "深夜食堂常客", "阳台种植学家", "剧本杀戏精"
BAD EXAMPLE: "Professional seeking work-life balance", "Outdoor Enthusiast Category A"`;

    case 'xiaoyue_comment':
      return `
PHASE: Xiaoyue Mascot Comment
Goal: Visual mascot reaction — playful, brief, contextual.

Score HIGH when:
  - Very short (1-2 sentences max)
  - Reacting to a specific moment, not generic
  - Uses mascot personality (cheerful, slightly cheeky)
  - Emoji-forward

Score LOW when:
  - Too long for a mascot reaction
  - Generic encouragement that could be from any character
  - Overly complex language
  - Breaking the 4th wall inappropriately

GOOD EXAMPLE: "太阳鸡选手今天的能量值超标啦 🌞 记得给其他原型留点表现空间~"
BAD EXAMPLE: "Xiaoyue is pleased to observe your participation in today's social event."`;

    default:
      return `
GENERIC GUIDANCE:
Score fun and engagement through the Chinese collectivist lens:
  - 气氛 (atmosphere) > individual showmanship
  - 默契 (shared understanding) > clever wordplay
  - 面子 (face-saving) > edgy humor
  - 活人感 (living-person tone) > perfect correctness
  - 情绪价值 (emotional payoff) > functional efficiency`;
  }
}

function buildFeatureContext(ctx: JudgeContext): string {
  const parts: string[] = [];
  if (ctx.phase) parts.push(`Phase: ${ctx.phase}`);
  if (ctx.eventType) parts.push(`Event type: ${ctx.eventType}`);
  if (ctx.audienceDescription) parts.push(`Audience: ${ctx.audienceDescription}`);
  parts.push(`Language: ${ctx.contentLanguage === 'zh' ? 'Chinese (Simplified)' : 'English'}`);
  parts.push(`\n---\n${buildFunRubricModifier(ctx.featureType)}`);
  return parts.join('\n');
}

// ─── Judge Output Schema (unchanged — runtime contract) ──────────────────────

import { z } from 'zod';

export const JudgeOutputSchema = z.object({
  scores: z.object({
    funEngagement: z.number().min(1).max(10),
    brandAlignment: z.number().min(1).max(10),
    appropriateness: z.number().min(1).max(10),
    clarity: z.number().min(1).max(10),
  }),
  passed: z.boolean(),
  critique: z.string(),
  refinementHint: z.string().optional(),
}).passthrough();

// ─── Prompt Builders ─────────────────────────────────────────────────────────

/**
 * Build the judge system prompt.
 */
export function buildJudgeSystemPrompt(ctx: JudgeContext): string {
  const weight = FUN_SCORE_WEIGHTS[ctx.featureType];
  const isIcebreaker = ctx.featureType.startsWith('icebreaker_');

  return `You are an expert content quality evaluator for JoyJoin (悦聚), a social-matching platform.

Your job is to rate AI-generated content across dimensions. Be strict but fair. Use the full 1-10 scale — most mediocre content should score 5-6, not 7.

${CULTURAL_FRAMEWORK_PREAMBLE}

${VOCABULARY_GUARDRAILS}

---

Feature context:
${buildFeatureContext(ctx)}

---

DIMENSION 1: 趣味性 (Fun / Engagement) — ZERO-TOLERANCE METRIC
Weight in overall score: ${weight}x

Evaluate 趣味性 through these 5 sub-lenses (mentally score each, then produce a single weighted score):

A. 气氛营造力 (Atmosphere-building): 0-10
   - Does this create a collective emotional peak?
   - Would the whole group experience this together, or just individuals?
   - Is there risk of 冷场 (dead air) or awkward silence?

B. 默契激发度 (Tacit-understanding potential): 0-10
   - Does this create "we're on the same wavelength" feeling?
   - Is there call-and-response potential (抛梗→接梗)?
   - Would this become an inside joke the group references later?

C. 面子安全性 (Face-safety): 0-10
   - Could the most socially anxious person participate comfortably?
   - Is there any risk of public embarrassment, judgment, or comparison?
   - Are graceful opt-outs built in?

D. 结构合理性 (Structural soundness): 0-10
   - Are rules clear and timeboxed?
   - Does everyone know exactly what to do?
   - Is the burden on the GAME/ACTIVITY, not on individuals to be "interesting"?

E. 情绪价值 (Emotional value): 0-10
   - Does this make people feel understood and welcomed?
   - Is the tone low-pressure and inclusive?
   - Does it feel like it was made for THIS group, not generic?

Composite 趣味性 scoring guide:
- 9-10: Exceptional on 3+ sub-lenses. Creates genuine 默契 or 气氛. Feels unmistakably human and group-oriented. Would make people want to keep hanging out.
- 7-8: Strong on 2+ sub-lenses. Warm, engaging, culturally fluent. Contributes positively to group atmosphere.
- 5-6: Mediocre on all sub-lenses. Generic, forgettable, could be from any app. Doesn't harm but doesn't elevate.
- 3-4: Weak on 2+ sub-lenses. Awkward, forced, slightly cringe. Reads like bad translation or corporate chatbot. Might make one person laugh while others feel left out.
- 1-2: Fails on 3+ sub-lenses. Actively off-putting, face-threatening, or atmosphere-killing.

${isIcebreaker ? 'This is IN-EVENT icebreaker content. If it does not elevate the group atmosphere, the host will skip it and the social experience collapses. Be ruthless.' : 'This is user-facing content. Fun is important but not the only metric.'}

---

DIMENSION 2: 品牌一致性 (Brand Alignment)

Does it sound unmistakably like JoyJoin?
- Uses warm, social, playful tone — never corporate or clinical
- References archetype language when relevant (e.g. 开心柯基, 太阳鸡)
- Feels like it was written by a street-smart social veteran, not a marketing team
- Has 活人感: modal particles, emoji, contextual references, minor imperfections
- Avoids generic filler like "让我们一起...", "精彩的", "美好的时光", "旨在"

---

DIMENSION 3: 适当性 (Appropriateness) — HARD SAFETY LINE

- Safe for mixed company (strangers, different ages, different backgrounds)
- No sensitive topics (politics, religion, trauma, money pressure)
- Culturally appropriate for Chinese-speaking users in China
- No peer pressure, humiliation, or exclusionary dynamics
- If content is a game instruction: fairness must be explicit
- No forced disclosure of personal information
- No binary win/lose that creates face risk

---

DIMENSION 4: 清晰度 (Clarity)

- Easy to understand at a glance
- Instructions are actionable (user knows exactly what to do)
- No ambiguity in rules or next steps
- Appropriate length for the context (not a wall of text)
- For icebreakers: time and turn structure must be explicit

---

RESPONSE FORMAT (STRICT JSON):
{
  "scores": {
    "funEngagement": number,      // 1-10
    "brandAlignment": number,     // 1-10
    "appropriateness": number,    // 1-10
    "clarity": number             // 1-10
  },
  "passed": boolean,              // true if ALL thresholds met
  "critique": string,             // 2-3 sentences on what works and what doesn't
  "refinementHint": string        // 1 sentence prompt addition for retry if failed
}

Thresholds for PASS:
- funEngagement ≥ ${FUN_SCORE_REFINEMENT_THRESHOLD}
- brandAlignment ≥ ${BRAND_ALIGNMENT_THRESHOLD}
- appropriateness ≥ ${APPROPRIATENESS_THRESHOLD}
- clarity ≥ ${CLARITY_THRESHOLD}

If ANY dimension is below threshold, set passed=false and refinementHint to a concrete, specific suggestion. Use culturally-aware language in the hint. Example: "Add a 默契-building moment where everyone reveals simultaneously" rather than "make it more fun."`;
}

/**
 * Build the user prompt containing the content to judge.
 */
export function buildJudgeUserPrompt(generatedContent: string): string {
  return `Rate the following AI-generated content:\n\n---\n${generatedContent}\n---\n\nReturn ONLY the JSON object. No markdown, no explanations.`;
}
