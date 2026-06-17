import type { MiniProgramCenterState } from './centerTabRouting'

/**
 * Single source of truth for the native custom tab bar's chrome state.
 *
 * Why a singleton instead of per-page React state?
 * - The native WeChat custom-tab-bar component is owned by each tab page, but
 *   its badge/center data should be consistent across all of them.
 * - Keeping the state in a plain module avoids every tab page re-fetching the
 *   same data and re-computing center state on mount.
 * - Per-page hooks only publish "I am now visible with this tab index"; the
 *   data lives here and is pushed to the visible tab bar instance.
 */

export interface TabBadgeCounts {
  discover: number
  activities: number
  chat: number
}

export interface TabBarState {
  selected: number
  center: MiniProgramCenterState
  badges: TabBadgeCounts
}

type Listener = (state: TabBarState) => void

const DEFAULT_CENTER: MiniProgramCenterState = {
  label: '进行中',
  showBadge: false,
  action: {
    kind: 'discover',
    navigation: 'switchTab',
    url: '/pages/center-hub/index',
  },
}

let state: TabBarState = {
  selected: 0,
  center: DEFAULT_CENTER,
  badges: { discover: 0, activities: 0, chat: 0 },
}

const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener(state))
}

export function getTabBarState(): TabBarState {
  return state
}

export function subscribeTabBarState(listener: Listener): () => void {
  listeners.add(listener)
  // Eagerly emit current state so subscribers never start from a blank slate.
  listener(state)
  return () => {
    listeners.delete(listener)
  }
}

export function setTabBarSelected(selected: number): void {
  if (state.selected === selected) return
  state = { ...state, selected }
  emit()
}

function centerChanged(a: MiniProgramCenterState, b: MiniProgramCenterState): boolean {
  return (
    a.label !== b.label ||
    a.showBadge !== b.showBadge ||
    a.action.kind !== b.action.kind ||
    a.action.navigation !== b.action.navigation ||
    a.action.url !== b.action.url
  )
}

export function setTabBarCenterState(center: MiniProgramCenterState): void {
  if (!centerChanged(state.center, center)) return
  state = { ...state, center }
  emit()
}

function badgesChanged(a: TabBadgeCounts, b: TabBadgeCounts): boolean {
  return a.discover !== b.discover || a.activities !== b.activities || a.chat !== b.chat
}

export function setTabBarBadges(badges: TabBadgeCounts): void {
  if (!badgesChanged(state.badges, badges)) return
  state = { ...state, badges }
  emit()
}

/**
 * Replace the entire published state in one shot. Used when a tab page becomes
 * visible and wants to push the latest known state to the native component.
 */
export function publishTabBarState(update: Partial<TabBarState>): void {
  const next: TabBarState = {
    selected: update.selected ?? state.selected,
    center: update.center ?? state.center,
    badges: update.badges ?? state.badges,
  }
  if (
    next.selected === state.selected &&
    !centerChanged(state.center, next.center) &&
    !badgesChanged(state.badges, next.badges)
  ) {
    return
  }
  state = next
  emit()
}
