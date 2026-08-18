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
 * - TIER_A_LINES: the full 12-archetype × 13-step voice matrix (founder
 *   decision: Tier A over Tier B template). R3-9 (2026-08-18) added the six
 *   extended-category-* keys so the interest taxonomy's per-category hint
 *   lines also speak in the user's archetype voice.
 *
 * Voice rules: Xiaoyue register (warm, playful, non-clinical), zero emoji,
 * never evaluative/mock an archetype, one sentence per line. Every line
 * passes the brand-copy 🔴 Hard Rules (see docs/copy/brand-copy-strategy.md).
 */

export type OnboardingVoiceStepId =
  | 'essential-displayName'
  | 'essential-intent'
  | 'essential-aboutYou'
  | 'essential-professionalProfile'
  | 'essential-location'
  | 'extended-interests'
  | 'extended-category-food'
  | 'extended-category-play'
  | 'extended-category-sports'
  | 'extended-category-culture'
  | 'extended-category-life'
  | 'extended-category-growth'
  | 'profile-review';

export const ONBOARDING_VOICE_STEP_IDS: readonly OnboardingVoiceStepId[] = [
  'essential-displayName',
  'essential-intent',
  'essential-aboutYou',
  'essential-professionalProfile',
  'essential-location',
  'extended-interests',
  'extended-category-food',
  'extended-category-play',
  'extended-category-sports',
  'extended-category-culture',
  'extended-category-life',
  'extended-category-growth',
  'profile-review',
];

const TIER_B_LINES: Record<OnboardingVoiceStepId, string> = {
  'essential-displayName': '嘿！给自己起个响亮的名字吧，活动中大家会这么叫你~',
  'essential-intent': '先说说你想收获什么，我才知道该把你安排在哪桌~',
  'essential-aboutYou': '告诉我你的基本情况，我帮你安排年龄和阶段都同频的朋友~',
  'essential-professionalProfile': '学历+行业一起搞定，说不定能遇到同行大佬！',
  'essential-location': '老乡见老乡，配桌优先排！',
  'extended-interests': '先点一个真正想聊的话题，再点同一项就能升温。三档会成为你的必聊项。',
  'extended-category-food': '火锅咖啡小酒馆，先标出你最想上桌的那一味。',
  'extended-category-play': '剧本杀到KTV，挑一个你想和大家一起玩的。',
  'extended-category-sports': '徒步露营骑行局，动起来的友谊升温最快。',
  'extended-category-culture': '展览电影演唱会，选一个你想约人一起去的现场。',
  'extended-category-life': '摄影穿搭CityWalk，把喜欢的生活方式标出来。',
  'extended-category-growth': '阅读搞事业语言搭子，挑一个你想一起进步的方向。',
  'profile-review': '先确认这张卡，悦仔再帮你筛合适的局。',
};

type ArchetypeVoiceMap = Record<string, Record<OnboardingVoiceStepId, string>>;

