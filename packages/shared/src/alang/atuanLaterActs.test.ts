import { describe, expect, it } from 'vitest'
import {
  ATUAN_LATER_ACT_VERSION,
  atuanLaterActStoryAnswers,
  createAtuanLaterActProgress,
  resolveAtuanLaterActOutcome,
  restoreAtuanLaterActProgress,
  toAtuanLaterActSubmission,
  validateAtuanLaterActSubmission,
} from './atuanLaterActs'
import { flashAnswerRequestSchema } from './flashTypes'

describe('Atuan later-act story paths', () => {
  it('requires all three scene highlights and the completed second-act spacing game', () => {
    const progress = createAtuanLaterActProgress('s1-p2-atuan', 'read_plan_first')

    expect(progress).toMatchObject({ arrivalReplyId: null, gameStarted: false })

    expect(() => resolveAtuanLaterActOutcome({
      ...progress,
      arrivalReplyId: 'ask_fold_history',
      highlightOrder: ['plan_folds', 'chair_scuffs', 'blank_place'],
      followupId: 'name_wish',
      gameStarted: false,
      game: { planUpright: true, chairGap: null, attempts: 1 },
    })).toThrow('ATUAN_LATER_ACT_INCOMPLETE')

    const outcome = resolveAtuanLaterActOutcome({
      ...progress,
      arrivalReplyId: 'ask_fold_history',
      highlightOrder: ['plan_folds', 'chair_scuffs', 'blank_place'],
      followupId: 'name_wish',
      gameStarted: true,
      game: { planUpright: true, chairGap: 'breathing', attempts: 2 },
    })
    const submission = toAtuanLaterActSubmission(outcome.progress)

    expect(submission).toMatchObject({
      version: ATUAN_LATER_ACT_VERSION,
      unitId: 's1-p2-atuan',
      approachId: 'read_plan_first',
      arrivalReplyId: 'ask_fold_history',
      actionId: 'arrange_seating_plan',
      endingId: 'invitation_named',
      game: { planUpright: true, chairGap: 'breathing', attempts: 2 },
    })
    expect(validateAtuanLaterActSubmission('s1-p2-atuan', submission)?.outcome.responseCopy).toContain('邀请')
    expect(validateAtuanLaterActSubmission('s1-p3-atuan', submission)).toBeNull()
  })

  it('keeps the other seat blank in the third act instead of answering for Momo', () => {
    const progress = createAtuanLaterActProgress('s1-p3-atuan', 'open_box_first')
    const outcome = resolveAtuanLaterActOutcome({
      ...progress,
      arrivalReplyId: 'ask_sixth_card',
      highlightOrder: ['box_key', 'sixth_card', 'empty_seat'],
      followupId: 'leave_answer',
      gameStarted: true,
      game: { boxUnlocked: true, invitationPlaced: true, atuanNamePlaced: true, otherSeat: 'blank', attempts: 1 },
    })
    const submission = toAtuanLaterActSubmission(outcome.progress)
    const answers = atuanLaterActStoryAnswers(submission)

    expect(submission.endingId).toBe('answer_left_open')
    expect(answers).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'atuan-later-act:arrival-reply', optionId: 'ask_sixth_card' }),
      expect.objectContaining({ questionId: 'atuan-later-act:action', optionId: 'open_returned_card' }),
      expect.objectContaining({ questionId: 'atuan-later-act:game:other-seat', optionId: 'blank' }),
      expect.objectContaining({ questionId: 'atuan-later-act:highlight', optionId: 'sixth_card' }),
    ]))
    expect(flashAnswerRequestSchema.safeParse({
      questionId: 's1-p3-atuan-question',
      optionId: 'option-a',
      storyPath: submission,
    }).success).toBe(true)
  })

  it('rejects stale versions, duplicate highlights, and incomplete local recovery', () => {
    const progress = createAtuanLaterActProgress('s1-p2-atuan', 'ask_invitation')

    expect(restoreAtuanLaterActProgress('s1-p2-atuan', { ...progress, version: 'old' })).toBeNull()
    expect(restoreAtuanLaterActProgress('s1-p2-atuan', {
      ...progress,
      highlightOrder: ['plan_folds', 'plan_folds'],
    })).toBeNull()
    expect(restoreAtuanLaterActProgress('s1-p2-atuan', {
      ...progress,
      arrivalReplyId: 'ask_fold_history',
    })).toBeNull()
    expect(restoreAtuanLaterActProgress('s1-p2-atuan', {
      ...progress,
      highlightOrder: ['plan_folds'],
    })).toBeNull()
    expect(restoreAtuanLaterActProgress('s1-p3-atuan', progress)).toBeNull()
  })
})
