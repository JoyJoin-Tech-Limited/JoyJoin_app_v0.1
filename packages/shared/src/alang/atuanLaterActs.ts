import { z } from 'zod'

export const ATUAN_LATER_ACT_VERSION = 'atuan-later-acts-v2' as const
export const ATUAN_LATER_ACT_UNIT_IDS = ['s1-p2-atuan', 's1-p3-atuan'] as const

export type AtuanLaterActUnitId = typeof ATUAN_LATER_ACT_UNIT_IDS[number]

export const ATUAN_SECOND_ACT = {
  unitId: 's1-p2-atuan',
  opening: '阿团把一张反复折过的座位图铺在桌上。两把椅子被他挪过很多次，每一次都像差一点才敢停下。',
  approaches: [
    { id: 'read_plan_first', label: '先看看他改过的地方', narration: '你没有急着问名字，先沿着纸上的折痕看了一遍。', reply: '我每次都说是在替默默找舒服的位置。其实有一半，是我想坐在他旁边。' },
    { id: 'ask_invitation', label: '这张图，是一份邀请吗？', narration: '你把图纸转向阿团，没有替他把空白席位填上。', reply: '是。只是我画了很多遍，还是没敢把“想一起坐一会儿”写出来。' },
  ],
  arrivalReplies: [
    { id: 'ask_fold_history', approachId: 'read_plan_first', label: '这些折痕，是你一次次改出来的吗？', reply: '嗯。每次以为自己找到了合适的距离，真正要开口时又会把图折回去。' },
    { id: 'name_the_distance', approachId: 'read_plan_first', label: '你是在找距离，还是在等勇气？', reply: '可能两样都有。距离画得出来，承认自己想靠近却要难一点。' },
    { id: 'ask_whose_place', approachId: 'ask_invitation', label: '你最想把哪一个位置留给他？', reply: '我旁边那个。以前我只敢说那里比较舒服，现在想说清楚是我希望他来。' },
    { id: 'offer_to_listen', approachId: 'ask_invitation', label: '先把真正想说的话告诉我。', reply: '我想邀请他坐一会儿。不是替他安排，只是终于把我的那一边说出来。' },
  ],
  action: { id: 'arrange_seating_plan', prompt: '阿团把座位图和两把椅子留在你们中间。', label: '和阿团一起摆好座位图' },
  highlights: [
    { id: 'plan_folds', label: '反复折过的座位图', reply: '折痕压着三版不同的距离。最近的一版并不拥挤，只是刚好能并肩说话。' },
    { id: 'chair_scuffs', label: '椅脚旁的浅痕', reply: '同一把椅子被往外挪过，又被拉回来。阿团不是不知道距离，只是迟迟不敢决定自己的位置。' },
    { id: 'blank_place', label: '没有名字的席位卡', reply: '席位卡一直空着。阿团说：“我可以写我的名字，另一边不能由我替他写。”' },
  ],
  followups: [
    { id: 'name_wish', label: '你想照顾他，也确实想和他坐在一起。', reply: '对。把后半句藏起来，看起来体贴，其实也会让他一直猜。' },
    { id: 'leave_choice', label: '把你的邀请说清，把舒服的距离留给他选。', reply: '这样最好。图可以给一个起点，最后坐在哪里还是由他决定。' },
    { id: 'say_before_plan', label: '先亲口说邀请，再把座位图递给他。', reply: '嗯。不能再让一张图替我绕弯子。' },
  ],
  endings: [
    { id: 'invitation_named', title: '你替愿望说出了名字', responseCopy: '阿团把两把椅子的距离停在折痕上：“原来我不是只想照顾他。我是在邀请他。答案还是留给默默。”' },
    { id: 'room_preserved', title: '你替回答留下了空间', responseCopy: '阿团把自己的席位卡放下，另一边仍然空着：“我的邀请已经清楚了，他可以按自己的距离回答。”' },
    { id: 'words_before_plan', title: '你让图纸回到话语之后', responseCopy: '阿团把座位图折好：“这次我会先开口。图纸只说明我的心意，不替他安排位置。”' },
  ],
} as const

