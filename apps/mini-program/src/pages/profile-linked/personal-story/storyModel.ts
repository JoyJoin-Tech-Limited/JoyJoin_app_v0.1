import type { PersonalStoryChapter, PersonalStoryDocument } from './api'

function timestamp(value?: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

export function sortPersonalStoryChapters(
  chapters: readonly PersonalStoryChapter[],
): PersonalStoryChapter[] {
  return chapters
    .map((chapter, index) => ({ chapter, index }))
    .sort((left, right) => {
      const timeDifference = timestamp(left.chapter.occurredAt) - timestamp(right.chapter.occurredAt)
      return timeDifference === 0 ? left.index - right.index : timeDifference
    })
    .map(({ chapter }) => chapter)
}

/**
 * Preserve chapters that have already been readable while a background update
 * is running. The server remains the cross-device authority; this merge prevents
 * a partial polling snapshot from making older chapters disappear in-session.
 */
export function mergePersonalStory(
  previous: PersonalStoryDocument | null,
  incoming: PersonalStoryDocument | null | undefined,
): PersonalStoryDocument | null {
  if (!incoming) return previous
  if (!previous) {
    return { ...incoming, chapters: sortPersonalStoryChapters(incoming.chapters ?? []) }
  }

  const chaptersById = new Map(
    previous.chapters.map((chapter) => [chapter.id, chapter] as const),
  )
  incoming.chapters.forEach((chapter) => chaptersById.set(chapter.id, chapter))

  return {
    ...previous,
    ...incoming,
    chapters: sortPersonalStoryChapters([...chaptersById.values()]),
  }
}

export function formatPersonalStoryUpdatedAt(value?: string | null): string {
  if (!value) return '等下一段经历写进来'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '最近一次相遇之后'
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `更新于 ${date.getMonth() + 1}月${date.getDate()}日 ${hour}:${minute}`
}

export function formatPersonalStoryChapterDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '某次相遇'
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function getPersonalStoryPreview(chapter: PersonalStoryChapter): string {
  const explicitPreview = chapter.preview?.trim()
  if (explicitPreview) return explicitPreview
  const body = chapter.body.replace(/\s+/g, ' ').trim()
  return body || '这一页还留着一点安静，等你重新翻开。'
}

export function splitPersonalStoryBody(body: string): string[] {
  const paragraphs = body
    .split(/\r?\n(?:\s*\r?\n)+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  return paragraphs.length > 0 ? paragraphs : ['这一段经历还在整理文字。']
}
