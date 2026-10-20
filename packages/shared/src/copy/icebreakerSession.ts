/**
 * Icebreaker session copy — Wave 2「定向与减负」术语收敛与壳层定向文案
 * (sprint icebreaker-uiux-wave2, contract AC-01/02/03/13/15, plan #2/#3/#4/#34/#38).
 *
 * surface: 'social-icebreaker' session shell + phase views
 * toneMode: 'yuezai-voice' — warm, orientation-first, zero internal jargon.
 *
 * 🔴 Hard constraints:
 * - Internal machine vocabulary NEVER reaches user-visible copy: no 「深度·L2」
 *   level stamps, no 「节奏球」, no 「开场包」, no 「抓马」, no auction 「标」,
 *   no internal metrics like 「胜率」.
 * - WeChat review posture: no 匹配/社交/灵魂/撮合/AI in any visible string.
 * - Machine identifiers (phase ids, storage keys) stay in code; ONLY display
 *   strings live here.
 */

// ─── 环节进度 chip（AC-01）───────────────────────────────────────────────

/** 常驻环节进度 chip：「第 2/5 环 · 谎言侦探」。 */
export function formatIcePhaseProgress(index1Based: number, total: number, phaseLabel: string): string {
  return `第 ${index1Based}/${total} 环 · ${phaseLabel}`
}

/** 自由局（无既定环节序列）的弱进度 chip：只报当前环节名。 */
export function formatIcePhaseProgressLoose(phaseLabel: string): string {
  return `进行中 · ${phaseLabel}`
}

// ─── 入场环节地图（AC-02/AC-13，两态共用同一数据源）────────────────────────

/** 环节地图分隔符（如「话题卡 → 挑战 → 回顾」）。 */
export const ICE_PHASE_MAP_ARROW = '→'

/** waiting 玩家版明示文案（AC-13）：空档期的安心说明。 */
export const ICE_WAITING_FOR_HOST_LINE = '等主持人开场，先和同桌打个招呼'

// ─── host 菜单与模式 caption（AC-03）──────────────────────────────────────

/** host 菜单触发器文字 pill 前缀（后接 ⋯ 图形符号）。 */
export const ICE_HOST_MENU_PILL_LABEL = '主持人'

/** ActionSheet 行瘦身：当前模式信息移壳层 caption，菜单行只留动作。 */
export const ICE_HOST_MENU_CHANGE_TIER = '更换模式'

/** 壳层模式 caption 连接符：「深度畅聊 · 60min」。 */
export function formatIceModeCaption(title: string, duration?: string): string {
  return duration ? `${title} · ${duration}` : title
}

// ─── 术语收敛（AC-15 六项）────────────────────────────────────────────────

/** #38-3 「开场包」→「悦仔开场提示」（等待屏 host 生成按钮）。 */
export function formatIceOpeningPackButton(mascotDisplayName: string): string {
  return `${mascotDisplayName}开场提示`
}

/** AIGC 反馈 reason（开场提示）：术语同步，非主文案。 */
export const ICE_AIGC_REASON_OPENING_PACK = 'AI 生成开场提示/主持提示'

/** #38-4 「抓马」→「推理」（同桌工具卡徽标）。 */
export const ICE_TOOL_BADGE_MINI_SCRIPT = '推理'

/** #38-5 拍卖「标」→「拍品」。 */
export function formatIceAuctionLotPosition(index0Based: number, total: number): string {
  return `第 ${index0Based + 1} / ${total} 拍品`
}

/** host 落槌按钮（拍品术语）。 */
export const ICE_AUCTION_CLOSE_LOT = '关闭本拍品（落槌）'

/** #38-2 「节奏球」→ 用户语言（micro_challenge 点按引导）。 */
export const ICE_MICRO_TAP_HINT = '跟着节奏点一点，和大家一起完成'

/** #38-6 「悦仔胜率」→ 用户语言（recap 分享行 + 数据卡）。 */
export function formatIceLieFooledLine(count: number): string {
  return `悦仔骗过全场 ${count} 次`
}

// ─── P0 补1/补4 host 开场提词 + 新人一句规则（2026-10-20）─────────────────
// PhaseIntroOverlay 只在 ritual phase（mini_script / recap）出现，所以只需
// 这两个环节的策展文案；零 LLM、零 emoji、微信审核姿态（无社交/匹配/灵魂词）。
// 「你可以这样说：」「一句话规则：」前缀由渲染层拼接，此处只放口语正文。

/** 补1: host 专属开场提词正文（1 句，悦仔温暖口语）。 */
const ICE_HOST_PHASE_PROMPT_BY_PHASE: Partial<Record<string, string>> = {
  mini_script: '接下来我们演一出小戏，每个人都拿到了自己的角色，跟着每幕的提示往下走就好',
  recap: '今晚大家都很棒，我们一起回头看看这一桌的高光时刻',
}

/** 补1: host 提词渲染前缀。 */
export const ICE_HOST_PHASE_PROMPT_PREFIX = '你可以这样说：'

export function getIceHostPhasePrompt(phase: string): string | null {
  return ICE_HOST_PHASE_PROMPT_BY_PHASE[phase] ?? null
}

/** 补4: 首次参会的一句规则正文（每 phase 一句，一次性展示）。 */
const ICE_PHASE_ONE_LINE_RULE_BY_PHASE: Partial<Record<string, string>> = {
  mini_script: '拿到角色先别声张，跟着每幕的提示往下演',
  recap: '这是今晚的回顾环节，看看自己的高光，也为同桌喝彩',
}

/** 补4: 一句规则渲染前缀。 */
export const ICE_PHASE_ONE_LINE_RULE_PREFIX = '一句话规则：'

export function getIcePhaseOneLineRule(phase: string): string | null {
  return ICE_PHASE_ONE_LINE_RULE_BY_PHASE[phase] ?? null
}
