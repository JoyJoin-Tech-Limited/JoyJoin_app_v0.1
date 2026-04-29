/**
 * Quip Battle — Fill-in-the-Blank Comedy Phase
 *
 * Quiplash-style phase where players write funny answers to AI prompts,
 * then vote on the best. Designed for 3-8 players, 10-15 minutes.
 */

export interface QuipBattlePrompt {
  id: string;
  promptText: string;
  category: string;
}

export interface QuipBattleAnswer {
  userId: string;
  displayName: string;
  answerText: string;
  promptId: string;
}

export interface QuipBattleVote {
  voterId: string;
  answerId: string; // userId + promptId composite
  promptId: string;
}

export interface QuipBattleResult {
  promptId: string;
  promptText: string;
  answers: QuipBattleAnswer[];
  winnerUserId: string;
  winnerDisplayName: string;
  voteCount: number;
}

export interface QuipBattleState {
  prompts: QuipBattlePrompt[];
  answers: QuipBattleAnswer[];
  votes: QuipBattleVote[];
  submittedUserIds: string[];
  votedUserIds: string[];
  revealed: boolean;
  results?: QuipBattleResult[];
}

/** Curated fallback prompts when AI is unavailable */
export const QUIP_BATTLE_FALLBACK_PROMPTS: QuipBattlePrompt[] = [
  { id: 'qb_fb_1', promptText: '如果_____有段位，你已经是王者了', category: '自嘲' },
  { id: 'qb_fb_2', promptText: '你最离谱的一次_____经历', category: '生活' },
  { id: 'qb_fb_3', promptText: '如果今天能重来，你最想_____', category: '幻想' },
  { id: 'qb_fb_4', promptText: '你觉得自己最像哪种_____，为什么', category: '比喻' },
  { id: 'qb_fb_5', promptText: '用三个字形容你现在的_____状态', category: '状态' },
  { id: 'qb_fb_6', promptText: '如果突然变成_____，第一件事做什么', category: '脑洞' },
  { id: 'qb_fb_7', promptText: '你最想对十年前的自己说_____', category: '时光' },
  { id: 'qb_fb_8', promptText: '用一句话证明你是_____', category: '身份' },
  { id: 'qb_fb_9', promptText: '如果你有一千万，但只能用来_____', category: '假设' },
  { id: 'qb_fb_10', promptText: '你最离谱的_____借口', category: '社死' },
  { id: 'qb_fb_11', promptText: '如果_____会说话，它第一句会说什么', category: '拟人' },
  { id: 'qb_fb_12', promptText: '用三个字让在场所有人_____', category: '互动' },
  { id: 'qb_fb_13', promptText: '你最想删掉的_____记录', category: '秘密' },
  { id: 'qb_fb_14', promptText: '如果突然失忆，你最不想忘记_____', category: '情感' },
  { id: 'qb_fb_15', promptText: '你最_____的一次外卖经历', category: '生活' },
  { id: 'qb_fb_16', promptText: '如果_____是你的超能力，你会怎么用它', category: '脑洞' },
  { id: 'qb_fb_17', promptText: '你最尴尬的_____瞬间', category: '社死' },
  { id: 'qb_fb_18', promptText: '用一句话形容你今天的_____', category: '状态' },
  { id: 'qb_fb_19', promptText: '如果_____有声音，你的会是什么', category: '比喻' },
  { id: 'qb_fb_20', promptText: '你最想对_____说的一句吐槽', category: '吐槽' },
];

/** Get N random curated prompts */
export function getRandomQuipBattlePrompts(count: number = 3): QuipBattlePrompt[] {
  const shuffled = [...QUIP_BATTLE_FALLBACK_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((p, i) => ({
    ...p,
    id: `${p.id}_${i}`,
  }));
}

/** Build composite answer ID from userId + promptId */
export function buildAnswerId(userId: string, promptId: string): string {
  return `${userId}::${promptId}`;
}

/** Parse composite answer ID */
export function parseAnswerId(answerId: string): { userId: string; promptId: string } {
  const [userId, promptId] = answerId.split('::');
  return { userId: userId || '', promptId: promptId || '' };
}
