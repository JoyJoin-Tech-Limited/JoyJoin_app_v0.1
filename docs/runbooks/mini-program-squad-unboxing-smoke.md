# Mini-Program Squad Unboxing — Smoke Runbook

> **Scope:** Verify that the squad-unboxing reveal page renders correctly in every visual state (`ready`, `shaking`, `revealed`) and does not overlap fixed-stage visuals with scrollable content.
>
> **Audience:** Frontend engineers and QA validating `apps/mini-program/src/pages/squad-unboxing` in WeChat DevTools or on a real device.
>
> **Last updated:** 2026-07-09

---

## What this runbook proves

The squad-unboxing page renders a fixed-position stage (gift box, then fanned card deck) above a scrollable story. The page has three visual states and several hard-won layout constraints:

1. `ready` — white instruction card + drag-to-reveal ribbon below the gift box.
2. `shaking` — same card, no ribbon, box shakes.
3. `revealed` — header, analysis bubble, chapters, inline card detail, and action dock below the fanned deck.

This smoke proves:

1. The fixed stage **never overlaps** the scrollable content.
2. The gift box fits inside the `ready`/`shaking` stage; the fanned deck fits inside the `revealed` stage.
3. All entrance animations, haptics, and reduced-motion/degradation fallbacks work without layout regression.
4. The action dock and success overlay do not obscure the wrong layer.
5. Swipe-back re-entry resets focus, flip state, and header-ready animation correctly.

---

## Deterministic checks to run first

From the repo root:

```bash
npm run typecheck -w mini-program
npm run guardrails
npm run test -w mini-program
npm run check:package-size -w mini-program
npm run build:weapp -w mini-program
```

Expected result:

- TypeScript passes.
- Guardrails pass.
- Mini-program tests pass (550 as of 2026-07-09).
- Main package is under 2.00 MB.
- WeChat build succeeds and refreshes `apps/mini-program/dist`.

These checks catch type, import, and regression issues. The manual DevTools smoke below is **still required** to confirm runtime layout and overlap behavior.

---

## The golden rule of squad-unboxing smoke tests

> **Render the page in every state, not just the final revealed state.**
>
> The most common regression is a fixed-stage visual (gift box / deck) overlapping the scrollable story because the scroll container's `padding-top` or the stage's `height` changed. Automated tests cannot detect overlap; a WeChat DevTools preview (or real-device screenshot) is mandatory.

### Minimum states to preview

| State | How to reach | What to look for |
| --- | --- | --- |
| `ready` | Land on `pages/squad-unboxing/index` for a matched group that has not been revealed. | Gift box is tappable (`role="button"`, pressed state) and triggers reveal; white instruction card sits **below** the gift box; `DragRevealRibbon` is anchored below the box (not inside the card) and is reachable; vertical scroll works in tap-fallback / low-end mode. |
| `shaking` | Tap the gift box or drag the ribbon past 50%. | Gift box shakes; white card stays below; no overlap; ribbon is no longer mounted. |
| `revealed` | After shake completes. | Fanned deck is visible; header + analysis bubble are below the deck; scroll down to see chapters and action dock. |
| `error` | Force a failed group fetch (e.g., disconnect network or use a bad group ID). | Full-screen error state centered; CTA reachable. |
| `empty deck` | Matched group with zero members. | Empty-deck state with Xiaoyue `actionFailure` mascot; copy readable. |
| `success overlay` | Tap **确认出席**. | Success overlay covers the full screen; background interactions are disabled. |

---

## Visual checklist per state

Use the WeChat DevTools **Inspect** panel (or real-device screenshot) and confirm:

- [ ] No fixed-stage element overlaps any text, card, or tappable surface in the scrollable area.
- [ ] The gift box bottom edge aligns with the top of the scrollable story; the white card is fully below the stage.
- [ ] Tapping the gift box in `ready` state triggers the `shaking` → `revealed` flow.
- [ ] The `DragRevealRibbon` is anchored below the gift box, not inside the white copy card, and remains reachable on all screen heights.
- [ ] Drag mode blocks parent `ScrollView` scroll; tap-fallback / low-end mode allows vertical scroll.
- [ ] The fanned deck is fully inside the revealed stage; no card is clipped by the stage or the viewport.
- [ ] All tap targets (cards, drag ribbon, dismiss button, action dock buttons) are ≥ 88rpx tall and not overlapped.
- [ ] Reduced-motion preference suppresses entrance animations but preserves layout.
- [ ] Degradation-tier device (or simulated low-end) shortens transitions but preserves layout.
- [ ] On the smallest target device (iPhone SE / 375 × 667), the white card and action dock are still visible without needing to scroll.

---

## Common regression patterns to watch

| Symptom | Likely cause |
| --- | --- |
| Gift box covers the white card text | Scroll `padding-top` is too small (often overriden by `safe-area-top` mixin) or the stage `height` is too small. |
| Fanned deck is clipped at the top or bottom | `revealed` stage height is smaller than the 480rpx deck. |
| Header or analysis bubble appears behind the stage | Root `squad-unboxing--${flowState}` class is missing, so `padding-top` for that state is not applied. |
| White card is off-screen at the bottom | Stage height is too large for the ready state; reduce `clamp(420rpx, 54vh, 560rpx)` minimum. |
| Action dock overlaps content | `fixed-footer-reserve` is missing or the wrong value is used. |
| Success overlay is not full-screen | `z-index` of the overlay is lower than another fixed element. |

---

## How to simulate states in DevTools

If you cannot easily reach a state naturally:

1. **Local dev override:** add a temporary `useState` default in `useSquadUnboxingController` for the desired `flowState` (revert before commit).
2. **Mock route:** use the DevTools page-path input to enter `/pages/squad-unboxing/index?groupId=<id>` and hardcode the controller to return that state.
3. **Network / device:** disable network for the error state; use a test group with zero members for the empty deck.

---

## Sign-off

Before marking a squad-unboxing PR ready:

- [ ] Deterministic checks pass.
- [ ] DevTools preview (or real-device screenshots) attached for `ready`, `shaking`, and `revealed`.
- [ ] Visual checklist above is complete.
- [ ] No overlap, clipping, or unreachable tap targets observed.
