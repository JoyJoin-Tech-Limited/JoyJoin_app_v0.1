import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlashAssignmentResponse, FlashHomeResponse, FlashPreferenceDto } from '@shared/alang/flashTypes'
import {
  adaptFlashHomeDto,
  adaptFlashLocateDto,
  adaptFlashAssignmentDto,
  adaptFlashEncounterDto,
  adaptFlashStoryArchiveDto,
  fetchFlashHome,
  fetchFlashStoryArchive,
  getFlashApiErrorCode,
  respondToFlashTaskOffer,
  submitFlashFeedback,
  submitFlashStoryInteraction,
  updateFlashPreferences,
} from './flashApi'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../api/api', () => ({ apiRequest: mocks.apiRequest }))

const preference: FlashPreferenceDto = {
  personalizationEnabled: true,
  usePersonality: true,
  useInterests: true,
  useIndustry: false,
  useDistrict: true,
  useTaskBehavior: false,
  consentVersion: 'v1',
  consentedAt: '2026-07-20T12:00:00+08:00',
  tags: [],
}

const destination = {
  name: '南头古城', city: '深圳' as const, district: '南山区', address: '南山大道附近',
  latitude: 22.538, longitude: 113.923, coordinateSystem: 'gcj02' as const,
}

const task = {
  id: '11111111-1111-4111-8111-111111111111',
  npc: { id: 'npc-1', slug: 'alang', name: '阿浪', avatarUrl: null },
  code: 'T01', category: '城市观察', title: '看看旧街的招牌', brief: '去附近看看。', instructions: '待一小会儿。',
  destination, status: 'arrived' as const, expiresAt: '2026-07-27T12:00:00+08:00',
  arrivedAt: '2026-07-20T13:00:00+08:00', feedbackSubmittedAt: null, deliveredAt: null,
  canonicalScreen: 'feedback' as const,
}

const assignmentResponse: FlashAssignmentResponse = {
  task,
  feedbackPrompts: [{ id: 'prompt-1', prompt: '第一感觉是？', options: [{ id: 'quiet', label: '安静' }] }],
  canonicalScreen: 'feedback',
}

