import { describe, it, expect } from 'vitest'
import { buildEntryCardInterestFacts } from '../entryCardFacts'
import type {
  StructuredInterestSelection,
  StructuredInterestTopPriority,
} from '@shared/api'

function selection(
  topicId: string,
  label: string,
  level: 1 | 2 | 3,
  heat: 3 | 10 | 25,
): StructuredInterestSelection {
  return {
    topicId,
    emoji: '',
    label,
    fullName: label,
    category: '美食小酌',
    categoryId: 'food',
    level,
    heat,
  }
}

function priority(topicId: string, label: string): StructuredInterestTopPriority {
  return { topicId, label, heat: 25 }
}

describe('buildEntryCardInterestFacts', () => {
  it('ranks real selections by level, then heat, then stable topic id', () => {
    const facts = buildEntryCardInterestFacts({
      selections: [
        selection('b', '桌游', 2, 10),
        selection('a', '火锅', 1, 3),
        selection('c', '探店', 3, 25),
        selection('d', '徒步', 2, 10),
      ],
      topPriorities: null,
    })

    expect(facts.items.map((item) => item.label)).toEqual(['探店', '桌游', '徒步', '火锅'])
    expect(facts.total).toBe(4)
  })

  it('dedupes by topic id and keeps the strongest level and heat', () => {
    const facts = buildEntryCardInterestFacts({
      selections: [selection('hotpot', '火锅', 2, 10)],
      topPriorities: [priority('hotpot', '火锅')],
    })

    expect(facts.total).toBe(1)
    expect(facts.items[0]).toMatchObject({ level: 3, heat: 25 })
  })

  it('fills a missing label from the other source instead of dropping the row', () => {
    const facts = buildEntryCardInterestFacts({
      selections: [selection('hotpot', '火锅', 2, 10)],
      topPriorities: [{ topicId: 'hotpot', label: '  ', heat: 25 }],
    })

    expect(facts.items).toEqual([{ topicId: 'hotpot', label: '火锅', level: 3, heat: 25 }])
  })

  it('supports topPriorities-only payloads as level 3 rows', () => {
    const facts = buildEntryCardInterestFacts({
      selections: [],
      topPriorities: [priority('n1', '咖啡'), priority('n2', '电影')],
    })

    expect(facts.items).toEqual([
      { topicId: 'n1', label: '咖啡', level: 3, heat: 25 },
      { topicId: 'n2', label: '电影', level: 3, heat: 25 },
    ])
  })

  it('drops blank ids and labels without inventing rows', () => {
    const facts = buildEntryCardInterestFacts({
      selections: [
        selection('', '空 id', 3, 25),
        selection('blank', '   ', 2, 10),
      ],
      topPriorities: [priority('also-blank', '  ')],
    })

    expect(facts).toEqual({ items: [], all: [], total: 0 })
  })

  it('caps the card-face rows while keeping the full ranked list and true total', () => {
    const facts = buildEntryCardInterestFacts({
      selections: [
        selection('a', 'A', 3, 25),
        selection('b', 'B', 3, 25),
        selection('c', 'C', 2, 10),
        selection('d', 'D', 2, 10),
        selection('e', 'E', 1, 3),
      ],
    })

    expect(facts.items).toHaveLength(4)
    expect(facts.all).toHaveLength(5)
    expect(facts.total).toBe(5)
    expect(facts.items.map((item) => item.topicId)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('handles null, undefined, and an explicit zero limit', () => {
    expect(buildEntryCardInterestFacts(null)).toEqual({ items: [], all: [], total: 0 })
    expect(buildEntryCardInterestFacts(undefined)).toEqual({ items: [], all: [], total: 0 })
    expect(
      buildEntryCardInterestFacts(
        { selections: [selection('a', 'A', 3, 25)], topPriorities: null },
        0,
      ).items,
    ).toEqual([])
  })
})
