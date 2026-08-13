import { z } from 'zod'

export const ATUAN_FIRST_ACT_VERSION = 'atuan-first-act-v4' as const

export const ATUAN_FIRST_ACT_HIGHLIGHTS = [
  { id: 'fold', label: '新折痕', reply: '阿团用指腹压住折痕：“不是我折的。有人来过，又没等我回来。”' },
  { id: 'string', label: '褪色的紫绳', reply: '“原来系着六张卡。”阿团把断口并在一起，“现在只剩五张。”' },
  { id: 'blank_name', label: '被擦掉的名字', reply: '纸面迎着光，留下浅浅一层压痕。阿团没有念出来：“先别替它找主人。”' },
] as const

export const ATUAN_FIRST_ACT_CARDS = [
  { id: 'city', label: '雨后便利店门口的橘猫', destination: 'keep' },
  { id: 'habit', label: '总把靠窗的位置留空', destination: 'return' },
  { id: 'private_time', label: '每周固定出现的时间', destination: 'cover' },
] as const

export const ATUAN_FIRST_ACT_APPROACHES = [
  {
    id: 'notice_wait',
    label: '接住卡片',
    reply: '“谢谢。这张要是真飞远了，我可能得追到公园门口。”阿团接过卡，看到背面时停了一下，“……偏偏是这张。”',
  },
  {
    id: 'notice_again',
    label: '护住纸袋',
    reply: '“还好。”阿团蹲下去捡长椅下的卡，“要是五张一起散开，我大概会站在这里，一张一张和风讲道理。”',
  },
] as const

export const ATUAN_FIRST_ACT_FOLLOWUPS = [
  {
    id: 'ask_who',
    label: '你一直看着路口，是在等谁吗？',
    reply: '“一个答应来拿东西的人。”阿团把目光收回来，“我还没想好，他不来算不算一种回答。”',
  },
  {
    id: 'offer_help',
    label: '纸袋里装着什么？需要我搭把手吗？',
    reply: '“几张一直没送出去的卡。”阿团第一次笑了一下，“本来不想麻烦刚认识的人，但你都走到这里了。”',
  },
  {
    id: 'move_forward',
    label: '如果他不来，我们也别让这趟白跑。',
    reply: '阿团望向长椅：“好。那我们做点只有今天能做的事，别把黄昏全交给一个没出现的人。”',
  },
] as const

export const ATUAN_FIRST_ACT_ACTION = {
  id: 'sit_beside_him',
  label: '走到阿团身边，看看那只纸袋',
} as const

export const ATUAN_FIRST_ACT_ENDINGS = [
  {
    id: 'felt_seen',
    title: '你看见了他的等待',
    responseCopy: '阿团把座位图往你这边挪了挪：“这些卡本来是写给不同人的。我不太想一个人打开。你愿意陪我一起整理吗？”',
  },
  {
    id: 'helped_first',
    title: '你先伸出了手',
    responseCopy: '阿团把纸袋放到你们中间：“这些卡本来是写给不同人的。我不太想一个人打开。你愿意陪我一起整理吗？”',
  },
  {
    id: 'shared_the_trip',
    title: '这趟没有白来',
    responseCopy: '阿团在长椅上给你留出位置：“这些卡本来是写给不同人的。既然你来了，我们一起看看它们该去哪里。”',
  },
] as const

export type AtuanFirstActApproachId = typeof ATUAN_FIRST_ACT_APPROACHES[number]['id']
export type AtuanFirstActArrivalReplyId = 'ask_special' | 'turn_face_down' | 'ask_order' | 'count_cards'
export type AtuanFirstActFollowupId = typeof ATUAN_FIRST_ACT_FOLLOWUPS[number]['id']
export type AtuanFirstActEndingId = typeof ATUAN_FIRST_ACT_ENDINGS[number]['id']
export type AtuanFirstActCardId = typeof ATUAN_FIRST_ACT_CARDS[number]['id']
export type AtuanFirstActCardDestinationId = 'keep' | 'return' | 'cover'
export interface AtuanFirstActCardPlacement {
  cardId: AtuanFirstActCardId
  destinationId: AtuanFirstActCardDestinationId
}

export interface AtuanFirstActProgress {
  version: typeof ATUAN_FIRST_ACT_VERSION
  approachId: AtuanFirstActApproachId
  arrivalReplyId: AtuanFirstActArrivalReplyId | null
  followupId: AtuanFirstActFollowupId | null
  benchReached: boolean
  highlightOrder: Array<typeof ATUAN_FIRST_ACT_HIGHLIGHTS[number]['id']>
  cardPlacements: AtuanFirstActCardPlacement[]
}

const approachIdSchema = z.enum(['notice_wait', 'notice_again'])
const arrivalReplyIdSchema = z.enum(['ask_special', 'turn_face_down', 'ask_order', 'count_cards'])
const followupIdSchema = z.enum(['ask_who', 'offer_help', 'move_forward'])
const endingIdSchema = z.enum(['felt_seen', 'helped_first', 'shared_the_trip'])
const highlightIdSchema = z.enum(['fold', 'string', 'blank_name'])
const cardIdSchema = z.enum(['city', 'habit', 'private_time'])
const cardDestinationIdSchema = z.enum(['keep', 'return', 'cover'])
const cardPlacementSchema = z.object({ cardId: cardIdSchema, destinationId: cardDestinationIdSchema }).strict()