const TIER_A_LINES: ArchetypeVoiceMap = {
  corgi: {
    'essential-displayName': '名字就是你在桌上的第一张名片，柯基——挑一个一开口就带笑场的！',
    'essential-intent': '先选好想玩的方向，我就把你的场子安排上。',
    'essential-aboutYou': '像你这样的热场高手，当然要按年龄和阶段，把你放进最热闹、接得住你能量的那一桌！',
    'essential-professionalProfile': '说说你的职业吧，说不定桌上就有人等着被你点燃。',
    'essential-location': '同乡同桌，热场加倍——告诉我你从哪来、现在在哪混？',
    'extended-interests': '你的雷达本来就灵，先点一个真正想聊的话题，再点一下就能升温。',
    'extended-category-food': '饭局就是你的主场，柯基——先标出你最想组的那一桌！',
    'extended-category-play': '玩乐这一区写着你的名字，柯基——点下去，场子就算约上了！',
    'extended-category-sports': '动起来更热闹，柯基——选一个你想带头冲锋的玩法！',
    'extended-category-culture': '看展看演出也要搭子，柯基——标一个，你来当气氛担当！',
    'extended-category-life': '把日子过得有声有色是你的强项，柯基——挑一个想晒给同桌的！',
    'extended-category-growth': '连成长你都能聊成热场，柯基——选一个想拉着大家一起进步的方向！',
    'profile-review': '这张入场卡很有你的味道了——确认一下，就可以去点燃第一桌啦。',
  },
  rooster: {
    'essential-displayName': '给你起个名字吧，小太阳——稳定输出的人，名字也要让人记得住。',
    'essential-intent': '先选好想要的方向，我就把你放进最舒服的那桌。',
    'essential-aboutYou': '填好基本信息和你现在的阶段，我帮你找到节奏合拍、聊得到一块的同桌。',
    'essential-professionalProfile': '聊聊你的职业身份，说不定能遇到和你一样靠谱的同频人。',
    'essential-location': '老乡见老乡，节奏不用讲——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你的节奏，话题跟得上。',
    'extended-category-food': '小太阳的温暖先从胃开始——挑一个你能常组的那一味。',
    'extended-category-play': '玩乐也要稳定输出，小太阳——选一个你愿意常驻的场。',
    'extended-category-sports': '坚持运动的人自带光，小太阳——标出你一直在练的那个。',
    'extended-category-culture': '好的现场值得反复赴约，小太阳——选一个你想定期打卡的。',
    'extended-category-life': '把日常过出温度是你的本事，小太阳——挑一个你想分享的节奏。',
    'extended-category-growth': '稳步成长的人最有光，小太阳——选一个你愿意长期投入的方向。',
    'profile-review': '这张卡已经很稳了——确认之后，就去你的第一局发光吧。',
  },
  hamster_praise: {
    'essential-displayName': '起个名字吧，仓鼠——你这么会发现别人的好，名字也要甜甜的。',
    'essential-intent': '先选好想要的方向，我就把你和最会接住你好意的人排一桌。',
    'essential-aboutYou': '填好基本信息和你现在的阶段，我帮你把值得你发现亮点的人和好故事安排到身边。',
    'essential-professionalProfile': '说说你的职业吧，说不定桌上就有人等着被你看见。',
    'essential-location': '老乡见老乡，夸奖不用藏——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你感兴趣的样子最动人。',
    'extended-category-food': '仓鼠的饭桌从不冷场——选一个你想边夸边吃的主题。',
    'extended-category-play': '会夸人的玩伴最受欢迎——挑一个你想为大家喝彩的局。',
    'extended-category-sports': '运动时的加油声最动听——选一个你想陪大家一起流汗的。',
    'extended-category-culture': '看完一场好戏最想有人共鸣——标一个你想分享感动的现场。',
    'extended-category-life': '你总能发现日常里的闪光点——挑一个你想夸给同桌听的生活方式。',
    'extended-category-growth': '一起成长的人值得互相打气——选一个你想为同好鼓掌的方向。',
    'profile-review': '这张卡写满了你的真诚——确认一下，去遇见值得夸的人吧。',
  },
  fox: {
    'essential-displayName': '起个名字吧，狐狸——一开口就能把天聊出火花的那种。',
    'essential-intent': '先选好想要的方向，我就把你的局安排得有滋有味。',
    'essential-aboutYou': '填好基本信息和你的阶段，我帮你挖一桌接得住你梗的宝藏。',
    'essential-professionalProfile': '聊聊你的职业，说不定桌上就有和你一样有趣的故事。',
    'essential-location': '老乡见老乡，故事特别长——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你的嗅觉一向很准。',
    'extended-category-food': '寻宝狐的美食雷达该开了——标出你私藏的那一口。',
    'extended-category-play': '好玩的局逃不过你的鼻子——挑一个你闻到就想去的。',
    'extended-category-sports': '户外也藏着宝藏玩法——选一个你想带队去探索的。',
    'extended-category-culture': '小众现场才是你的猎场——标一个别人还没发现的宝。',
    'extended-category-life': '会生活的人处处有梗——挑一个你最有心得的玩法。',
    'extended-category-growth': '成长也能很有趣——选一个你觉得最有料的方向。',
    'profile-review': '这张卡有点东西——确认一下，去挖你的第一场宝藏局。',
  },
  dolphin_calm: {
    'essential-displayName': '起个名字吧，海豚——气场对了，名字自然就顺了。',
    'essential-intent': '先选好想要的方向，我就把你放进让你舒服的那一桌。',
    'essential-aboutYou': '填好基本信息和你的阶段，我帮你找到气场相合、让你最自在的同桌。',
    'essential-professionalProfile': '说说你的职业吧，我会留意和你频率相近的人。',
    'essential-location': '老乡见老乡，气场不用装——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——跟着你的感觉走。',
    'extended-category-food': '气味相投先从口味开始——挑一个让你舒服的那一味。',
    'extended-category-play': '玩也要频率对了才尽兴——选一个让你放松的场。',
    'extended-category-sports': '身体的节奏你最懂——标一个让你自在的运动方式。',
    'extended-category-culture': '好的现场有自己的气场——选一个和你同频的。',
    'extended-category-life': '生活方式合拍最难得——挑一个你过起来最顺的。',
    'extended-category-growth': '成长的频率不必赶——选一个让你心里踏实的方向。',
    'profile-review': '这张卡的气场很对——确认一下，顺流而下，去你的第一局。',
  },
  spider: {
    'essential-displayName': '起个名字吧，织网师——你的名字，会是你网里的第一个结点。',
    'essential-intent': '先选好想要的方向，我就把你的网撒向最对的那桌。',
    'essential-aboutYou': '填好基本信息和你的阶段，我帮你把对的人慢慢牵线到同一桌。',
    'essential-professionalProfile': '聊聊你的职业，说不定能织出一条意想不到的连线。',
    'essential-location': '老乡见老乡，连线特别强——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你很会找到连接点。',
    'extended-category-food': '饭桌是最好的结点——标一个你想用来牵线的那一味。',
    'extended-category-play': '一场好玩的局能织出整张网——选一个你想攒的局。',
    'extended-category-sports': '并肩流汗最容易连上线——挑一个你想约人同行的。',
    'extended-category-culture': '同看一场戏的人自然有了连线——标一个你想共享的现场。',
    'extended-category-life': '生活里的同好最耐看——挑一个你想慢慢织进网里的。',
    'extended-category-growth': '一起进步的关系最牢固——选一个你想搭线的方向。',
    'profile-review': '这张卡已经连上线了——确认一下，去织你的第一张网吧。',
  },
  koala: {
    'essential-displayName': '起个名字吧，考拉——让人一听就觉得安心的那种就很好。',
    'essential-intent': '先选好想要的方向，我就把你放进最温柔的那一桌。',
    'essential-aboutYou': '填好基本信息和你的阶段，我帮你找到最能接住你、让你放松做自己的那桌。',
    'essential-professionalProfile': '说说你的职业吧，说不定有人正需要你的那份稳。',
    'essential-location': '老乡见老乡，安心不用讲——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——不用急，按你的节奏来。',
    'extended-category-food': '好吃的东西最让人安心——挑一个你想慢慢吃慢慢聊的。',
    'extended-category-play': '玩也要玩得放松——选一个让你没压力的局。',
    'extended-category-sports': '微微出汗的感觉刚刚好——标一个你做起来最舒服的。',
    'extended-category-culture': '安安静静看一场戏也很好——选一个你想沉浸其中的现场。',
    'extended-category-life': '温柔的日子值得分享——挑一个你想和同桌一起过的。',
    'extended-category-growth': '成长不用着急——选一个让你觉得安心的方向。',
    'profile-review': '这张卡暖暖的——确认一下，去一个让你舒服的地方吧。',
  },
  octopus: {
    'essential-displayName': '起个名字吧，章鱼——越出乎意料，越适合你。',
    'essential-intent': '先选好想要的方向，我就把你的局安排得意想不到。',
    'essential-aboutYou': '填好基本信息和你的阶段，我帮你找到跟得上你脑洞、装得下你想法的局。',
    'essential-professionalProfile': '聊聊你的职业，说不定你的跨界故事正是桌上最亮的那道。',
    'essential-location': '老乡见老乡，脑洞碰脑洞——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你的触角一向很灵。',
    'extended-category-food': '章鱼的好奇心先投喂胃——标一个你想尝鲜的那一味。',
    'extended-category-play': '玩法越意想不到越对你胃口——选一个你最想解锁的局。',
    'extended-category-sports': '运动也能玩出脑洞——挑一个你还没试过的新玩法。',
    'extended-category-culture': '现场永远有惊喜——标一个你想一头钻进去的。',
    'extended-category-life': '生活方式的排列组合你最会玩——挑一个你想试试的新花样。',
    'extended-category-growth': '跨界成长最有戏——选一个你想打开的新地图。',
    'profile-review': '这张卡很有戏——确认一下，去制造第一场惊喜吧。',
  },
  owl: {
    'essential-displayName': '起个名字吧，猫头鹰——不用说太多，名字先让人记住。',
    'essential-intent': '先选好想要的方向，我就把你放进值得深聊的那一桌。',
    'essential-aboutYou': '填好基本信息和你的阶段，我帮你找到值得你开口、甚至值得熬夜的那桌。',
    'essential-professionalProfile': '说说你的职业吧，你的见解说不定正是桌上缺的那块。',
    'essential-location': '老乡见老乡，深浅不用量——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你挑话题的眼光一向毒。',
    'extended-category-food': '一顿饭能看出很多东西——标一个你想边吃边观察的。',
    'extended-category-play': '玩得深比玩得多有意思——选一个你想认真探究的局。',
    'extended-category-sports': '运动里藏着人的节奏——挑一个你想细细体会的。',
    'extended-category-culture': '值得看的现场值得回味——标一个你想从头看到尾的。',
    'extended-category-life': '生活美学是门学问——挑一个你想研究透的。',
    'extended-category-growth': '真正的好奇心值得熬夜——选一个你想深入的方向。',
    'profile-review': '这张卡很有记忆点——确认一下，去观察你的第一局吧。',
  },
  elephant: {
    'essential-displayName': '起个名字吧，大象——稳稳的，让人一听就想同桌。',
    'essential-intent': '先选好想要的方向，我就把你放进最踏实的那一桌。',
    'essential-aboutYou': '填好基本信息和你的阶段，我帮你找到最需要你的稳定感、会因为你在而安心的那桌。',
    'essential-professionalProfile': '聊聊你的职业，靠谱的人到哪儿都受欢迎。',
    'essential-location': '老乡见老乡，踏实不用讲——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——稳扎稳打，像你。',
    'extended-category-food': '靠谱的饭局从会点菜开始——标一个你拿得出手的那一味。',
    'extended-category-play': '组局靠谱的人最受欢迎——选一个你能稳稳带起来的场。',
    'extended-category-sports': '稳稳的运动习惯最难得——挑一个你一直在坚持的。',
    'extended-category-culture': '好的现场值得认真赴约——标一个你会准时到的。',
    'extended-category-life': '踏实过日子也是一种本事——挑一个你过得最有心得的。',
    'extended-category-growth': '稳扎稳打地变好——选一个你愿意长期投入的方向。',
    'profile-review': '这张卡很可靠——确认一下，稳稳地走进你的第一局。',
  },
  turtle: {
    'essential-displayName': '起个名字吧，龟龟——不用急，想好了再定也可以。',
    'essential-intent': '先选好想要的方向，我就把你放进不用假装热络的那一桌。',
    'essential-aboutYou': '填好基本信息和你的阶段，我帮你找到节奏舒服、愿意慢慢熟起来的那桌。',
    'essential-professionalProfile': '说说你的职业吧，靠谱这件事，时间会说话。',
    'essential-location': '老乡见老乡，慢慢聊更长——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——按你的速度来就好。',
    'extended-category-food': '慢慢吃慢慢聊最舒服——挑一个你不赶时间的那一味。',
    'extended-category-play': '不用假装热络也能玩得开心——选一个你可以慢热融入的局。',
    'extended-category-sports': '按自己的节奏动一动就好——标一个你不着急的运动。',
    'extended-category-culture': '好戏不怕看得慢——选一个你想慢慢品的现场。',
    'extended-category-life': '日子慢慢过才有味道——挑一个你愿意花时间的方式。',
    'extended-category-growth': '成长这件事急不来——选一个你想慢慢走的方向。',
    'profile-review': '这张卡很踏实——确认一下，准备好了就去你的第一局。',
  },
  cat: {
    'essential-displayName': '起个名字吧，猫猫——低调一点也没关系，懂的人自然会记住。',
    'essential-intent': '先选好想要的方向，我就把你放进对味的那一桌。',
    'essential-aboutYou': '填好基本信息和你的阶段，我帮你找到值得你出现、也值得你走出舒适圈的那桌。',
    'essential-professionalProfile': '说说你的职业吧，说不定桌上就有你想深聊的人。',
    'essential-location': '老乡见老乡，默契不用讲——你从哪来、现在在哪？',
    'extended-interests': '先点一个真正想聊的话题，再点一下升温——你很知道什么值得。',
    'extended-category-food': '对味的食物和对味的人一样值得等——先标一个你真正喜欢的。',
    'extended-category-play': '安静的人也有自己的玩法——选一个你愿意露面的局。',
    'extended-category-sports': '不用假装热情也能动起来——挑一个你独处也乐意的。',
    'extended-category-culture': '好现场不需要喧哗——标一个你想安静欣赏的。',
    'extended-category-life': '把日子过成自己喜欢的样子——挑一个你私藏的生活方式。',
    'extended-category-growth': '悄悄变厉害是你的风格——选一个你想默默深耕的方向。',
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
