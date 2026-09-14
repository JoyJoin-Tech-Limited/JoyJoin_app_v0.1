/**
 * Group Mirror (群像镜像) — fallback questions, appreciation guard, and types
 *
 * Players anonymously vote on who best fits each question. Results reveal the
 * "group mirror" — how the group sees each other.
 *
 * W9 (gm-debrief, AC-W9.1): the phase is the final act before recap, so it MUST
 * be appreciation-only. Questions celebrate warm, positive qualities; passive
 * judgment / put-down framings ("谁最不会…", "谁最尴尬…") are rejected at the
 * delivery boundary by `sanitizeGroupMirrorQuestions` and replaced with curated
 * appreciation superlatives. This keeps the closing beat warm instead of
 * evaluative without touching the W7-owned prompt layer.
 */

export interface GroupMirrorQuestion {
  id: string;
  questionText: string;
  category: 'appreciation' | 'perception' | 'memory' | 'prediction';
}

export interface GroupMirrorAnswer {
  userId: string;
  displayName: string;
  questionId: string;
  targetUserId: string;
  reasonText?: string;
}

export interface GroupMirrorResult {
  questionId: string;
  questionText: string;
  topTargetUserId: string;
  topTargetDisplayName: string;
  voteCount: number;
  totalVotes: number;
}

export const FALLBACK_GROUP_MIRROR_QUESTIONS: GroupMirrorQuestion[] = [
  { id: 'gm_1', questionText: '今晚谁让你笑得最多、最放松？', category: 'appreciation' },
  { id: 'gm_2', questionText: '谁最会照顾到桌上每个人的感受？', category: 'appreciation' },
  { id: 'gm_3', questionText: '谁的笑容最有感染力？', category: 'appreciation' },
  { id: 'gm_4', questionText: '谁最像今晚的隐藏 MVP？', category: 'appreciation' },
  { id: 'gm_5', questionText: '谁最会接住别人抛出的梗，把气氛托起来？', category: 'appreciation' },
  { id: 'gm_6', questionText: '谁让你觉得最自在、最没有压力？', category: 'appreciation' },
  { id: 'gm_7', questionText: '谁最有可能成为大家以后还想约的人？', category: 'appreciation' },
  { id: 'gm_8', questionText: '谁今晚说的哪句话最让你印象深刻？', category: 'appreciation' },
  { id: 'gm_9', questionText: '谁最会主动把冷场悄悄救回来？', category: 'appreciation' },
  { id: 'gm_10', questionText: '谁最像会默默记住大家喜好的那种人？', category: 'appreciation' },
  { id: 'gm_11', questionText: '谁最有让人想多聊两句的好奇心？', category: 'appreciation' },
  { id: 'gm_12', questionText: '谁今晚的分享最有温度？', category: 'appreciation' },
  { id: 'gm_13', questionText: '谁最像那种低调但特别靠谱的人？', category: 'appreciation' },
  { id: 'gm_14', questionText: '谁最会鼓励别人、给别人正向反馈？', category: 'appreciation' },
  { id: 'gm_15', questionText: '谁最像会记得今晚并愿意再组局的人？', category: 'appreciation' },
];

/**
 * Passive-judgment markers. A question containing any of these frames targets a
 * person's shortcomings rather than celebrating them, so it must not close the
 * session. Kept deliberately narrow (appreciation-first) to avoid false
 * positives on playful-but-positive questions.
 */
export const GROUP_MIRROR_JUDGMENT_MARKERS: readonly string[] = [
  '最不会',
  '最不擅',
  '最不靠谱',
  '最不靠得住',
  '最尴尬',
  '最讨厌',
  '最烦',
  '最无趣',
  '最无聊',
  '最没意思',
  '最菜',
  '最差',
  '最容易翻车',
  '最该被吐槽',
  '最不想再约',
  '最敷衍',
];

/** True when a question is appreciation-only (no passive-judgment framing). */
export function isAppreciationGroupMirrorQuestion(questionText: string): boolean {
  const text = (questionText ?? '').trim();
  if (text.length === 0) return false;
  return !GROUP_MIRROR_JUDGMENT_MARKERS.some((marker) => text.includes(marker));
}

/**
 * Keep only appreciation questions and backfill from the curated bank so the
 * caller always receives up to `count` questions. Defaults to the input length,
 * so a delivery route never inflates the payload it was given. Deterministic
 * (no random shuffle) so the same input produces the same output.
 */
export function sanitizeGroupMirrorQuestions(
  questions: ReadonlyArray<GroupMirrorQuestion>,
  count: number = (questions ?? []).length,
): GroupMirrorQuestion[] {
  const target = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  if (target === 0) return [];
  const accepted: GroupMirrorQuestion[] = [];
  const seenTexts = new Set<string>();
  for (const question of questions ?? []) {
    if (!question || typeof question.questionText !== 'string') continue;
    if (!isAppreciationGroupMirrorQuestion(question.questionText)) continue;
    const key = question.questionText.trim();
    if (seenTexts.has(key)) continue;
    seenTexts.add(key);
    accepted.push(question);
    if (accepted.length >= target) return accepted;
  }
  // Backfill from the curated appreciation bank, skipping duplicates and
  // re-keying ids so downstream dedupe by id stays meaningful.
  for (const seed of FALLBACK_GROUP_MIRROR_QUESTIONS) {
    if (accepted.length >= target) break;
    const key = seed.questionText.trim();
    if (seenTexts.has(key)) continue;
    seenTexts.add(key);
    accepted.push({ ...seed, id: `gm_s_${accepted.length + 1}` });
  }
  return accepted;
}

export function getFallbackGroupMirrorQuestions(count = 5): GroupMirrorQuestion[] {
  return [...FALLBACK_GROUP_MIRROR_QUESTIONS]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((q, i) => ({ ...q, id: `gm_f_${i + 1}` }));
}
