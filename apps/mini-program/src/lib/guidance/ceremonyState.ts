/**
 * Ceremony suppression registry for the guidance queue (C4 onboarding
 * guidance iteration, 2026-08-27 — sprint-contract.c4-guidance-queue, D1).
 *
 * Module-level by design: ceremony surfaces (UnboxingCeremony,
 * squad-unboxing, Flash flows, icebreaker sessions) and the queue hook live
 * in different page trees, so the suppression signal cannot ride React
 * state — it must be readable synchronously from anywhere.
 *
 * The queue hard-refuses to fire while ANY ceremony is active.
 *
 * Leak safety (D2): every ceremony surface binds `exitCeremony` to the page
 * `onUnload` lifecycle (Taro `useUnload`) in ADDITION to React effect
 * cleanup, so an abnormal teardown (crash, page destroy without unmount)
 * cannot leak ceremony state and suppress the queue app-wide forever.
 * `exitCeremony` is idempotent, so the double binding is safe.
 *
 * Balanced enter/exit is locked by guidanceQueueContract.test.ts.
 */

export const CEREMONY_IDS = {
  /** Onboarding payoff box opening (profile-review UnboxingCeremony). */
  unboxing: 'unboxing-ceremony',
  /** Post-match squad deck unboxing page. */
  squadUnboxing: 'squad-unboxing',
  /** 街头盲盒 (Flash) flows. */
  flash: 'flash-flow',
  /** Social icebreaker live session. */
  icebreakerSession: 'icebreaker-session',
} as const

export type CeremonyId = (typeof CEREMONY_IDS)[keyof typeof CEREMONY_IDS]

const activeCeremonies = new Set<string>()

export function enterCeremony(id: CeremonyId | string): void {
  activeCeremonies.add(id)
}

export function exitCeremony(id: CeremonyId | string): void {
  activeCeremonies.delete(id)
}

export function isCeremonyActive(): boolean {
  return activeCeremonies.size > 0
}

/** Test-only reset. Never call from product code. */
export function __resetCeremoniesForTests(): void {
  activeCeremonies.clear()
}
