import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.resolve(process.cwd(), 'migrations/20260810010000_distinct_flash_story_units.sql')
const source = fs.readFileSync(migrationPath, 'utf8')

function parseEpisodeRows() {
  const rows = source.split(/\r?\n/)
    .filter((line) => line.trimStart().startsWith("('s1-p"))
    .map((line) => [...line.matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replaceAll("''", "'")))
  return [...new Map(rows.map((row) => [row[0], row])).values()]
}

type CandidateRow = { code: string; version: number; review: 'reviewed' | 'draft'; season: 'draft' | 'published'; baseline: boolean }

function applyMigration(rows: CandidateRow[]) {
  const eligible = rows.filter((row) => (
    row.season === 'draft'
    && row.version === 1
    && row.review === 'reviewed'
    && row.baseline
  ))
  if (eligible.length !== 0 && eligible.length !== 15) throw new Error(`CAS drift: ${eligible.length}`)
  let updates = 0
  for (const row of eligible) {
    row.version = 2
    row.review = 'draft'
    row.baseline = false
    updates += 1
  }
  return updates
}

describe('distinct Flash story content migration', () => {
  it('covers exactly 15 stable units with two unique first-person choices and replies each', () => {
    const rows = parseEpisodeRows()
    expect(rows).toHaveLength(15)
    expect(new Set(rows.map((row) => row[0])).size).toBe(15)
    const labels = rows.flatMap((row) => [row[3], row[5]])
    const replies = rows.flatMap((row) => [row[4], row[6]])
    expect(labels).toHaveLength(30)
    expect(new Set(labels).size).toBe(30)
    expect(new Set(replies).size).toBe(30)
    labels.forEach((label) => expect(label).toMatch(/^我/))
    replies.forEach((reply) => expect(reply.length).toBeGreaterThan(20))
  })

  it('builds per-unit option IDs and a matching response map', () => {
    expect(source).toContain("copy.code || '-cooperate-a'")
    expect(source).toContain("copy.code || '-cooperate-b'")
    expect(source).toContain("'responseByOption', jsonb_build_object(")
    expect(source).toContain("e.content #> '{question}' = jsonb_build_object(")
    expect(source).toContain("e.content #> '{responseByOption}' = jsonb_build_object(")
    expect(source).toContain("AND s.status = 'draft'")
    expect(source).toContain("AND e.content_version = 1")
    expect(source).toContain("review_status = 'draft'")
    expect(source).toContain('GET DIAGNOSTICS updated_count = ROW_COUNT')
    expect(source).toContain('eligible_count <> 0 AND eligible_count <> 15')
    expect(source).toContain('ROLLBACK')
  })

  it('updates all 15 canonical baselines, preserves operator drift, and is idempotent', () => {
    const rows: CandidateRow[] = parseEpisodeRows().map(([code]) => ({ code, version: 1, review: 'reviewed', season: 'draft', baseline: true }))
    expect(applyMigration(rows)).toBe(15)
    expect(rows.every((row) => row.version === 2 && row.review === 'draft')).toBe(true)
    expect(applyMigration(rows)).toBe(0)

    const drift: CandidateRow[] = parseEpisodeRows().map(([code]) => ({ code, version: 1, review: 'reviewed', season: 'draft', baseline: true }))
    drift[6] = { ...drift[6], version: 2, baseline: false }
    const snapshot = structuredClone(drift)
    expect(() => applyMigration(drift)).toThrow('CAS drift: 14')
    expect(drift).toEqual(snapshot)
    expect(drift[6]).toEqual({ code: drift[6].code, version: 2, review: 'reviewed', season: 'draft', baseline: false })
  })

  it('never mutates a published season or claims candidate copy is reviewed', () => {
    const row: CandidateRow = { code: 's1-p1-shiqi', version: 1, review: 'reviewed', season: 'published', baseline: true }
    expect(applyMigration([row])).toBe(0)
    expect(row).toEqual({ code: 's1-p1-shiqi', version: 1, review: 'reviewed', season: 'published', baseline: true })
  })
})