export const ATUAN_THIRD_ACT = {
  unitId: 's1-p3-atuan',
  opening: '黄昏落到公共桌上。第二幕那张座位图重新铺开，箱底的钥匙终于对上锁孔，第六张卡也回来了。阿团没有翻背面的名字。',
  approaches: [
    { id: 'open_box_first', label: '先看看箱底那把钥匙', narration: '钥匙只转了半圈，旧木箱里传来一声很轻的碰响。', reply: '原来它一直在夹层里。第六张卡不是回答，是我当时没送出去的邀请。' },
    { id: 'read_sixth_first', label: '先看第六张卡的正面', narration: '你只看了正面的城市小事，没有去碰背面被擦淡的名字。', reply: '谢谢。背面该由默默决定要不要看。正面只写着：这里有一个位置，想留给你。' },
  ],
  arrivalReplies: [
    { id: 'ask_sixth_card', approachId: 'open_box_first', label: '第六张卡，原来一直在这里？', reply: '一直都在。它没有替默默回答什么，只是把我没送出去的话还给了我。' },
    { id: 'keep_back_unread', approachId: 'open_box_first', label: '先不翻背面，只看你写出的邀请。', reply: '好。正面是我该负责的话，背面要不要被看见，仍然由默默决定。' },
    { id: 'ask_card_return', approachId: 'read_sixth_first', label: '它回来以后，你想先做什么？', reply: '先把邀请摆回桌上，再放好我自己的名字。另一边不急着有答案。' },
    { id: 'set_answer_boundary', approachId: 'read_sixth_first', label: '正面是你的邀请，背面还是他的选择。', reply: '嗯。我终于能分清：把话说出来是我的事，怎么回应是他的事。' },
  ],
  action: { id: 'open_returned_card', prompt: '阿团把钥匙、第六张卡和座位图放到你们中间。', label: '和阿团一起打开这份迟到的邀请' },
  highlights: [
    { id: 'box_key', label: '木箱旁的钥匙', reply: '钥匙齿痕与箱底夹层完全吻合。它打开的不是秘密，只是一张被拖延太久的卡。' },
    { id: 'sixth_card', label: '回来的第六张卡', reply: '卡角的紫绳断口和第一幕剩下的五张对上了。它从来没有被别人拿走。' },
    { id: 'empty_seat', label: '座位图上空着的另一边', reply: '第二幕的座位图已经铺回桌上。阿团只放好自己的名牌，另一侧没有名字。那不是遗漏，是他刻意留下的回答位置。' },
  ],
  followups: [
    { id: 'own_side_only', label: '只放好你的名字，另一边留给默默。', reply: '好。我负责把邀请摆上桌，不替他把答案摆好。' },
    { id: 'leave_answer', label: '告诉他不用现在回答，这个位置不会催他。', reply: '我会说清楚。等待不该变成压力，空着也可以是一种完整状态。' },
    { id: 'friendship_safe', label: '无论他怎么回答，都不改变你珍惜这段关系。', reply: '这句我会亲口说。拒绝一次邀请，不该让朋友担心失去我。' },
  ],
  endings: [
    { id: 'own_side_claimed', title: '你只替阿团确认了这一边', responseCopy: '阿团把自己的名字放到左边，右边保持空白：“邀请属于我，答案属于默默。”' },
    { id: 'answer_left_open', title: '你让空位也成为完整答案', responseCopy: '阿团把第六张卡放在两边中间：“他不用现在回答。这个空位不会催他，也不会替他答应。”' },
    { id: 'friendship_held', title: '你把关系放在答案之前', responseCopy: '阿团合上旧木箱：“我会说出邀请，也会说清楚——无论答案是什么，我们的关系都不会因此被收回。”' },
  ],
} as const

