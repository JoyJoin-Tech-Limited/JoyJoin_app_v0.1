import { z } from 'zod'

export const ATUAN_FIRST_ACT_VERSION = 'atuan-first-act-v1' as const

export const ATUAN_FIRST_ACT_INVESTIGATIONS = [
  {
    id: 'trace_order',
    label: '先按纸张和笔迹，排出这些卡出现的顺序。',
    reply: '阿团把卡边对齐：好。先看痕迹，不急着猜是谁。',
  },
  {
    id: 'protect_boundary',
    label: '先确认哪些内容可以看，别为了找卡越界。',
    reply: '阿团按住卡背：你先问边界。那我们只看正面留下的东西。',
  },
] as const

export const ATUAN_FIRST_ACT_HYPOTHESES = [
  { id: 'returned', label: '有人捡到以后，把它悄悄放回来了。' },
  { id: 'miscounted', label: '也许从来没有六张，是你记错了。' },
  { id: 'self_hidden', label: '第六张一直在，只是你不想承认写过。' },
] as const

export const ATUAN_FIRST_ACT_DECISIONS = [
  { id: 'return_unread', label: '把卡还给你，不替你翻开。' },
  { id: 'ask_first', label: '先问卡上的人，愿不愿意听。' },
  { id: 'restore_words', label: '把被盖住的字恢复出来，再决定。' },
] as const

export const ATUAN_FIRST_ACT_ANOMALIES = [
  {
    id: 'missing_card',
    opening: '……还是少了一张。奇怪，我明明写了六张。',
    action: '阿团把五张卡数了两遍，始终没有抬头。',
    clues: {
      trace_order: '五张卡的纸边磨损相同，只有座位图后面露出一道更新的折痕。',
      protect_boundary: '正面能确认五张编号；座位图背后压着纸角，但不必翻看任何名字。',
    },
    reversalId: 'card_behind_plan',
    reversal: '第六张没有被拿走。它一直压在座位图后面，最后一行被阿团自己涂黑了。',
    correctHypothesisId: 'self_hidden',
  },
  {
    id: 'extra_card',
    opening: '多了一张。这不是同一批纸，却用了我给卡片编号的方法。',
    action: '阿团停在第七张卡上，手指一直压着右下角。',
    clues: {
      trace_order: '第七张纸更新，右下角的短线却比其他字更旧，像从旧稿上描过。',
      protect_boundary: '不看正文也能发现：第七张只有编号，没有收件人的名字。',
    },
    reversalId: 'old_draft_returned',
    reversal: '第七张并不是别人仿写的。它来自阿团丢掉的旧稿，有人只把它重新放回了卡片中间。',
    correctHypothesisId: 'returned',
  },
  {
    id: 'rewritten_line',
    opening: '这句不对。前半句是我的，后半句却替我勇敢了一点。',
    action: '阿团把其中一张转向光线，墨色在句子中间变浅。',
    clues: {
      trace_order: '浅色字覆盖在一道擦痕上；擦掉的旧字与阿团现在的笔迹一致。',
      protect_boundary: '不读具体内容也看得出：修改只发生在阿团写下的部分，没有碰名字和时间。',
    },
    reversalId: 'erased_words_restored',
    reversal: '没有人替阿团写得更勇敢。浅色字只是把他自己擦掉的原句重新描了出来。',
    correctHypothesisId: 'self_hidden',
  },
  {
    id: 'moved_order',
    opening: '顺序变了。默默刚才来过，什么也没拿，只换了两张卡的位置。',
    action: '阿团没有把卡换回去，只盯着新的排列。',
    clues: {
      trace_order: '交换后的编号连成 2、1、2，正好对应座位图上被反复修改的三个距离。',
      protect_boundary: '两张卡的公开标题分别是“留下”和“等回答”；默默没有翻动其余内容。',
    },
    reversalId: 'order_is_reply',
    reversal: '默默没有留下新字。他换动卡片的顺序，本身就是对阿团那张座位图的回答。',
    correctHypothesisId: 'returned',
  },
] as const

