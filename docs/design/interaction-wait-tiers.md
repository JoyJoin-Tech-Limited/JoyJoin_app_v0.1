# Interaction Wait Tiers — The 优雅等待层 Standard

**Date:** 2026-08-11 · **Status:** Active standard (M1 of the interaction-perceived-latency plan) · **Scope:** WeChat mini-program (`apps/mini-program`), all user-facing waits that cannot be eliminated

> **Dual mandate.** (1) *Perceived latency:* every tap must produce first visible feedback at the ms-level — the network may take its time, the screen never goes silent. (2) *Brand:* a wait is a JoyJoin moment, not a dead gap — warm, honest, and never louder than the task. Instrumentation from M0 (`interactionLatency`, `docs/agent-context`-adjacent M0 notes) measures these waits; this standard decides what the user *sees* while they elapse.

---

## 1. The Three Tiers

| Tier | Latency budget | Canonical treatment | Completion punctuation |
|------|---------------|---------------------|------------------------|
| **S — Instant** | < 800 ms | Micro-animation on the tapped control (state flip, pulse chip, soft pop). **Never a raw spinner.** | `haptics('success')` (or existing success haptic) + state flip |
| **M — Structured** | 0.8–4 s | Opacity-pulse skeleton matching the incoming content shape + staged honest copy. | Existing success transition + haptic |
| **L — LLM** | 1–6 s (generation) | Reuse `AiGenerationShell` (`components/ui/AiGenerationShell.tsx`) — never build bespoke LLM loaders. | `successSubtitle` + existing reveal |

**Tier assignment rule:** measure first (M0 `interactionLatency` events), then pick the tier that covers the measured p95. When the wait crosses a tier boundary, upgrade the treatment — a tier-S control that hangs for 2 s is a broken promise.

---

## 2. Hard Rules (binding)

1. **>300 ms → no bare spinner.** Any wait longer than a tap-click (~300 ms) must be a branded state: state flip, pulse chip, skeleton, or `AiGenerationShell`. The shared `Button`'s `loading` prop (dot-ellipsis) is reserved for <300 ms feedback only.
2. **No fake progress.** Stages must map to real work (e.g., "正在为你创建订单…" → "确认支付通道中…" = order creation → payment-channel confirm). Never a percentage bar for an indeterminate request.
3. **`prefers-reduced-motion` fallback required** on all new motion: static/low-opacity state, `animation: none`. See §4 for the canonical pattern per page.
4. **Haptics mandatory on completion** (`haptics('success')` per `lib/utils/haptics.ts` intensity rules). Haptics on tap stay `light`/`medium` per surface rules.
5. **Copy via `@shared/copy/*` helpers where a category exists** — `getOnboardingVoiceLine` (`packages/shared/src/copy/onboardingVoice.ts:182`), `getEmptyStateMessage` (`packages/shared/src/copy/emptyStates.ts:62`), `mascotVoice.ts` patterns. Surface-specific copy (payment, squad) lives on the page, following the same voice. **Zero emoji** on wait copy.
6. **Motion = `transform` + `opacity` only** (WeChat runtime discipline; no layout-triggering properties per frame).
7. **No new assets.** Skeleton blocks are CSS shapes; icons are CSS marks. If a mascot is wanted, reuse `getXiaoyueExpressionAsset` (existing bundled set).
8. **Never block or reorder success paths.** Wait layers are feedback-only: no state changes to the underlying flow, no server calls added, no success-path behavior altered.

---

## 3. Canonical References (file:line)

| Pattern | Where | Notes |
|---------|-------|-------|
| Micro-animation state flip | `pages/squad-unboxing/index.tsx:1377` (M1) — `锁定中` wait chip in the confirm CTA | Tier-S reference: CSS seat-mark pulse + text flip, `loading` removed |
| Instant submit flip | `pages/event-feedback/index.tsx:350` (M1) — `setSubmitted(true)` optimistic flip inside `handleSubmit`, POST in background | Tier-S reference: guard + revert-on-error preserved |
| Opacity-pulse skeleton | `pages/onboarding/profile-review/index.scss:806` (`@keyframes profile-review-pulse`, 0.55 → 1) used at `:554-585` | The canonical pulse; any new skeleton keyframes must use these exact values |
| Tier-M branded skeleton + staged copy | `pages/payments/event-ticket-payment/index.tsx:998` (M1) — order-summary skeleton during `creating` | Tier-M reference: skeleton mirrors the real card, copy stages at ~1.6 s |
| LLM generation shell | `components/ui/AiGenerationShell.tsx:17` (`AiGenerationShellProps`: `title`, `subtitle`, `successSubtitle`) | Tier-L: the only sanctioned LLM loader |
| AnalyzingAnimation min-duration | `pages/onboarding/profile-review/index.tsx:592` — `minDuration={1200}` + `onComplete` gate | Pattern: animation owns reveal timing; content shows only in `onComplete` |
| Celebration 500 ms pattern | `pages/onboarding/profile-review/index.tsx:439` — `haptics('success')` then 500 ms beat before navigation, CTA text flips (`:1009`) | Completion punctuation reference |
| Wait instrumentation | `lib/analytics/interactionLatency.ts` (M0) — `startInteraction` / `trackInteraction` | Measure each tiered wait to validate tier assignment |

---

## 4. Reduced-Motion Convention

Every page with wait motion carries a `prefers-reduced-motion: reduce` block (or the squad `--reduce-motion` modifier) that:
- kills the animation (`animation: none`),
- sets a static mid-opacity so skeleton/glow remains visible but quiet (opacity 0.6–0.75, or 1 for content-replace states like the `已提交` flip).

Reference blocks: `pages/event-feedback/index.scss:766` (`prefers-reduced-motion` block, lines 766–776), `pages/payments/event-ticket-payment/index.scss:968`, `pages/squad-unboxing/index.scss:39` (+ blanket kill list at `:3240`).

---

## 5. Applying the Standard (checklist)

- [ ] Identify the wait (tap → first visible feedback); measure with M0 `interactionLatency` if not yet measured
- [ ] Assign tier S/M/L by p95 budget; upgrade if the measured p95 crosses the boundary
- [ ] Implement feedback-only: no flow/state/server changes
- [ ] Completion haptic + state flip present
- [ ] `prefers-reduced-motion` fallback added
- [ ] No new assets, no new dependencies, no emoji
- [ ] Copy voice-checked (shared helper where category exists)
- [ ] `npm run typecheck -w mini-program`, `npm run guardrails`, `npm run audit:visual` (repo root)
