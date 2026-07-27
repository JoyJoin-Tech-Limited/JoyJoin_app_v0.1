import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlashAssignmentResponse, FlashHomeResponse, FlashPreferenceDto } from '@shared/alang/flashTypes'
import {
  adaptFlashHomeDto,
  adaptFlashAssignmentDto,
  adaptFlashEncounterDto,
  fetchFlashHome,
  FLASH_LOCATION_TIMEOUT_MS,
  FLASH_SETTING_TIMEOUT_MS,
  getFlashApiErrorCode,
  getFlashLocationPermission,
  getOneShotFlashLocation,
  respondToFlashTaskOffer,
  submitFlashFeedback,
  updateFlashPreferences,
} from './flashApi'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  getLocation: vi.fn(),
  getSetting: vi.fn(),
}))
vi.mock('../api/api', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('@tarojs/taro', () => ({
  default: {
    getLocation: mocks.getLocation,
    getSetting: mocks.getSetting,
  },
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
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
        district: '南山区', endsAt: '2026-07-20T14:00:00+08:00', remainingMinutes: 90, canonicalScreen: 'radar',
      }],
      myTasks: [task], preferenceSummary: preference, canonicalScreen: 'home',
    }

    expect(adaptFlashHomeDto(dto)).toMatchObject({
      onlineNpcs: [{
        appearanceId: 'appearance-1', name: '阿浪', animal: '灰狼', invitation: '替我去看看？',
        districtName: '南山区', remainingSeconds: 5400,
      }],
      myTasks: [{ assignmentId: task.id, destinationName: '南头古城' }],
      preferenceSummary: { personalizationEnabled: true, activeSourceCount: 3, tagCount: 0 },
    })
  })

  it('sends home coordinates only in a POST body under the shared contract', async () => {
    const dto: FlashHomeResponse = {
      serverNow: '2026-07-20T12:00:00+08:00', city: '深圳', digitalNpcDisclosure: '数字叙事角色',
      encounterId: null, assignmentId: null,
      onlineNpcs: [], myTasks: [], preferenceSummary: preference, canonicalScreen: 'home',
    }
    mocks.apiRequest.mockResolvedValue(dto)
    await fetchFlashHome({ latitude: 22.5431, longitude: 114.0579, accuracy: 18 })

    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/alang/flash/home', method: 'POST',
      data: { latitude: 22.5431, longitude: 114.0579, coordinateSystem: 'gcj02' },
    })
    expect(mocks.apiRequest.mock.calls[0][0].path).not.toMatch(/22\.5431|114\.0579/)
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
      deliveryMessage: '你真的去了呀，谢谢你替我看见那一小块地方。',
      message: null,
      canonicalScreen: 'dialogue',
    })
    expect(view).toMatchObject({
      encounterId: 'encounter-1',
      currentQuestion: { id: 'q1', text: '更想去哪里？' },
      taskOffer: { title: '替我看看那家店', invitation: '我一直没去过，可以替我看看吗？' },
      canReroll: true,
      deliveryMessage: '你真的去了呀，谢谢你替我看见那一小块地方。',
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

  it('times out when getSetting never resolves', async () => {
    vi.useFakeTimers()
    mocks.getSetting.mockReturnValue(new Promise(() => undefined))

    const pending = getFlashLocationPermission()
    await vi.advanceTimersByTimeAsync(FLASH_SETTING_TIMEOUT_MS)

    await expect(pending).resolves.toBe('timeout')
  })

  it('times out when getLocation never calls success or fail', async () => {
    vi.useFakeTimers()
    mocks.getLocation.mockImplementation(() => undefined)

    const pending = getOneShotFlashLocation()
    const rejection = expect(pending).rejects.toMatchObject({
      code: 'FLASH_LOCATION_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(FLASH_LOCATION_TIMEOUT_MS)

    await rejection
  })
})
