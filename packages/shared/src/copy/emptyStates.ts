/**
 * Empty State Copy — Should Follow
 *
 * Every empty state MUST include action guidance in 悦仔 Voice.
 * Never just安慰 — always give the user a next step.
 */

export type EmptySurface = 'events' | 'connections' | 'notifications' | 'messages' | 'history';

interface EmptyStateTemplate {
  /** Prompt explaining what happened */
  prompt: string;
  /** Action nudge — what the user should do next */
  action: string;
  /** Template variant with {{mascotName}} placeholder */
  promptMascot?: string;
  actionMascot?: string;
}

const EMPTY_STATE_TEMPLATES: Record<EmptySurface, EmptyStateTemplate> = {
  events: {
    prompt: '暂时还没有活动呢',
    action: '去发现页逛逛吧',
    promptMascot: '{{mascotName}}还没找到适合你的活动',
    actionMascot: '先逛逛发现页？',
  },
  connections: {
    prompt: '还没有连接呢',
    action: '参加活动认识新朋友吧',
    promptMascot: '{{mascotName}}正在等你带新朋友回来',
    actionMascot: '先去发现页挑一局活动？',
  },
  notifications: {
    prompt: '暂时没有新通知',
    action: '有动态时会通知你',
    promptMascot: '{{mascotName}}这里暂时安安静静的',
    actionMascot: '有动态第一时间告诉你~',
  },
  messages: {
    prompt: '还没有消息',
    action: '和桌友打个招呼吧',
    promptMascot: '{{mascotName}}看了又看，还没有新消息',
    actionMascot: '主动和桌友打个招呼如何？',
  },
  history: {
    prompt: '还没有历史记录',
    action: '参加一局活动吧',
    promptMascot: '{{mascotName}}翻了翻记录，还是空空的',
    actionMascot: '来一局活动吧？',
  },
};

/**
 * Get empty state copy for a given surface.
 *
 * @param surface - EmptySurface
 * @param context - Optional context
 * @param context.mascotName - Override mascot name
 * @param context.includeAction - Whether to include action text (default: true)
 * @returns Combined prompt + action string
 */
export function getEmptyStateMessage(
  surface: EmptySurface,
  context?: { mascotName?: string; includeAction?: boolean }
): string {
  const template = EMPTY_STATE_TEMPLATES[surface];
  if (!template) {
    return '暂无内容，逛逛发现页吧';
  }

  const mascotName = context?.mascotName ?? '悦仔';
  const includeAction = context?.includeAction ?? true;

  const prompt = template.promptMascot
    ? template.promptMascot.replace(/\{\{mascotName\}\}/g, mascotName)
    : template.prompt;

  if (!includeAction) {
    return prompt;
  }

  const action = template.actionMascot
    ? template.actionMascot.replace(/\{\{mascotName\}\}/g, mascotName)
    : template.action;

  return `${prompt}，${action}`;
}

/**
 * Get only the prompt portion of an empty state (for title/header use).
 */
export function getEmptyStatePrompt(
  surface: EmptySurface,
  context?: { mascotName?: string }
): string {
  return getEmptyStateMessage(surface, { ...context, includeAction: false });
}

/**
 * Get only the action portion of an empty state (for button/link use).
 */
export function getEmptyStateAction(
  surface: EmptySurface,
  context?: { mascotName?: string }
): string {
  const template = EMPTY_STATE_TEMPLATES[surface];
  if (!template) {
    return '';
  }

  const mascotName = context?.mascotName ?? '悦仔';
  const action = template.actionMascot
    ? template.actionMascot.replace(/\{\{mascotName\}\}/g, mascotName)
    : template.action;

  return action;
}
