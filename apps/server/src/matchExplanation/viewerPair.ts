import type { GroupAnalysis, MatchExplanation } from './types';

// ============ 查看者配对辅助函数 ============

/**
 * 返回与特定查看者相关的所有配对解释。
 * 
 * pairKey 格式为 sorted([userId1, userId2]).join('-')，因此查看者的 userId
 * 要么作为前缀（排序在前），要么作为后缀（排序在后）出现。
 * 通过 startsWith / endsWith 检测边界，避免子字符串误匹配
 * （UUID 自身含有短横线，不能直接使用 String.prototype.includes）。
 * 
 * @param analysis  generateGroupAnalysis() 返回的 GroupAnalysis 对象
 * @param viewerUserId  当前请求用户的 userId
 * @returns 包含该用户的所有配对解释（0 到 n-1 条）
 */
export function getPairExplanationForUser(
  analysis: GroupAnalysis,
  viewerUserId: string
): MatchExplanation[] {
  if (!viewerUserId) return [];
  return analysis.pairExplanations.filter(exp => {
    const key = exp.pairKey;
    // The viewer's ID appears as prefix (sorted first) or suffix (sorted second)
    return key.startsWith(viewerUserId + '-') || key.endsWith('-' + viewerUserId);
  });
}
