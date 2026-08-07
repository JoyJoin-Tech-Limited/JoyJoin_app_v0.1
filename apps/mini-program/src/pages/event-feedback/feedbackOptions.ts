/**
 * Preset options for the 均衡反馈 (balanced feedback) layer — the optional
 * upgrade surfaced after the 30-second required flow. All copy follows the
 * JoyJoin voice: warm, playful, never oily.
 *
 * IMPORTANT: connectionStatus / venueStyleRating literals MUST match the
 * server enum in packages/shared/src/schema/_definitions.ts
 * (insertEventFeedbackSchema) exactly — they are the wire values, not labels.
 */

/** connectionStatus enum — wire values (server contract, do not reword). */
export const CONNECTION_STATUS_OPTIONS = [
  '已交换联系方式',
  '有但还没联系',
  '没有但很愉快',
  '没有不太合适',
] as const
export type ConnectionStatusLiteral = (typeof CONNECTION_STATUS_OPTIONS)[number]

/** venueStyleRating enum — wire values (server contract, do not reword). */
export const VENUE_STYLE_OPTIONS = [
  { value: 'like', label: '喜欢' },
  { value: 'neutral', label: '一般' },
  { value: 'dislike', label: '不喜欢' },
] as const
export type VenueStyleLiteral = (typeof VENUE_STYLE_OPTIONS)[number]['value']

/**
 * Attendee trait tags — up to MAX_TAGS_PER_ATTENDEE per person.
 * Purely positive first impressions; constructive notes live in the 悄悄话.
 */
export const ATTENDEE_TRAIT_PRESETS = ['有趣', '会聊天', '温暖', '有想法', '活跃', '同频'] as const
export const MAX_TAGS_PER_ATTENDEE = 3

/**
 * Improvement-area "magic recipe" presets. Each string is both the chip label
 * and the payload value — playful enough to read as a suggestion, precise
 * enough to aggregate. Max MAX_IMPROVEMENT_AREAS per submission.
 */
export const IMPROVEMENT_AREA_PRESETS = [
  '流程安排再多点惊喜',
  '话题引导想聊得更尽兴',
  '场地体验更对味一点',
  '时间节奏再长一点点',
  '匹配质量更同频一些',
  '组织服务更贴心周到',
  '开场破冰更热闹一些',
] as const
export const MAX_IMPROVEMENT_AREAS = 3

/** Atmosphere thermometer labels, index 0 → score 1. */
export const ATMOSPHERE_LABELS = ['尴尬', '平淡', '舒适', '热烈', '完美'] as const

/** Connection radar dimensions — render order top to bottom. */
export const RADAR_DIMENSIONS = [
  { key: 'topicResonance', label: '话题共鸣', hint: '聊到一块儿了吗' },
  { key: 'personalityMatch', label: '性格合拍', hint: '和 TA 们处得舒服吗' },
  { key: 'backgroundDiversity', label: '背景多元', hint: '大家来自不同的世界吗' },
  { key: 'overallFit', label: '整体契合', hint: '这场局像是为你准备的吗' },
] as const
export type RadarKey = (typeof RADAR_DIMENSIONS)[number]['key']
export type ConnectionRadarState = Record<RadarKey, number>
