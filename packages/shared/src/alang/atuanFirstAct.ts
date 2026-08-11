import { z } from 'zod'

export const ATUAN_FIRST_ACT_VERSION = 'atuan-first-act-v2' as const

export const ATUAN_FIRST_ACT_APPROACHES = [
  {
    id: 'notice_wait',
    label: '你等了很久吗？',
    reply: '“也没有很久。”阿团看了一眼已经亮起的路灯，“只是它今天亮得比我有耐心。”',
  },
  {
    id: 'notice_again',
    label: '你刚才说“又”？',
    reply: '阿团顿了一下：“上次也有人说会来。可能大家都觉得，水豚比较等得起。”',
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
export type AtuanFirstActFollowupId = typeof ATUAN_FIRST_ACT_FOLLOWUPS[number]['id']
export type AtuanFirstActEndingId = typeof ATUAN_FIRST_ACT_ENDINGS[number]['id']

export interface AtuanFirstActProgress {
  version: typeof ATUAN_FIRST_ACT_VERSION
  approachId: AtuanFirstActApproachId
  followupId: AtuanFirstActFollowupId | null
  benchReached: boolean
}

const approachIdSchema = z.enum(['notice_wait', 'notice_again'])
const followupIdSchema = z.enum(['ask_who', 'offer_help', 'move_forward'])
const endingIdSchema = z.enum(['felt_seen', 'helped_first', 'shared_the_trip'])

export const atuanFirstActSubmissionSchema = z.object({
  version: z.literal(ATUAN_FIRST_ACT_VERSION),
  approachId: approachIdSchema,
  followupId: followupIdSchema,
  actionId: z.literal(ATUAN_FIRST_ACT_ACTION.id),
  endingId: endingIdSchema,
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
    followupId: null,
    benchReached: false,
  }
}

export function restoreAtuanFirstActProgress(_encounterId: string, value: unknown): AtuanFirstActProgress | null {
  const parsed = z.object({
    version: z.literal(ATUAN_FIRST_ACT_VERSION),
    approachId: approachIdSchema,
    followupId: followupIdSchema.nullable(),
    benchReached: z.boolean(),
  }).strict().safeParse(value)
  if (!parsed.success || (parsed.data.benchReached && !parsed.data.followupId)) return null
  return parsed.data
}

function endingIdFor(progress: AtuanFirstActProgress): AtuanFirstActEndingId {
  if (progress.followupId === 'offer_help') return 'helped_first'
  if (progress.followupId === 'move_forward') return 'shared_the_trip'
  return 'felt_seen'
}

export function resolveAtuanFirstActOutcome(encounterId: string, progress: AtuanFirstActProgress) {
  const restored = restoreAtuanFirstActProgress(encounterId, progress)
  if (!restored?.followupId || !restored.benchReached) throw new Error('ATUAN_FIRST_ACT_INCOMPLETE')
  const ending = ATUAN_FIRST_ACT_ENDINGS.find((item) => item.id === endingIdFor(restored))!
  return { progress: restored, ending, responseCopy: ending.responseCopy }
}

export function toAtuanFirstActSubmission(progress: AtuanFirstActProgress): AtuanFirstActSubmission {
  if (!progress.followupId || !progress.benchReached) throw new Error('ATUAN_FIRST_ACT_INCOMPLETE')
  return {
    version: ATUAN_FIRST_ACT_VERSION,
    approachId: progress.approachId,
    followupId: progress.followupId,
    actionId: ATUAN_FIRST_ACT_ACTION.id,
    endingId: endingIdFor(progress),
  }
}

export function validateAtuanFirstActSubmission(_encounterId: string, value: unknown) {
  const parsed = atuanFirstActSubmissionSchema.safeParse(value)
  if (!parsed.success) return null
  const progress: AtuanFirstActProgress = {
    version: ATUAN_FIRST_ACT_VERSION,
    approachId: parsed.data.approachId,
    followupId: parsed.data.followupId,
    benchReached: true,
  }
  const outcome = resolveAtuanFirstActOutcome('', progress)
  return outcome.ending.id === parsed.data.endingId ? { submission: parsed.data, outcome } : null
}

export function atuanFirstActStoryAnswers(submission: AtuanFirstActSubmission) {
  return [
    { questionId: 'atuan-first-act:approach', optionId: submission.approachId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:followup', optionId: submission.followupId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:action', optionId: submission.actionId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
    { questionId: 'atuan-first-act:ending', optionId: submission.endingId, tags: ['story_path', ATUAN_FIRST_ACT_VERSION] },
  ]
}
