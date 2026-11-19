import { z } from 'zod';
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames';
import { archetypeRegistry } from '@shared/personality/archetypeRegistry';
import { XIAOYUE_PERSONA, GENDER_NEUTRAL, XIAOYUE_PERSONA_PROMPT_VERSION, XIAOYUE_CRAFT_PROMPT_VERSION } from './prompts';
import { getDeepseekClient, getDeepseekModel } from './ai/deepseekClient';
import { generateWithCraftQuality } from './lib/craftQualityGate';
import { logger } from './lib/logger';
import { buildAIGCMeta, buildCachedAIMeta, buildFallbackAIMeta, buildLiveAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import { moderateGeneratedContent } from './lib/aiContentModeration';

export interface ArchetypeAnalysisInput {
  archetype: string;
  secondaryArchetype?: string | null;
  topArchetypes?: Array<{
    archetype: string;
    score: number;
    confidence?: number;
  }>;
  traitScores: {
    affinity: number;
    openness: number;
    conscientiousness: number;
    emotionalStability: number;
    extraversion: number;
    positivity: number;
  };
  questionPath?: string[];
  confidence?: number;
}

export interface XiaoyueShareVariants {
  selfIntro: string;
  friendCallout: string;
  socialInvite: string;
}

export interface XiaoyueAnalysisResult {
  headline: string;
  analysis: string;
  socialRole: string;
  bestScene: string;
  microAction: string;
  shareLine: string;
  stateLabel: string;
  whyThisFits: string;
  blendLine: string;
  expressionTags: string[];
  shareVariants: XiaoyueShareVariants;
  cached: boolean;
  /** Standard AI observability metadata with AIGC compliance flags. */
  meta: AIResponseMeta;
}

type ConfidenceBand = 'high' | 'medium' | 'low';

interface DerivedSocialSnapshot {
  stateLabel: string;
  confidenceBand: ConfidenceBand;
  confidenceInstruction: string;
  /** L0 — the verdict: one declarative sentence that names the pattern ("你是那种…的人"). */
  verdictLine: string;
  /** L0.5 — why this archetype carries that animal name (empty for blends). */
  archetypeNoteLine: string;
  /** L1 — what others perceive first. */
  sceneLens: string;
  /** L2 — why this person runs this way. */
  mechanismLine: string;
  /** L3 — the cost, or how others misread it. */
  misreadLine: string;
  /** L4 — the relationship condition that makes the mechanism work. */
  conditionLine: string;
  socialRole: string;
  bestScene: string;
  /** @deprecated Legacy slot rendered as the closing line; now equals conditionLine. */
  microAction: string;
  headlineHint: string;
  shareLineHint: string;
}

function archetypeToCn(id: string): string {
  return ARCHETYPE_BY_ID[id]?.nameCn ?? id;
}

const HIGH_CONFIDENCE_THRESHOLD = 0.82;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.64;
/**
 * State-derivation thresholds.
 *
 * These were recalibrated on 2026-11-17 against the twelve registry
 * `traitProfile`s, because the previous bands contradicted 9 of the 12
 * declarations (six archetypes were swallowed by the "high extraversion +
 * high positivity" band, turtle's stability outranked its low energy, and
 * owl missed the openness band by one point). The rule below reproduces all
 * twelve declared `stateLabel`s — locked by a test.
 *
 * Remember the letters: E is emotional stability, not extraversion.
 */
const IDEA_OPENNESS_THRESHOLD = 80;
const IDEA_EXTRAVERSION_THRESHOLD = 70;
const LOW_ENERGY_EXTRAVERSION = 30;
const RESERVED_EXTRAVERSION_CEILING = 58;
const DEEP_AFFINITY_THRESHOLD = 75;
const DEEP_OPENNESS_THRESHOLD = 70;
const WARM_AFFINITY_THRESHOLD = 75;
const WARM_EXTRAVERSION_CEILING = 66;
const STEADY_STABILITY_THRESHOLD = 65;
const STEADY_CONSCIENTIOUSNESS_THRESHOLD = 63;
const HEAT_EXTRAVERSION_THRESHOLD = 90;
const HEAT_POSITIVITY_THRESHOLD = 80;
const HEADLINE_MIN_LENGTH = 12;
const HEADLINE_MAX_LENGTH = 24;
const ANALYSIS_MIN_LENGTH = 30;
// Six beats, not five: the verdict, the name's origin, then the four layers.
const ANALYSIS_MAX_LENGTH = 400;
const SHORT_COPY_MIN_LENGTH = 8;
const SHORT_COPY_MAX_LENGTH = 80;
const EXTENDED_COPY_MAX_LENGTH = 140;
const TAG_MIN_LENGTH = 2;
const TAG_MAX_LENGTH = 8;

const shareVariantsSchema = z.object({
  selfIntro: z.string().min(SHORT_COPY_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
  friendCallout: z.string().min(SHORT_COPY_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
  socialInvite: z.string().min(SHORT_COPY_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
});

const analysisResponseSchema = z.object({
  headline: z.string().min(HEADLINE_MIN_LENGTH).max(HEADLINE_MAX_LENGTH),
  analysis: z.string().min(ANALYSIS_MIN_LENGTH).max(ANALYSIS_MAX_LENGTH),
  socialRole: z.string().min(SHORT_COPY_MIN_LENGTH).max(SHORT_COPY_MAX_LENGTH),
  bestScene: z.string().min(SHORT_COPY_MIN_LENGTH).max(SHORT_COPY_MAX_LENGTH),
  microAction: z.string().min(SHORT_COPY_MIN_LENGTH).max(SHORT_COPY_MAX_LENGTH),
  shareLine: z.string().min(SHORT_COPY_MIN_LENGTH).max(SHORT_COPY_MAX_LENGTH),
  whyThisFits: z.string().min(ANALYSIS_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
  blendLine: z.string().min(SHORT_COPY_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
  expressionTags: z.array(z.string().min(TAG_MIN_LENGTH).max(TAG_MAX_LENGTH)).min(3).max(4),
  shareVariants: shareVariantsSchema,
});

const analysisCache = new Map<string, { result: Omit<XiaoyueAnalysisResult, 'cached'>; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60;
/** In-flight generation promises keyed by cache key — dedupes concurrent
 *  prefetch + direct calls so the same profile never burns two LLM runs. */
const inFlightAnalysis = new Map<string, Promise<XiaoyueAnalysisResult>>();

const traitLabels: Record<keyof ArchetypeAnalysisInput['traitScores'], string> = {
  affinity: '亲和力',
  openness: '开放性',
  conscientiousness: '责任心',
  emotionalStability: '情绪稳定性',
  extraversion: '外向性',
  positivity: '正能量性',
};

function normalizeTraitScore(value: number): number {
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

/**
 * The registry writes its own `stateLabel` for every archetype. It is authored
 * next to that animal's trait profile and narrative, so it is the better
 * authority whenever the reading is about one archetype.
 */
function getDeclaredStateLabel(archetypeId?: string | null): string | null {
  if (!archetypeId) return null;
  const record = (archetypeRegistry as Record<string, { display?: { xiaoyueFallback?: { stateLabel?: string } } } | undefined>)[
    archetypeId
  ];
  return record?.display?.xiaoyueFallback?.stateLabel ?? null;
}

/**
 * Per-archetype reading copy.
 *
 * The seven behavioural states are a bucket, and buckets flatten voice: 12
 * archetypes squeezed into 7 states means half of them read like a description
 * of somebody else. This table is the per-archetype layer — when a result is a
 * single archetype, these four beats replace the state copy. States stay as the
 * fallback for blends, low confidence and unknown ids.
 *
 * Filled by hand, not by the model: `ARCHETYPE_READINGS[archetypeId]` wins over
 * `snapshotByState[stateLabel]` for the four reading beats (the verdict comes
 * from the same entry's `verdict`).
 */
export interface ArchetypeReading {
  verdict: string;
  signal: string;
  mechanism: string;
  misread: string;
  condition: string;
}

const ARCHETYPE_READINGS: Record<string, ArchetypeReading> = {
  corgi: {
    verdict: '你是那种一出现，房间的温度就先升半度的人。',
    signal: '你进门还没坐下，先把屋里每个人的名字和笑点过了一遍，三句话之内就有人接上你的话。',
    mechanism: '你先把自己抛出去——讲一件刚发生的糗事，看谁敢接；有人接住，这一桌就算正式开始了。',
    misread:
      '麻烦在于，你先拿自己当引子，热闹起来之后，你想说的那件事还留在原地。什么时候把它拿出来，是你自己的节奏。',
    condition: '让你愿意一直热下去的，是有人会回头接住你抛出去的那句话；每次都要自己撑，热就变成任务。',
  },
  rooster: {
    verdict: '你是那种不抢戏，却让一桌人的语速慢慢降下来的人。',
    signal: '你坐下来先问大家喝什么，然后把每个人的杯子都续上，整个过程没打断任何一句话。',
    mechanism: '你不靠漂亮话圆回来，而是把同样的温度重复到别人相信；你的标准是，对方今天有没有多说一点。',
    misread:
      '代价是，你总是先安顿好所有人，自己那份想法就排到了最后。它要不要说出口，得你自己给它留个位置。',
    condition: '让你不必一直稳着的，是有人在你沉默的时候不追问，也不急着把气氛填满。',
  },
  hamster_praise: {
    verdict: '你是那种总能挑出对方自己都没留意的优点的人。',
    signal: '你说完「你刚才那句特别好」之后，会补上具体是哪一句、好在哪里，而不是只给一个笑。',
    mechanism: '你听人说话时，会自动去找那句他自己一带而过、却露出真本事的话，然后说回给他听。',
    misread:
      '麻烦的是，你的标准全用在看别人，轮到自己被夸，第一反应是把它翻译成客气。把一句夸奖原样收下，你其实做得到。',
    condition: '让你愿意一直把好话说出口的，是对方被夸中时那一下的真反应——你要的不是回礼，是看见那句话真的落到了人身上。',
  },
  fox: {
    verdict: '你是那种走到哪儿，都能顺手带回一个新发现的人。',
    signal: '别人刚提起一个话题，你就能翻出它背后那条冷门线索，还顺手带出一个没听说过的新东西。',
    mechanism: '你脑子里常年挂着一张「还没试过」的清单，遇到任何话题，第一件事是把它和清单对上号。',
    misread:
      '代价落在注意力上：一件事重复到第三遍，你的目光就开始往外飘。走或不走，是你挑的，不是被推着走的。',
    condition: '让你愿意在一个地方待久的，是那里还有没被你摸清的角落；全摸清了，你就开始看门口。',
  },
  dolphin_calm: {
    verdict: '你是那种别人还没觉出不对，你已经把话头挪开的人。',
    signal: '你会在某个人第二次低头看手机时，把话题从刚才那件事上移开，动作轻到像本来就要换。',
    mechanism: '你一边说话一边在扫：谁的话被盖过去了，谁的句子只说了半截，然后挑一个最轻的时机把它捞回来。',
    misread: '代价是，你盯着不让任何一句话掉地上，自己那半句就咽回去了。那半句说不说，开关一直握在你手里。',
    condition: '让你不必时时盯着气氛的，是身边的人会自己把话接住，安静下来也不慌张。',
  },
  spider: {
    verdict: '你是那种比当事人更早看见两个人共同点的人。',
    signal: '聊到一半，你会把一个人刚说过的事，转手递给另一个人——“你上次不是也在弄这个”。',
    mechanism: '你听人说话时顺手存下细节，再自动配对：这个人卡在哪，那个人手上正好有什么。',
    misread:
      '只是把人接上之后，你会退到旁边；你自己那条线，一直没有接出去。站到中间这件事你其实会，只是很少用。',
    condition: '让你愿意继续牵线的，是这两个人后来真的自己聊了起来，而不是一直要靠你在中间传话。',
  },
  koala: {
    verdict: '你是那种能把别人说散的话，重新串成一条线的人。',
    signal: '对方停下来的时候，你会接一句“然后呢”，接的常常是对方刚说漏的那半句。',
    mechanism: '你听的不是字面，是对方绕开的那一段；你衡量的是这句话有没有说完，没说完的你就替对方续上。',
    misread:
      '代价是，你太擅长把别人的话接完整，轮到自己时就只剩梗概。想让人听见细的那部分，得由你先讲。',
    condition: '真正让你松下来的，是有一个人不急着给建议，也不急着把话接到自己身上。',
  },
  octopus: {
    verdict: '你是那种别人说一句话，你能岔出三条路的人。',
    signal: '你接话经常先跳到一件不相干的事上，语速变快，眼睛先亮起来。',
    mechanism: '你的注意力不在结论，而在两件事之间那条还没被接上的连线；你衡量的是它新不新，不是它稳不稳。',
    misread:
      '代价也在同一处：你抛出的线头太多，收束那一步常悬在半空。哪一条留下、哪几条先放掉，是你手里的事。',
    condition: '让你敢把最离谱那条说出口的，是有人先接住它，再跟你一起把它拆开看。',
  },
  owl: {
    verdict: '你是那种听一句话，会先想它成立需要什么条件的人。',
    signal: '你会在轻松的话中间停下来问“为什么”，问完再补一句“那反过来呢”。',
    mechanism: '你的注意力落在前提上：这句话在什么条件下成立、反例在哪；你只认它经不经得起再问一层。',
    misread:
      '代价是，你往下拆的时候，对方要的可能只是把话说完。先分清他要答案还是要人应一声，这一步不难，只是要想到。',
    condition: '让你不必先掂量“这话会不会太重”的，是对方愿意跟你一起停在原地想，而不是急着换个轻松话题。',
  },
  elephant: {
    verdict: '你是那种事情还没乱，就已经想好第二步的人。',
    signal: '出岔子的时候你说话反而更慢，先问的不是“怎么搞的”，而是“现在缺什么”。',
    mechanism: '你的注意力落在下一步会不会掉链子上，只信这件事靠不靠得住；不确定的部分，你先自己消化。',
    misread:
      '代价是，你把不确定咽下去，别人就当你不必帮忙。说一句“这次我需要搭把手”，你并非说不出口。',
    condition: '让你不必一直当那个兜底的人的，是有人在你开口之前，就把你那份也算进去。',
  },
  turtle: {
    verdict: '你是那种等到最后才开口，一句话就把事情说清的人。',
    signal: '前面你几乎不出声，等到某个点才说一句，把散着的话一次收拢。',
    mechanism: '你要先看够才肯下判断，掂量的是这句话此刻说出去，会不会把还没成形的东西压扁。',
    misread:
      '代价落在开口的门槛上：你把标准设在“说得准”，那些“其实也行”的话就都留在你这边。门槛设多高，牌在你手里。',
    condition: '让你愿意开口的，是有人不催，也不在你沉默的时候替你下结论。',
  },
  cat: {
    verdict: '你是那种待在一群人里，却不占任何人注意力的人。',
    signal: '你会自然坐在稍微靠外的位置，不插话，只在某一句上轻轻点头或笑一下。',
    mechanism: '你的注意力落在这一屋子的消耗上：谁的声音会把你拽进去，哪句话一旦接上就要陪很久。你把自己调到最省电的那一档，是算过账的。',
    misread:
      '代价是，你把“不打扰”做得太干净，干净到你看起来什么都不缺。让一个人看见你也想要什么，不必先把自己弄得很吵。',
    condition: '你待得住的地方，通常不是安静一点，而是有人不把那份安静当成不高兴。',
  },
};

function getArchetypeReading(archetypeId?: string | null): ArchetypeReading | null {
  if (!archetypeId) return null;
  return ARCHETYPE_READINGS[archetypeId] ?? null;
}

/**
 * The name's origin — why this archetype carries that animal.
 *
 * The reading explains a person; this line explains the *label*. Without it the
 * animal name is a metaphor the reader has to decode alone, and a name left
 * undecoded starts to read as the cause ("我是人脉蛛型所以…"). Each entry names
 * one observable habit the animal is known for, then hands that habit back to
 * the person — the animal is a handle, not an explanation.
 *
 * Kept separate from ARCHETYPE_READINGS because a blend has no single name.
 */
const ARCHETYPE_NOTES: Record<string, string> = {
  corgi: '柯基是那种走两步就要跟所有人打一遍招呼的狗。你身上最像它的地方不是热闹，是你根本不怕先开口。',
  rooster: '鸡群里最早醒的那只，天亮不靠闹钟。你像它的地方是，没人提醒，你也会先把气氛托住。',
  hamster_praise:
    '仓鼠总往颊囊里塞东西，一路都舍不得吃。你对别人优点的记性也是这样，先攒着，再一颗一颗给回去。',
  fox: '狐狸走路不看路，看两边。你像它的地方是，同一条街上你能看见别人没留意的那扇门。',
  dolphin_calm: '海豚在水里靠回声摸清前面有什么。你靠的是别人说话时那一下停顿。',
  spider:
    '蜘蛛结网不靠力气，靠位置——它知道哪根线连着哪根线。你身上这一点最明显：两个人还没发现彼此有关，你已经看见了。',
  koala: '树洞本来是别人往里说秘密的地方。你的耳朵就是那个洞，等别人说完，才发现自己说了很多。',
  octopus: '章鱼有八条腕，每条都在自己找东西。你说的每句话底下，通常还压着三条没出口的路。',
  owl: '猫头鹰夜里看得清，靠的不是眼睛亮，是脖子能转。你像它的地方是，你愿意把头转过去看别人没看的那一面。',
  elephant: '象群走路会等走得慢的那只，没有谁下令。你身上最像它的地方是，你会自动放慢，而且不觉得这是牺牲。',
  turtle: '龟壳不是用来躲的，是它移动的方式——把要紧的部分收好，再慢慢往前。你只在确定安全时才把头伸出来。',
  cat: '猫进屋会先找一个能看见所有人、又没人会注意到的位置。这个位置你很熟。',
};

function getArchetypeNote(archetypeId?: string | null): string {
  if (!archetypeId) return '';
  return ARCHETYPE_NOTES[archetypeId] ?? '';
}

function getConfidenceBand(confidence = 1): {
  band: ConfidenceBand;
  instruction: string;
} {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return {
      band: 'high',
      instruction: '语气可以笃定，直接说“你就是/你通常会”，但仍然保持不评判。',
    };
  }

  if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return {
      band: 'medium',
      instruction: '语气保持有把握，但用“你更像是/你多半会/常见表现是”这类表达，避免绝对化。',
    };
  }

  return {
    band: 'low',
    instruction: '强调这是一种交界气质，用“你身上有两种节奏交界”“这次更偏向”这样的说法，避免下定论。',
  };
}

export function deriveSocialSnapshot(input: ArchetypeAnalysisInput): DerivedSocialSnapshot {
  const scores = Object.fromEntries(
    Object.entries(input.traitScores).map(([key, value]) => [key, normalizeTraitScore(value)])
  ) as Record<keyof ArchetypeAnalysisInput['traitScores'], number>;

  const confidence = getConfidenceBand(input.confidence);

  const derivedStateLabel = (() => {
    // Order matters: the most specific signal wins. Idea-led people are also
    // loud, and quiet people are also steady, so those two bands have to be
    // read before "steady" and "fires up the room".
    if (scores.openness >= IDEA_OPENNESS_THRESHOLD && scores.extraversion >= IDEA_EXTRAVERSION_THRESHOLD) return '灵感破冰型';
    if (scores.extraversion <= LOW_ENERGY_EXTRAVERSION) return '低耗观察型';
    if (
      scores.extraversion <= RESERVED_EXTRAVERSION_CEILING &&
      (scores.affinity >= DEEP_AFFINITY_THRESHOLD || scores.openness >= DEEP_OPENNESS_THRESHOLD)
    ) {
      return '慢热深聊型';
    }
    if (scores.affinity >= WARM_AFFINITY_THRESHOLD && scores.extraversion <= WARM_EXTRAVERSION_CEILING) return '熟了更有火花型';
    if (scores.emotionalStability >= STEADY_STABILITY_THRESHOLD && scores.conscientiousness >= STEADY_CONSCIENTIOUSNESS_THRESHOLD) {
      return '稳场推进型';
    }
    if (scores.extraversion >= HEAT_EXTRAVERSION_THRESHOLD && scores.positivity >= HEAT_POSITIVITY_THRESHOLD) return '快热带动型';
    return '局内升温型';
  })();

  /**
   * Seven behavioural states, each written as a four-layer reading:
   *
   *   sceneLens  — L1 what others perceive first (signal)
   *   mechanism  — L2 why this person runs this way (attention / safety / criteria)
   *   misread    — L3 the cost of the mechanism, or how others misread it
   *   condition  — L4 the relationship condition that makes it work
   *
   * The reading deliberately never says "next time at the event, do X": this
   * surface answers *who this person is*, not *what they should do*. Landing on
   * a tactic is what made the old copy read like an event tip sheet.
   */
  interface StateCopy {
    sceneLens: string;
    mechanism: string;
    misread: string;
    condition: string;
    socialRole: string;
    bestScene: string;
    headlineHint: string;
    shareLineHint: string;
  }

  const snapshotByState: Record<string, StateCopy> = {
    '快热带动型': {
      sceneLens: '你一进来，房间里的人先感觉到的是“有人在了”。不是声音大，是别人不用猜你的态度。',
      mechanism: '冷场对你不构成威胁。话题断了，你会先补一句，哪怕补得不完美。',
      misread:
        '代价是，你把“没事”说得太顺。别人不是不关心，是你说得太像真的。久了，连你自己都分不清是真没事，还是不想让人为难。',
      condition: '让你舒服的，是有来有回的热，不是只有你一个人在托着场。',
      socialRole: '你更像开场加速器，能让一桌人更快进入同频状态。',
      bestScene: '人多一点、节奏松快、不用一上来就深聊的场合',
      headlineHint: '你不是硬撑热闹，你是自然带热的人',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，属于一进场就会慢慢把气氛带起来的那种。`,
    },
    '稳场推进型': {
      sceneLens: '你在的时候，房间不会突然散掉。别人说不上来为什么，只是待着更安心。',
      mechanism: '你习惯把“接下来做什么”先想一步。别人还在挑话题，你已经在给这件事找个落点。',
      misread: '代价是，你可能一直在做那个不出声的承重墙。久了，别人会把这份稳当成默认配置。',
      condition: '你需要的是有人也替你兜一次底，而不是永远由你来收尾。',
      socialRole: '你更像节奏稳定器，能把散掉的谈话拉回舒服的推进感。',
      bestScene: '有一点主题、能边聊边往下推进的小规模场合',
      headlineHint: '你不抢戏，场子却会跟着你稳下来',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，更像那种不吵但能把场子稳住的人。`,
    },
    '熟了更有火花型': {
      sceneLens: '第一眼的你，通常比真实的你安静半格。',
      mechanism: '你不是慢，是在等人和话对上。对上了，你的回应会比对方预期多给一层。',
      misread: '代价是，前十分钟的你可能被记成“话不多”。很多人没等到你打开就走了。',
      condition: '你需要的不是更多人，是同一个人的第二次见面。',
      socialRole: '你更像关系升温器，能把表面的寒暄带到真正舒服的交流。',
      bestScene: '能留出预热时间的小范围场合，两三个人也能聊开',
      headlineHint: '你不是秒热型，你是越聊越有戏',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，熟起来之后会比第一眼看上去更有火花。`,
    },
    '灵感破冰型': {
      sceneLens: '你说的话，常常不是最响的那句，是最让人想接的那句。',
      mechanism: '你听的时候在找缝——找一个能把话题拐去别处的缝。',
      misread: '代价是，跟你聊过的人记得那个角度，不一定记得你。你的存在感藏在内容里。',
      condition: '你需要的是有人接得住你的拐弯，而不是把话题拉回原处。',
      socialRole: '你更像话题点火器，能把原本平的聊天带出灵感和新鲜感。',
      bestScene: '能交换想法、允许话题拐弯的场合',
      headlineHint: '你不靠硬聊，你靠灵感把话头点着',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，属于会把普通聊天聊出新鲜感的那种。`,
    },
    '慢热深聊型': {
      sceneLens: '你在人群里的前半小时，看起来像在等什么。',
      mechanism: '你在等的不是话题，是一个人值不值得你把话递过去。你的判断比你的表达快。',
      misread:
        '代价是，你错过的人比你以为的多。有些值得的人只出现一次，而那一次你没开口。',
      condition: '让你松下来的，往往不是人多人少，而是有没有一个人，能让你把一句话说完。',
      socialRole: '你更像深聊引线，一旦找到对频的人，聊天会比表面热闹更有记忆点。',
      bestScene: '人不多、有共同话题可以落脚的小范围场合',
      headlineHint: '你不是慢，你只是只对对的人升温',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，看着慢热，其实聊到点上就很能聊。`,
    },
    '低耗观察型': {
      sceneLens: '你进一个房间，会先花一点时间看，而不是先说。',
      mechanism: '你在收集信息：谁和谁熟，谁在硬撑，哪句话是真的。这些没人教你，你自动在做。',
      misread:
        '代价是，你的判断需要时间，而很多场合不给这个时间。你很少输在看不准，你输在开口比看准晚了一步。',
      condition: '你需要的是允许你慢半拍进入的关系，不是一上来就要表态。',
      socialRole: '你更像安静观察者，话不一定最多，但经常能在关键时刻说到点上。',
      bestScene: '节奏不吵、允许各自留白的场合',
      headlineHint: '你不是掉线型，你是先观察再发力',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，习惯先看气场，再决定什么时候出手。`,
    },
    '局内升温型': {
      sceneLens: '别人对你的第一印象，常常比你以为的更淡一点。',
      mechanism: '不是没话说。你在用前几分钟判断这场相处值不值得投入，等你决定投入，节奏就变了。',
      misread: '代价是，别人往往在你已经开始热的时候，才想起要重新看你一眼。',
      condition: '能留住你的关系，几乎都有一个共同点：跨过了第一次。',
      socialRole: '你更像慢发酵型的存在，关系在不知不觉里自然松开。',
      bestScene: '有互动空间、能让人逐步进入状态的场合',
      headlineHint: '你不是没热度，你是热得比别人慢半拍',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，属于相处越往后越容易让人觉得舒服的那种。`,
    },
  };

  /**
   * L0 — the verdict, one line per state.
   *
   * The reading has to *land* before it explains: readers want the label first
   * ("你是那种…的人") and the reasoning after. Without this opening the four
   * layers started mid-thought and the whole panel read as description rather
   * than as a reading of them. Deliberately plain language — no type codes, no
   * 性格标签, nothing that sounds like a clinical instrument.
   */
  const verdictByState: Record<string, string> = {
    // 每条都必须过三关：能被相反类型的人否认、能被上周的具体场景支持、
    // 不与共用同一状态的其它原型自述打架。「第一眼被低估」「看得比谁都清楚」
    // 这类句子三关全过不了——它们是人人都能认领的夸奖，不是判定。
    '快热带动型': '你是那种一出现，房间的温度就先升半度的人。',
    '稳场推进型': '你是那种不抢着出声，却让一桌人心里有底的人。',
    '熟了更有火花型': '你是那种要处过几次，好处才一点点显出来的人。',
    '灵感破冰型': '你是那种一开口就把话题拐个弯，弯过去更好玩的人。',
    '慢热深聊型': '你是那种听很久不出声，一开口就绕过客套的人。',
    '低耗观察型': '你是那种先看清楚，才决定要不要出声的人。',
    '局内升温型': '你是那种一上来不抢镜，越往后越显出分量的人。',
  };

  /**
   * Two identity systems meet on this screen: the 12 archetypes (poster, hero
   * title) and these seven behavioural states (the reading). Threshold-only
   * derivation disagreed with the registry's own declaration for 8 of the 12
   * archetypes, so the card printed one name while the reading described
   * another person. Resolution order:
   *
   *   1. A single archetype at medium+ confidence → the registry's declared
   *      stateLabel wins; it was authored with that animal in mind.
   *   2. Blended or low confidence → the threshold derivation wins, because
   *      the registry has no declaration for a mix or a coin-flip.
   */
  const declaredStateLabel = getDeclaredStateLabel(input.archetype);
  const stateLabel =
    declaredStateLabel && snapshotByState[declaredStateLabel] && !isBlendMatch(input) && confidence.band !== 'low'
      ? declaredStateLabel
      : derivedStateLabel;

  const copy = snapshotByState[stateLabel];
  const archetypeReading = isBlendMatch(input) ? null : getArchetypeReading(input.archetype);

  return {
    stateLabel,
    confidenceBand: confidence.band,
    confidenceInstruction: confidence.instruction,
    verdictLine: archetypeReading?.verdict ?? verdictByState[stateLabel] ?? '',
    // Only a single, named archetype gets the name's origin. A blend has no one
    // animal to explain, and inventing one would be the fastest way to be wrong.
    archetypeNoteLine: archetypeReading ? getArchetypeNote(input.archetype) : '',
    sceneLens: archetypeReading?.signal ?? copy.sceneLens,
    mechanismLine: archetypeReading?.mechanism ?? copy.mechanism,
    misreadLine: archetypeReading?.misread ?? copy.misread,
    conditionLine: archetypeReading?.condition ?? copy.condition,
    // Legacy alias: the API still carries `microAction`, and callers render it
    // as one closing line. It now holds the condition sentence — same slot,
    // no instruction.
    microAction: archetypeReading?.condition ?? copy.condition,
    socialRole: copy.socialRole,
    bestScene: copy.bestScene,
    headlineHint: copy.headlineHint,
    shareLineHint: copy.shareLineHint,
  };
}

function getRankedTraits(input: ArchetypeAnalysisInput): Array<{ name: string; score: number }> {
  return Object.entries(input.traitScores)
    .map(([key, value]) => ({
      name: traitLabels[key as keyof typeof traitLabels],
      score: normalizeTraitScore(value),
    }))
    .sort((a, b) => b.score - a.score);
}

function getTopArchetypeCandidates(input: ArchetypeAnalysisInput): Array<{
  archetype: string;
  score: number;
  confidence?: number;
}> {
  if (!Array.isArray(input.topArchetypes)) {
    return input.secondaryArchetype
      ? [
          { archetype: input.archetype, score: 100, confidence: input.confidence },
          { archetype: input.secondaryArchetype, score: 92 },
        ]
      : [{ archetype: input.archetype, score: 100, confidence: input.confidence }];
  }

  const normalized = input.topArchetypes
    .filter((item): item is { archetype: string; score: number; confidence?: number } =>
      !!item &&
      typeof item.archetype === 'string' &&
      item.archetype.length > 0 &&
      typeof item.score === 'number' &&
      Number.isFinite(item.score)
    )
    .sort((a, b) => b.score - a.score);

  if (normalized.length === 0) {
    return input.secondaryArchetype
      ? [
          { archetype: input.archetype, score: 100, confidence: input.confidence },
          { archetype: input.secondaryArchetype, score: 92 },
        ]
      : [{ archetype: input.archetype, score: 100, confidence: input.confidence }];
  }

  if (!normalized.some((item) => item.archetype === input.archetype)) {
    normalized.unshift({ archetype: input.archetype, score: normalized[0].score + 1, confidence: input.confidence });
  }

  return normalized;
}

function getBlendSecondaryArchetype(input: ArchetypeAnalysisInput): string | null {
  if (input.secondaryArchetype) return input.secondaryArchetype;
  return getTopArchetypeCandidates(input).find((item) => item.archetype !== input.archetype)?.archetype ?? null;
}

function getTopArchetypeGap(input: ArchetypeAnalysisInput): number | null {
  const candidates = getTopArchetypeCandidates(input);
  if (candidates.length < 2) return null;
  return Math.round((candidates[0].score - candidates[1].score) * 10) / 10;
}

function isBlendMatch(input: ArchetypeAnalysisInput): boolean {
  const scoreGap = getTopArchetypeGap(input);
  if (scoreGap !== null) {
    return scoreGap <= 8;
  }

  return !!getBlendSecondaryArchetype(input) && (input.confidence ?? 1) < HIGH_CONFIDENCE_THRESHOLD;
}

function trimSentence(text: string): string {
  return text.replace(/[。！!？?]+$/g, '').trim();
}

function formatSentence(text: string): string {
  const next = trimSentence(text);
  return next ? `${next}。` : '';
}

function deriveSceneTag(bestScene: string): string {
  // These tags render next to the archetype on the results screen, so they
  // carry the same review rules as body copy — no 「局」.
  if (/人不多|小范围|一两个人|两三个人/.test(bestScene)) return '适合小范围深聊';
  if (/人多一点|热场|热闹/.test(bestScene)) return '适合多人热场';
  if (/主题|交换想法|推进/.test(bestScene)) return '有主题更出彩';
  if (/留白|不吵|慢半拍/.test(bestScene)) return '低耗相处更舒服';
  return '越相处越有戏';
}

function buildExpressionTags(input: ArchetypeAnalysisInput, snapshot: DerivedSocialSnapshot): string[] {
  const tagsByState: Record<string, string[]> = {
    '快热带动型': ['一上桌就熟得快', '热场但不压人'],
    '稳场推进型': ['不抢戏但稳全场', '靠谱感很强'],
    '熟了更有火花型': ['第一眼温和型', '熟了会越来越有戏'],
    '灵感破冰型': ['聊天自带新鲜感', '靠点子打开话题'],
    '慢热深聊型': ['慢热但不冷场', '聊到点上停不下'],
    '低耗观察型': ['先观察再发力', '低耗但会看人'],
    '局内升温型': ['越相处越有戏', '关系会慢慢热起来'],
  };

  const tags = [...(tagsByState[snapshot.stateLabel] ?? ['相处有自己的节奏', '相处久了更舒服'])];
  tags.push(deriveSceneTag(snapshot.bestScene));
  tags.push(isBlendMatch(input) && getBlendSecondaryArchetype(input) ? '有点双原型感' : `${archetypeToCn(input.archetype)}气质`);

  return Array.from(new Set(tags)).slice(0, 4);
}

function buildBlendLine(input: ArchetypeAnalysisInput): string {
  const secondaryArchetype = getBlendSecondaryArchetype(input);
  const primary = archetypeToCn(input.archetype);
  if (!secondaryArchetype || secondaryArchetype === input.archetype) {
    return formatSentence(`${primary}这层底色很清楚，几乎没有别的原型混进来`);
  }

  const secondary = archetypeToCn(secondaryArchetype);
  if (isBlendMatch(input)) {
    return formatSentence(`你底色更像${primary}，熟起来或遇到对频的话题时，会露出一点${secondary}那一面`);
  }

  return formatSentence(`你身上也有一点${secondary}的影子，只是这次更稳定地落在${primary}这边`);
}

function buildWhyThisFits(input: ArchetypeAnalysisInput): string {
  const rankedTraits = getRankedTraits(input);
  const topTraits = rankedTraits.slice(0, 2).map((trait) => trait.name);
  const secondaryArchetype = getBlendSecondaryArchetype(input);
  const primary = archetypeToCn(input.archetype);
  const traitSummary = topTraits.length >= 2 ? `${topTraits[0]}和${topTraits[1]}` : topTraits[0] || '相处节奏';

  const suffix =
    secondaryArchetype && secondaryArchetype !== input.archetype
      ? isBlendMatch(input)
        ? `你身上也带一点${archetypeToCn(secondaryArchetype)}的感觉，所以不是单一一种路数。`
        : `虽然也有一点${archetypeToCn(secondaryArchetype)}的影子，但没有盖过主底色。`
      : '';

  return `${formatSentence(`你身上最明显的是${traitSummary}。${primary}只是给这套东西起的一个名字，它解释不了全部的你`)}${suffix}`.trim();
}

function buildShareVariants(input: ArchetypeAnalysisInput, snapshot: DerivedSocialSnapshot): XiaoyueShareVariants {
  const secondaryArchetype = getBlendSecondaryArchetype(input);
  const bestScene = trimSentence(snapshot.bestScene).replace(/^更适合/, '');

  const primary = archetypeToCn(input.archetype);
  return {
    selfIntro: snapshot.shareLineHint,
    friendCallout:
      secondaryArchetype && secondaryArchetype !== input.archetype && isBlendMatch(input)
        ? formatSentence(`认识我的人应该会懂，我平时更像${primary}，熟起来会露出一点${archetypeToCn(secondaryArchetype)}那面`)
        : formatSentence(`认识我的人应该会懂，${trimSentence(snapshot.headlineHint)}`),
    socialInvite: formatSentence(`如果一起出去，我更适合${bestScene}，会比较容易进入状态`),
  };
}

function getCacheKey(input: ArchetypeAnalysisInput): string {
  const confidenceBand = getConfidenceBand(input.confidence).band;
  const topArchetypesKey = getTopArchetypeCandidates(input)
    .slice(0, 2)
    .map((item) => `${item.archetype}:${Math.round(item.score)}`)
    .join('|');
  // Bucket normalized trait scores to the nearest 10 so a mid-test prefetch
  // (replayed from a session with fewer answers) hits the same cache entry as
  // the final completion-time call when the profile has only drifted slightly.
  const traitBucketKey = Object.values(input.traitScores)
    .map((value) => Math.round(normalizeTraitScore(value) / 10) * 10)
    .join('_');
  return `${input.archetype}_${input.secondaryArchetype ?? 'none'}_${confidenceBand}_${topArchetypesKey}_${traitBucketKey}_v${XIAOYUE_PERSONA_PROMPT_VERSION}_${XIAOYUE_CRAFT_PROMPT_VERSION}`;
}

function buildAnalysisPrompt(input: ArchetypeAnalysisInput): string {
  const { archetype, traitScores } = input;
  const archetypeCn = archetypeToCn(archetype);
  const snapshot = deriveSocialSnapshot(input);
  const rankedCandidates = getTopArchetypeCandidates(input).slice(0, 2);
  const secondaryArchetype = getBlendSecondaryArchetype(input);
  const topGap = getTopArchetypeGap(input);

  const traitSummary = Object.entries(traitScores)
    .map(([key, value]) => `- ${traitLabels[key as keyof typeof traitLabels]}: ${normalizeTraitScore(value)}/100`)
    .join('\n');

  const rankedTraits = getRankedTraits(input);

  const topTraits = rankedTraits.slice(0, 2).map((trait) => trait.name);
  const lowTraits = [...rankedTraits].reverse().slice(0, 2).map((trait) => trait.name);

  return `你在为悦聚 personality result 生成"悦仔分析"文案。已有 Pokémon 风格海报承载"原型视觉感"，这次输出必须走"文字版解读"，不能重复海报上的原型卡、编号、限定、收藏感文案。

读者刚做完测试。他想知道的不是"下次该怎么表现得更好"，而是"我到底是怎么运转的、为什么我会这样"。所以这段文字只做一件事：把一个人身上那套自动发生的机制说清楚。它解释人，不指导人。

用户原型：${archetypeCn}
用户六维特质：
${traitSummary}

高特质：${topTraits.join('、')}
相对收着的特质：${lowTraits.join('、')}
推断的当下状态：${snapshot.stateLabel}

六拍参考（这是这段文字要承载的事实，用你的话把它们缝起来，不必逐句照抄；顺序不能变）：
① 定调，第一句就要把结论给出来：${snapshot.verdictLine}
② 为什么叫这个名字（先说来历，再说它指向哪一类行为；名字是个把手，不是原因，不要写成「因为是 X 型所以你…」）：${snapshot.archetypeNoteLine || '（这次是混合原型，没有单独的名字，跳过这一拍）'}
③ 别人先感知到你什么：${snapshot.sceneLens}
④ 你为什么会长成这样：${snapshot.mechanismLine}
⑤ 代价，或别人容易误读你的地方：${snapshot.misreadLine}
⑥ 什么样的关系条件让它成立：${snapshot.conditionLine}
角色参考：${snapshot.socialRole}
场景参考：${snapshot.bestScene}
分享短句参考：${snapshot.shareLineHint}
次高原型：${secondaryArchetype ? archetypeToCn(secondaryArchetype) : '无明显次高原型'}
前二原型：${rankedCandidates.map((item) => `${archetypeToCn(item.archetype)}(${Math.round(item.score)})`).join(' / ')}
是否属于边界混合：${isBlendMatch(input) ? '是' : '否'}
前二差值：${topGap ?? '未知'}

置信度层级：${snapshot.confidenceBand}
语气要求：${snapshot.confidenceInstruction}

请严格输出 JSON，不要 markdown，不要代码块，不要额外解释，字段如下：
{
  "headline": "一句可晒的身份签名，12-24字，适合结果页顶部文字，不要直接重复原型名",
  "analysis": "共6段，每段1句，段与段之间用换行分隔，不要写成一整段。第1段是定调：先给结论，用“你是那种……的人”这类判断句把这个人最核心的运行方式一句话说清，这一句要能让人立刻认领自己；第2段 为什么叫这个名字，先说名字的来历再落到行为，不要写得像词条解释，也不要把它写成原因；第3段 别人先感知到你什么；第4段 你为什么会这样（注意力放在哪、靠什么判断、什么让你觉得安全）；第5段 这套机制的代价，或别人容易误读你的地方；第6段 什么样的关系条件让它成立。不写下次该怎么做，不写场合攻略。不要出现分数、测试、模型、AI。",
  "socialRole": "一句话说明你在关系里的角色或价值，不要写成岗位描述",
  "bestScene": "一句话说明什么样的相处场合更适合你，保持“我更适合…”能直接接上的短语形态",
  "microAction": "一句话说明什么样的关系条件让你这套节奏运转得最好；不要写动作建议",
  "shareLine": "一句适合复制到评论区/聊天框的分享短句，别和 headline 重复",
  "whyThisFits": "1-2句，解释为什么这次更偏这个原型，用真实相处里看得见的信号，不要提模型或分数",
  "blendLine": "1句，解释主原型和次原型之间的张力或边界感；如果没有明显次高原型，也要写成一句稳定说明",
  "expressionTags": ["3到4个适合小红书/朋友圈传播的短标签，每个2到8字，不要带#"],
  "shareVariants": {
    "selfIntro": "适合直接发评论区/聊天框的自我介绍型文案",
    "friendCallout": "适合发给朋友或朋友圈配文的互动型文案",
    "socialInvite": "适合带一点轻邀约感的社交转化型文案"
  }
}

硬性要求：
1. 全部使用第二人称“你”或第一人称分享句，不要写“该用户”
2. 保持悦仔的机智、利落、不油腻，不要鸡汤，不要感叹号，不要过度热情
3. 写具体经历和画面：别人看到什么、你心里在做什么判断。少用抽象人格词（“共情力强”“边界感清晰”这类结论不要当句子用）
4. headline 和 shareLine 必须与海报视觉形成互补：更像一句活人会发出去的话，不要写成海报标题
5. analysis 第 1 段必须是定调判断句，先给结论再展开；不要用“你可能”“也许”这类不确定开头
6. analysis 结尾落在关系条件上（什么样的关系、什么样的相处才让它成立），不要落到下一步动作，不要给建议
7. expressionTags 要像人会拿去发内容平台的标签，不要写“人格分析”“MBTI感”这种空词
8. shareVariants 三句不能互相重复，要明显对应“自我介绍 / 朋友互动 / 轻邀约”三种传播场景
9. 不出现这些词：社交、局、进局、活动、破冰、下次、第一轮、开场。也不要“但是/不过/然而”接否定，需要转折时用“只是”`;
}

function extractJsonPayload(content: string): string {
  const candidates = [
    content.trim(),
    content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim(),
  ].filter((candidate): candidate is string => !!candidate);

  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  const firstBrace = content.indexOf('{');
  if (firstBrace !== -1) {
    for (let end = content.lastIndexOf('}'); end > firstBrace; end = content.lastIndexOf('}', end - 1)) {
      const candidate = content.slice(firstBrace, end + 1).trim();
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // Keep shrinking until a valid JSON object is found.
      }
    }
  }

  return content.trim();
}

function buildFallbackAnalysisPayload(input: ArchetypeAnalysisInput): Omit<XiaoyueAnalysisResult, 'cached'> {
  const snapshot = deriveSocialSnapshot(input);
  // Confidence shows up as a short calibration prefix instead of a separate
  // "你身上这股 X 的感觉" opening line — the reading itself is five beats about
  // the person, not a label plus commentary.
  const confidencePrefix =
    snapshot.confidenceBand === 'medium'
      ? '多数时候，'
      : snapshot.confidenceBand === 'low'
        ? '这次更偏这一边——'
        : '';

  return {
    headline: snapshot.headlineHint,
    analysis: `${confidencePrefix}${[
      snapshot.verdictLine,
      snapshot.archetypeNoteLine,
      snapshot.sceneLens,
      snapshot.mechanismLine,
      snapshot.misreadLine,
      snapshot.conditionLine,
    ]
      // A blend has no archetype note; drop the empty line instead of leaving a
      // blank paragraph the client would render as a gap.
      .filter(Boolean)
      .join('\n')}`,
    socialRole: snapshot.socialRole,
    bestScene: snapshot.bestScene,
    microAction: snapshot.microAction,
    shareLine: snapshot.shareLineHint,
    stateLabel: snapshot.stateLabel,
    whyThisFits: buildWhyThisFits(input),
    blendLine: buildBlendLine(input),
    expressionTags: buildExpressionTags(input, snapshot),
    shareVariants: buildShareVariants(input, snapshot),
    meta: buildFallbackAIMeta('template_fallback', XIAOYUE_CRAFT_PROMPT_VERSION),
  };
}

export function parseAnalysisResponse(
  content: string,
  input: ArchetypeAnalysisInput
): Omit<XiaoyueAnalysisResult, 'cached'> {
  const fallback = buildFallbackAnalysisPayload(input);

  try {
    const parsed = JSON.parse(extractJsonPayload(content));
    const result = analysisResponseSchema.safeParse(parsed);

    if (!result.success) {
      return fallback;
    }

    return {
      ...result.data,
      stateLabel: deriveSocialSnapshot(input).stateLabel,
      meta: buildLiveAIMeta('deepseek', XIAOYUE_CRAFT_PROMPT_VERSION),
    };
  } catch {
    return fallback;
  }
}

export async function generateXiaoyueAnalysis(
  input: ArchetypeAnalysisInput
): Promise<XiaoyueAnalysisResult> {
  const cacheKey = getCacheKey(input);
  const cached = analysisCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.info('[XiaoyueAnalysis] Cache hit', { archetype: input.archetype });
    const hit = { ...cached.result, cached: true };
    if (!hit.meta) {
      // A cache hit with no meta can only come from a record written before the
      // field existed. The text is still model output, so the trace must read
      // "cached", not "fallback": buildFallbackAIMeta() sets fallbackUsed, and
      // buildAIGCMeta() then forces aiGenerated:false — which hid the AIGC
      // label on text the model actually wrote (2026-11-19).
      hit.meta = {
        ...buildCachedAIMeta(
          new Date(cached.timestamp).toISOString(),
          null,
          XIAOYUE_CRAFT_PROMPT_VERSION,
        ),
        aigc: { aiGenerated: true, labelType: 'ai-generated' },
      };
    }
    return hit;
  }

  const inFlight = inFlightAnalysis.get(cacheKey);
  if (inFlight) {
    logger.info('[XiaoyueAnalysis] Reusing in-flight generation', { archetype: input.archetype });
    return inFlight;
  }

  const running = runAnalysisGeneration(input, cacheKey);
  inFlightAnalysis.set(cacheKey, running);
  try {
    return await running;
  } finally {
    inFlightAnalysis.delete(cacheKey);
  }
}

async function runAnalysisGeneration(
  input: ArchetypeAnalysisInput,
  cacheKey: string
): Promise<XiaoyueAnalysisResult> {
  const systemBase = `${XIAOYUE_PERSONA}\n\n${GENDER_NEUTRAL}`;
  const fallback = buildFallbackAnalysisPayload(input);

  try {
    const craftResult = await generateWithCraftQuality({
      buildPrompt: () => ({
        system: systemBase,
        user: buildAnalysisPrompt(input),
      }),
      callLLM: async (systemPrompt, userPrompt) => {
        const response = await getDeepseekClient().chat.completions.create({
          model: getDeepseekModel('flash'),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          // deepseek-flash reasons by default; an unchecked chain burns
          // 1100+ tokens and stretches generation past 20s. 'low' collapses
          // reasoning to ~30 tokens — measured 2.4s total, full content.
          reasoning_effort: 'low',
          max_tokens: 2500,
          response_format: { type: 'json_object' },
        });
        return response.choices[0]?.message?.content?.trim() || '';
      },
      parseResult: (rawText: string) => {
        if (!rawText) return null;
        return parseAnalysisResponse(rawText, input);
      },
      context: 'analysis',
      extractText: (r: Omit<XiaoyueAnalysisResult, 'cached'>) => r.analysis,
      // Cap retries at 1: each LLM round-trip is ~3-7s, and two extra retries
      // can push a cold generation past the client's 15s request timeout
      // (measured 20s on a retried run). The template fallback is the floor.
      maxRetries: 1,
      fallback,
    });

    let result = craftResult.result;

    // Parsed AI responses do not yet carry observability metadata; attach it now.
    if (!result.meta) {
      result.meta = buildLiveAIMeta('deepseek', XIAOYUE_CRAFT_PROMPT_VERSION);
    }

    // Post-generation content safety check before returning to users.
    const moderation = moderateGeneratedContent(
      [
        { field: 'headline', text: result.headline },
        { field: 'analysis', text: result.analysis },
        { field: 'socialRole', text: result.socialRole },
        { field: 'bestScene', text: result.bestScene },
        { field: 'microAction', text: result.microAction },
        { field: 'shareLine', text: result.shareLine },
        { field: 'whyThisFits', text: result.whyThisFits },
        { field: 'blendLine', text: result.blendLine },
        ...result.expressionTags.map((t, i) => ({ field: `expressionTag_${i}`, text: t })),
        { field: 'shareVariant_selfIntro', text: result.shareVariants.selfIntro },
        { field: 'shareVariant_friendCallout', text: result.shareVariants.friendCallout },
        { field: 'shareVariant_socialInvite', text: result.shareVariants.socialInvite },
      ],
      {
        domain: 'xiaoyue_analysis',
        feature: 'generateXiaoyueAnalysis',
        provider: 'deepseek',
        model: getDeepseekModel('flash'),
        latencyMs: 0,
        promptVersion: XIAOYUE_CRAFT_PROMPT_VERSION,
        enforceReviewVocab: true,
      }
    );

    if (!moderation.safe) {
      logger.warn('[XiaoyueAnalysis] Content safety moderation failed, using fallback', {
        archetype: input.archetype,
        field: moderation.field,
      });
      result = fallback;
    }

    result.meta.aigc = buildAIGCMeta({
      fallbackUsed: result.meta.fallbackUsed,
      labelType: 'ai-generated',
    });

    if (craftResult.passed) {
      analysisCache.set(cacheKey, { result, timestamp: Date.now() });
      logger.info('[XiaoyueAnalysis] Generated + craft passed', {
        archetype: input.archetype,
        craftScore: craftResult.craftScore,
        retries: craftResult.retries,
      });
    } else if (craftResult.exhausted) {
      logger.warn('[XiaoyueAnalysis] Craft max retries exhausted, using best effort', {
        archetype: input.archetype,
        craftScore: craftResult.craftScore,
        issues: craftResult.unresolvedIssues,
      });
      analysisCache.set(cacheKey, { result, timestamp: Date.now() });
    }

    return { ...result, cached: false };
  } catch (error) {
    if (error instanceof Error && error.message.includes('DEEPSEEK_API_KEY')) {
      logger.warn('[XiaoyueAnalysis] DeepSeek disabled, using fallback copy because API key is missing');
    }
    logger.error('[XiaoyueAnalysis] API error', { error: error instanceof Error ? error.message : String(error) });
    fallback.meta.aigc = buildAIGCMeta({ fallbackUsed: true });
    return { ...fallback, cached: false };
  }
}

export function peekCachedAnalysis(
  input: ArchetypeAnalysisInput
): Omit<XiaoyueAnalysisResult, 'cached'> | null {
  const cacheKey = getCacheKey(input);
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  return null;
}

export async function prefetchAnalysisIfReady(
  input: Omit<ArchetypeAnalysisInput, 'confidence'>,
  confidence: number
): Promise<void> {
  if (confidence < 0.7) {
    logger.info('[XiaoyueAnalysis] Skipping prefetch, confidence too low', { confidence });
    return;
  }

  const cacheKey = getCacheKey({ ...input, confidence });
  if (analysisCache.has(cacheKey)) {
    logger.info('[XiaoyueAnalysis] Already cached, skipping prefetch');
    return;
  }

  logger.info('[XiaoyueAnalysis] Starting background prefetch', { archetype: input.archetype });
  generateXiaoyueAnalysis({ ...input, confidence }).catch(err => {
    logger.error('[XiaoyueAnalysis] Background prefetch failed', { error: err instanceof Error ? err.message : String(err) });
  });
}