export const atuanFirstActSubmissionSchema = z.object({
  version: z.literal(ATUAN_FIRST_ACT_VERSION),
  approachId: approachIdSchema,
  arrivalReplyId: arrivalReplyIdSchema,
  followupId: followupIdSchema,
  actionId: z.literal(ATUAN_FIRST_ACT_ACTION.id),
  endingId: endingIdSchema,
  highlightOrder: z.array(highlightIdSchema).length(3),
  cardPlacements: z.array(cardPlacementSchema).length(3),
}).strict()

export type AtuanFirstActSubmission = z.infer<typeof atuanFirstActSubmissionSchema>

export function getAtuanFirstActApproach(index: number) {
  return ATUAN_FIRST_ACT_APPROACHES[index] ?? ATUAN_FIRST_ACT_APPROACHES[0]
}

// Compatibility alias for the server's reviewed-question option binding.
export const getAtuanFirstActInvestigation = getAtuanFirstActApproach

export function createAtuanFirstActProgress(
  _encounterId: string,
  approachId: AtuanFirstActApproachId,
): AtuanFirstActProgress {
  return {
    version: ATUAN_FIRST_ACT_VERSION,
    approachId,
    arrivalReplyId: null,
    followupId: null,
    benchReached: false,
    highlightOrder: [],
    cardPlacements: [],
  }
}

export function restoreAtuanFirstActProgress(_encounterId: string, value: unknown): AtuanFirstActProgress | null {
  const parsed = z.object({
    version: z.literal(ATUAN_FIRST_ACT_VERSION),
    approachId: approachIdSchema,
    arrivalReplyId: arrivalReplyIdSchema.nullable(),
    followupId: followupIdSchema.nullable(),
    benchReached: z.boolean(),
    highlightOrder: z.array(highlightIdSchema),
    cardPlacements: z.array(cardPlacementSchema),
  }).strict().safeParse(value)
  if (!parsed.success || (parsed.data.benchReached && (!parsed.data.followupId || parsed.data.highlightOrder.length !== 3 || parsed.data.cardPlacements.length !== 3))) return null
  return parsed.data
}

function endingIdFor(progress: AtuanFirstActProgress): AtuanFirstActEndingId {
  if (progress.followupId === 'offer_help') return 'helped_first'
  if (progress.followupId === 'move_forward') return 'shared_the_trip'
  return 'felt_seen'
}

export function resolveAtuanFirstActOutcome(encounterId: string, progress: AtuanFirstActProgress) {
  const restored = restoreAtuanFirstActProgress(encounterId, progress)
  if (!restored?.arrivalReplyId || !restored.followupId || !restored.benchReached || restored.highlightOrder.length !== 3 || restored.cardPlacements.length !== 3) throw new Error('ATUAN_FIRST_ACT_INCOMPLETE')
  const ending = ATUAN_FIRST_ACT_ENDINGS.find((item) => item.id === endingIdFor(restored))!
  return { progress: restored, ending, responseCopy: ending.responseCopy }
}

export function toAtuanFirstActSubmission(progress: AtuanFirstActProgress): AtuanFirstActSubmission {
  if (!progress.arrivalReplyId || !progress.followupId || !progress.benchReached) throw new Error('ATUAN_FIRST_ACT_INCOMPLETE')
  return {
    version: ATUAN_FIRST_ACT_VERSION,
    approachId: progress.approachId,
    arrivalReplyId: progress.arrivalReplyId,
    followupId: progress.followupId,
    actionId: ATUAN_FIRST_ACT_ACTION.id,
    endingId: endingIdFor(progress),
    highlightOrder: progress.highlightOrder,
    cardPlacements: progress.cardPlacements,
  }
}

export function validateAtuanFirstActSubmission(_encounterId: string, value: unknown) {
  const parsed = atuanFirstActSubmissionSchema.safeParse(value)
  if (!parsed.success) return null
  const progress: AtuanFirstActProgress = {
    version: ATUAN_FIRST_ACT_VERSION,
    approachId: parsed.data.approachId,
    arrivalReplyId: parsed.data.arrivalReplyId,
    followupId: parsed.data.followupId,
    benchReached: true,
    highlightOrder: parsed.data.highlightOrder,
    cardPlacements: parsed.data.cardPlacements,
  }
  const outcome = resolveAtuanFirstActOutcome('', progress)
  return outcome.ending.id === parsed.data.endingId ? { submission: parsed.data, outcome } : null
}

export function atuanFirstActStoryAnswers(submission: AtuanFirstActSubmission) {
  return [
    { questionId: 'atuan-first-act:approach', optionId: submission.approachId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:arrival-reply', optionId: submission.arrivalReplyId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:followup', optionId: submission.followupId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:action', optionId: submission.actionId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:ending', optionId: submission.endingId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    ...submission.highlightOrder.map((optionId) => ({ questionId: 'atuan-first-act:highlight', optionId, tags: ['story_memory', ATUAN_FIRST_ACT_VERSION] })),
    ...submission.cardPlacements.map(({ cardId, destinationId }) => ({ questionId: `atuan-first-act:card:${cardId}`, optionId: destinationId, tags: ['story_memory', ATUAN_FIRST_ACT_VERSION] })),
  ]
}
