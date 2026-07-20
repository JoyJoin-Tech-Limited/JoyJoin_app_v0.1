import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPersonalStory,
  isPersonalStoryUpdatePending,
  requestPersonalStoryUpdate,
} from './api'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: mocks.apiRequest,
}))

describe('personal story api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiRequest.mockResolvedValue({
      story: {
        title: '你的故事，正在慢慢长大',
        chapters: [],
      },
      updateJob: null,
      aiEnabled: true,
      canUpdate: true,
    })
  })

  it('loads only the authenticated user personal story', async () => {
    await fetchPersonalStory()

    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/personal-story',
      method: 'GET',
    })
  })

  it('requests a story update without accepting a user id', async () => {
    await requestPersonalStoryUpdate()

    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/personal-story/update',
      method: 'POST',
    })
  })

  it('polls only while the background update is queued or running', () => {
    expect(isPersonalStoryUpdatePending('pending')).toBe(true)
    expect(isPersonalStoryUpdatePending('queued')).toBe(true)
    expect(isPersonalStoryUpdatePending('running')).toBe(true)
    expect(isPersonalStoryUpdatePending('succeeded')).toBe(false)
    expect(isPersonalStoryUpdatePending('failed')).toBe(false)
    expect(isPersonalStoryUpdatePending('disabled')).toBe(false)
  })

  it('uses the server story contract without inventing feature availability', async () => {
    const wireResponse = {
      story: {
        title: '你的故事，正在慢慢长大',
        updatedAt: '2026-07-15T13:00:00.000Z',
        chapters: [{
          id: 'chapter-1',
          title: '2026.07.15 · 闪现',
          body: '这是完整章节。',
          activityType: '闪现',
          occurredAt: '2026-07-15T12:00:00.000Z',
          aigc: { aiGenerated: true, labelType: 'ai-generated' },
        }],
      },
      updateJob: { id: 'job-1', status: 'queued' },
      aiEnabled: false,
      canUpdate: false,
    }
    mocks.apiRequest.mockResolvedValueOnce(wireResponse)

    const response = await fetchPersonalStory()

    expect(response).toEqual(wireResponse)
    expect(response.aiEnabled).toBe(false)
    expect(response.canUpdate).toBe(false)
  })

  it('passes through the update response without inventing a story snapshot', async () => {
    const wireResponse = {
      accepted: true,
      noNewExperiences: false,
      updateJob: {
        id: 'job-2',
        status: 'running',
      },
    }
    mocks.apiRequest.mockResolvedValueOnce(wireResponse)

    await expect(requestPersonalStoryUpdate()).resolves.toEqual(wireResponse)
  })
})
