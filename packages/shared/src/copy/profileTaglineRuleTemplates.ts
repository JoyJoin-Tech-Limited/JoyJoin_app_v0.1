/**
 * Profile Tagline Rule Templates
 * 入场卡「悦仔的观察」规则兜底模板库（entry-card-insight-v2, AC-05/AC-12）
 *
 * Deterministic template library for the profile tagline v2 pipeline:
 *  - Observation lines cite the user's REAL interest labels via slots; with
 *    zero interest selections they degrade to an archetype-level line
 *    (AC-13), so the observation row always renders when any signal exists.
 *  - Inference/reveal fallback templates (12 archetypes × 3 slotted + 1
 *    slot-free safety net each) activate only when the LLM line is unusable.
 *    The slot-free net guarantees ≥2 lines (observation + inference) even
 *    when every citable slot is empty (AC-05).
 *
 * Slot-fill rules (AC-05 行丢弃可测规则):
 *  - a required slot whose value is missing/empty → template fails → caller
 *    drops the line;
 *  - rendered text < MIN_TAGLINE_LINE_CHARS → dropped.
 *
 * Copy governance (AC-12 / SEC-02): no emoji, no review-blocked vocabulary
 * (匹配/社交/灵魂/撮合/AI — see `./terms`). `renderRuleTemplate` additionally
 * re-scans the rendered text so a slot value can never smuggle blocked vocab
 * into visible copy. The unit test `profileTaglineRuleTemplates.test.ts`
 * scans every raw template for both rules.
 */

import { findReviewBlockedVocab } from './terms.js';

/** AC-05: a rendered line shorter than this is dropped. */
export const MIN_TAGLINE_LINE_CHARS = 12;
/** LLM/template lines longer than this are rejected as low quality. */
export const MAX_TAGLINE_LINE_CHARS = 80;
/** Answer slot text is truncated to this length so pills/lines stay compact. */
export const MAX_ANSWER_SLOT_CHARS = 12;

/**
 * Slot values available to templates. Every value is a REAL user signal —
 * interest labels from user_interests selections/topPriorities, or the
 * recovered answer text from assessment_answers. Templates must never
 * invent text for a slot.
 */
export interface TaglineTemplateSlots {
  /** Top selection label (highest heat). */
  interest?: string;
  /** Second selection label. */
  interest2?: string;
  /** Top topPriorities label. */
  priority?: string;
  /** Recovered answer text of the top-ranked Q&A pair (sanitized). */
  answer?: string;
}

export type RuleTemplateRole = 'inference' | 'reveal';
export type TaglineTemplateRole = 'observation' | RuleTemplateRole;

export interface RuleTemplate {
  role: TaglineTemplateRole;
  /**
   * Template text with `{slot}` markers. Invariant (test-enforced): every
   * `{slot}` marker present in `text` is listed in `requiredSlots`.
   */
  text: string;
  requiredSlots: Array<keyof TaglineTemplateSlots>;
}

/**
 * Trim + truncate a raw slot value. Returns undefined when empty so the
 * caller treats the slot as missing (template fails → line dropped).
 */
export function sanitizeSlotValue(
  raw: string | null | undefined,
  maxChars: number = MAX_ANSWER_SLOT_CHARS,
): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed;
}

const SLOT_MARKER_RE = /\{(interest|interest2|priority|answer)\}/g;

/**
 * Render a template against the available slots.
 * Returns null (caller drops the line) when:
 *  - any required slot value is missing/empty,
 *  - an unfilled slot marker survives,
 *  - the rendered text is shorter than MIN_TAGLINE_LINE_CHARS, or
 *  - the rendered text hits review-blocked vocabulary (defense-in-depth).
 */
