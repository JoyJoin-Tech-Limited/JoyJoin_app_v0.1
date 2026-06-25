export interface ProfessionResponseClassification {
  category: { id: string; label: string } | null
  segment: { id: string; label: string } | null
  niche: { id: string; label: string } | null
  standardizedOccupationId: string | null
}

export interface ProfessionResponseLike {
  classification: ProfessionResponseClassification
  source?: string | null
  confidence?: number | null
  displayTags?: string[] | null
}

export interface StoredProfessionClassificationLike {
  occupationId?: string | null
  standardizedOccupationId?: string | null
  industryCategory?: string | null
  industrySegmentNew?: string | null
  industryNiche?: string | null
  industrySource?: string | null
  industryConfidence?: number | null
}

const MIN_STRUCTURED_CONFIDENCE = 0.35

export function normalizeProfessionSubmissionKey(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function hasStructuredProfessionResponse(data: ProfessionResponseLike | null | undefined): boolean {
  const classification = data?.classification
  return !!(
    classification?.standardizedOccupationId ||
    classification?.category?.id ||
    classification?.segment?.id ||
    classification?.niche?.id
  )
}

export function isUsableProfessionResponse(data: ProfessionResponseLike | null | undefined): boolean {
  if (!data) return false
  if (!hasStructuredProfessionResponse(data)) return false
  const source = data.source ?? ''
  if (source.includes('fallback')) return false
  const confidence = data.confidence ?? 0
  return confidence >= MIN_STRUCTURED_CONFIDENCE
}

export function isUsableStoredProfessionClassification(
  data: StoredProfessionClassificationLike | null | undefined,
): boolean {
  if (!data) return false
  if (data.industrySource?.includes('fallback')) return false
  if ((data.industryConfidence ?? 0) < MIN_STRUCTURED_CONFIDENCE) return false
  return !!(
    data.standardizedOccupationId ||
    data.industryCategory ||
    data.industrySegmentNew ||
    data.industryNiche
  )
}

export function isDuplicateProfessionSubmission(
  input: string,
  classification: StoredProfessionClassificationLike | null | undefined,
): boolean {
  if (!classification?.occupationId) return false
  return normalizeProfessionSubmissionKey(input) === normalizeProfessionSubmissionKey(classification.occupationId)
}

export function dedupeProfessionTags(tags: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags ?? []) {
    const normalized = tag.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}