export type AtuanSecondActApproachId = typeof ATUAN_SECOND_ACT.approaches[number]['id']
export type AtuanSecondActArrivalReplyId = typeof ATUAN_SECOND_ACT.arrivalReplies[number]['id']
export type AtuanSecondActHighlightId = typeof ATUAN_SECOND_ACT.highlights[number]['id']
export type AtuanSecondActFollowupId = typeof ATUAN_SECOND_ACT.followups[number]['id']
export type AtuanSecondActEndingId = typeof ATUAN_SECOND_ACT.endings[number]['id']
export type AtuanThirdActApproachId = typeof ATUAN_THIRD_ACT.approaches[number]['id']
export type AtuanThirdActArrivalReplyId = typeof ATUAN_THIRD_ACT.arrivalReplies[number]['id']
export type AtuanThirdActHighlightId = typeof ATUAN_THIRD_ACT.highlights[number]['id']
export type AtuanThirdActFollowupId = typeof ATUAN_THIRD_ACT.followups[number]['id']
export type AtuanThirdActEndingId = typeof ATUAN_THIRD_ACT.endings[number]['id']

export interface AtuanSecondActProgress {
  version: typeof ATUAN_LATER_ACT_VERSION
  unitId: 's1-p2-atuan'
  approachId: AtuanSecondActApproachId
  arrivalReplyId: AtuanSecondActArrivalReplyId | null
  highlightOrder: AtuanSecondActHighlightId[]
  followupId: AtuanSecondActFollowupId | null
  gameStarted: boolean
  game: { planUpright: boolean; chairGap: 'close' | 'breathing' | 'far' | null; attempts: number }
}

export interface AtuanThirdActProgress {
  version: typeof ATUAN_LATER_ACT_VERSION
  unitId: 's1-p3-atuan'
  approachId: AtuanThirdActApproachId
  arrivalReplyId: AtuanThirdActArrivalReplyId | null
  highlightOrder: AtuanThirdActHighlightId[]
  followupId: AtuanThirdActFollowupId | null
  gameStarted: boolean
  game: { boxUnlocked: boolean; invitationPlaced: boolean; atuanNamePlaced: boolean; otherSeat: 'unset' | 'blank'; attempts: number }
}

export type AtuanLaterActProgress = AtuanSecondActProgress | AtuanThirdActProgress

const uniqueArray = <T extends z.ZodTypeAny>(schema: T, length: number) => z.array(schema).max(length).refine(
  (values) => new Set(values).size === values.length,
  { message: 'Highlights must be unique' },
)

const attemptsSchema = z.number().int().min(0).max(20)
const secondApproachSchema = z.enum(['read_plan_first', 'ask_invitation'])
const secondArrivalReplySchema = z.enum(['ask_fold_history', 'name_the_distance', 'ask_whose_place', 'offer_to_listen'])
const secondHighlightSchema = z.enum(['plan_folds', 'chair_scuffs', 'blank_place'])
const secondFollowupSchema = z.enum(['name_wish', 'leave_choice', 'say_before_plan'])
const secondEndingSchema = z.enum(['invitation_named', 'room_preserved', 'words_before_plan'])
const thirdApproachSchema = z.enum(['open_box_first', 'read_sixth_first'])
const thirdArrivalReplySchema = z.enum(['ask_sixth_card', 'keep_back_unread', 'ask_card_return', 'set_answer_boundary'])
const thirdHighlightSchema = z.enum(['box_key', 'sixth_card', 'empty_seat'])
const thirdFollowupSchema = z.enum(['own_side_only', 'leave_answer', 'friendship_safe'])
const thirdEndingSchema = z.enum(['own_side_claimed', 'answer_left_open', 'friendship_held'])

const secondProgressSchema = z.object({
  version: z.literal(ATUAN_LATER_ACT_VERSION),
  unitId: z.literal('s1-p2-atuan'),
  approachId: secondApproachSchema,
  arrivalReplyId: secondArrivalReplySchema.nullable(),
  highlightOrder: uniqueArray(secondHighlightSchema, 3),
  followupId: secondFollowupSchema.nullable(),
  gameStarted: z.boolean(),
  game: z.object({
    planUpright: z.boolean(),
    chairGap: z.enum(['close', 'breathing', 'far']).nullable(),
    attempts: attemptsSchema,
  }).strict(),
}).strict()