export function renderRuleTemplate(
  template: RuleTemplate,
  slots: TaglineTemplateSlots,
): string | null {
  let text = template.text;
  for (const slot of template.requiredSlots) {
    const value = slots[slot]?.trim();
    if (!value) return null;
    text = text.split(`{${slot}}`).join(value);
  }
  SLOT_MARKER_RE.lastIndex = 0;
  if (SLOT_MARKER_RE.test(text)) return null;
  const finalText = text.trim();
  if (finalText.length < MIN_TAGLINE_LINE_CHARS) return null;
  if (findReviewBlockedVocab(finalText)) return null;
  return finalText;
}

// ─── Observation templates (确定性，引用真实兴趣 label) ───────────────────────
// Ordered: the renderer tries them in sequence and takes the first whose
// required slots are all filled. The archetype-level map below is the
// zero-interest degradation path (AC-13).

export const OBSERVATION_INTEREST_TEMPLATES: RuleTemplate[] = [
  {
    role: 'observation',
    text: '{interest}和{interest2}——你舍得为这两件事花时间',
    requiredSlots: ['interest', 'interest2'],
  },
  {
    role: 'observation',
    text: '悦仔注意到，你最近把热情放在了{interest}上',
    requiredSlots: ['interest'],
  },
];

/**
 * Archetype-level observation lines — zero-interest degradation (AC-13).
 * Slot-free so the observation row always renders when an archetype exists.
 */
export const ARCHETYPE_OBSERVATION_LINES: Record<string, string> = {
  corgi: '悦仔对你的第一印象：你到的地方，气氛会先热起来',
  rooster: '悦仔对你的第一印象：你很会接住别人的情绪',
  hamster_praise: '悦仔对你的第一印象：你让人觉得自己被认真看见',
  fox: '悦仔对你的第一印象：你习惯先观察，再找到最妙的切入点',
  dolphin_calm: '悦仔对你的第一印象：你在的地方，紧绷的气氛会松下来',
  spider: '悦仔对你的第一印象：你天然会把不同的人连到一起',
  koala: '悦仔对你的第一印象：你在场，别人就敢说真心话',
  octopus: '悦仔对你的第一印象：你总能把话题带向意想不到的地方',
  owl: '悦仔对你的第一印象：你的问题常让人第一次认真想一件事',
  elephant: '悦仔对你的第一印象：节奏再快，你都是稳住场子的那个人',
  turtle: '悦仔对你的第一印象：你慢热，但每一步都让人踏实',
  cat: '悦仔对你的第一印象：你安静，但记住的细节比谁都多',
};

// ─── Inference / reveal rule-fallback templates ─────────────────────────────
// 12 archetypes × 4 templates: two slotted inference ({interest} / {answer}),
// one slotted reveal ({priority}), one slot-free inference safety net.
// Slots only ever carry the user's real labels / answer text (AC-05).

