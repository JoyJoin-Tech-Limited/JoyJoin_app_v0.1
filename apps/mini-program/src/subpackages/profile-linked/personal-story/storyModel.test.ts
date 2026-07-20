import { describe, expect, it } from 'vitest'
import type { PersonalStoryChapter, PersonalStoryDocument } from './api'
import {
  getPersonalStoryPreview,
  mergePersonalStory,
  sortPersonalStoryChapters,
  splitPersonalStoryBody,
} from './storyModel'

function chapter(overrides: Partial<PersonalStoryChapter>): PersonalStoryChapter {
  return {
    id: 'chapter-default',
    occurredAt: '2026-07-12T18:00:00+08:00',
    activityType: '城市同行',
    title: '晚风里的一段路',
    body: '这是正文。',
    aigc: { aiGenerated: true, labelType: 'ai-generated' },
    ...overrides,
  }
}

function story(chapters: PersonalStoryChapter[], title = '我的故事'): PersonalStoryDocument {
  return { title, updatedAt: '2026-07-12T18:00:00+08:00', chapters }
}

describe('personal story model', () => {
  it('sorts chapters from the oldest experience to the newest', () => {
    const result = sortPersonalStoryChapters([
      chapter({ id: 'new', occurredAt: '2026-07-14T18:00:00+08:00' }),
      chapter({ id: 'old', occurredAt: '2026-06-01T18:00:00+08:00' }),
      chapter({ id: 'middle', occurredAt: '2026-07-01T18:00:00+08:00' }),
    ])

    expect(result.map(({ id }) => id)).toEqual(['old', 'middle', 'new'])
  })

  it('keeps every old chapter when a background update returns a partial snapshot', () => {
    const previous = story([
      chapter({ id: 'first', title: '第一章' }),
      chapter({ id: 'second', title: '第二章' }),
    ])
    const incoming = story([
      chapter({ id: 'second', title: '第二章（修订）' }),
      chapter({ id: 'third', title: '第三章', occurredAt: '2026-07-15T18:00:00+08:00' }),
    ], '仍是同一本故事')

    const result = mergePersonalStory(previous, incoming)

    expect(result?.title).toBe('仍是同一本故事')
    expect(result?.chapters.map(({ id }) => id)).toEqual(['first', 'second', 'third'])
    expect(result?.chapters[1].title).toBe('第二章（修订）')
  })

  it('derives readable preview and paragraphs without exposing empty system state', () => {
    const item = chapter({ preview: '  ', body: '第一段。\n\n第二段。' })

    expect(getPersonalStoryPreview(item)).toBe('第一段。 第二段。')
    expect(splitPersonalStoryBody(item.body)).toEqual(['第一段。', '第二段。'])
  })
})