const thirdProgressSchema = z.object({
  version: z.literal(ATUAN_LATER_ACT_VERSION),
  unitId: z.literal('s1-p3-atuan'),
  approachId: thirdApproachSchema,
  arrivalReplyId: thirdArrivalReplySchema.nullable(),
  highlightOrder: uniqueArray(thirdHighlightSchema, 3),
  followupId: thirdFollowupSchema.nullable(),
  gameStarted: z.boolean(),
  game: z.object({
    boxUnlocked: z.boolean(),
    invitationPlaced: z.boolean(),
    atuanNamePlaced: z.boolean(),
    otherSeat: z.enum(['unset', 'blank']),
    attempts: attemptsSchema,
  }).strict(),
}).strict()

const secondSubmissionSchema = z.object({
  version: z.literal(ATUAN_LATER_ACT_VERSION),
  unitId: z.literal('s1-p2-atuan'),
  approachId: secondApproachSchema,
  arrivalReplyId: secondArrivalReplySchema,
  highlightOrder: z.array(secondHighlightSchema).length(3).refine((values) => new Set(values).size === 3),
  followupId: secondFollowupSchema,
  game: z.object({ planUpright: z.literal(true), chairGap: z.literal('breathing'), attempts: attemptsSchema }).strict(),
  actionId: z.literal(ATUAN_SECOND_ACT.action.id),
  endingId: secondEndingSchema,
}).strict()

const thirdSubmissionSchema = z.object({
  version: z.literal(ATUAN_LATER_ACT_VERSION),
  unitId: z.literal('s1-p3-atuan'),
  approachId: thirdApproachSchema,
  arrivalReplyId: thirdArrivalReplySchema,
  highlightOrder: z.array(thirdHighlightSchema).length(3).refine((values) => new Set(values).size === 3),
  followupId: thirdFollowupSchema,
  game: z.object({ boxUnlocked: z.literal(true), invitationPlaced: z.literal(true), atuanNamePlaced: z.literal(true), otherSeat: z.literal('blank'), attempts: attemptsSchema }).strict(),
  actionId: z.literal(ATUAN_THIRD_ACT.action.id),
  endingId: thirdEndingSchema,
}).strict()

export const atuanLaterActSubmissionSchema = z.discriminatedUnion('unitId', [
  secondSubmissionSchema,
  thirdSubmissionSchema,
])

export type AtuanLaterActSubmission = z.infer<typeof atuanLaterActSubmissionSchema>

export function isAtuanLaterActUnitId(value: string): value is AtuanLaterActUnitId {
  return (ATUAN_LATER_ACT_UNIT_IDS as readonly string[]).includes(value)
}

export function getAtuanLaterActDefinition(unitId: AtuanLaterActUnitId) {
  return unitId === 's1-p2-atuan' ? ATUAN_SECOND_ACT : ATUAN_THIRD_ACT
}

export function getAtuanLaterActApproach(unitId: 's1-p2-atuan', index: number): typeof ATUAN_SECOND_ACT.approaches[number]
export function getAtuanLaterActApproach(unitId: 's1-p3-atuan', index: number): typeof ATUAN_THIRD_ACT.approaches[number]
export function getAtuanLaterActApproach(unitId: AtuanLaterActUnitId, index: number): typeof ATUAN_SECOND_ACT.approaches[number] | typeof ATUAN_THIRD_ACT.approaches[number]
export function getAtuanLaterActApproach(unitId: AtuanLaterActUnitId, index: number) {
  const approaches = getAtuanLaterActDefinition(unitId).approaches
  return approaches[index] ?? approaches[0]
}

