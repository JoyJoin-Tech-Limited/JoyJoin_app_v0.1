import { XIAOYUE_CRAFT_LITE } from '../prompts/craft';
import type { MatchMember } from './types';

// ============ Prompt 构建 ============

/**
 * 构建配对解释提示词（结构化 JSON：主解释 + 开场角度）。
 */
export function buildPairExplanationPrompt(
  member1: MatchMember,
  member2: MatchMember,
  chemistryScore: number,
  sharedInterests: string[],
  connectionPoints: string[],
  sharedHighlights: string[],
): string {
  return `你是一个社交活动的匹配分析师。请用2-3句温暖、正面的话语解释为什么这两位参与者可能会聊得来。

用户A: ${member1.displayName || '神秘嘉宾'}
- 社交原型: ${member1.archetype || '未知'}
- 兴趣: ${member1.interestsTop?.slice(0, 3).join('、') || '未知'}
- 行业: ${member1.industry || '未知'}
${member1.socialStyle ? `- 社交风格: ${member1.socialStyle}` : ''}

用户B: ${member2.displayName || '神秘嘉宾'}
- 社交原型: ${member2.archetype || '未知'}
- 兴趣: ${member2.interestsTop?.slice(0, 3).join('、') || '未知'}
- 行业: ${member2.industry || '未知'}
${member2.socialStyle ? `- 社交风格: ${member2.socialStyle}` : ''}

化学反应分数: ${chemistryScore}/100
${sharedInterests.length > 0 ? `共同兴趣: ${sharedInterests.join('、')}` : ''}
${connectionPoints.length > 0 ? `连接点: ${connectionPoints.join('、')}` : ''}
${sharedHighlights.length > 0 ? `共同亮点: ${sharedHighlights.join('；')}` : ''}

${XIAOYUE_CRAFT_LITE}

请用中文，语气温暖友好，突出互补或共鸣点；不要使用「用户A/B」称呼。

输出要求：只输出**一行**合法 JSON（不要 markdown 代码块），格式如下：
{"explanation":"50-80字的解释正文","introAngle":"一句自然破冰的开场建议（≤24字）"}
explanation 为正文；introAngle 为两人见面时如何开口的一句提示。`;
}

/**
 * 构建破冰话题提示词。
 */
export function buildIceBreakersPrompt(
  eventType: string,
  archetypes: (string | null)[],
  commonInterests: string[],
  sharedSignals: string[],
): string {
  return `你是一个社交活动的破冰专家。请为这个${eventType}小组生成3-5个有趣的破冰话题。

小组成员原型: ${archetypes.join('、') || '多样化组合'}
${commonInterests.length > 0 ? `共同兴趣: ${commonInterests.join('、')}` : ''}
${sharedSignals.length > 0 ? `兴趣偏好信号（成员自填）: ${sharedSignals.join('；')}` : ''}
活动类型: ${eventType}

要求:
1. 话题要轻松有趣，适合初次见面
2. 避免敏感话题（政治、宗教、催婚催生）
3. 鼓励每个人都能参与
4. 可以结合共同兴趣或原型特点
5. 用中文回复，每个话题一行

请直接列出话题，不要加序号或前缀。`;
}
