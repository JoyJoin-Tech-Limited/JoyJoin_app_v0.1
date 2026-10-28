/**
 * Quiet Concierge activity guidance — curated event copy + deterministic
 * current/next/final session window.
 *
 * 独立模块：参照 eventFaqCopy.ts，不进 copy/ barrel；消费方直接
 *   import { buildGenericEventActivityGuide } from '@shared/copy/eventActivityGuide'
 *
 * There is deliberately no tier lookup here. event-detail has no authoritative
 * run plan, so its guide is explicitly approximate. Session guidance receives
 * an already-resolved sequence from sessionPhaseSequence; custom, empty and
 * offline inputs collapse to one honest line and never invent next/total.
 */

export interface EventActivityGuideStep {
  id: 'arrival' | 'warmup' | 'follow_cards' | 'recap';
  text: string;
}

export interface EventActivityGuideModel {
  title: string;
  summary: string;
  expandLabel: string;
  collapseLabel: string;
  approximateNote: string;
  steps: EventActivityGuideStep[];
}

const GENERIC_EVENT_GUIDE_STEPS: readonly EventActivityGuideStep[] = [
  { id: 'arrival', text: '到场入座，不用准备自我介绍' },
  { id: 'warmup', text: '话题卡暖场，想跳过也可以' },
  { id: 'follow_cards', text: '跟着卡面走，不用提前准备' },
  { id: 'recap', text: '一起回顾，不用轮流发言' },
];

/** Generic no-plan event guide. It makes no phase, next-step or total claim. */
export function buildGenericEventActivityGuide(): EventActivityGuideModel {
  return {
    title: '到了现场，今晚会怎么过？',
    summary: '到场后跟着卡面走，想跳过都可以',
    expandLabel: '具体安排',
    collapseLabel: '收起安排',
    approximateNote: '这是大致安排，现场以卡面为准',
    steps: GENERIC_EVENT_GUIDE_STEPS.map((step) => ({ ...step })),
  };
}

export type SessionActivityGuidePlanState = 'planned' | 'empty' | 'custom' | 'offline';
export type SessionActivityGuideRole = 'current' | 'next' | 'final';

export interface SessionActivityGuideItem {
  phase: string;
  current: boolean;
  role: SessionActivityGuideRole;
}

export type SessionActivityGuideModel =
  | {
      kind: 'planned';
      title: string;
      items: SessionActivityGuideItem[];
      fallbackLine: null;
    }
  | {
      kind: 'generic';
      title: string;
      items: [];
      fallbackLine: string;
    };

export interface SessionActivityGuideInput {
  currentPhase?: string | null;
  /** Authoritative ordered phases resolved from runPlan (or legacy preset). */
  orderedPhases?: readonly string[] | null;
  /** Anything other than `planned` is fail-closed to the generic one-liner. */
  planState: SessionActivityGuidePlanState;
}

export const SESSION_ACTIVITY_GUIDE_TITLE = '现在和接下来';
export const SESSION_ACTIVITY_GUIDE_FALLBACK_LINE =
  '有下一环时，跟着卡面走就好，不用提前准备';
export const SESSION_ACTIVITY_GUIDE_ROLE_LABELS: Record<SessionActivityGuideRole, string> = {
  current: '现在',
  next: '下一环',
  final: '最后',
};

/**
 * Positional role for the already-windowed list. Two items mean current/final;
 * three mean current/next/final. No phase count or plan total is exposed.
 */
export function getSessionActivityGuideRoleAt(
  index: number,
  itemCount: number,
): SessionActivityGuideRole {
  if (index === 0) return 'current';
  if (index === itemCount - 1) return 'final';
  return 'next';
}

/**
 * Keep only current, immediate next and final. The selector is shared with the
 * waiting view as a hard cap against an older caller passing a full chain.
 */
export function selectSessionActivityGuideWindow<T extends { current: boolean }>(
  items: readonly T[],
): T[] {
  if (items.length === 0) return [];
  const foundCurrent = items.findIndex((item) => item.current);
  const currentIndex = foundCurrent >= 0 ? foundCurrent : 0;
  const current = items[currentIndex];
  const next = items[currentIndex + 1];
  const final = items[items.length - 1];
  const selected: T[] = [current];
  if (next && next !== final) selected.push(next);
  if (final !== current) selected.push(final);
  return selected;
}

function buildGenericSessionGuide(): SessionActivityGuideModel {
  return {
    kind: 'generic',
    title: SESSION_ACTIVITY_GUIDE_TITLE,
    items: [],
    fallbackLine: SESSION_ACTIVITY_GUIDE_FALLBACK_LINE,
  };
}

/**
 * Build the session's current/next/final guide from a resolved run-plan order.
 * `waiting` is the real pre-start session state, so it can be current while the
 * first planned phase is next. Unknown current phases never receive a guess.
 */
export function buildSessionActivityGuide(
  input: SessionActivityGuideInput,
): SessionActivityGuideModel {
  const orderedPhases = Array.from(
    new Set(
      (input.orderedPhases ?? [])
        .map((phase) => phase.trim())
        .filter((phase) => phase.length > 0),
    ),
  );
  const currentPhase = input.currentPhase?.trim();
  if (input.planState !== 'planned' || orderedPhases.length === 0 || !currentPhase) {
    return buildGenericSessionGuide();
  }

  let candidates: Array<{ phase: string; current: boolean }>;
  if (currentPhase === 'waiting') {
    candidates = [
      { phase: 'waiting', current: true },
      ...orderedPhases.map((phase) => ({ phase, current: false })),
    ];
  } else {
    const currentIndex = orderedPhases.indexOf(currentPhase);
    if (currentIndex < 0) return buildGenericSessionGuide();
    candidates = orderedPhases.map((phase, index) => ({
      phase,
      current: index === currentIndex,
    }));
  }

  const selected = selectSessionActivityGuideWindow(candidates);
  return {
    kind: 'planned',
    title: SESSION_ACTIVITY_GUIDE_TITLE,
    fallbackLine: null,
    items: selected.map((item, index) => ({
      ...item,
      role: getSessionActivityGuideRoleAt(index, selected.length),
    })),
  };
}