export function createAtuanLaterActProgress(unitId: 's1-p2-atuan', approachId: AtuanSecondActApproachId): AtuanSecondActProgress
export function createAtuanLaterActProgress(unitId: 's1-p3-atuan', approachId: AtuanThirdActApproachId): AtuanThirdActProgress
export function createAtuanLaterActProgress(unitId: AtuanLaterActUnitId, approachId: AtuanSecondActApproachId | AtuanThirdActApproachId): AtuanLaterActProgress {
  if (unitId === 's1-p2-atuan') {
    const parsed = secondApproachSchema.parse(approachId)
    return {
      version: ATUAN_LATER_ACT_VERSION,
      unitId,
      approachId: parsed,
      arrivalReplyId: null,
      highlightOrder: [],
      followupId: null,
      gameStarted: false,
      game: { planUpright: false, chairGap: null, attempts: 0 },
    }
  }
  const parsed = thirdApproachSchema.parse(approachId)
  return {
    version: ATUAN_LATER_ACT_VERSION,
    unitId,
    approachId: parsed,
    arrivalReplyId: null,
    highlightOrder: [],
    followupId: null,
    gameStarted: false,
    game: { boxUnlocked: false, invitationPlaced: false, atuanNamePlaced: false, otherSeat: 'unset', attempts: 0 },
  }
}

export function restoreAtuanLaterActProgress(unitId: AtuanLaterActUnitId, value: unknown): AtuanLaterActProgress | null {
  const parsed = unitId === 's1-p2-atuan'
    ? secondProgressSchema.safeParse(value)
    : thirdProgressSchema.safeParse(value)
  if (!parsed.success) return null
  const progress = parsed.data
  const definition = getAtuanLaterActDefinition(unitId)
  const arrivalReply = progress.arrivalReplyId
    ? (definition.arrivalReplies as readonly { id: string; approachId: string }[]).find((item) => item.id === progress.arrivalReplyId)
    : null
  if (arrivalReply && arrivalReply.approachId !== progress.approachId) return null
  if (progress.highlightOrder.length > 0 && !arrivalReply) return null
  if (progress.followupId && progress.highlightOrder.length !== 3) return null
  if (progress.gameStarted && !progress.followupId) return null
  const gameChanged = progress.unitId === 's1-p2-atuan'
    ? progress.game.planUpright || progress.game.chairGap !== null || progress.game.attempts > 0
    : progress.game.boxUnlocked || progress.game.invitationPlaced || progress.game.atuanNamePlaced || progress.game.otherSeat !== 'unset' || progress.game.attempts > 0
  if (gameChanged && !progress.gameStarted) return null
  return progress
}

function secondEndingId(followupId: AtuanSecondActFollowupId): AtuanSecondActEndingId {
  if (followupId === 'leave_choice') return 'room_preserved'
  if (followupId === 'say_before_plan') return 'words_before_plan'
  return 'invitation_named'
}

function thirdEndingId(followupId: AtuanThirdActFollowupId): AtuanThirdActEndingId {
  if (followupId === 'leave_answer') return 'answer_left_open'
  if (followupId === 'friendship_safe') return 'friendship_held'
  return 'own_side_claimed'
}

export function resolveAtuanLaterActOutcome(progress: AtuanLaterActProgress) {
  const restored = restoreAtuanLaterActProgress(progress.unitId, progress)
  if (!restored || !restored.arrivalReplyId || restored.highlightOrder.length !== 3 || !restored.followupId || !restored.gameStarted) throw new Error('ATUAN_LATER_ACT_INCOMPLETE')
  if (restored.unitId === 's1-p2-atuan') {
    if (!restored.game.planUpright || restored.game.chairGap !== 'breathing') throw new Error('ATUAN_LATER_ACT_INCOMPLETE')
    const endingId = secondEndingId(restored.followupId)
    const ending = ATUAN_SECOND_ACT.endings.find((item) => item.id === endingId)!
    return { progress: restored, ending, responseCopy: ending.responseCopy }
  }
  if (!restored.game.boxUnlocked || !restored.game.invitationPlaced || !restored.game.atuanNamePlaced || restored.game.otherSeat !== 'blank') throw new Error('ATUAN_LATER_ACT_INCOMPLETE')
  const endingId = thirdEndingId(restored.followupId)
  const ending = ATUAN_THIRD_ACT.endings.find((item) => item.id === endingId)!
  return { progress: restored, ending, responseCopy: ending.responseCopy }
}

