// ============ Match Explanation 常量 ============

export const API_CONFIG = {
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  CONCURRENCY_LIMIT: 3, // Max concurrent API calls
};

export const GROUP_ANALYSIS_PROMPT_VERSION = 'group-analysis-v1';
export const PAIR_EXPLANATION_PROMPT_VERSION = 'pair-explanation-v3';
export const GROUP_ICEBREAKERS_PROMPT_VERSION = 'group-icebreakers-v1';

// Cache expiry: 7 days
export const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** 必聊项档位：三档兴趣（heat=25，见 INTEREST_HEAT_BY_LEVEL）。heatLevel 字段承载的是档位 1–3。 */
export const MUST_CHAT_HEAT_LEVEL = 3;
export const MAX_SHARED_HIGHLIGHTS = 3;
