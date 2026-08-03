/**
 * Onboarding Archetype Voice Matrix (Bet 1 人格在场, 2026-07-31)
 *
 * After the archetype reveal, onboarding steps 6–8 must keep "knowing who
 * the user is" — Xiaoyue narrates each step AS the user's archetype instead
 * of addressing an anonymous form-filler.
 *
 * Structure (PM R2):
 * - TIER_B_LINES: step-level fallback lines. Any missing Tier A key falls
 *   back here, so the matrix can layer in batches and a renamed/removed
 *   step degrades silently instead of crashing.
 * - TIER_A_LINES: the full 12-archetype × 8-step voice matrix (founder
 *   decision: Tier A over Tier B template).
 *
 * Voice rules: Xiaoyue register (warm, playful, non-clinical), zero emoji,
 * never evaluative/mock an archetype, one sentence per line. Every line
 * passes the brand-copy 🔴 Hard Rules (see docs/copy/brand-copy-strategy.md).
 */

export type OnboardingVoiceStepId =
  | 'essential-displayName'
  | 'essential-genderBirthday'
  | 'essential-professionalProfile'
  | 'essential-lifeStage'
  | 'essential-location'
  | 'essential-intent'
  | 'extended-interests'
  | 'profile-review';

export const ONBOARDING_VOICE_STEP_IDS: readonly OnboardingVoiceStepId[] = [
  'essential-displayName',
  'essential-genderBirthday',
  'essential-professionalProfile',
  'essential-lifeStage',
  'essential-location',
  'essential-intent',
  'extended-interests',
  'profile-review',
];

const TIER_B_LINES: Record<OnboardingVoiceStepId, string> = {
  'essential-displayName': '嘿！给自己起个响亮的名字吧，活动中大家会这么叫你~',
  'essential-genderBirthday': '帮你找到年龄相近、聊得来的朋友！',
  'essential-professionalProfile': '学历+行业一起搞定，说不定能遇到同行大佬！',
  'essential-lifeStage': '告诉我你现在的人生阶段，我帮你匹配同频的朋友~',
  'essential-location': '老乡见老乡，配桌优先排！',
  'essential-intent': '最后一个问题！选完之后我就知道该把你安排在哪桌了',
  'extended-interests': '先点一个真正想聊的话题，再点同一项就能升温。三档会成为你的必聊项。',
  'profile-review': '先确认这张卡，悦仔再帮你筛合适的局。',
};

type ArchetypeVoiceMap = Record<string, Record<OnboardingVoiceStepId, string>>;

