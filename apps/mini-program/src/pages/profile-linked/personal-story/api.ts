import { apiRequest } from '../../../lib/api/api'
import type {
  PersonalStoryChapterView as PersonalStoryChapter,
  PersonalStoryClientUpdateStatus as PersonalStoryUpdateStatus,
  PersonalStoryDocument,
  PersonalStoryResponse,
  PersonalStoryUpdateJobView as PersonalStoryUpdateJob,
  PersonalStoryUpdateResponse,
} from '@joyjoin/shared'

export const PERSONAL_STORY_QUERY_KEY = ['mini-program', 'personal-story'] as const
export const PERSONAL_STORY_POLL_INTERVAL_MS = 3_000

export type {
  PersonalStoryChapter,
  PersonalStoryDocument,
  PersonalStoryResponse,
  PersonalStoryUpdateJob,
  PersonalStoryUpdateResponse,
  PersonalStoryUpdateStatus,
}

export function isPersonalStoryUpdatePending(status?: PersonalStoryUpdateStatus | null): boolean {
  return status === 'pending' || status === 'queued' || status === 'running'
}

export async function fetchPersonalStory(): Promise<PersonalStoryResponse> {
  return apiRequest<PersonalStoryResponse>({
    path: '/api/personal-story',
    method: 'GET',
  })
}

/**
 * The server derives ownership from the authenticated session. Deliberately do
 * not accept a user id here, so this screen cannot request another person's story.
 */
export async function requestPersonalStoryUpdate(): Promise<PersonalStoryUpdateResponse> {
  return apiRequest<PersonalStoryUpdateResponse>({
    path: '/api/personal-story/update',
    method: 'POST',
  })
}