export const ARCHETYPE_RULE_TEMPLATES: Record<string, RuleTemplate[]> = {
  corgi: [
    { role: 'inference', text: '一聊起{interest}，你的眼睛会先亮起来，然后整张桌子都被你带动', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——这很像你，热场不靠嗓门，靠的是先伸手', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你把{priority}标成最在意的事，其实你是在找能一起疯的人', requiredSlots: ['priority'] },
    { role: 'inference', text: '冷场超过三秒你就坐不住了，总会第一个把话头捡起来', requiredSlots: [] },
  ],
  rooster: [
    { role: 'inference', text: '说到{interest}你会不自觉提高音量，旁边的人也跟着兴奋起来', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你很会把大家的情绪串成一股', requiredSlots: ['answer'] },
    { role: 'reveal', text: '热闹哪儿都有，你把{priority}放最前面，是想有人接得住你的热', requiredSlots: ['priority'] },
    { role: 'inference', text: '群里气氛低落时，你常常是那个先发消息破冰的人', requiredSlots: [] },
  ],
  hamster_praise: [
    { role: 'inference', text: '聊到{interest}时，你会先问别人怎么看，再慢慢放出自己的观点', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你总能记住别人随口提过的小事', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你最看重{priority}，其实你最怕的是有人被忽略', requiredSlots: ['priority'] },
    { role: 'inference', text: '你夸人的话很具体，不是客套，是真的看见了对方', requiredSlots: [] },
  ],
  fox: [
    { role: 'inference', text: '聊到{interest}你会比平时话多，而且总能找到别人没想到的角度', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——这很像你，先看清楚，再决定往哪走', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你把{priority}标成最在意，其实你在意的是有没有真正聊进去', requiredSlots: ['priority'] },
    { role: 'inference', text: '进到一个新局，你会先扫一圈每个人的状态，再决定从谁聊起', requiredSlots: [] },
  ],
  dolphin_calm: [
    { role: 'inference', text: '{interest}这种需要沉下来的事吸引你，说明你心里有自己的节奏', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你不抢话，但你开口时大家都在听', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你把{priority}放在第一位，其实你要的是不慌不忙的相处', requiredSlots: ['priority'] },
    { role: 'inference', text: '别人急着表达的时候，你往往是那个先听完的人', requiredSlots: [] },
  ],
  spider: [
    { role: 'inference', text: '你对{interest}的上心，最后会变成“正好认识一个人也懂这个”', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你脑子里像有一张人脉地图，随时在连线', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你最看重{priority}，其实你享受的是把对的人凑到一起', requiredSlots: ['priority'] },
    { role: 'inference', text: '聊到一半你会发现，桌上两个陌生人因你一句话就接上了', requiredSlots: [] },
  ],
  koala: [
    { role: 'inference', text: '你喜欢{interest}这类能沉下去的事，深聊比热聊更像你的主场', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你给的安全感，是从认真听开始的', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你把{priority}标成最在意，说明你更想要少数几个聊得深的人', requiredSlots: ['priority'] },
    { role: 'inference', text: '饭局后半场，别人反而会主动坐到你旁边说悄悄话', requiredSlots: [] },
  ],
  octopus: [
    { role: 'inference', text: '一聊{interest}你的点子就停不下来，同桌的人只想听你再讲一个', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你的大脑好像永远在后台跑创意程序', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你把{priority}放在第一位，其实你在找能跟上你脑回路的人', requiredSlots: ['priority'] },
    { role: 'inference', text: '普通的话题到你嘴里，总会拐出一个意想不到的方向', requiredSlots: [] },
  ],
  owl: [
    { role: 'inference', text: '你对{interest}的好奇不是随便问问，是会追到底的那种', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你的问题常让对方愣一下，然后聊得更深', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你最看重{priority}，其实你想弄明白事情背后的为什么', requiredSlots: ['priority'] },
    { role: 'inference', text: '你不满足于寒暄，三句话之内就会问到一个真问题', requiredSlots: [] },
  ],
  elephant: [
    { role: 'inference', text: '聊到{interest}你是认真的很——约好的事，你会一直在', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你不轻易许诺，但说了的就一定会做到', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你把{priority}标成最在意，说明稳定和分寸对你不是口号', requiredSlots: ['priority'] },
    { role: 'inference', text: '局面再乱，大家也习惯先看看你的反应再定心', requiredSlots: [] },
  ],
  turtle: [
    { role: 'inference', text: '你对{interest}是慢热型的认真，一旦上心就会待很久', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你话不多，但每一句都经过琢磨', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你把{priority}放在第一位，其实你要的是经得起时间的关系', requiredSlots: ['priority'] },
    { role: 'inference', text: '第一次见面你话不多，但散场时别人记住的往往是你', requiredSlots: [] },
  ],
  cat: [
    { role: 'inference', text: '提到{interest}你才会打开话匣子，平时的你更习惯旁观', requiredSlots: ['interest'] },
    { role: 'inference', text: '你说过「{answer}」——你看似安静，其实把每个人都看在了眼里', requiredSlots: ['answer'] },
    { role: 'reveal', text: '你最看重{priority}，说明你要的是被少数人真正懂', requiredSlots: ['priority'] },
    { role: 'inference', text: '你不抢风头，但你随口一句常常是最准的那句', requiredSlots: [] },
  ],
};