describe('formal Flash shared-contract adapter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserves the active appearance destination and live distance', () => {
    const view = adaptFlashLocateDto({
      appearanceId: 'appearance-1',
      destination: { latitude: 22.5432, longitude: 114.0578, coordinateSystem: 'gcj02' },
      distanceMeters: 83,
      targetBearingDegrees: 91,
      proximityBand: 'near',
      signal: 'searching',
      arrived: false,
      encounterId: null,
      canonicalScreen: 'map',
    })
    expect(view).toMatchObject({
      distanceMeters: 83,
      targetBearingDegrees: 91,
      proximityBand: 'near',
      withinRange: false,
      destination: { latitude: 22.5432, longitude: 114.0578, coordinateSystem: 'gcj02' },
    })
  })

  it('adapts the canonical nested home DTO into renderer-only view data', () => {
    const dto: FlashHomeResponse = {
      serverNow: '2026-07-20T12:00:00+08:00', city: '深圳', digitalNpcDisclosure: '数字叙事角色',
      encounterId: null, assignmentId: null,
      onlineNpcs: [{
        appearanceId: 'appearance-1',
        npc: {
          id: 'npc-1', slug: 'alang', name: '阿浪', species: '灰狼', personalitySummary: '好奇',
          inviteLine: '替我去看看？', themeColor: '#6E7891', avatarUrl: null,
        },
        district: '南山区', locationAddress: '南头古城开放公共街巷', endsAt: '2026-07-20T14:00:00+08:00', remainingMinutes: 90, canonicalScreen: 'map',
      }],
      myTasks: [task], preferenceSummary: preference, canonicalScreen: 'home',
    }

    expect(adaptFlashHomeDto(dto)).toMatchObject({
      onlineNpcs: [{
        appearanceId: 'appearance-1', name: '阿浪', animal: '灰狼', invitation: '替我去看看？',
        districtName: '南山区', locationAddress: '南头古城开放公共街巷', remainingSeconds: 5400,
      }],
      myTasks: [{ assignmentId: task.id, destinationName: '南头古城' }],
      preferenceSummary: { personalizationEnabled: true, activeSourceCount: 3, tagCount: 0 },
    })
  })

  it('preserves a manual hold without inventing an end time or countdown', () => {
    const dto: FlashHomeResponse = {
      serverNow: '2026-08-08T15:00:00Z', city: '深圳', digitalNpcDisclosure: '数字叙事角色',
      encounterId: null, assignmentId: null,
      onlineNpcs: [{
        appearanceId: 'manual-appearance-1',
        npc: {
          id: 'npc-1', slug: 'shiqi', name: '拾柒', species: '黑猫', personalitySummary: '安静',
          inviteLine: '来找我。', themeColor: '#8B5CF6', avatarUrl: null,
        },
        district: '南山区', locationAddress: '深圳人才公园开放公共区域',
        endsAt: null, remainingMinutes: null, availabilityMode: 'manual_hold', canonicalScreen: 'map',
      }],
      myTasks: [], preferenceSummary: preference, canonicalScreen: 'home',
    }

    expect(adaptFlashHomeDto(dto).onlineNpcs[0]).toMatchObject({
      appearanceId: 'manual-appearance-1',
      availabilityMode: 'manual_hold',
      endsAt: undefined,
      remainingSeconds: undefined,
    })
  })

  it('loads the home list without sending a location payload', async () => {
    const dto: FlashHomeResponse = {
      serverNow: '2026-07-20T12:00:00+08:00', city: '深圳', digitalNpcDisclosure: '数字叙事角色',
      encounterId: null, assignmentId: null,
      onlineNpcs: [], myTasks: [], preferenceSummary: preference, canonicalScreen: 'home',
    }
    mocks.apiRequest.mockResolvedValue(dto)
    await fetchFlashHome()

    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/alang/flash/home', method: 'POST',
    })
  })

  it('adapts canonical encounter question/offer field names', () => {
    const view = adaptFlashEncounterDto({
      id: 'encounter-1',
      npc: {
        id: 'npc-1', slug: 'lizi', name: '栗子', species: '水獭', personalitySummary: '热情',
        themeColor: '#C77D58', avatarUrl: null,
      },
      expiresAt: '2026-07-21T12:00:00+08:00', status: 'offered', pendingDelivery: null,
      questionPosition: { current: 1, total: 2 },
      question: { id: 'q1', prompt: '更想去哪里？', options: [{ id: 'quiet', label: '安静的地方' }] },
      offer: {
        templateId: 'template-1', code: 'T02', category: '探店', title: '替我看看那家店', brief: '到附近看看。',
        requestCopy: '我一直没去过，可以替我看看吗？',
        destinationPreview: { name: '一家小店', district: '福田区' }, canReroll: true,
      },
      canonicalScreen: 'dialogue',
    })
    expect(view).toMatchObject({
      encounterId: 'encounter-1',
      currentQuestion: { id: 'q1', text: '更想去哪里？' },
      taskOffer: { title: '替我看看那家店', invitation: '我一直没去过，可以替我看看吗？' },
      canReroll: true,
    })
  })

  it('adapts canonical assignment task/feedbackPrompts nesting', () => {
    expect(adaptFlashAssignmentDto(assignmentResponse)).toMatchObject({
      assignmentId: task.id,
      title: '看看旧街的招牌',
      description: '待一小会儿。',
      destination: { latitude: 22.538, longitude: 113.923 },
      feedbackQuestions: [{ promptId: 'prompt-1', prompt: '第一感觉是？' }],
    })
  })

  it('uses the shared promptId/privateReply feedback body', async () => {
    mocks.apiRequest.mockResolvedValue(assignmentResponse)
    await submitFlashFeedback({
      assignmentId: task.id,
      answers: [{ promptId: 'prompt-1', optionId: 'quiet' }],
      privateReply: '这里比我想象中安静。',
    })

    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: `/api/alang/flash/assignments/${task.id}/feedback`, method: 'POST',
      data: { answers: [{ promptId: 'prompt-1', optionId: 'quiet' }], privateReply: '这里比我想象中安静。' },
    })
  })

  it('turns an accepted assignment response into a canonical task route snapshot', async () => {
    mocks.apiRequest.mockResolvedValue({ ...assignmentResponse, canonicalScreen: 'task' })
    await expect(respondToFlashTaskOffer({ encounterId: 'encounter-1', accepted: true })).resolves.toEqual({
      canonicalScreen: 'task',
      encounterId: 'encounter-1',
      assignmentId: task.id,
    })
  })

  it('uses deleteTagIds from the shared preference schema', async () => {
    mocks.apiRequest.mockResolvedValue(preference)
    await updateFlashPreferences({ deleteTagIds: [task.id] })
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'PUT', data: { deleteTagIds: [task.id] },
    }))
  })

  it('recovers stable API error codes', () => {
    expect(getFlashApiErrorCode({ data: { code: 'FLASH_APPEARANCE_ENDED' } })).toBe('FLASH_APPEARANCE_ENDED')
    expect(getFlashApiErrorCode(new Error('Request failed: FLASH_TASK_EXPIRED'))).toBe('FLASH_TASK_EXPIRED')
  })

  it('submits an interaction result with exactly { nodeId, resultId } — no traces, coordinates or free text (AC-03)', async () => {
    mocks.apiRequest.mockResolvedValueOnce({
      id: 'encounter-1',
      npc: { id: 'npc-1', slug: 'alang', name: '阿浪', species: '灰狼', personalitySummary: '', themeColor: '#000', avatarUrl: null },
      expiresAt: '2026-08-25T12:00:00.000Z',
      status: 'accepted',
      pendingDelivery: null,
      question: null,
      questionPosition: null,
      offer: null,
      storyEpisode: null,
      canonicalScreen: 'dialogue',
    })

    await submitFlashStoryInteraction({ encounterId: 'encounter-1', nodeId: 'n2_action', resultId: 'aligned' })

    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/alang/flash/encounters/encounter-1/story-interaction',
      method: 'POST',
      data: { nodeId: 'n2_action', resultId: 'aligned' },
    })
  })

  it('adapts the archive DTO without inventing fields beyond the sanitized contract (SEC-02)', async () => {
    const dto = {
      season: { id: 'season-1', code: 's1', title: '没有名字的旧物' },
      fragments: [{
        id: 'frag-1', code: 's1-p1-alang-fragment', category: 'object' as const,
        title: '迟到的出发', fact: '这本册子不是没被想起。', assetUrl: null,
        unlockedAt: '2026-08-20T10:00:00.000Z', episodeTitle: '一张画了两把椅子的图', npcName: '阿浪',
      }],
      imprints: [{ unitId: 's1-p1-alang', template: 'spacing' as const, resultId: 'aligned', settledAt: '2026-08-20T10:00:00.000Z' }],
      hookHint: '阿浪听到过金属碰过木板的声音。',
      completedUnitIds: ['s1-p1-alang'],
    }

    const view = adaptFlashStoryArchiveDto(dto)
    expect(view.season?.code).toBe('s1')
    expect(view.fragments[0]).toEqual({
      id: 'frag-1', code: 's1-p1-alang-fragment', category: 'object',
      title: '迟到的出发', fact: '这本册子不是没被想起。', assetUrl: null,
      unlockedAt: '2026-08-20T10:00:00.000Z', episodeTitle: '一张画了两把椅子的图', npcName: '阿浪',
    })
    expect(view.imprints[0]).toEqual({ unitId: 's1-p1-alang', template: 'spacing', resultId: 'aligned', settledAt: '2026-08-20T10:00:00.000Z' })
    expect(view.hookHint).toContain('金属')
    expect(view.completedUnitIds).toEqual(['s1-p1-alang'])
    expect(view.fragments[0]).not.toHaveProperty('encounterId')

    mocks.apiRequest.mockResolvedValueOnce(dto)
    await fetchFlashStoryArchive()
    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/alang/flash/story/archive',
      method: 'GET',
    })
  })
})