export function toAtuanLaterActSubmission(progress: AtuanLaterActProgress): AtuanLaterActSubmission {
  const outcome = resolveAtuanLaterActOutcome(progress)
  const base = {
    version: outcome.progress.version,
    unitId: outcome.progress.unitId,
    approachId: outcome.progress.approachId,
    arrivalReplyId: outcome.progress.arrivalReplyId,
    highlightOrder: outcome.progress.highlightOrder,
    followupId: outcome.progress.followupId,
    game: outcome.progress.game,
    endingId: outcome.ending.id,
  }
  return atuanLaterActSubmissionSchema.parse(outcome.progress.unitId === 's1-p2-atuan'
    ? { ...base, actionId: ATUAN_SECOND_ACT.action.id }
    : { ...base, actionId: ATUAN_THIRD_ACT.action.id })
}

export function validateAtuanLaterActSubmission(unitId: AtuanLaterActUnitId, value: unknown) {
  const parsed = atuanLaterActSubmissionSchema.safeParse(value)
  if (!parsed.success || parsed.data.unitId !== unitId) return null
  const { endingId, actionId: _actionId, ...submitted } = parsed.data
  const progress = { ...submitted, gameStarted: true } as AtuanLaterActProgress
  const outcome = resolveAtuanLaterActOutcome(progress)
  return outcome.ending.id === endingId ? { submission: parsed.data, outcome } : null
}

export function atuanLaterActStoryAnswers(submission: AtuanLaterActSubmission) {
  const base = [
    { questionId: 'atuan-later-act:approach', optionId: submission.approachId, tags: ['story_path', ATUAN_LATER_ACT_VERSION, submission.unitId] },
    { questionId: 'atuan-later-act:arrival-reply', optionId: submission.arrivalReplyId, tags: ['story_path', ATUAN_LATER_ACT_VERSION, submission.unitId] },
    { questionId: 'atuan-later-act:followup', optionId: submission.followupId, tags: ['story_path', ATUAN_LATER_ACT_VERSION, submission.unitId] },
    { questionId: 'atuan-later-act:action', optionId: submission.actionId, tags: ['story_path', ATUAN_LATER_ACT_VERSION, submission.unitId] },
    { questionId: 'atuan-later-act:ending', optionId: submission.endingId, tags: ['story_path', ATUAN_LATER_ACT_VERSION, submission.unitId] },
    ...submission.highlightOrder.map((optionId) => ({ questionId: 'atuan-later-act:highlight', optionId, tags: ['story_memory', ATUAN_LATER_ACT_VERSION, submission.unitId] })),
  ]
  if (submission.unitId === 's1-p2-atuan') {
    return [
      ...base,
      { questionId: 'atuan-later-act:game:plan', optionId: 'upright', tags: ['story_memory', ATUAN_LATER_ACT_VERSION, submission.unitId] },
      { questionId: 'atuan-later-act:game:chair-gap', optionId: submission.game.chairGap, tags: ['story_memory', ATUAN_LATER_ACT_VERSION, submission.unitId] },
    ]
  }
  return [
    ...base,
    { questionId: 'atuan-later-act:game:box', optionId: 'unlocked', tags: ['story_memory', ATUAN_LATER_ACT_VERSION, submission.unitId] },
    { questionId: 'atuan-later-act:game:invitation', optionId: 'placed_on_plan', tags: ['story_memory', ATUAN_LATER_ACT_VERSION, submission.unitId] },
    { questionId: 'atuan-later-act:game:atuan-seat', optionId: 'placed', tags: ['story_memory', ATUAN_LATER_ACT_VERSION, submission.unitId] },
    { questionId: 'atuan-later-act:game:other-seat', optionId: submission.game.otherSeat, tags: ['story_memory', ATUAN_LATER_ACT_VERSION, submission.unitId] },
  ]
}