export const ATUAN_FIRST_ACT_ENDINGS = [
  {
    id: 'no_one_stole',
    title: '没有人偷走任何东西',
    summary: '你找到了真正的来路，也把是否翻开的决定留给阿团。',
    npcReply: '阿团接过卡，没有翻面：“原来我一直在找一个小偷，好像这样就不用承认，是我先把话藏了起来。”',
  },
  {
    id: 'kept_unopened',
    title: '没有被打开的答案',
    summary: '你的判断没有完全命中，但那张卡仍被完整地还给了写下它的人。',
    npcReply: '阿团把卡收进座位图：“你可能猜错了来路，但没有把猜测变成伤害。这样已经很好。”',
  },
  {
    id: 'ask_before_reveal',
    title: '先问名字的主人',
    summary: '事实已经足够接近答案，你仍决定先取得被写到的那个人同意。',
    npcReply: '阿团把问题重新写在空白处：“先问他愿不愿意听。我的坦白，不该变成他的负担。”',
  },
  {
    id: 'question_without_owner',
    title: '还没有主人的问题',
    summary: '线索仍有矛盾，于是你没有急着把一个未经确认的问题交给任何人。',
    npcReply: '阿团点点头：“连写给谁都没弄清，就不该让谁来负责回答。我们先把问号留在这里。”',
  },
  {
    id: 'truth_too_early',
    title: '知道得太早',
    summary: '你恢复了关键文字，也让一个本来仍可选择的秘密提前成为事实。',
    npcReply: '阿团看完那行字，又把它盖住：“答案也许是真的。只是这次，我们比它的主人更早决定了它该被看见。”',
  },
  {
    id: 'wrong_ink',
    title: '认错的笔迹',
    summary: '被恢复的字没有证明原先的猜测，却留下了另一条需要谨慎处理的线索。',
    npcReply: '阿团没有责怪你，只把两种墨色分开：“认错不等于什么都没发生。至少现在，我们知道哪一部分还不能下结论。”',
  },
] as const

export type AtuanFirstActAnomalyId = typeof ATUAN_FIRST_ACT_ANOMALIES[number]['id']
export type AtuanFirstActInvestigationId = typeof ATUAN_FIRST_ACT_INVESTIGATIONS[number]['id']
export type AtuanFirstActHypothesisId = typeof ATUAN_FIRST_ACT_HYPOTHESES[number]['id']
export type AtuanFirstActDecisionId = typeof ATUAN_FIRST_ACT_DECISIONS[number]['id']
export type AtuanFirstActEndingId = typeof ATUAN_FIRST_ACT_ENDINGS[number]['id']

export interface AtuanFirstActProgress {
  version: typeof ATUAN_FIRST_ACT_VERSION
  anomalyId: AtuanFirstActAnomalyId
  investigationId: AtuanFirstActInvestigationId
  hypothesisId: AtuanFirstActHypothesisId | null
  reversalRevealed: boolean
  decisionId: AtuanFirstActDecisionId | null
}

const anomalyIdSchema = z.enum(['missing_card', 'extra_card', 'rewritten_line', 'moved_order'])
const investigationIdSchema = z.enum(['trace_order', 'protect_boundary'])
const hypothesisIdSchema = z.enum(['returned', 'miscounted', 'self_hidden'])
const decisionIdSchema = z.enum(['return_unread', 'ask_first', 'restore_words'])
const endingIdSchema = z.enum(['no_one_stole', 'kept_unopened', 'ask_before_reveal', 'question_without_owner', 'truth_too_early', 'wrong_ink'])

export const atuanFirstActSubmissionSchema = z.object({
  version: z.literal(ATUAN_FIRST_ACT_VERSION),
  anomalyId: anomalyIdSchema,
  investigationId: investigationIdSchema,
  hypothesisId: hypothesisIdSchema,
  reversalId: z.string().trim().min(1).max(80),
  decisionId: decisionIdSchema,
  endingId: endingIdSchema,
}).strict()

export type AtuanFirstActSubmission = z.infer<typeof atuanFirstActSubmissionSchema>

function stableIndex(value: string, size: number): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % size
}

export function selectAtuanFirstActAnomaly(encounterId: string) {
  return ATUAN_FIRST_ACT_ANOMALIES[stableIndex(encounterId, ATUAN_FIRST_ACT_ANOMALIES.length)]
}

export function getAtuanFirstActInvestigation(index: number) {
  return ATUAN_FIRST_ACT_INVESTIGATIONS[index] ?? ATUAN_FIRST_ACT_INVESTIGATIONS[0]
}

export function getAtuanFirstActAnomaly(id: AtuanFirstActAnomalyId) {
  return ATUAN_FIRST_ACT_ANOMALIES.find((item) => item.id === id) ?? ATUAN_FIRST_ACT_ANOMALIES[0]
}

