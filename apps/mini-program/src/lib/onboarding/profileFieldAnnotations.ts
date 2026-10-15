/**
 * 「悦仔记住的」deterministic annotation copy for the profile-review expanded
 * detail card (sprint entry-card-insight-v2, AC-09 / D6; Amendment A1 AC-17;
 * Amendment A2 AC-21④).
 *
 * Every annotation is a template function of the field's already-confirmed
 * value — zero LLM, zero network. Unmapped fields fall back to a graceful
 * generic line so the section never renders blank.
 *
 * AC-17 softening: annotations are pure-memory narrative. They must NOT
 * promise behaviour the matching engine does not deliver — no 「优先帮你留意」,
 * no 「替你把握」, nothing that pledges a matching outcome.
 *
 * AC-21④ prefix dedup: the 「悦仔记住的」 marker is rendered ONCE at section
 * level by the page. Builders therefore carry no 悦仔 subject — saying it in
 * every field block read as repetition.
 *
 * Copy constraints (AC-12): no emoji, no 匹配/社交/灵魂/AI wording.
 */

export type ProfileAnnotationFieldLabel = '家乡' | '关系状态' | '学历' | '职业' | '行业'

type AnnotationBuilder = (value: string) => string

const FIELD_ANNOTATION_BUILDERS: Record<ProfileAnnotationFieldLabel, AnnotationBuilder> = {
  // AC-17: pure-memory narrative, no matching-behaviour promises.
  家乡: (value) => `${value}，老乡见老乡，话总会多几句`,
  // Relationship status is sensitive: do not echo the value, just acknowledge.
  关系状态: () => '这一栏先记着，之后会用得上',
  学历: (value) => `${value}的经历，都收进这张卡了`,
  职业: (value) => `${value}的日常，就是你最好的话题底气`,
  行业: (value) => `${value}这一行，同行和好奇的人都有得聊`,
}

const GENERIC_FIELD_ANNOTATION = '这一条也收好了，之后会用得上'

/**
 * Resolve the deterministic 「悦仔记住的」 annotation for one 小档案 field.
 * Returns the generic fallback for unmapped labels or empty values.
 */
export function getProfileFieldAnnotation(label: string, value: string): string {
  const trimmedValue = value.trim()
  if (trimmedValue === '') {
    return GENERIC_FIELD_ANNOTATION
  }

  const builder = FIELD_ANNOTATION_BUILDERS[label as ProfileAnnotationFieldLabel]
  if (!builder) {
    return GENERIC_FIELD_ANNOTATION
  }

  const built = builder(trimmedValue)
  return built.trim() !== '' ? built : GENERIC_FIELD_ANNOTATION
}

/**
 * Deterministic conclusion sentence prepended to the 兴趣热量地图 section
 * (AC-09): cites the top interest labels, e.g. 「你把最多的热量给了探店和私厨」.
 * Returns null when there is nothing to cite (section renders without it).
 */
export function buildInterestHeatConclusion(topInterestLabels: string[]): string | null {
  const cited = topInterestLabels
    .map((label) => (typeof label === 'string' ? label.trim() : ''))
    .filter((label) => label !== '')
    .slice(0, 2)

  if (cited.length === 0) {
    return null
  }

  return cited.length === 1
    ? `你把最多的热量给了${cited[0]}`
    : `你把最多的热量给了${cited[0]}和${cited[1]}`
}
