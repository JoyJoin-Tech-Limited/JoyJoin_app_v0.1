import { TIER_RUN_PLANS } from '@shared/socialIcebreakerRunPlans'
import { CUSTOM_GAME_OPTIONS } from '../tier-selector/customGameSelection'

/**
 * 环节时长预期模型（2026-10-20 P2 #4，spec §环节时长）— 「约 N 分钟」。
 *
 * 数据源的数值会漂移：TIER_RUN_PLANS 的静态 allocatedMinutes 与服务端
 * 编译产物（runPlanService：模板编译、mini_script 追加、lie_detective 按
 *  roster 上调）并不恒等；CUSTOM_GAME_OPTIONS 又是自定义局的第三套数。
 * 因此消费顺序固定为：
 *   1. session state 的 compiled runPlan.segments[].allocatedMinutes（权威；
 *      Wave 2 进度 chip 已消费同一字段）；
 *   2. 静态 tier plan（TIER_RUN_PLANS[eventTier]）；
 *   3. CUSTOM_GAME_OPTIONS.minutes（自定义局 / mini_script 等静态补丁）。
 * 均不可得 → null（不渲染时长，绝不编造）。
 *
 * 展示纪律：文案一律带「约」（PM 修正版——不做局内实时倒计时/剩余时间，
 * 时长只是预期，不是承诺）。
 *
 * 通道说明（车道约束）：PhaseIntroOverlay 由 index.tsx 挂载且该文件冻结，
 * WaitingPhase 的 prop 链同样不在本车道——因此本模块提供一个极薄的
 * module-level snapshot，由 useIcebreakerSessionAnalytics 在 index.tsx 每次
 * render 时同步（hooks 先于子组件 render，读取方永远拿到当帧最新值），
 * 页面卸载时清理。纯函数部分（resolve*）无 Taro / React 依赖，可单测。
 */

export interface PhaseDurationSource {
  runPlan?: {
    segments?: ReadonlyArray<{
      phase: string
      allocatedMinutes?: number | null
    }> | null
  } | null
  eventTier?: string | null
}

/** Meta/transitional states never carry a duration expectation. */
const NON_GAME_PHASES: ReadonlySet<string> = new Set([
  'waiting',
  'ended',
  'phase_selection',
])

function resolvePositiveMinutes(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null
}

/**
 * Resolve the expected minutes for one phase. Pure; priority per the module
 * header (compiled run plan → static tier plan → custom game options).
 */
export function resolvePhaseDurationMinutes(
  source: PhaseDurationSource | null | undefined,
  phase: string,
): number | null {
  if (!phase || NON_GAME_PHASES.has(phase)) return null

  const compiled = source?.runPlan?.segments?.find(
    (segment) => segment.phase === phase,
  )
  const compiledMinutes = resolvePositiveMinutes(compiled?.allocatedMinutes)
  if (compiledMinutes !== null) return compiledMinutes

  const tierPlan = source?.eventTier ? TIER_RUN_PLANS[source.eventTier] : undefined
  const tierSegment = tierPlan?.segments.find((segment) => segment.phase === phase)
  const tierMinutes = resolvePositiveMinutes(tierSegment?.allocatedMinutes)
  if (tierMinutes !== null) return tierMinutes

  const customOption = CUSTOM_GAME_OPTIONS.find((option) => option.phase === phase)
  return customOption ? customOption.minutes : null
}

/** 「约 N 分钟」— the only sanctioned rendering (always approximate). */
export function formatApproxPhaseDuration(minutes: number): string {
  return `约${Math.round(minutes)}分钟`
}

/** One-call convenience: source + phase → 「约N分钟」 or null. */
export function resolveApproxPhaseDurationLabel(
  source: PhaseDurationSource | null | undefined,
  phase: string,
): string | null {
  const minutes = resolvePhaseDurationMinutes(source, phase)
  return minutes === null ? null : formatApproxPhaseDuration(minutes)
}

// ── Module snapshot channel (see header for the lane rationale) ──────────

let currentSource: PhaseDurationSource | null = null

/**
 * Idempotently publish the session's duration source for this render pass.
 * Called from useIcebreakerSessionAnalytics' render body (the same hook that
 * already derives session-level analytics from the polled state).
 */
export function syncPhaseDurationSource(
  session: PhaseDurationSource | null | undefined,
): void {
  currentSource = session
    ? {
        runPlan: session.runPlan ?? null,
        eventTier: session.eventTier ?? null,
      }
    : null
}

/** Clear on page unmount so a stacked page never reads a foreign session. */
export function clearPhaseDurationSource(): void {
  currentSource = null
}

/**
 * Snapshot-first label resolver for UI surfaces. When the snapshot is absent
 * (unit tests, standalone renders), callers may pass a static fallback (e.g.
 * WaitingPhase's `{ eventTier: currentTier }`). With NO snapshot and NO
 * fallback the answer is null — never price a phase with zero session
 * context (CUSTOM_GAME_OPTIONS alone is the drift-prone source for phases
 * that also live in tier plans).
 */
export function getApproxPhaseDurationLabel(
  phase: string,
  fallbackSource?: PhaseDurationSource,
): string | null {
  const source = currentSource ?? fallbackSource ?? null
  if (source === null) return null
  return resolveApproxPhaseDurationLabel(source, phase)
}