export function createAtuanFirstActProgress(
  encounterId: string,
  investigationId: AtuanFirstActInvestigationId,
): AtuanFirstActProgress {
  return {
    version: ATUAN_FIRST_ACT_VERSION,
    anomalyId: selectAtuanFirstActAnomaly(encounterId).id,
    investigationId,
    hypothesisId: null,
    reversalRevealed: false,
    decisionId: null,
  }
}

export function restoreAtuanFirstActProgress(encounterId: string, value: unknown): AtuanFirstActProgress | null {
  const parsed = z.object({
    version: z.literal(ATUAN_FIRST_ACT_VERSION),
    anomalyId: anomalyIdSchema,
    investigationId: investigationIdSchema,
    hypothesisId: hypothesisIdSchema.nullable(),
    reversalRevealed: z.boolean(),
    decisionId: decisionIdSchema.nullable(),
  }).strict().safeParse(value)
  if (!parsed.success || parsed.data.anomalyId !== selectAtuanFirstActAnomaly(encounterId).id) return null
  if (parsed.data.reversalRevealed && !parsed.data.hypothesisId) return null
  if (parsed.data.decisionId && !parsed.data.reversalRevealed) return null
  return parsed.data
}

function endingIdFor(progress: AtuanFirstActProgress): AtuanFirstActEndingId {
  const anomaly = getAtuanFirstActAnomaly(progress.anomalyId)
  const hypothesisMatched = progress.hypothesisId === anomaly.correctHypothesisId
  if (progress.decisionId === 'return_unread') return hypothesisMatched ? 'no_one_stole' : 'kept_unopened'
  if (progress.decisionId === 'ask_first') return hypothesisMatched ? 'ask_before_reveal' : 'question_without_owner'
  return hypothesisMatched ? 'truth_too_early' : 'wrong_ink'
}

export function resolveAtuanFirstActOutcome(encounterId: string, progress: AtuanFirstActProgress) {
  const restored = restoreAtuanFirstActProgress(encounterId, progress)
  if (!restored?.hypothesisId || !restored.reversalRevealed || !restored.decisionId) {
    throw new Error('ATUAN_FIRST_ACT_INCOMPLETE')
  }
  const ending = ATUAN_FIRST_ACT_ENDINGS.find((item) => item.id === endingIdFor(restored))!
  return {
    progress: restored,
    ending,
    responseCopy: `《${ending.title}》\n${ending.npcReply}`,
  }
}

export function toAtuanFirstActSubmission(progress: AtuanFirstActProgress): AtuanFirstActSubmission {
  if (!progress.hypothesisId || !progress.reversalRevealed || !progress.decisionId) {
    throw new Error('ATUAN_FIRST_ACT_INCOMPLETE')
  }
  const anomaly = getAtuanFirstActAnomaly(progress.anomalyId)
  return {
    version: ATUAN_FIRST_ACT_VERSION,
    anomalyId: progress.anomalyId,
    investigationId: progress.investigationId,
    hypothesisId: progress.hypothesisId,
    reversalId: anomaly.reversalId,
    decisionId: progress.decisionId,
    endingId: endingIdFor(progress),
  }
}

export function validateAtuanFirstActSubmission(encounterId: string, value: unknown) {
  const parsed = atuanFirstActSubmissionSchema.safeParse(value)
  if (!parsed.success) return null
  const expectedAnomaly = selectAtuanFirstActAnomaly(encounterId)
  if (parsed.data.anomalyId !== expectedAnomaly.id || parsed.data.reversalId !== expectedAnomaly.reversalId) return null
  const progress: AtuanFirstActProgress = {
    version: ATUAN_FIRST_ACT_VERSION,
    anomalyId: parsed.data.anomalyId,
    investigationId: parsed.data.investigationId,
    hypothesisId: parsed.data.hypothesisId,
    reversalRevealed: true,
    decisionId: parsed.data.decisionId,
  }
  const outcome = resolveAtuanFirstActOutcome(encounterId, progress)
  return outcome.ending.id === parsed.data.endingId ? { submission: parsed.data, outcome } : null
}

export function atuanFirstActStoryAnswers(submission: AtuanFirstActSubmission) {
  return [
    { questionId: 'atuan-first-act:anomaly', optionId: submission.anomalyId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:investigation', optionId: submission.investigationId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:hypothesis', optionId: submission.hypothesisId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:reversal', optionId: submission.reversalId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:decision', optionId: submission.decisionId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:ending', optionId: submission.endingId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
  ]
}