const TIER_A_LINES: ArchetypeVoiceMap = {
  corgi: {
    'essential-displayName': '名字就是你在桌上的第一张名片，柯基——挑一个一开口就带笑场的！',
    'essential-genderBirthday': '像你这样的热场高手，当然要帮你配年龄同频、接得住你能量的人！',
    'essential-professionalProfile': '说说你的职业吧，说不定桌上就有人等着被你点燃。',
    'essential-lifeStage': '你现在的人生阶段，决定了我把你放进哪一桌才最热闹。',
    'essential-location': '同乡同桌，热场加倍——告诉我你从哪来、现在在哪混？',
    'essential-intent': '最后一题！选好想玩的方向，我就把你的场子安排上。',
    'extended-interests': '你的雷达本来就灵，先点一个真正想聊的话题，再点一下就能升温。',
    'profile-review': '这张入场卡很有你的味道了——确认一下，就可以去点燃第一桌啦。',
  },
  rooster: {
    'essential-displayName': '给你起个名字吧，小太阳——稳定输出的人，名字也要让人记得住。',
    'essential-genderBirthday': '填好基本信息，我帮你找到节奏合拍的同桌。',
    'essential-professionalProfile': '聊聊你的职业身份，说不定能遇到和你一样靠谱的同频人。',
    'essential-lifeStage': '告诉我你现在的人生阶段，节奏相近的人更容易聊到一块。',
    'essential-location': '老乡见老乡，节奏不用讲——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你放进最舒服的那桌。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你的节奏，话题跟得上。',
    'profile-review': '这张卡已经很稳了——确认之后，就去你的第一局发光吧。',
  },
  hamster_praise: {
    'essential-displayName': '起个名字吧，仓鼠——你这么会发现别人的好，名字也要甜甜的。',
    'essential-genderBirthday': '填好基本信息，我帮你找到值得你发现亮点的那桌人。',
    'essential-professionalProfile': '说说你的职业吧，说不定桌上就有人等着被你看见。',
    'essential-lifeStage': '你现在的人生阶段，会告诉我该把哪些好故事安排到你身边。',
    'essential-location': '老乡见老乡，夸奖不用藏——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你和最会接住你好意的人排一桌。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你感兴趣的样子最动人。',
    'profile-review': '这张卡写满了你的真诚——确认一下，去遇见值得夸的人吧。',
  },
  fox: {
    'essential-displayName': '起个名字吧，狐狸——一开口就能把天聊出火花的那种。',
    'essential-genderBirthday': '填好基本信息，我帮你找到接得住你梗的那桌。',
    'essential-professionalProfile': '聊聊你的职业，说不定桌上就有和你一样有趣的故事。',
    'essential-lifeStage': '你现在的人生阶段，决定了我给你挖哪一桌宝藏。',
    'essential-location': '老乡见老乡，故事特别长——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你的局安排得有滋有味。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你的嗅觉一向很准。',
    'profile-review': '这张卡有点东西——确认一下，去挖你的第一场宝藏局。',
  },
  dolphin_calm: {
    'essential-displayName': '起个名字吧，海豚——气场对了，名字自然就顺了。',
    'essential-genderBirthday': '填好基本信息，我帮你找到气场相合的同桌。',
    'essential-professionalProfile': '说说你的职业吧，我会留意和你频率相近的人。',
    'essential-lifeStage': '你现在的人生阶段，会帮我判断哪种局让你最自在。',
    'essential-location': '老乡见老乡，气场不用装——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你放进让你舒服的那一桌。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——跟着你的感觉走。',
    'profile-review': '这张卡的气场很对——确认一下，顺流而下，去你的第一局。',
  },
  spider: {
    'essential-displayName': '起个名字吧，织网师——你的名字，会是你网里的第一个结点。',
    'essential-genderBirthday': '填好基本信息，我帮你把对的人慢慢连到你身边。',
    'essential-professionalProfile': '聊聊你的职业，说不定能织出一条意想不到的连线。',
    'essential-lifeStage': '你现在的人生阶段，决定了我替你牵线到哪一桌。',
    'essential-location': '老乡见老乡，连线特别强——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你的网撒向最对的那桌。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你很会找到连接点。',
    'profile-review': '这张卡已经连上线了——确认一下，去织你的第一张网吧。',
  },
  koala: {
    'essential-displayName': '起个名字吧，考拉——让人一听就觉得安心的那种就很好。',
    'essential-genderBirthday': '填好基本信息，我帮你找到让你放松做自己的那桌。',
    'essential-professionalProfile': '说说你的职业吧，说不定有人正需要你的那份稳。',
    'essential-lifeStage': '你现在的人生阶段，会告诉我哪种局最能接住你。',
    'essential-location': '老乡见老乡，安心不用讲——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你放进最温柔的那一桌。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——不用急，按你的节奏来。',
    'profile-review': '这张卡暖暖的——确认一下，去一个让你舒服的地方吧。',
  },
  octopus: {
    'essential-displayName': '起个名字吧，章鱼——越出乎意料，越适合你。',
    'essential-genderBirthday': '填好基本信息，我帮你找到跟得上你脑洞的那桌。',
    'essential-professionalProfile': '聊聊你的职业，说不定你的跨界故事正是桌上最亮的那道。',
    'essential-lifeStage': '你现在的人生阶段，会帮我找到装得下你想法的局。',
    'essential-location': '老乡见老乡，脑洞碰脑洞——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你的局安排得意想不到。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你的触角一向很灵。',
    'profile-review': '这张卡很有戏——确认一下，去制造第一场惊喜吧。',
  },
  owl: {
    'essential-displayName': '起个名字吧，猫头鹰——不用说太多，名字先让人记住。',
    'essential-genderBirthday': '填好基本信息，我帮你找到值得你开口的那桌。',
    'essential-professionalProfile': '说说你的职业吧，你的见解说不定正是桌上缺的那块。',
    'essential-lifeStage': '你现在的人生阶段，会告诉我哪种局值得你熬夜。',
    'essential-location': '老乡见老乡，深浅不用量——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你放进值得深聊的那一桌。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你挑话题的眼光一向毒。',
    'profile-review': '这张卡很有记忆点——确认一下，去观察你的第一局吧。',
  },
  elephant: {
    'essential-displayName': '起个名字吧，大象——稳稳的，让人一听就想同桌。',
    'essential-genderBirthday': '填好基本信息，我帮你找到会因为你在而安心的那桌。',
    'essential-professionalProfile': '聊聊你的职业，靠谱的人到哪儿都受欢迎。',
    'essential-lifeStage': '你现在的人生阶段，会告诉我哪种局最需要你的稳定感。',
    'essential-location': '老乡见老乡，踏实不用讲——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你放进最踏实的那一桌。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——稳扎稳打，像你。',
    'profile-review': '这张卡很可靠——确认一下，稳稳地走进你的第一局。',
  },
  turtle: {
    'essential-displayName': '起个名字吧，龟龟——不用急，想好了再定也可以。',
    'essential-genderBirthday': '填好基本信息，我帮你找到愿意慢慢熟起来的那桌。',
    'essential-professionalProfile': '说说你的职业吧，靠谱这件事，时间会说话。',
    'essential-lifeStage': '你现在的人生阶段，会告诉我哪种节奏让你最舒服。',
    'essential-location': '老乡见老乡，慢慢聊更长——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你放进不用假装热络的那一桌。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——按你的速度来就好。',
    'profile-review': '这张卡很踏实——确认一下，准备好了就去你的第一局。',
  },
  cat: {
    'essential-displayName': '起个名字吧，猫猫——低调一点也没关系，懂的人自然会记住。',
    'essential-genderBirthday': '填好基本信息，我帮你找到值得你出现的那桌。',
    'essential-professionalProfile': '说说你的职业吧，说不定桌上就有你想深聊的人。',
    'essential-lifeStage': '你现在的人生阶段，会告诉我哪种局值得你走出舒适圈。',
    'essential-location': '老乡见老乡，默契不用讲——你从哪来、现在在哪？',
    'essential-intent': '最后一题！选好方向，我就把你放进对味的那一桌。',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你很知道什么值得。',
    'profile-review': '这张卡很懂你——确认一下，优雅地溜进你的第一局。',
  },
};

/**
 * Resolve the Xiaoyue voice line for an onboarding step. Tier A (archetype
 * voice) wins when present; Tier B step default is the graceful fallback
 * for unknown archetypes and future matrix gaps.
 */
export function getOnboardingVoiceLine(
  stepId: OnboardingVoiceStepId,
  archetype?: string | null,
): string {
  if (archetype) {
    const line = TIER_A_LINES[archetype]?.[stepId];
    if (line) return line;
  }
  return TIER_B_LINES[stepId];
}

/** Test/audit hook: raw tables (never mutate from product code). */
export const ONBOARDING_VOICE_TABLES = {
  tierB: TIER_B_LINES,
  tierA: TIER_A_LINES,
} as const;
