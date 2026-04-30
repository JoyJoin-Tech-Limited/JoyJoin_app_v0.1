/**
 * Group Mirror (群像镜像) — fallback questions and types
 *
 * Players anonymously vote on who best fits each question.
 * Results reveal the "group mirror" — how the group sees each other.
 */

export interface GroupMirrorQuestion {
  id: string;
  questionText: string;
  category: 'perception' | 'memory' | 'prediction';
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
  { id: 'gm_1', questionText: '谁最有可能在聚会后请大家吃夜宵？', category: 'perception' },
  { id: 'gm_2', questionText: '谁看起来最像会偷偷养猫的人？', category: 'perception' },
  { id: 'gm_3', questionText: '谁最可能在未来一年里突然辞职去旅行？', category: 'prediction' },
  { id: 'gm_4', questionText: '谁给在场大多数人的第一印象最反差？', category: 'perception' },
  { id: 'gm_5', questionText: '谁最可能是群里那个默默记住所有人喜好的角色？', category: 'perception' },
  { id: 'gm_6', questionText: '谁最像会在深夜发长篇朋友圈的人？', category: 'perception' },
  { id: 'gm_7', questionText: '谁看起来最不会做饭但最有可能在尝试？', category: 'perception' },
  { id: 'gm_8', questionText: '谁最有可能在KTV抢麦？', category: 'perception' },
  { id: 'gm_9', questionText: '谁最像是会收藏奇怪小物件的人？', category: 'perception' },
  { id: 'gm_10', questionText: '谁最可能一年后还在组织大家聚会？', category: 'prediction' },
  { id: 'gm_11', questionText: '谁看起来最冷静但内心戏最多？', category: 'perception' },
  { id: 'gm_12', questionText: '谁最像会在旅行中迷路但发现惊喜的人？', category: 'perception' },
  { id: 'gm_13', questionText: '谁最可能是那个「明明很强却很低调」的人？', category: 'perception' },
  { id: 'gm_14', questionText: '谁最有可能在聚会后写小作文复盘今晚？', category: 'perception' },
  { id: 'gm_15', questionText: '谁最像会在家里种很多植物的人？', category: 'perception' },
];

export function getFallbackGroupMirrorQuestions(count = 5): GroupMirrorQuestion[] {
  return [...FALLBACK_GROUP_MIRROR_QUESTIONS]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((q, i) => ({ ...q, id: `gm_f_${i + 1}` }));
}
