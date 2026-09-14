import type { MatchExplanationContract, GroupAnalysisContract, OverallChemistry } from '@shared/groupAnalysis';
import type { ConnectionPointWithRarity } from '@shared/types/groupAnalysis';
import type { AIProvider, AIResponseMeta } from '@shared/types/aiMeta';

// ============ 类型定义 ============

export interface MatchMember {
  userId: string;
  displayName: string;
  archetype: string | null;
  secondaryArchetype?: string | null;
  interestsTop?: string[] | null;
  industry?: string | null;           // Display label (e.g. "科技互联网")
  hometown?: string | null;
  socialStyle?: string | null;
  // Enriched fields for connection point detection
  educationLevel?: string | null;
  relationshipStatus?: string | null;
  workMode?: string | null;
  industryCategory?: string | null;   // Category code for matching (e.g. "tech")
  industryCategoryLabel?: string | null; // Human-readable label for display (e.g. "科技互联网")
  interestsWithHeat?: Array<{ topicId: string; heatLevel: number }> | null;
  /** 用户档案默认活动意图（users.intent），可含 "flexible" */
  intent?: string[] | null;
  /** 本次活动意图（eventPoolRegistrations.eventIntent），优先于档案默认意图 */
  eventIntent?: string[] | null;
  /** Optional interest signal boost data (from user_interest_signals table) */
  interestSignals?: Array<{
    interestKey: string;
    interestLabel: string;
    enthusiasmLevel: number;       // 1–5
    discussionStyle: string;       // e.g. "character_people"
    conversationDepth: number;     // 1–3
  }> | null;
}

export interface MatchExplanation extends MatchExplanationContract {
  pairKey: string; // "userId1-userId2" 排序后的组合
  explanation: string; // 2-3句话的匹配解释
  chemistryScore: number; // 化学反应分数
  sharedInterests: string[]; // 共同兴趣
  connectionPoints: string[]; // 连接点（同乡、同行业等）
  connectionPointsWithRarity?: ConnectionPointWithRarity[]; // 带稀有度的连接点
  sharedHighlights: string[]; // 确定性共同亮点（必聊项/共同意图/同乡），无则 []
  introAngle?: string;
}

export interface GroupAnalysis extends GroupAnalysisContract {
  groupId: string;
  overallChemistry: OverallChemistry; // fire/warm/mild/cold
  groupDynamics: string; // 整体动态描述
  pairExplanations: MatchExplanation[]; // 两两配对解释
  iceBreakers: string[]; // 推荐破冰话题
  groupThemeTags: string[]; // 2–4 compact post-match theme tags
  groupThemeCompanion: string; // one short companion line
  /** true if the response was served from the DB cache */
  fromCache?: boolean;
  /** ISO-8601 timestamp of generation */
  generatedAt?: string;
  /**
   * The LLM provider used for this generation.
   * null when cached metadata is unavailable, when no model call succeeded,
   * or when different successful providers contributed to the same response.
   * Aligned with AIResponseMeta.provider.
   */
  provider?: AIProvider;
  /**
   * true if deterministic fallback content was used for any component of
   * this analysis. Aligned with AIResponseMeta.fallbackUsed.
   */
  fallbackUsed?: boolean;
  /**
   * Response-level prompt version for the group analysis contract.
   */
  promptVersion?: string;
  /** Standard AI observability metadata with AIGC compliance flags. */
  meta?: AIResponseMeta;
}
